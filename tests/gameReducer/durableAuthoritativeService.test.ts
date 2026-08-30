import { describe, expect, it } from 'vitest';
import {
  type AuthoritativeCommitCommand,
  type AuthoritativeCommitResult,
  type AuthoritativeExecutionContext,
  type AuthoritativePersistencePort,
  TransactionalInMemoryAuthoritativeStore,
} from '../../src/game/authoritativePersistence.js';
import { DurableAuthoritativeCommandService } from '../../src/game/durableAuthoritativeService.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';

const createState = () => initializeGame({
  gameId: MATCH_ID,
  player1Id: 'player-1',
  player2Id: 'player-2',
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
}, createGameRandomState('66'.repeat(32)));

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

const service = (
  persistence: AuthoritativePersistencePort,
  enabled = true,
  now = '2026-08-28T12:00:00.000Z',
) => (
  new DurableAuthoritativeCommandService({
    enabled,
    persistence,
    now: () => new Date(now),
    turnDurationSeconds: 120,
  })
);

class TwoLoadBarrierPersistence implements AuthoritativePersistencePort {
  private loadCount = 0;
  private releaseLoads!: () => void;
  private readonly loadGate = new Promise<void>((resolve) => { this.releaseLoads = resolve; });

  constructor(private readonly inner: AuthoritativePersistencePort) {}

  async loadExecutionContext(
    matchId: string,
    requestedCommandId: string,
  ): Promise<AuthoritativeExecutionContext | null> {
    const context = await this.inner.loadExecutionContext(matchId, requestedCommandId);
    this.loadCount += 1;
    if (this.loadCount === 2) this.releaseLoads();
    await this.loadGate;
    return context;
  }

  commitCommand(command: AuthoritativeCommitCommand): Promise<AuthoritativeCommitResult> {
    return this.inner.commitCommand(command);
  }

  loadPlayerProjection(matchId: string, playerId: string) {
    return this.inner.loadPlayerProjection(matchId, playerId);
  }
}

describe('durable authoritative command service', () => {
  it('remains disabled by default before persistence access', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    await expect(service(store, false).execute(null, { forged: true })).resolves.toEqual({
      status: 'rejected',
      code: 'multiplayer_disabled',
      message: 'Multiplayer is not available in this release.',
    });
  });

  it('lets exactly one of two server instances commit the same base version', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    const persistence = new TwoLoadBarrierPersistence(store);
    const instanceA = service(persistence);
    const instanceB = service(persistence);

    const results = await Promise.all([
      instanceA.execute('player-1', envelope(1)),
      instanceB.execute('player-1', envelope(2, 0, {
        type: 'rotate_creature',
        creatureId: 'adaro',
      })),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['accepted', 'rejected']);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      code: 'version_conflict',
      currentVersion: 1,
    });
    expect(store.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(store.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });

  it('deduplicates the same command racing through two instances', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    const persistence = new TwoLoadBarrierPersistence(store);
    const command = envelope(1);

    const results = await Promise.all([
      service(persistence).execute('player-1', command),
      service(persistence).execute('player-1', command),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['accepted', 'duplicate']);
    expect(store.readPrivateMatchForTest(MATCH_ID)).toMatchObject({ stateVersion: 1 });
    expect(store.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });

  it('leaves no partial write when persistence fails before commit', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    store.failNextCommit('before_commit');
    const command = envelope(1);

    await expect(service(store).execute('player-1', command)).resolves.toMatchObject({
      status: 'rejected',
      code: 'internal_error',
      currentVersion: 0,
    });
    expect(store.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 0,
      eventSequence: 0,
    });
    expect(store.readEventsForTest(MATCH_ID)).toEqual([]);
    await expect(service(store).execute('player-1', command)).resolves.toMatchObject({
      status: 'accepted',
      stateVersion: 1,
    });
  });

  it('turns an unknown post-commit timeout into a duplicate on retry', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    store.failNextCommit('after_commit');
    const command = envelope(1);

    await expect(service(store).execute('player-1', command)).resolves.toMatchObject({
      status: 'rejected',
      code: 'internal_error',
    });
    expect(store.readPrivateMatchForTest(MATCH_ID)).toMatchObject({
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(store.readEventsForTest(MATCH_ID)).toHaveLength(1);

    await expect(service(store).execute('player-1', command)).resolves.toMatchObject({
      status: 'duplicate',
      stateVersion: 1,
      eventSequence: 1,
    });
    expect(store.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });

  it('rejects command-id collisions after a successful commit', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    const instanceA = service(store);
    const instanceB = service(store);
    const first = envelope(1);

    await expect(instanceA.execute('player-1', first)).resolves.toMatchObject({ status: 'accepted' });
    await expect(instanceB.execute('player-1', {
      ...first,
      expectedVersion: 1,
      command: { type: 'end_turn' },
    })).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_command',
    });
    expect(store.readEventsForTest(MATCH_ID)).toHaveLength(1);
  });

  it('reconnects from the current private projection without exposing the rival or seed', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    const state = createState();
    state.players[0].hand.push(state.knowledgeDeck.shift()!);
    state.players[1].hand.push(state.knowledgeDeck.shift()!);
    const rivalCardId = state.players[1].hand[0].instanceId!;
    const seedHex = state.privateRandom!.seedHex;
    store.registerMatch(state);
    const instanceA = service(store);
    const instanceB = service(store);

    await expect(instanceA.execute('player-1', envelope(1))).resolves.toMatchObject({
      status: 'accepted',
      stateVersion: 1,
    });
    const reconnected = await instanceB.readPlayerProjection('player-1', MATCH_ID);
    const serialized = JSON.stringify(reconnected);

    expect(reconnected).toMatchObject({
      status: 'ok',
      projection: {
        stateVersion: 1,
        players: [
          { hand: { visibility: 'visible', count: 1 } },
          { hand: { visibility: 'hidden', count: 1 } },
        ],
      },
    });
    expect(serialized).not.toContain(rivalCardId);
    expect(serialized).not.toContain(seedHex);
  });

  it('fails projection reads closed for unauthenticated, invalid, and outsider requests', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState());
    const instance = service(store);

    await expect(instance.readPlayerProjection(null, MATCH_ID)).resolves.toMatchObject({
      status: 'rejected',
      code: 'unauthorized',
    });
    await expect(instance.readPlayerProjection('player-1', 'not-a-uuid')).resolves.toMatchObject({
      status: 'rejected',
      code: 'match_not_playable',
    });
    await expect(instance.readPlayerProjection('intruder', MATCH_ID)).resolves.toMatchObject({
      status: 'rejected',
      code: 'match_not_playable',
    });
  });

  it('renews the deadline only when the active turn changes', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerMatch(createState(), { turnDeadline: '2026-08-28T12:02:00.000Z' });

    const rotate = await service(store, true, '2026-08-28T12:01:00.000Z')
      .execute('player-1', envelope(1));
    expect(rotate).toMatchObject({
      status: 'accepted',
      projection: { turnDeadline: '2026-08-28T12:02:00.000Z' },
    });
    expect(store.readPrivateMatchForTest(MATCH_ID)?.turnDeadline)
      .toBe('2026-08-28T12:02:00.000Z');

    const endTurn = await service(store, true, '2026-08-28T12:01:15.000Z')
      .execute('player-1', envelope(2, 1, { type: 'end_turn' }));
    expect(endTurn).toMatchObject({
      status: 'accepted',
      projection: { turnDeadline: '2026-08-28T12:03:15.000Z' },
    });
    expect(store.readPrivateMatchForTest(MATCH_ID)?.turnDeadline)
      .toBe('2026-08-28T12:03:15.000Z');
  });
});
