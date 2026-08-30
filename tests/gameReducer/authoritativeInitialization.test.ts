import { describe, expect, it } from 'vitest';
import { AuthoritativeInitializationService } from '../../src/game/authoritativeInitialization.js';
import {
  type AuthoritativeCreateMatchRequest,
  type AuthoritativeCreateMatchResult,
  type AuthoritativeInitializationSource,
  TransactionalInMemoryAuthoritativeStore,
} from '../../src/game/authoritativePersistence.js';
import { verifyGameSeedCommitment } from '../../src/game/random.js';

const SESSION_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';

const source = (): AuthoritativeInitializationSource => ({
  sessionId: SESSION_ID,
  gameId: 'card_game',
  modeId: 'casual',
  status: 'playing',
  revision: 'session-revision-1',
  participants: [
    {
      playerId: PLAYER_2_ID,
      slot: 2,
      selectedCreatureIds: ['pele', 'tulpar', 'tarasca'],
    },
    {
      playerId: PLAYER_1_ID,
      slot: 1,
      selectedCreatureIds: ['lafaic', 'adaro', 'kappa'],
    },
  ],
});

const initializationService = (
  persistence: TransactionalInMemoryAuthoritativeStore,
  seedHex = '77'.repeat(32),
  enabled = true,
) => new AuthoritativeInitializationService({
  enabled,
  persistence,
  now: () => new Date('2026-08-28T12:00:00.000Z'),
  generateSeedHex: () => seedHex,
  turnDurationSeconds: 120,
});

class RevisionChangingStore extends TransactionalInMemoryAuthoritativeStore {
  constructor(private readonly changedSource: AuthoritativeInitializationSource) {
    super();
  }

  override createMatchIfAbsent(
    request: AuthoritativeCreateMatchRequest,
  ): Promise<AuthoritativeCreateMatchResult> {
    this.registerInitializationSource(this.changedSource);
    return super.createMatchIfAbsent(request);
  }
}

describe('authoritative match initialization', () => {
  it('is default-off before reading a session', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    await expect(initializationService(store, '77'.repeat(32), false).initialize(SESSION_ID))
      .resolves.toEqual({
        status: 'rejected',
        code: 'multiplayer_disabled',
        message: 'Multiplayer is not available in this release.',
      });
  });

  it('creates a match from server-held slots and selections with a private seed', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    const seedHex = '77'.repeat(32);
    store.registerInitializationSource(source());

    const result = await initializationService(store, seedHex).initialize(SESSION_ID);
    const snapshot = store.readPrivateMatchForTest(SESSION_ID)!;

    expect(result).toMatchObject({
      status: 'created',
      matchId: SESSION_ID,
      stateVersion: 0,
      eventSequence: 0,
      turnDeadline: '2026-08-28T12:02:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain(seedHex);
    expect(snapshot.state.players.map((player) => player.id)).toEqual([PLAYER_1_ID, PLAYER_2_ID]);
    expect(snapshot.state.players[0].selectedCreatures.map((creature) => creature.id)).toEqual([
      'lafaic',
      'adaro',
      'kappa',
    ]);
    expect(snapshot.state.privateRandom?.seedHex).toBe(seedHex);
    await expect(verifyGameSeedCommitment(seedHex, result.seedCommitment)).resolves.toBe(true);
  });

  it('converges two workers with different seeds on one initialized match', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerInitializationSource(source());
    const workerA = initializationService(store, '88'.repeat(32));
    const workerB = initializationService(store, '99'.repeat(32));

    const results = await Promise.all([
      workerA.initialize(SESSION_ID),
      workerB.initialize(SESSION_ID),
    ]);
    const snapshot = store.readPrivateMatchForTest(SESSION_ID)!;

    expect(results.map((result) => result.status).sort()).toEqual(['created', 'existing']);
    expect(results[0]).toMatchObject({ seedCommitment: results[1].seedCommitment });
    expect(snapshot.stateVersion).toBe(0);
    expect(snapshot.eventSequence).toBe(0);
    expect(store.readEventsForTest(SESSION_ID)).toEqual([]);
    expect(['88'.repeat(32), '99'.repeat(32)]).toContain(snapshot.state.privateRandom?.seedHex);
    await expect(verifyGameSeedCommitment(
      snapshot.state.privateRandom!.seedHex,
      results[0].seedCommitment!,
    )).resolves.toBe(true);
  });

  it('rejects sessions that are not exactly ready for casual Wisdom Duel', async () => {
    const invalidSources: AuthoritativeInitializationSource[] = [
      { ...source(), gameId: 'another_game' },
      { ...source(), modeId: 'competitive_gem' },
      { ...source(), status: 'waiting' },
      { ...source(), participants: source().participants.slice(0, 1) },
      {
        ...source(),
        participants: source().participants.map((participant) => ({
          ...participant,
          playerId: PLAYER_1_ID,
        })),
      },
      {
        ...source(),
        participants: source().participants.map((participant) => (
          participant.slot === 1
            ? { ...participant, selectedCreatureIds: ['lafaic', 'lafaic', 'kappa'] }
            : participant
        )),
      },
      {
        ...source(),
        participants: source().participants.map((participant) => (
          participant.slot === 1
            ? { ...participant, selectedCreatureIds: ['lafaic', 'adaro', 'unknown'] }
            : participant
        )),
      },
    ];

    for (const invalidSource of invalidSources) {
      const store = new TransactionalInMemoryAuthoritativeStore();
      store.registerInitializationSource(invalidSource);
      await expect(initializationService(store).initialize(SESSION_ID)).resolves.toMatchObject({
        status: 'rejected',
        code: 'session_not_ready',
      });
      expect(store.readPrivateMatchForTest(SESSION_ID)).toBeNull();
    }
  });

  it('detects a source revision change before the atomic create', async () => {
    const changed = { ...source(), revision: 'session-revision-2' };
    const store = new RevisionChangingStore(changed);
    store.registerInitializationSource(source());

    await expect(initializationService(store).initialize(SESSION_ID)).resolves.toMatchObject({
      status: 'rejected',
      code: 'session_changed',
    });
    expect(store.readPrivateMatchForTest(SESSION_ID)).toBeNull();
  });

  it('fails closed when the injected seed is invalid', async () => {
    const store = new TransactionalInMemoryAuthoritativeStore();
    store.registerInitializationSource(source());

    await expect(initializationService(store, 'not-a-seed').initialize(SESSION_ID))
      .resolves.toMatchObject({ status: 'rejected', code: 'internal_error' });
    expect(store.readPrivateMatchForTest(SESSION_ID)).toBeNull();
  });
});

