import { describe, expect, it } from 'vitest';
import { createAuthoritativeCommandHttpHandler } from '../../src/game/authoritativeHttp.js';
import type { AuthoritativeOperationEvent } from '../../src/game/authoritativeOperations.js';
import { TransactionalInMemoryAuthoritativeStore } from '../../src/game/authoritativePersistence.js';
import { createAuthoritativeProjectionHttpHandler } from '../../src/game/authoritativeProjectionHttp.js';
import {
  createFailClosedAuthoritativeRateLimitCheck,
  TransactionalInMemoryRateLimitStore,
} from '../../src/game/authoritativeRateLimit.js';
import { DurableAuthoritativeCommandService } from '../../src/game/durableAuthoritativeService.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const ALLOWED_ORIGIN = 'https://wisdomduel.mythicalbeings.io';
const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
const PRIVATE_SEED = 'ab'.repeat(32);

const commandId = (index: number) => (
  `018f2f9a-4e1c-7b8a-8f2c-${index.toString(16).padStart(12, '0')}`
);

const envelope = (
  index: number,
  creatureId = 'lafaic',
): GameCommandEnvelope => ({
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId: MATCH_ID,
  commandId: commandId(index),
  expectedVersion: 0,
  command: { type: 'rotate_creature', creatureId },
});

const commandRequest = (body: unknown, token = 'token-player-1') => new Request(
  'https://example.supabase.co/functions/v1/wisdom-duel-command',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: ALLOWED_ORIGIN,
    },
    body: JSON.stringify(body),
  },
);

const projectionRequest = (token = 'token-player-1') => new Request(
  `https://example.supabase.co/functions/v1/wisdom-duel-projection?matchId=${MATCH_ID}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: ALLOWED_ORIGIN,
    },
  },
);

const responseJson = async (response: Response): Promise<Record<string, unknown>> => (
  response.json() as Promise<Record<string, unknown>>
);

const createHarness = (options: { maxRequests?: number } = {}) => {
  const persistence = new TransactionalInMemoryAuthoritativeStore();
  const state = initializeGame({
    gameId: MATCH_ID,
    player1Id: PLAYER_1_ID,
    player2Id: PLAYER_2_ID,
    player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
    player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
  }, createGameRandomState(PRIVATE_SEED));
  state.players[0].hand.push(state.knowledgeDeck.shift()!);
  state.players[1].hand.push(state.knowledgeDeck.shift()!);
  const rivalCardId = state.players[1].hand[0].instanceId!;
  persistence.registerMatch(state, {
    seedCommitment: 'cd'.repeat(32),
    turnDeadline: '2026-08-28T12:02:00.000Z',
  });

  const quotaStore = new TransactionalInMemoryRateLimitStore();
  const checkRateLimit = createFailClosedAuthoritativeRateLimitCheck({
    store: quotaStore,
    keySalt: 'integration-only-rate-limit-salt',
    policy: {
      windows: [{ durationMs: 60_000, maxRequests: options.maxRequests ?? 100 }],
    },
    now: () => Date.parse('2026-08-28T12:00:00.000Z'),
  });
  const authenticateBearerToken = async (token: string) => ({
    'token-player-1': PLAYER_1_ID,
    'token-player-2': PLAYER_2_ID,
    'token-outsider': '018f2f9a-4e1c-7b8a-8f2c-0242ac120005',
  })[token] ?? null;
  const operations: Readonly<AuthoritativeOperationEvent>[] = [];
  let requestSequence = 0;
  const createRequestId = () => `integration-${requestSequence += 1}`;
  const service = () => new DurableAuthoritativeCommandService({
    enabled: true,
    persistence,
    now: () => new Date('2026-08-28T12:00:30.000Z'),
    turnDurationSeconds: 120,
  });

  const createCommandHandler = (
    commandService = service(),
    executeCommand: Parameters<typeof createAuthoritativeCommandHttpHandler>[0]['executeCommand']
      = (actorId, body) => commandService.execute(actorId, body),
    operationTimeoutMs = 1_000,
    createOperationSignal?: Parameters<
      typeof createAuthoritativeCommandHttpHandler
    >[0]['createOperationSignal'],
  ) => createAuthoritativeCommandHttpHandler({
    isReleaseEnabled: () => true,
    allowedOrigins: [ALLOWED_ORIGIN],
    authenticateBearerToken,
    checkRateLimit,
    executeCommand,
    createRequestId,
    operationSink: (event) => { operations.push(event); },
    operationNow: () => new Date('2026-08-28T12:00:30.000Z'),
    monotonicNow: () => 10,
    operationTimeoutMs,
    createOperationSignal,
  });
  const createProjectionHandler = (commandService = service()) => (
    createAuthoritativeProjectionHttpHandler({
      isReleaseEnabled: () => true,
      allowedOrigins: [ALLOWED_ORIGIN],
      authenticateBearerToken,
      checkRateLimit,
      readProjection: (actorId, matchId) => commandService.readPlayerProjection(actorId, matchId),
      createRequestId,
      operationSink: (event) => { operations.push(event); },
      operationNow: () => new Date('2026-08-28T12:00:30.000Z'),
      monotonicNow: () => 10,
      operationTimeoutMs: 1_000,
    })
  );

  return {
    persistence,
    quotaStore,
    operations,
    rivalCardId,
    service,
    createCommandHandler,
    createProjectionHandler,
  };
};

describe('authoritative in-memory vertical stack', () => {
  it('commits through HTTP and reconnects through another instance with a private projection', async () => {
    const harness = createHarness();
    const commandHandler = harness.createCommandHandler(harness.service());
    const projectionHandler = harness.createProjectionHandler(harness.service());

    const commandResponse = await commandHandler(commandRequest(envelope(1)));
    const commandBody = await responseJson(commandResponse);
    const projectionResponse = await projectionHandler(projectionRequest());
    const projectionBody = await responseJson(projectionResponse);
    const serializedResponses = JSON.stringify([commandBody, projectionBody]);

    expect(commandResponse.status).toBe(200);
    expect(commandBody).toMatchObject({
      status: 'accepted',
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(projectionResponse.status).toBe(200);
    expect(projectionBody).toMatchObject({
      status: 'ok',
      projection: {
        stateVersion: 1,
        eventSequence: 1,
        players: [
          { id: PLAYER_1_ID, hand: { visibility: 'visible', count: 1 } },
          { id: PLAYER_2_ID, hand: { visibility: 'hidden', count: 1 } },
        ],
      },
    });
    expect(serializedResponses).not.toContain(PRIVATE_SEED);
    expect(serializedResponses).not.toContain(harness.rivalCardId);
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
    expect(harness.operations.map((event) => [event.operation, event.outcome])).toEqual([
      ['command', 'accepted'],
      ['projection_read', 'accepted'],
    ]);
    expect(JSON.stringify(harness.operations)).not.toMatch(
      new RegExp(`token-player|${PLAYER_1_ID}|${PLAYER_2_ID}|${MATCH_ID}|${PRIVATE_SEED}`),
    );
  });

  it('recovers a committed command as duplicate after a controlled HTTP timeout signal', async () => {
    const harness = createHarness();
    const firstService = harness.service();
    const retryService = harness.service();
    const timeoutController = new AbortController();
    let confirmCommit = () => undefined;
    const committed = new Promise<void>((resolve) => { confirmCommit = resolve; });
    const lostResponseHandler = harness.createCommandHandler(
      firstService,
      async (actorId, body) => {
        await firstService.execute(actorId, body);
        confirmCommit();
        return new Promise(() => undefined);
      },
      1_000,
      () => timeoutController.signal,
    );
    const retryHandler = harness.createCommandHandler(retryService);
    const command = envelope(2);

    const timedOutResponsePromise = lostResponseHandler(commandRequest(command));
    await committed;
    timeoutController.abort();
    const timedOutResponse = await timedOutResponsePromise;
    const timedOutBody = await responseJson(timedOutResponse);
    const retryResponse = await retryHandler(commandRequest(command));
    const retryBody = await responseJson(retryResponse);

    expect(timedOutResponse.status).toBe(504);
    expect(timedOutBody).toMatchObject({ status: 'rejected', code: 'operation_timeout' });
    expect(retryResponse.status).toBe(200);
    expect(retryBody).toMatchObject({
      status: 'duplicate',
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
    expect(harness.operations.map((event) => event.outcome)).toEqual(['timeout', 'duplicate']);
  });

  it('allows one HTTP winner for a shared version and returns a refreshable conflict', async () => {
    const harness = createHarness();
    const handlerA = harness.createCommandHandler(harness.service());
    const handlerB = harness.createCommandHandler(harness.service());

    const responses = await Promise.all([
      handlerA(commandRequest(envelope(3, 'lafaic'))),
      handlerB(commandRequest(envelope(4, 'adaro'))),
    ]);
    const bodies = await Promise.all(responses.map(responseJson));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(bodies.map((body) => body.status).sort()).toEqual(['accepted', 'rejected']);
    expect(bodies.find((body) => body.status === 'rejected')).toMatchObject({
      code: 'version_conflict',
      currentVersion: 1,
      projection: { stateVersion: 1 },
    });
    expect(harness.persistence.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });

  it('shares hashed actor quota across independent projection handlers', async () => {
    const harness = createHarness({ maxRequests: 2 });
    const handlerA = harness.createProjectionHandler(harness.service());
    const handlerB = harness.createProjectionHandler(harness.service());

    const first = await handlerA(projectionRequest());
    const second = await handlerB(projectionRequest());
    const limited = await handlerA(projectionRequest());

    expect([first.status, second.status, limited.status]).toEqual([200, 200, 429]);
    expect(await responseJson(limited)).toMatchObject({
      status: 'rejected',
      code: 'rate_limited',
    });
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(harness.quotaStore.readHashedKeysForTest()).toHaveLength(1);
    expect(harness.quotaStore.readHashedKeysForTest()[0]).not.toContain(PLAYER_1_ID);
    expect(harness.operations.map((event) => event.outcome)).toEqual([
      'accepted',
      'accepted',
      'rate_limited',
    ]);
  });
});
