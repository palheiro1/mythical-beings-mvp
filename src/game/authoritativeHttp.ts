import type { GameCommandResult } from './protocol.js';
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

export const AUTHORITATIVE_COMMAND_MAX_BODY_BYTES = 16 * 1024;

export type AuthoritativeTransportErrorCode =
  | 'origin_not_allowed'
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'invalid_json'
  | 'unauthorized'
  | 'rate_limited'
  | 'operation_timeout'
  | 'internal_error';

export interface AuthoritativeCommandHttpDependencies<TProjection = unknown> {
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
  executeCommand: (
    actorId: string,
    body: unknown,
    signal?: AbortSignal,
  ) => GameCommandResult<TProjection> | Promise<GameCommandResult<TProjection>>;
  createRequestId?: () => string;
  maxBodyBytes?: number;
  operationSink?: AuthoritativeOperationSink;
  operationNow?: () => Date;
  monotonicNow?: () => number;
  operationTimeoutMs?: number;
  createOperationSignal?: (request: Request, timeoutMs: number) => AbortSignal;
}

type TransportError = {
  status: 'rejected';
  code: AuthoritativeTransportErrorCode;
  message: string;
  requestId: string;
};

const GAME_REJECTION_HTTP_STATUS: Record<
  Extract<GameCommandResult, { status: 'rejected' }>['code'],
  number
> = {
  multiplayer_disabled: 503,
  unauthorized: 401,
  not_participant: 403,
  invalid_command: 400,
  version_conflict: 409,
  rule_violation: 422,
  match_not_playable: 409,
  deadline_expired: 409,
  internal_error: 500,
};

type BoundedBodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'invalid_utf8' | 'payload_too_large' };

const readBoundedUtf8Body = async (
  request: Request,
  maxBodyBytes: number,
): Promise<BoundedBodyReadResult> => {
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteCount = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteCount += value.byteLength;
      if (byteCount > maxBodyBytes) {
        await reader.cancel('payload_too_large');
        return { ok: false, reason: 'payload_too_large' };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'invalid_utf8' };
  } finally {
    reader.releaseLock();
  }
};

export function createAuthoritativeCommandHttpHandler<TProjection = unknown>(
  dependencies: AuthoritativeCommandHttpDependencies<TProjection>,
) {
  const allowedOrigins = prepareAuthoritativeAllowedOrigins(dependencies.allowedOrigins);
  const maxBodyBytes = dependencies.maxBodyBytes ?? AUTHORITATIVE_COMMAND_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error('maxBodyBytes must be a positive safe integer.');
  }

  const createRequestId = dependencies.createRequestId ?? (() => crypto.randomUUID());
  const operationNow = dependencies.operationNow ?? (() => new Date());
  const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
  const operationTimeoutMs = validateAuthoritativeOperationTimeout(
    dependencies.operationTimeoutMs ?? 5_000,
  );
  const createOperationSignal = dependencies.createOperationSignal
    ?? createAuthoritativeOperationSignal;

  return async (request: Request): Promise<Response> => {
    const requestId = createRequestId();
    const startedAt = monotonicNow();
    const responseContext = createAuthoritativeHttpResponseContext(
      request,
      allowedOrigins,
      requestId,
      ['POST'],
    );
    const { originAllowed } = responseContext;

    const respond = async (
      body: unknown,
      status: number,
      outcome: AuthoritativeOperationOutcome,
      extraHeaders?: HeadersInit,
      stateVersion?: number,
    ) => {
      await emitAuthoritativeOperationSafely(dependencies.operationSink, {
        operation: 'command',
        outcome,
        durationMs: Math.max(0, monotonicNow() - startedAt),
        occurredAt: operationNow().toISOString(),
        requestId,
        stateVersion,
      });
      return responseContext.jsonResponse(body, status, extraHeaders);
    };

    const transportError = (
      code: AuthoritativeTransportErrorCode,
      message: string,
      status: number,
      outcome: AuthoritativeOperationOutcome = 'rejected',
      extraHeaders?: HeadersInit,
    ) => respond(
      { status: 'rejected', code, message, requestId } satisfies TransportError,
      status,
      outcome,
      extraHeaders,
    );

    if (!originAllowed) {
      return transportError('origin_not_allowed', 'Request origin is not allowed.', 403);
    }

    if (request.method === 'OPTIONS') {
      return responseContext.emptyResponse(204);
    }

    if (request.method !== 'POST') {
      return transportError('method_not_allowed', 'Only POST is supported.', 405, 'rejected', {
        Allow: 'POST, OPTIONS',
      });
    }

    // The release gate deliberately precedes authentication, body parsing, and any future data access.
    if (!dependencies.isReleaseEnabled()) {
      return respond({
        status: 'rejected',
        code: 'multiplayer_disabled',
        message: 'Multiplayer is not available in this release.',
        requestId,
      }, 503, 'disabled');
    }
    const operationSignal = createOperationSignal(request, operationTimeoutMs);

    const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') {
      return transportError('unsupported_media_type', 'Content-Type must be application/json.', 415);
    }

    const declaredLength = request.headers.get('Content-Length');
    if (declaredLength) {
      const parsedLength = Number(declaredLength);
      if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > maxBodyBytes) {
        return transportError('payload_too_large', 'Request body is too large.', 413);
      }
    }

    let bodyRead: BoundedBodyReadResult;
    try {
      bodyRead = await readBoundedUtf8Body(request, maxBodyBytes);
    } catch {
      return transportError('invalid_json', 'Request body could not be read.', 400);
    }
    if (!bodyRead.ok) {
      return bodyRead.reason === 'payload_too_large'
        ? transportError('payload_too_large', 'Request body is too large.', 413)
        : transportError('invalid_json', 'Request body must use valid UTF-8.', 400);
    }

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
      return transportError(
        'internal_error',
        'Authentication could not be completed.',
        500,
        'internal_error',
      );
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
      return transportError('rate_limited', 'Too many commands. Retry later.', 429, 'rate_limited', {
        'Retry-After': String(retryAfter),
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyRead.text);
    } catch {
      return transportError('invalid_json', 'Request body must contain valid JSON.', 400);
    }

    let result: GameCommandResult<TProjection>;
    try {
      result = await awaitAuthoritativeDependency(
        Promise.resolve(dependencies.executeCommand(actorId, body, operationSignal)),
        operationSignal,
      );
    } catch (error) {
      if (error instanceof AuthoritativeHttpOperationTimeoutError) {
        return transportError(
          'operation_timeout',
          'The request exceeded its processing time budget. Retry with the same commandId.',
          504,
          'timeout',
        );
      }
      return transportError(
        'internal_error',
        'The command could not be processed safely.',
        500,
        'internal_error',
      );
    }

    const status = result.status === 'rejected'
      ? GAME_REJECTION_HTTP_STATUS[result.code]
      : 200;
    let outcome: AuthoritativeOperationOutcome;
    if ('code' in result) {
      outcome = result.code === 'version_conflict'
        ? 'conflict'
        : result.code === 'multiplayer_disabled'
          ? 'disabled'
          : result.code === 'internal_error'
            ? 'internal_error'
            : 'rejected';
    } else {
      outcome = result.status;
    }
    const stateVersion = result.status === 'rejected'
      ? result.currentVersion
      : result.stateVersion;
    return respond({ ...result, requestId }, status, outcome, undefined, stateVersion);
  };
}
