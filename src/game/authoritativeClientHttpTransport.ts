import type {
  AuthoritativeClientCommandResponse,
  AuthoritativeClientErrorCode,
  AuthoritativeClientProjectionResponse,
  AuthoritativeClientTransport,
} from './authoritativeClient.js';
import { isGameProjectionWire } from './projectionWire.js';
import type { GameCommandEnvelope } from './protocol.js';
import { validateGameCommandEnvelope } from './protocol.js';

export const AUTHORITATIVE_CLIENT_MAX_RESPONSE_BYTES = 256 * 1024;

export interface AuthoritativeClientHttpTransportOptions {
  commandUrl: string;
  projectionUrl: string;
  getAccessToken: (signal?: AbortSignal) => Promise<string | null>;
  fetcher?: typeof fetch;
  maxResponseBytes?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[^\s,]{1,8192}$/;
const ERROR_CODES = new Set<AuthoritativeClientErrorCode>([
  'multiplayer_disabled',
  'unauthorized',
  'not_participant',
  'invalid_command',
  'version_conflict',
  'rule_violation',
  'match_not_playable',
  'deadline_expired',
  'internal_error',
  'origin_not_allowed',
  'method_not_allowed',
  'unsupported_media_type',
  'payload_too_large',
  'invalid_json',
  'rate_limited',
  'operation_timeout',
  'invalid_match_id',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};

const prepareEndpoint = (raw: string, label: string): URL => {
  if (raw.length > 2_048) throw new Error(`${label} URL is too long.`);
  const url = new URL(raw);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.origin === 'null'
  ) {
    throw new Error(`${label} must be an HTTPS URL without credentials, query, or hash.`);
  }
  return url;
};

type BoundedJsonResult = { ok: true; value: unknown } | { ok: false };

const readBoundedJson = async (response: Response, maxBytes: number): Promise<BoundedJsonResult> => {
  const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return { ok: false };
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxBytes) return { ok: false };
  }
  if (!response.body) return { ok: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel('response_too_large');
        return { ok: false };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (!text) return { ok: false };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }
};

const invalidResponse = (operation: 'command' | 'projection') => ({
  status: 'rejected' as const,
  code: 'invalid_response' as const,
  message: `The authoritative ${operation} response was invalid.`,
});

const unauthorized = () => ({
  status: 'rejected' as const,
  code: 'unauthorized' as const,
  message: 'A current authenticated session is required.',
});

const parseRetryAfter = (response: Response): number | undefined => {
  const value = Number(response.headers.get('Retry-After'));
  return Number.isSafeInteger(value) && value >= 1 && value <= 86_400 ? value : undefined;
};

const parseRejection = (
  value: unknown,
  response: Response,
): Extract<AuthoritativeClientCommandResponse, { status: 'rejected' }> | null => {
  if (
    response.ok
    || !isRecord(value)
    || !hasOnlyKeys(value, [
      'status',
      'code',
      'message',
      'requestId',
      'commandId',
      'currentVersion',
      'projection',
    ])
    || value.status !== 'rejected'
    || typeof value.code !== 'string'
    || !ERROR_CODES.has(value.code as AuthoritativeClientErrorCode)
    || typeof value.message !== 'string'
    || value.message.length < 1
    || value.message.length > 1_024
    || (value.commandId !== undefined && (
      typeof value.commandId !== 'string' || !UUID_PATTERN.test(value.commandId)
    ))
    || (value.currentVersion !== undefined && (
      !Number.isSafeInteger(value.currentVersion) || Number(value.currentVersion) < 0
    ))
    || (value.projection !== undefined && !isGameProjectionWire(value.projection))
  ) return null;

  const result: Extract<AuthoritativeClientCommandResponse, { status: 'rejected' }> = {
    status: 'rejected',
    code: value.code as AuthoritativeClientErrorCode,
    message: value.message,
  };
  if (typeof value.commandId === 'string') result.commandId = value.commandId;
  if (typeof value.currentVersion === 'number') result.currentVersion = value.currentVersion;
  if (isGameProjectionWire(value.projection)) result.projection = structuredClone(value.projection);
  if (result.code === 'rate_limited') result.retryAfterSeconds = parseRetryAfter(response);
  return result;
};

const parseCommandResponse = (
  value: unknown,
  response: Response,
): AuthoritativeClientCommandResponse | null => {
  if (isRecord(value) && value.status === 'rejected') return parseRejection(value, response);
  if (
    response.status !== 200
    || !isRecord(value)
    || !hasOnlyKeys(value, [
      'status',
      'commandId',
      'stateVersion',
      'eventSequence',
      'projection',
      'requestId',
    ])
    || (value.status !== 'accepted' && value.status !== 'duplicate')
    || typeof value.commandId !== 'string'
    || !UUID_PATTERN.test(value.commandId)
    || !Number.isSafeInteger(value.stateVersion)
    || Number(value.stateVersion) < 0
    || !Number.isSafeInteger(value.eventSequence)
    || Number(value.eventSequence) < 0
    || !isGameProjectionWire(value.projection)
  ) return null;
  return {
    status: value.status,
    commandId: value.commandId,
    stateVersion: Number(value.stateVersion),
    eventSequence: Number(value.eventSequence),
    projection: structuredClone(value.projection),
  };
};

const parseProjectionRejection = (
  value: unknown,
  response: Response,
): Extract<AuthoritativeClientProjectionResponse, { status: 'rejected' }> | null => {
  if (
    response.ok
    || !isRecord(value)
    || !hasOnlyKeys(value, ['status', 'code', 'message', 'requestId'])
    || value.status !== 'rejected'
    || typeof value.code !== 'string'
    || !ERROR_CODES.has(value.code as AuthoritativeClientErrorCode)
    || typeof value.message !== 'string'
    || value.message.length < 1
    || value.message.length > 1_024
  ) return null;
  const result: Extract<AuthoritativeClientProjectionResponse, { status: 'rejected' }> = {
    status: 'rejected',
    code: value.code as AuthoritativeClientErrorCode,
    message: value.message,
  };
  if (result.code === 'rate_limited') result.retryAfterSeconds = parseRetryAfter(response);
  return result;
};

export class AuthoritativeClientHttpTransport implements AuthoritativeClientTransport {
  private readonly commandUrl: URL;
  private readonly projectionUrl: URL;
  private readonly getAccessToken: AuthoritativeClientHttpTransportOptions['getAccessToken'];
  private readonly fetcher: typeof fetch;
  private readonly maxResponseBytes: number;

  constructor(options: AuthoritativeClientHttpTransportOptions) {
    this.commandUrl = prepareEndpoint(options.commandUrl, 'Command endpoint');
    this.projectionUrl = prepareEndpoint(options.projectionUrl, 'Projection endpoint');
    if (this.commandUrl.origin !== this.projectionUrl.origin) {
      throw new Error('Authoritative command and projection endpoints must share one origin.');
    }
    this.getAccessToken = options.getAccessToken;
    this.fetcher = options.fetcher ?? fetch;
    this.maxResponseBytes = options.maxResponseBytes ?? AUTHORITATIVE_CLIENT_MAX_RESPONSE_BYTES;
    if (
      !Number.isSafeInteger(this.maxResponseBytes)
      || this.maxResponseBytes < 1_024
      || this.maxResponseBytes > 1024 * 1024
    ) {
      throw new Error('Authoritative response limit must be between 1024 and 1048576 bytes.');
    }
  }

  async sendCommand(
    envelope: GameCommandEnvelope,
    signal?: AbortSignal,
  ): Promise<AuthoritativeClientCommandResponse> {
    const validation = validateGameCommandEnvelope(envelope);
    if (!validation.valid) throw new Error(`Invalid authoritative command envelope: ${validation.reason}`);
    const token = await this.freshToken(signal);
    if (!token) return unauthorized();

    const response = await this.fetcher(this.commandUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validation.value),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal,
    });
    const parsed = await readBoundedJson(response, this.maxResponseBytes);
    if (!parsed.ok) return invalidResponse('command');
    return parseCommandResponse(parsed.value, response) ?? invalidResponse('command');
  }

  async readProjection(
    matchId: string,
    signal?: AbortSignal,
  ): Promise<AuthoritativeClientProjectionResponse> {
    if (!UUID_PATTERN.test(matchId)) throw new Error('Projection matchId must be a UUID.');
    const token = await this.freshToken(signal);
    if (!token) return unauthorized();

    const url = new URL(this.projectionUrl);
    url.searchParams.set('matchId', matchId);
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal,
    });
    const parsed = await readBoundedJson(response, this.maxResponseBytes);
    if (!parsed.ok) return invalidResponse('projection');
    if (isRecord(parsed.value) && parsed.value.status === 'rejected') {
      return parseProjectionRejection(parsed.value, response) ?? invalidResponse('projection');
    }
    if (
      response.status !== 200
      || !isRecord(parsed.value)
      || !hasOnlyKeys(parsed.value, ['status', 'projection', 'requestId'])
      || parsed.value.status !== 'ok'
      || !isGameProjectionWire(parsed.value.projection)
    ) return invalidResponse('projection');
    return { status: 'ok', projection: structuredClone(parsed.value.projection) };
  }

  private async freshToken(signal?: AbortSignal): Promise<string | null> {
    try {
      const token = await this.getAccessToken(signal);
      return token && TOKEN_PATTERN.test(token) ? token : null;
    } catch {
      if (signal?.aborted) throw signal.reason;
      return null;
    }
  }
}
