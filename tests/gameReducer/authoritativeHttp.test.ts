import { describe, expect, it, vi } from 'vitest';
import { InMemoryAuthoritativeGameExecutor } from '../../src/game/authoritativeExecutor.js';
import { createAuthoritativeCommandHttpHandler } from '../../src/game/authoritativeHttp.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const ALLOWED_ORIGIN = 'https://wisdomduel.mythicalbeings.io';
const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';

const commandId = (index: number) => (
  `018f2f9a-4e1c-7b8a-8f2c-${index.toString(16).padStart(12, '0')}`
);

const envelope = (
  index: number,
  expectedVersion = 0,
  command: GameCommandEnvelope['command'] = { type: 'rotate_creature', creatureId: 'lafaic' },
): GameCommandEnvelope => ({
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId: MATCH_ID,
  commandId: commandId(index),
  expectedVersion,
  command,
});

const createState = () => {
  const state = initializeGame({
    gameId: MATCH_ID,
    player1Id: 'player-1',
    player2Id: 'player-2',
    player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
    player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
  }, createGameRandomState('55'.repeat(32)));
  state.players[0].hand.push(state.knowledgeDeck.shift()!);
  state.players[1].hand.push(state.knowledgeDeck.shift()!);
  return state;
};

const commandRequest = (
  body: unknown,
  options: {
    authorization?: string | null;
    contentType?: string | null;
    method?: string;
    origin?: string | null;
    rawBody?: string;
  } = {},
) => {
  const headers = new Headers();
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? 'Bearer token-player-1');
  }
  if (options.contentType !== null) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }
  if (options.origin !== null) headers.set('Origin', options.origin ?? ALLOWED_ORIGIN);
  return new Request('https://example.supabase.co/functions/v1/wisdom-duel-command', {
    method: options.method ?? 'POST',
    headers,
    body: ['GET', 'HEAD'].includes(options.method ?? '')
      ? undefined
      : options.rawBody ?? JSON.stringify(body),
  });
};

type CommandJsonResponse = {
  status?: string;
  code?: string;
  stateVersion?: number;
  eventSequence?: number;
  currentVersion?: number;
  projection?: {
    players: Array<{
      hand: { visibility: string; count: number };
    }>;
  };
};

const json = async (response: Response) => response.json() as Promise<CommandJsonResponse>;

const createHarness = (options: {
  releaseEnabled?: boolean;
  rateAllowed?: boolean;
} = {}) => {
  const executor = new InMemoryAuthoritativeGameExecutor({
    enabled: true,
    now: () => new Date('2026-08-28T12:00:00.000Z'),
  });
  const state = createState();
  const opponentCardId = state.players[1].hand[0].instanceId!;
  const privateSeed = state.privateRandom!.seedHex;
  executor.registerMatch(state);

  const authenticateBearerToken = vi.fn(async (token: string) => ({
    'token-player-1': 'player-1',
    'token-player-2': 'player-2',
    'token-intruder': 'intruder',
  })[token] ?? null);
  const checkRateLimit = vi.fn(async () => ({
    allowed: options.rateAllowed !== false,
    retryAfterSeconds: 7,
  }));
  const handler = createAuthoritativeCommandHttpHandler({
    isReleaseEnabled: () => options.releaseEnabled !== false,
    allowedOrigins: [ALLOWED_ORIGIN, 'https://mythical-mvp.netlify.app'],
    authenticateBearerToken,
    checkRateLimit,
    executeCommand: (actorId, body) => executor.execute(actorId, body),
    createRequestId: () => 'request-test-1',
  });

  return { handler, executor, authenticateBearerToken, checkRateLimit, opponentCardId, privateSeed };
};

describe('authoritative command HTTP boundary', () => {
  it('refuses wildcard CORS configuration at construction time', () => {
    expect(() => createAuthoritativeCommandHttpHandler({
      isReleaseEnabled: () => true,
      allowedOrigins: ['*'],
      authenticateBearerToken: async () => 'player-1',
      checkRateLimit: async () => ({ allowed: true }),
      executeCommand: () => ({
        status: 'rejected',
        code: 'internal_error',
        message: 'unused',
      }),
    })).toThrow('cannot use a wildcard CORS origin');
  });

  it('answers an allowed CORS preflight without authentication', async () => {
    const { handler, authenticateBearerToken } = createHarness();
    const response = await handler(commandRequest(null, {
      authorization: null,
      contentType: null,
      method: 'OPTIONS',
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(authenticateBearerToken).not.toHaveBeenCalled();
  });

  it('checks the default-off release gate before auth or body parsing', async () => {
    const { handler, authenticateBearerToken, checkRateLimit } = createHarness({ releaseEnabled: false });
    const response = await handler(commandRequest(null, { rawBody: '{invalid' }));

    expect(response.status).toBe(503);
    expect(await json(response)).toMatchObject({ status: 'rejected', code: 'multiplayer_disabled' });
    expect(authenticateBearerToken).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('rejects disallowed origins without reflecting their value', async () => {
    const { handler } = createHarness();
    const response = await handler(commandRequest(envelope(1), { origin: 'https://attacker.example' }));

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(await json(response)).toMatchObject({ code: 'origin_not_allowed' });
  });

  it('requires JSON, a bounded body, and a validated bearer token', async () => {
    const { handler, authenticateBearerToken } = createHarness();

    const noAuth = await handler(commandRequest(envelope(1), { authorization: null }));
    expect(noAuth.status).toBe(401);
    expect(await json(noAuth)).toMatchObject({ code: 'unauthorized' });

    const wrongMedia = await handler(commandRequest(envelope(1), { contentType: 'text/plain' }));
    expect(wrongMedia.status).toBe(415);
    expect(await json(wrongMedia)).toMatchObject({ code: 'unsupported_media_type' });

    const oversized = await handler(commandRequest(null, { rawBody: JSON.stringify({ value: 'x'.repeat(17 * 1024) }) }));
    expect(oversized.status).toBe(413);
    expect(await json(oversized)).toMatchObject({ code: 'payload_too_large' });
    expect(authenticateBearerToken).not.toHaveBeenCalled();

    const invalidToken = await handler(commandRequest(envelope(1), { authorization: 'Bearer invalid-token' }));
    expect(invalidToken.status).toBe(401);
    expect(await json(invalidToken)).toMatchObject({ code: 'unauthorized' });
    expect(authenticateBearerToken).toHaveBeenCalledWith(
      'invalid-token',
      expect.any(Request),
      expect.any(AbortSignal),
    );
  });

  it('rejects malformed UTF-8 before authentication', async () => {
    const { handler, authenticateBearerToken } = createHarness();
    const response = await handler(new Request(
      'https://example.supabase.co/functions/v1/wisdom-duel-command',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-player-1',
          'Content-Type': 'application/json',
          Origin: ALLOWED_ORIGIN,
        },
        body: new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d]),
      },
    ));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_json' });
    expect(authenticateBearerToken).not.toHaveBeenCalled();
  });

  it('derives identity, commits once, and returns only the actor projection', async () => {
    const { handler, executor, opponentCardId, privateSeed } = createHarness();

    const acceptedResponse = await handler(commandRequest(envelope(1)));
    const accepted = await json(acceptedResponse);
    const duplicateResponse = await handler(commandRequest(envelope(1)));
    const duplicate = await json(duplicateResponse);
    const serialized = JSON.stringify(accepted);

    expect(acceptedResponse.status).toBe(200);
    expect(accepted).toMatchObject({ status: 'accepted', stateVersion: 1, eventSequence: 1 });
    expect(accepted.projection!.players[0].hand).toMatchObject({ visibility: 'visible', count: 1 });
    expect(accepted.projection!.players[1].hand).toEqual({ visibility: 'hidden', count: 1 });
    expect(serialized).not.toContain(opponentCardId);
    expect(serialized).not.toContain(privateSeed);
    expect(acceptedResponse.headers.get('Cache-Control')).toBe('no-store');
    expect(acceptedResponse.headers.get('X-Request-Id')).toBe('request-test-1');
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate).toMatchObject({ status: 'duplicate', stateVersion: 1, eventSequence: 1 });
    expect(executor.exportEventsForReplay(MATCH_ID)).toHaveLength(1);
  });

  it('rejects injected identity, outsiders, and out-of-turn actors without a commit', async () => {
    const injectedHarness = createHarness();
    const injected = await injectedHarness.handler(commandRequest({
      ...envelope(1),
      playerId: 'player-2',
    }));
    expect(injected.status).toBe(400);
    expect(await json(injected)).toMatchObject({ code: 'invalid_command' });
    expect(injectedHarness.executor.exportEventsForReplay(MATCH_ID)).toEqual([]);

    const outsiderHarness = createHarness();
    const outsider = await outsiderHarness.handler(commandRequest(envelope(2), {
      authorization: 'Bearer token-intruder',
    }));
    expect(outsider.status).toBe(403);
    expect(await json(outsider)).toMatchObject({ code: 'not_participant' });

    const turnHarness = createHarness();
    const outOfTurn = await turnHarness.handler(commandRequest(envelope(3), {
      authorization: 'Bearer token-player-2',
    }));
    expect(outOfTurn.status).toBe(422);
    expect(await json(outOfTurn)).toMatchObject({ code: 'rule_violation' });
    expect(turnHarness.executor.exportEventsForReplay(MATCH_ID)).toEqual([]);
  });

  it('maps CAS conflicts to HTTP 409 with the current private projection', async () => {
    const { handler, executor } = createHarness();
    expect((await json(await handler(commandRequest(envelope(1))))).status).toBe('accepted');

    const conflictResponse = await handler(commandRequest(envelope(2, 0, {
      type: 'rotate_creature',
      creatureId: 'adaro',
    })));
    const conflict = await json(conflictResponse);

    expect(conflictResponse.status).toBe(409);
    expect(conflict).toMatchObject({ code: 'version_conflict', currentVersion: 1 });
    expect(conflict.projection!.players[0].hand.visibility).toBe('visible');
    expect(conflict.projection!.players[1].hand.visibility).toBe('hidden');
    expect(executor.exportEventsForReplay(MATCH_ID)).toHaveLength(1);
  });

  it('requires an explicit successful rate-limit decision before execution', async () => {
    const { handler, executor } = createHarness({ rateAllowed: false });
    const response = await handler(commandRequest(envelope(1)));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('7');
    expect(await json(response)).toMatchObject({ code: 'rate_limited' });
    expect(executor.exportEventsForReplay(MATCH_ID)).toEqual([]);
  });

  it('awaits an asynchronous durable executor before answering', async () => {
    const executeCommand = vi.fn(async () => ({
      status: 'accepted' as const,
      commandId: commandId(1),
      stateVersion: 1,
      eventSequence: 1,
      projection: { stateVersion: 1 },
    }));
    const operationSink = vi.fn(async () => undefined);
    const monotonicNow = vi.fn().mockReturnValueOnce(20).mockReturnValue(27);
    const handler = createAuthoritativeCommandHttpHandler({
      isReleaseEnabled: () => true,
      allowedOrigins: [ALLOWED_ORIGIN],
      authenticateBearerToken: async () => 'player-1',
      checkRateLimit: async () => ({ allowed: true }),
      executeCommand,
      createRequestId: () => 'request-async-1',
      operationSink,
      operationNow: () => new Date('2026-08-28T12:00:00.000Z'),
      monotonicNow,
    });

    const response = await handler(commandRequest(envelope(1)));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: 'accepted', stateVersion: 1 });
    expect(executeCommand).toHaveBeenCalledOnce();
    expect(operationSink).toHaveBeenCalledWith({
      schemaVersion: 'wisdom-duel-operation-v1',
      operation: 'command',
      outcome: 'accepted',
      durationMs: 7,
      occurredAt: '2026-08-28T12:00:00.000Z',
      requestId: 'request-async-1',
      stateVersion: 1,
    });
    expect(JSON.stringify(operationSink.mock.calls)).not.toMatch(/token-player-1|rotate_creature|lafaic/);
  });

  it('fails closed on the total operation budget and preserves the retry commandId', async () => {
    let executionSignal: AbortSignal | undefined;
    const handler = createAuthoritativeCommandHttpHandler({
      isReleaseEnabled: () => true,
      allowedOrigins: [ALLOWED_ORIGIN],
      authenticateBearerToken: async () => 'player-1',
      checkRateLimit: async () => ({ allowed: true }),
      executeCommand: (_actorId, _body, signal) => {
        executionSignal = signal;
        return new Promise(() => undefined);
      },
      createRequestId: () => 'request-timeout-1',
      operationTimeoutMs: 10,
    });

    const response = await handler(commandRequest(envelope(9)));
    expect(response.status).toBe(504);
    expect(await json(response)).toMatchObject({
      status: 'rejected',
      code: 'operation_timeout',
      message: expect.stringContaining('same commandId'),
    });
    expect(executionSignal?.aborted).toBe(true);
  });
});
