import {
  AuthoritativeHttpOperationTimeoutError,
  awaitAuthoritativeDependency,
  createAuthoritativeOperationSignal,
  createAuthoritativeHttpResponseContext,
  parseAuthoritativeBearerToken,
  prepareAuthoritativeAllowedOrigins,
  validateAuthoritativeOperationTimeout,
} from './authoritativeHttpShared.js';
import {
  emitAuthoritativeOperationSafely,
  type AuthoritativeOperationOutcome,
  type AuthoritativeOperationSink,
} from './authoritativeOperations.js';

export type AuthoritativeProjectionTransportCode =
  | 'origin_not_allowed'
  | 'method_not_allowed'
  | 'invalid_match_id'
  | 'unauthorized'
  | 'rate_limited'
  | 'operation_timeout'
  | 'match_not_playable'
  | 'internal_error';

export type AuthoritativeProjectionReadResult<TProjection> =
  | { status: 'ok'; projection: TProjection }
  | {
      status: 'rejected';
      code: 'match_not_playable' | 'internal_error';
      message: string;
    };

export interface AuthoritativeProjectionHttpDependencies<TProjection> {
  isReleaseEnabled: () => boolean;
  allowedOrigins: readonly string[];
  authenticateBearerToken: (
    token: string,
    request: Request,
    signal?: AbortSignal,
  ) => Promise<string | null>;
  checkRateLimit: (
    actorId: string,
    request: Request,
    signal?: AbortSignal,
  ) => Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
  readProjection: (
    actorId: string,
    matchId: string,
    signal?: AbortSignal,
  ) => Promise<AuthoritativeProjectionReadResult<TProjection>>;
  createRequestId?: () => string;
  operationSink?: AuthoritativeOperationSink;
  operationNow?: () => Date;
  monotonicNow?: () => number;
  operationTimeoutMs?: number;
}

type ProjectionTransportError = {
  status: 'rejected';
  code: AuthoritativeProjectionTransportCode | 'multiplayer_disabled';
  message: string;
  requestId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAuthoritativeProjectionHttpHandler<TProjection>(
  dependencies: AuthoritativeProjectionHttpDependencies<TProjection>,
) {
  const allowedOrigins = prepareAuthoritativeAllowedOrigins(dependencies.allowedOrigins);
  const createRequestId = dependencies.createRequestId ?? (() => crypto.randomUUID());
  const operationNow = dependencies.operationNow ?? (() => new Date());
  const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
  const operationTimeoutMs = validateAuthoritativeOperationTimeout(
    dependencies.operationTimeoutMs ?? 5_000,
  );

  return async (request: Request): Promise<Response> => {
    const requestId = createRequestId();
    const startedAt = monotonicNow();
    const responseContext = createAuthoritativeHttpResponseContext(
      request,
      allowedOrigins,
      requestId,
      ['GET'],
    );

    const respond = async (
      body: unknown,
      status: number,
      outcome: AuthoritativeOperationOutcome,
      extraHeaders?: HeadersInit,
      stateVersion?: number,
    ) => {
      await emitAuthoritativeOperationSafely(dependencies.operationSink, {
        operation: 'projection_read',
        outcome,
        durationMs: Math.max(0, monotonicNow() - startedAt),
        occurredAt: operationNow().toISOString(),
        requestId,
        stateVersion,
      });
      return responseContext.jsonResponse(body, status, extraHeaders);
    };

    const transportError = (
      code: ProjectionTransportError['code'],
      message: string,
      status: number,
      outcome: AuthoritativeOperationOutcome = 'rejected',
      extraHeaders?: HeadersInit,
    ) => respond(
      { status: 'rejected', code, message, requestId } satisfies ProjectionTransportError,
      status,
      outcome,
      extraHeaders,
    );

    if (!responseContext.originAllowed) {
      return transportError('origin_not_allowed', 'Request origin is not allowed.', 403);
    }
    if (request.method === 'OPTIONS') return responseContext.emptyResponse(204);
    if (request.method !== 'GET') {
      return transportError('method_not_allowed', 'Only GET is supported.', 405, 'rejected', {
        Allow: 'GET, OPTIONS',
      });
    }
    if (!dependencies.isReleaseEnabled()) {
      return transportError(
        'multiplayer_disabled',
        'Multiplayer is not available in this release.',
        503,
        'disabled',
      );
    }
    const operationSignal = createAuthoritativeOperationSignal(request, operationTimeoutMs);

    const url = new URL(request.url);
    const queryKeys = [...url.searchParams.keys()];
    const matchIds = url.searchParams.getAll('matchId');
    if (
      queryKeys.length !== 1
      || queryKeys[0] !== 'matchId'
      || matchIds.length !== 1
      || !UUID_PATTERN.test(matchIds[0])
    ) {
      return transportError('invalid_match_id', 'A single valid matchId is required.', 400);
    }
    const matchId = matchIds[0];

    const token = parseAuthoritativeBearerToken(request.headers.get('Authorization'));
    if (!token) return transportError('unauthorized', 'A valid bearer token is required.', 401);

    let actorId: string | null;
    try {
      actorId = await awaitAuthoritativeDependency(
        dependencies.authenticateBearerToken(token, request, operationSignal),
        operationSignal,
      );
    } catch (error) {
      if (error instanceof AuthoritativeHttpOperationTimeoutError) {
        return transportError(
          'operation_timeout',
          'The request exceeded its processing time budget.',
          504,
          'timeout',
        );
      }
      return transportError('internal_error', 'Authentication could not be completed.', 500, 'internal_error');
    }
    if (!actorId) return transportError('unauthorized', 'A valid bearer token is required.', 401);

    let rateLimit: { allowed: boolean; retryAfterSeconds?: number };
    try {
      rateLimit = await awaitAuthoritativeDependency(
        dependencies.checkRateLimit(actorId, request, operationSignal),
        operationSignal,
      );
    } catch (error) {
      if (error instanceof AuthoritativeHttpOperationTimeoutError) {
        return transportError(
          'operation_timeout',
          'The request exceeded its processing time budget.',
          504,
          'timeout',
        );
      }
      return transportError(
        'internal_error',
        'Rate-limit verification could not be completed.',
        500,
        'internal_error',
      );
    }
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, Math.floor(rateLimit.retryAfterSeconds ?? 1));
      return transportError('rate_limited', 'Too many requests. Retry later.', 429, 'rate_limited', {
        'Retry-After': String(retryAfter),
      });
    }

    let result: AuthoritativeProjectionReadResult<TProjection>;
    try {
      result = await awaitAuthoritativeDependency(
        dependencies.readProjection(actorId, matchId, operationSignal),
        operationSignal,
      );
    } catch (error) {
      if (error instanceof AuthoritativeHttpOperationTimeoutError) {
        return transportError(
          'operation_timeout',
          'The request exceeded its processing time budget.',
          504,
          'timeout',
        );
      }
      return transportError(
        'internal_error',
        'The match projection could not be loaded safely.',
        500,
        'internal_error',
      );
    }
    if (result.status === 'rejected') {
      return result.code === 'match_not_playable'
        ? transportError('match_not_playable', result.message, 404)
        : transportError('internal_error', result.message, 500, 'internal_error');
    }

    const stateVersion = (
      result.projection
      && typeof result.projection === 'object'
      && 'stateVersion' in result.projection
      && Number.isSafeInteger(result.projection.stateVersion)
    ) ? Number(result.projection.stateVersion) : undefined;
    return respond(
      { status: 'ok', projection: result.projection, requestId },
      200,
      'accepted',
      undefined,
      stateVersion,
    );
  };
}
