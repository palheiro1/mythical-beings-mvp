import { describe, expect, it, vi } from 'vitest';
import { createAuthoritativeProjectionHttpHandler } from '../../src/game/authoritativeProjectionHttp.js';

const ALLOWED_ORIGIN = 'https://wisdomduel.mythicalbeings.io';
const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';

const projection = {
  stateVersion: 4,
  players: [
    { id: 'player-1', hand: { visibility: 'visible', count: 1, cards: [{ id: 'safe-card' }] } },
    { id: 'player-2', hand: { visibility: 'hidden', count: 2 } },
  ],
};

const projectionRequest = (options: {
  authorization?: string | null;
  method?: string;
  origin?: string | null;
  query?: string;
} = {}) => {
  const headers = new Headers();
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? 'Bearer private-token');
  }
  if (options.origin !== null) headers.set('Origin', options.origin ?? ALLOWED_ORIGIN);
  return new Request(
    `https://example.supabase.co/functions/v1/wisdom-duel-projection${options.query ?? `?matchId=${MATCH_ID}`}`,
    { method: options.method ?? 'GET', headers },
  );
};

const createHarness = (options: {
  enabled?: boolean;
  rateAllowed?: boolean;
  readResult?: { status: 'ok'; projection: typeof projection } | {
    status: 'rejected';
    code: 'match_not_playable' | 'internal_error';
    message: string;
  };
} = {}) => {
  const authenticateBearerToken = vi.fn(async (token: string) => (
    token === 'private-token' ? 'player-private-id' : null
  ));
  const checkRateLimit = vi.fn(async () => ({
    allowed: options.rateAllowed !== false,
    retryAfterSeconds: 9,
  }));
  const readProjection = vi.fn(async () => options.readResult ?? ({ status: 'ok' as const, projection }));
  const operationSink = vi.fn(async () => undefined);
  const monotonicNow = vi.fn()
    .mockReturnValueOnce(10)
    .mockReturnValue(14);
  const handler = createAuthoritativeProjectionHttpHandler({
    isReleaseEnabled: () => options.enabled !== false,
    allowedOrigins: [ALLOWED_ORIGIN],
    authenticateBearerToken,
    checkRateLimit,
    readProjection,
    createRequestId: () => 'projection-request-1',
    operationSink,
    operationNow: () => new Date('2026-08-28T12:00:00.000Z'),
    monotonicNow,
  });
  return {
    handler,
    authenticateBearerToken,
    checkRateLimit,
    readProjection,
    operationSink,
  };
};

describe('authoritative projection HTTP boundary', () => {
  it('answers allowed preflight without authentication or telemetry', async () => {
    const { handler, authenticateBearerToken, operationSink } = createHarness();
    const response = await handler(projectionRequest({
      authorization: null,
      method: 'OPTIONS',
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(authenticateBearerToken).not.toHaveBeenCalled();
    expect(operationSink).not.toHaveBeenCalled();
  });

  it('checks the release gate before query validation, auth, rate limit, or data', async () => {
    const harness = createHarness({ enabled: false });
    const response = await harness.handler(projectionRequest({ query: '?forged=true' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'multiplayer_disabled' });
    expect(harness.authenticateBearerToken).not.toHaveBeenCalled();
    expect(harness.checkRateLimit).not.toHaveBeenCalled();
    expect(harness.readProjection).not.toHaveBeenCalled();
  });

  it('rejects disallowed origins, methods, and ambiguous queries', async () => {
    const harness = createHarness();
    const disallowed = await harness.handler(projectionRequest({ origin: 'https://attacker.test' }));
    expect(disallowed.status).toBe(403);
    expect(disallowed.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const wrongMethod = await harness.handler(projectionRequest({ method: 'POST' }));
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('Allow')).toBe('GET, OPTIONS');

    const duplicate = await harness.handler(projectionRequest({
      query: `?matchId=${MATCH_ID}&matchId=${MATCH_ID}`,
    }));
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toMatchObject({ code: 'invalid_match_id' });

    const extra = await harness.handler(projectionRequest({
      query: `?matchId=${MATCH_ID}&actorId=forged`,
    }));
    expect(extra.status).toBe(400);
    expect(harness.readProjection).not.toHaveBeenCalled();
  });

  it('requires a revalidated JWT and a positive quota decision', async () => {
    const harness = createHarness({ rateAllowed: false });
    const noToken = await harness.handler(projectionRequest({ authorization: null }));
    expect(noToken.status).toBe(401);

    const badToken = await harness.handler(projectionRequest({ authorization: 'Bearer invalid' }));
    expect(badToken.status).toBe(401);

    const limited = await harness.handler(projectionRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('9');
    expect(harness.readProjection).not.toHaveBeenCalled();
  });

  it('returns the private projection and emits only sanitized operational fields', async () => {
    const harness = createHarness();
    const response = await harness.handler(projectionRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBe('projection-request-1');
    expect(body).toMatchObject({
      status: 'ok',
      projection: {
        stateVersion: 4,
        players: [
          { hand: { visibility: 'visible', count: 1 } },
          { hand: { visibility: 'hidden', count: 2 } },
        ],
      },
    });
    expect(harness.readProjection).toHaveBeenCalledWith(
      'player-private-id',
      MATCH_ID,
      expect.any(AbortSignal),
    );
    expect(harness.operationSink).toHaveBeenCalledWith({
      schemaVersion: 'wisdom-duel-operation-v1',
      operation: 'projection_read',
      outcome: 'accepted',
      durationMs: 4,
      occurredAt: '2026-08-28T12:00:00.000Z',
      requestId: 'projection-request-1',
      stateVersion: 4,
    });
    expect(JSON.stringify(harness.operationSink.mock.calls)).not.toMatch(
      /private-token|player-private-id|safe-card|018f2f9a/,
    );
  });

  it('uses the same opaque not-found response for unavailable projections', async () => {
    const harness = createHarness({
      readResult: {
        status: 'rejected',
        code: 'match_not_playable',
        message: 'The match is not available.',
      },
    });
    const response = await harness.handler(projectionRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      status: 'rejected',
      code: 'match_not_playable',
      message: 'The match is not available.',
    });
  });

  it('times out a stalled projection store without returning partial data', async () => {
    let readSignal: AbortSignal | undefined;
    const handler = createAuthoritativeProjectionHttpHandler({
      isReleaseEnabled: () => true,
      allowedOrigins: [ALLOWED_ORIGIN],
      authenticateBearerToken: async () => 'player-private-id',
      checkRateLimit: async () => ({ allowed: true }),
      readProjection: (_actorId, _matchId, signal) => {
        readSignal = signal;
        return new Promise(() => undefined);
      },
      createRequestId: () => 'projection-timeout-1',
      operationTimeoutMs: 10,
    });

    const response = await handler(projectionRequest());
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      status: 'rejected',
      code: 'operation_timeout',
    });
    expect(readSignal?.aborted).toBe(true);
  });
});
