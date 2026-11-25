import { describe, expect, it, vi } from 'vitest';
import { AuthoritativeGameClient } from '../../src/game/authoritativeClient.js';
import { AuthoritativeClientHttpTransport } from '../../src/game/authoritativeClientHttpTransport.js';
import { createAuthoritativeCommandHttpHandler } from '../../src/game/authoritativeHttp.js';
import type { AuthoritativeOperationEvent } from '../../src/game/authoritativeOperations.js';
import { TransactionalInMemoryAuthoritativeStore } from '../../src/game/authoritativePersistence.js';
import { createAuthoritativeProjectionHttpHandler } from '../../src/game/authoritativeProjectionHttp.js';
import {
  createFailClosedAuthoritativeRateLimitCheck,
  TransactionalInMemoryRateLimitStore,
} from '../../src/game/authoritativeRateLimit.js';
import { DurableAuthoritativeCommandService } from '../../src/game/durableAuthoritativeService.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const APP_ORIGIN = 'https://wisdomduel.mythicalbeings.io';
const EDGE_ORIGIN = 'https://in-process.test';
const COMMAND_URL = `${EDGE_ORIGIN}/functions/v1/wisdom-duel-command`;
const PROJECTION_URL = `${EDGE_ORIGIN}/functions/v1/wisdom-duel-projection`;
const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
const PRIVATE_SEED = '9a'.repeat(32);

type CapturedRequest = {
  method: string;
  path: string;
  authorization: string | null;
  body: string;
};

const createHarness = () => {
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
    seedCommitment: 'bc'.repeat(32),
    turnDeadline: '2026-08-28T12:02:00.000Z',
  });

  const quotaStore = new TransactionalInMemoryRateLimitStore();
  const checkRateLimit = createFailClosedAuthoritativeRateLimitCheck({
    store: quotaStore,
    keySalt: 'browser-to-store-integration-salt',
    policy: { windows: [{ durationMs: 60_000, maxRequests: 100 }] },
    now: () => Date.parse('2026-08-28T12:00:00.000Z'),
  });
  const authenticateBearerToken = async (token: string) => ({
    'jwt-player-one': PLAYER_1_ID,
    'jwt-player-two': PLAYER_2_ID,
  })[token] ?? null;
  const service = () => new DurableAuthoritativeCommandService({
    enabled: true,
    persistence,
    now: () => new Date('2026-08-28T12:00:30.000Z'),
  });
  const operations: Readonly<AuthoritativeOperationEvent>[] = [];
  let requestId = 0;
  const common = {
    isReleaseEnabled: () => true,
    allowedOrigins: [APP_ORIGIN],
    authenticateBearerToken,
    checkRateLimit,
    createRequestId: () => `browser-wire-${requestId += 1}`,
    operationSink: (event: Readonly<AuthoritativeOperationEvent>) => { operations.push(event); },
    operationNow: () => new Date('2026-08-28T12:00:30.000Z'),
    monotonicNow: () => 10,
  };
  const normalCommandHandler = createAuthoritativeCommandHttpHandler({
    ...common,
    executeCommand: (actorId, body) => service().execute(actorId, body),
    operationTimeoutMs: 1_000,
  });
  const timeoutAfterCommitController = new AbortController();
  const timeoutAfterCommitHandler = createAuthoritativeCommandHttpHandler({
    ...common,
    executeCommand: async (actorId, body) => {
      await service().execute(actorId, body);
      timeoutAfterCommitController.abort();
      return new Promise(() => undefined);
    },
    operationTimeoutMs: 1_000,
    createOperationSignal: () => timeoutAfterCommitController.signal,
  });
  const projectionHandler = createAuthoritativeProjectionHttpHandler({
    ...common,
    readProjection: (actorId, matchId) => service().readPlayerProjection(actorId, matchId),
    operationTimeoutMs: 1_000,
  });

  const captured: CapturedRequest[] = [];
  let nextCommandMode: 'normal' | 'timeout_after_commit' | 'oversized_after_commit' = 'normal';
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    const headers = new Headers(init?.headers);
    headers.set('Origin', APP_ORIGIN);
    const request = new Request(input, { ...init, headers });
    const url = new URL(request.url);
    captured.push({
      method: request.method,
      path: `${url.pathname}${url.search}`,
      authorization: request.headers.get('Authorization'),
      body: request.method === 'POST' ? await request.clone().text() : '',
    });

    if (url.pathname.endsWith('/wisdom-duel-projection')) return projectionHandler(request);
    if (!url.pathname.endsWith('/wisdom-duel-command')) {
      return new Response('not found', { status: 404 });
    }
    const mode = nextCommandMode;
    nextCommandMode = 'normal';
    if (mode === 'timeout_after_commit') return timeoutAfterCommitHandler(request);
    const response = await normalCommandHandler(request);
    if (mode === 'oversized_after_commit') {
      return new Response(JSON.stringify({ padding: 'x'.repeat(70 * 1_024) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return response;
  });

  const createClient = (
    token: string,
    commandId: string,
    maxResponseBytes = 256 * 1024,
  ) => {
    const getAccessToken = vi.fn(async () => token);
    const createCommandId = vi.fn(() => commandId);
    const transport = new AuthoritativeClientHttpTransport({
      commandUrl: COMMAND_URL,
      projectionUrl: PROJECTION_URL,
      getAccessToken,
      fetcher: fetcher as unknown as typeof fetch,
      maxResponseBytes,
    });
    const client = new AuthoritativeGameClient({
      matchId: MATCH_ID,
      transport,
      createCommandId,
    });
    return { client, getAccessToken, createCommandId };
  };

  return {
    persistence,
    quotaStore,
    operations,
    captured,
    rivalCardId,
    fetcher,
    createClient,
    setNextCommandMode: (mode: typeof nextCommandMode) => { nextCommandMode = mode; },
  };
};

describe('authoritative browser-to-store wire', () => {
  it('reconnects and commits through the complete serialized stack without leaking secrets', async () => {
    const harness = createHarness();
    const clientHarness = harness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120010',
    );

    await expect(clientHarness.client.reconnect()).resolves.toMatchObject({
      status: 'ready',
      projection: {
        stateVersion: 0,
        players: [
          { id: PLAYER_1_ID, hand: { visibility: 'visible', count: 1 } },
          { id: PLAYER_2_ID, hand: { visibility: 'hidden', count: 1 } },
        ],
      },
    });
    await expect(clientHarness.client.send({
      type: 'rotate_creature',
      creatureId: 'lafaic',
    })).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 1, eventSequence: 1 },
      lastOutcome: 'accepted',
    });

    const clientState = JSON.stringify(clientHarness.client.getState());
    expect(clientState).not.toContain(PRIVATE_SEED);
    expect(clientState).not.toContain(harness.rivalCardId);
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
    expect(clientHarness.getAccessToken).toHaveBeenCalledTimes(2);
    expect(harness.captured.map((request) => request.authorization)).toEqual([
      'Bearer jwt-player-one',
      'Bearer jwt-player-one',
    ]);
    expect(harness.captured[1].body).not.toMatch(
      /jwt-player-one|privateRandom|seedHex|018f2f9a-4e1c-7b8a-8f2c-0242ac120003/,
    );
    expect(harness.captured[0].path).toBe(
      `/functions/v1/wisdom-duel-projection?matchId=${MATCH_ID}`,
    );
    expect(JSON.stringify(harness.operations)).not.toMatch(
      /jwt-player-one|018f2f9a-4e1c-7b8a-8f2c-0242ac120003|9a9a9a/,
    );
  });

  it('recovers a 504 after commit as duplicate using an identical serialized envelope', async () => {
    const harness = createHarness();
    const clientHarness = harness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120011',
    );
    await clientHarness.client.reconnect();
    harness.setNextCommandMode('timeout_after_commit');

    await expect(clientHarness.client.send({
      type: 'rotate_creature',
      creatureId: 'lafaic',
    })).resolves.toMatchObject({
      status: 'retryable',
      projection: { stateVersion: 0 },
      pendingCommand: { attempts: 1 },
      lastError: { code: 'operation_timeout' },
    });
    expect(harness.persistence.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 1,
      eventSequence: 1,
    });
    await expect(clientHarness.client.retry()).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 1 },
      lastOutcome: 'duplicate',
    });

    const commandBodies = harness.captured
      .filter((request) => request.method === 'POST')
      .map((request) => request.body);
    expect(commandBodies).toHaveLength(2);
    expect(commandBodies[1]).toBe(commandBodies[0]);
    expect(clientHarness.createCommandId).toHaveBeenCalledTimes(1);
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
    expect(harness.operations.map((event) => event.outcome)).toEqual([
      'accepted',
      'timeout',
      'duplicate',
    ]);
  });

  it('gives two stale browser clients one winner and one conflict projection', async () => {
    const harness = createHarness();
    const clientA = harness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120012',
    ).client;
    const clientB = harness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120013',
    ).client;
    await Promise.all([clientA.reconnect(), clientB.reconnect()]);

    const results = await Promise.all([
      clientA.send({ type: 'rotate_creature', creatureId: 'lafaic' }),
      clientB.send({ type: 'rotate_creature', creatureId: 'adaro' }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['conflict', 'ready']);
    expect(results.map((result) => result.projection?.stateVersion)).toEqual([1, 1]);
    expect(harness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
    expect(harness.persistence.readPrivateMatchForTest(MATCH_ID)).toMatchObject({ stateVersion: 1 });
  });

  it('keeps state intact on pre-fetch abort and on an oversized post-commit response', async () => {
    const abortedHarness = createHarness();
    const abortedClient = abortedHarness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120014',
    );
    await abortedClient.client.reconnect();
    const controller = new AbortController();
    controller.abort(new DOMException('cancelled', 'AbortError'));

    await expect(abortedClient.client.send({
      type: 'rotate_creature',
      creatureId: 'lafaic',
    }, controller.signal)).resolves.toMatchObject({
      status: 'retryable',
      projection: { stateVersion: 0 },
      lastError: { code: 'network_error' },
    });
    expect(abortedHarness.persistence.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 0,
      eventSequence: 0,
    });
    await expect(abortedClient.client.retry()).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 1 },
    });

    const oversizedHarness = createHarness();
    const oversizedClient = oversizedHarness.createClient(
      'jwt-player-one',
      '018f2f9a-4e1c-7b8a-8f2c-0242ac120015',
      64 * 1_024,
    );
    await oversizedClient.client.reconnect();
    oversizedHarness.setNextCommandMode('oversized_after_commit');
    await expect(oversizedClient.client.send({
      type: 'rotate_creature',
      creatureId: 'lafaic',
    })).resolves.toMatchObject({
      status: 'retryable',
      projection: { stateVersion: 0 },
      lastError: { code: 'invalid_response' },
    });
    expect(oversizedHarness.persistence.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 1,
      eventSequence: 1,
    });
    await expect(oversizedClient.client.retry()).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 1 },
      lastOutcome: 'duplicate',
    });
    expect(oversizedHarness.persistence.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });
});
