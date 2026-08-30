import { describe, expect, it, vi } from 'vitest';
import {
  AuthoritativeGameClient,
  type AuthoritativeClientCommandResponse,
  type AuthoritativeClientProjectionResponse,
  type AuthoritativeClientTransport,
} from '../../src/game/authoritativeClient.js';
import { buildGameProjection, type GameProjection } from '../../src/game/projections.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
const COMMAND_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120010';

const state = initializeGame({
  gameId: MATCH_ID,
  player1Id: PLAYER_1_ID,
  player2Id: PLAYER_2_ID,
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
}, createGameRandomState('ef'.repeat(32)));

const projection = (stateVersion: number, eventSequence = stateVersion): GameProjection => (
  buildGameProjection(state, { kind: 'player', playerId: PLAYER_1_ID }, {
    stateVersion,
    eventSequence,
    seedCommitment: 'ab'.repeat(32),
  })
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = (overrides: Partial<AuthoritativeClientTransport> = {}) => {
  const transport: AuthoritativeClientTransport = {
    readProjection: vi.fn(async () => ({ status: 'ok', projection: projection(4) })),
    sendCommand: vi.fn(async (envelope) => ({
      status: 'accepted',
      commandId: envelope.commandId,
      stateVersion: 5,
      eventSequence: 5,
      projection: projection(5),
    })),
    ...overrides,
  };
  const createCommandId = vi.fn(() => COMMAND_ID);
  const client = new AuthoritativeGameClient({ matchId: MATCH_ID, transport, createCommandId });
  return { client, transport, createCommandId };
};

describe('authoritative game client', () => {
  it('reconnects before sending and never updates the projection optimistically', async () => {
    const pending = deferred<AuthoritativeClientCommandResponse>();
    const harness = createHarness({ sendCommand: vi.fn(() => pending.promise) });

    await harness.client.reconnect();
    const sending = harness.client.send({ type: 'rotate_creature', creatureId: 'lafaic' });

    expect(harness.client.getState()).toMatchObject({
      status: 'sending',
      projection: { stateVersion: 4 },
      pendingCommand: {
        commandId: COMMAND_ID,
        commandType: 'rotate_creature',
        expectedVersion: 4,
        attempts: 1,
      },
    });
    pending.resolve({
      status: 'accepted',
      commandId: COMMAND_ID,
      stateVersion: 5,
      eventSequence: 5,
      projection: projection(5),
    });

    await expect(sending).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 5 },
      pendingCommand: null,
      lastOutcome: 'accepted',
    });
  });

  it('retries a lost response with exactly the same command envelope', async () => {
    const calls: unknown[] = [];
    let attempt = 0;
    const harness = createHarness({
      sendCommand: vi.fn(async (envelope) => {
        calls.push(structuredClone(envelope));
        attempt += 1;
        if (attempt === 1) throw new Error('connection lost after an unknown commit');
        return {
          status: 'duplicate',
          commandId: envelope.commandId,
          stateVersion: 5,
          eventSequence: 5,
          projection: projection(5),
        };
      }),
    });
    await harness.client.reconnect();

    await expect(harness.client.send({ type: 'rotate_creature', creatureId: 'lafaic' }))
      .resolves.toMatchObject({
        status: 'retryable',
        projection: { stateVersion: 4 },
        pendingCommand: { commandId: COMMAND_ID, attempts: 1 },
        lastError: { code: 'network_error' },
      });
    await expect(harness.client.retry()).resolves.toMatchObject({
      status: 'ready',
      projection: { stateVersion: 5 },
      pendingCommand: null,
      lastOutcome: 'duplicate',
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(harness.createCommandId).toHaveBeenCalledTimes(1);
  });

  it('adopts a conflict projection and never auto-replays the rejected intent', async () => {
    const harness = createHarness({
      sendCommand: vi.fn(async () => ({
        status: 'rejected',
        code: 'version_conflict',
        message: 'Refresh before choosing another action.',
        currentVersion: 5,
        projection: projection(5),
      })),
    });
    await harness.client.reconnect();

    await expect(harness.client.send({ type: 'rotate_creature', creatureId: 'lafaic' }))
      .resolves.toMatchObject({
        status: 'conflict',
        projection: { stateVersion: 5 },
        pendingCommand: null,
        lastError: { code: 'version_conflict' },
      });
    expect(harness.transport.sendCommand).toHaveBeenCalledTimes(1);
    await expect(harness.client.retry()).rejects.toThrow('no retryable');
  });

  it('does not let an older reconnect response roll the projection back', async () => {
    const first = deferred<AuthoritativeClientProjectionResponse>();
    const second = deferred<AuthoritativeClientProjectionResponse>();
    let read = 0;
    const harness = createHarness({
      readProjection: vi.fn(() => {
        read += 1;
        return read === 1 ? first.promise : second.promise;
      }),
    });

    const olderRequest = harness.client.reconnect();
    const newerRequest = harness.client.reconnect();
    second.resolve({ status: 'ok', projection: projection(2) });
    await newerRequest;
    first.resolve({ status: 'ok', projection: projection(1) });
    await olderRequest;

    expect(harness.client.getState()).toMatchObject({
      status: 'ready',
      projection: { stateVersion: 2, eventSequence: 2 },
    });
  });

  it('keeps an unknown command outcome retryable when the response is inconsistent', async () => {
    const harness = createHarness({
      sendCommand: vi.fn(async () => ({
        status: 'accepted',
        commandId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120099',
        stateVersion: 5,
        eventSequence: 5,
        projection: projection(5),
      })),
    });
    await harness.client.reconnect();

    await expect(harness.client.send({ type: 'rotate_creature', creatureId: 'lafaic' }))
      .resolves.toMatchObject({
        status: 'retryable',
        projection: { stateVersion: 4 },
        pendingCommand: { commandId: COMMAND_ID },
        lastError: { code: 'invalid_response' },
      });
  });

  it('serializes command intent until the pending outcome is resolved', async () => {
    const pending = deferred<AuthoritativeClientCommandResponse>();
    const harness = createHarness({ sendCommand: vi.fn(() => pending.promise) });
    await harness.client.reconnect();

    const first = harness.client.send({ type: 'rotate_creature', creatureId: 'lafaic' });
    await expect(harness.client.send({ type: 'end_turn' })).rejects.toThrow('outcome is unresolved');
    await expect(harness.client.reconnect()).rejects.toThrow('outcome is unresolved');
    pending.resolve({
      status: 'accepted',
      commandId: COMMAND_ID,
      stateVersion: 5,
      eventSequence: 5,
      projection: projection(5),
    });

    await expect(first).resolves.toMatchObject({ status: 'ready', pendingCommand: null });
    expect(harness.transport.sendCommand).toHaveBeenCalledTimes(1);
  });

  it('clears a definitively rejected intent without changing the projection', async () => {
    const harness = createHarness({
      sendCommand: vi.fn(async () => ({
        status: 'rejected',
        code: 'rule_violation',
        message: 'That action is not legal in the current turn.',
      })),
    });
    await harness.client.reconnect();

    await expect(harness.client.send({ type: 'end_turn' })).resolves.toMatchObject({
      status: 'rejected',
      projection: { stateVersion: 4 },
      pendingCommand: null,
      lastError: { code: 'rule_violation' },
    });
    await expect(harness.client.retry()).rejects.toThrow('no retryable');
  });

  it('fails closed on a projection for another match', async () => {
    const wrongProjection = {
      ...projection(4),
      matchId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120099',
    };
    const harness = createHarness({
      readProjection: vi.fn(async () => ({ status: 'ok', projection: wrongProjection })),
    });

    await expect(harness.client.reconnect()).resolves.toMatchObject({
      status: 'disconnected',
      projection: null,
      lastError: { code: 'invalid_response' },
    });
  });

  it('isolates subscribers and returned snapshots from internal client state', async () => {
    const harness = createHarness();
    const observed: number[] = [];
    harness.client.subscribe((snapshot) => {
      observed.push(snapshot.projection?.stateVersion ?? -1);
      if (snapshot.projection) snapshot.projection.stateVersion = 999;
      throw new Error('observer failure');
    });

    await harness.client.reconnect();
    const external = harness.client.getState();
    external.projection!.stateVersion = 888;

    expect(observed).toEqual([-1, -1, 4]);
    expect(harness.client.getState().projection?.stateVersion).toBe(4);
  });
});
