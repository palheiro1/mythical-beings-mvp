import { describe, expect, it } from 'vitest';
import type { AuthoritativeGameEvent } from '../../src/game/authoritativeExecutor.js';
import type {
  AuthoritativeExecutionSnapshot,
  AuthoritativePersistencePort,
  InMemoryCommitFailureMode,
} from '../../src/game/authoritativePersistence.js';
import { DurableAuthoritativeCommandService } from '../../src/game/durableAuthoritativeService.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';
import type { GameState } from '../../src/game/types.js';

export interface AuthoritativePersistenceConformanceHarness {
  persistence: AuthoritativePersistencePort;
  seedMatch(state: GameState): Promise<void>;
  readPrivateMatch(matchId: string): Promise<AuthoritativeExecutionSnapshot | null>;
  readEvents(matchId: string): Promise<AuthoritativeGameEvent[]>;
  injectCommitFailure(mode: InMemoryCommitFailureMode): Promise<void>;
  dispose(): Promise<void>;
}

export type AuthoritativePersistenceConformanceFactory = () => Promise<
  AuthoritativePersistenceConformanceHarness
>;

const MATCH_A = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const MATCH_B = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';

const state = (matchId = MATCH_A) => initializeGame({
  gameId: matchId,
  player1Id: 'player-1',
  player2Id: 'player-2',
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
}, createGameRandomState(matchId === MATCH_A ? 'aa'.repeat(32) : 'bb'.repeat(32)));

const command = (
  matchId: string,
  index: number,
  expectedVersion = 0,
  action: GameCommandEnvelope['command'] = { type: 'rotate_creature', creatureId: 'lafaic' },
): GameCommandEnvelope => ({
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId,
  commandId: `018f2f9a-4e1c-7b8a-8f2c-${index.toString(16).padStart(12, '0')}`,
  expectedVersion,
  command: action,
});

const service = (persistence: AuthoritativePersistencePort) => new DurableAuthoritativeCommandService({
  enabled: true,
  persistence,
  now: () => new Date('2026-08-28T12:00:00.000Z'),
});

export function runAuthoritativePersistenceConformanceContract(
  adapterName: string,
  factory: AuthoritativePersistenceConformanceFactory,
): void {
  describe(`authoritative persistence conformance: ${adapterName}`, () => {
    it('returns null for unknown matches without creating data', async () => {
      const harness = await factory();
      try {
        await expect(harness.persistence.loadExecutionContext(MATCH_A, command(MATCH_A, 1).commandId))
          .resolves.toBeNull();
        await expect(harness.persistence.loadPlayerProjection(MATCH_A, 'player-1'))
          .resolves.toBeNull();
        await expect(harness.readPrivateMatch(MATCH_A)).resolves.toBeNull();
      } finally {
        await harness.dispose();
      }
    });

    it('materializes isolated player projections without seed or rival hand', async () => {
      const harness = await factory();
      try {
        const initial = state();
        initial.players[0].hand.push(initial.knowledgeDeck.shift()!);
        initial.players[1].hand.push(initial.knowledgeDeck.shift()!);
        const rivalCardId = initial.players[1].hand[0].instanceId!;
        const seedHex = initial.privateRandom!.seedHex;
        await harness.seedMatch(initial);

        const projection = await harness.persistence.loadPlayerProjection(MATCH_A, 'player-1');
        expect(projection?.players[0].hand).toMatchObject({ visibility: 'visible', count: 1 });
        expect(projection?.players[1].hand).toEqual({ visibility: 'hidden', count: 1 });
        expect(JSON.stringify(projection)).not.toContain(rivalCardId);
        expect(JSON.stringify(projection)).not.toContain(seedHex);
      } finally {
        await harness.dispose();
      }
    });

    it('commits once, deduplicates retry, and rejects command collisions', async () => {
      const harness = await factory();
      try {
        await harness.seedMatch(state());
        const executor = service(harness.persistence);
        const rotate = command(MATCH_A, 1);

        await expect(executor.execute('player-1', rotate)).resolves.toMatchObject({
          status: 'accepted',
          stateVersion: 1,
        });
        await expect(executor.execute('player-1', rotate)).resolves.toMatchObject({
          status: 'duplicate',
          stateVersion: 1,
        });
        await expect(executor.execute('player-1', {
          ...rotate,
          expectedVersion: 1,
          command: { type: 'end_turn' },
        })).resolves.toMatchObject({ status: 'rejected', code: 'invalid_command' });
        await expect(harness.readEvents(MATCH_A)).resolves.toHaveLength(1);
      } finally {
        await harness.dispose();
      }
    });

    it('allows one CAS winner per match while keeping different matches independent', async () => {
      const harness = await factory();
      try {
        await harness.seedMatch(state(MATCH_A));
        await harness.seedMatch(state(MATCH_B));
        const workerA = service(harness.persistence);
        const workerB = service(harness.persistence);

        const sameMatch = await Promise.all([
          workerA.execute('player-1', command(MATCH_A, 1)),
          workerB.execute('player-1', command(MATCH_A, 2, 0, {
            type: 'rotate_creature',
            creatureId: 'adaro',
          })),
        ]);
        expect(sameMatch.map((result) => result.status).sort()).toEqual(['accepted', 'rejected']);
        expect(sameMatch.find((result) => result.status === 'rejected')).toMatchObject({
          code: 'version_conflict',
          currentVersion: 1,
        });

        await expect(workerB.execute('player-1', command(MATCH_B, 3)))
          .resolves.toMatchObject({ status: 'accepted', stateVersion: 1 });
        await expect(harness.readEvents(MATCH_A)).resolves.toHaveLength(1);
        await expect(harness.readEvents(MATCH_B)).resolves.toHaveLength(1);
      } finally {
        await harness.dispose();
      }
    });

    it('rolls back a pre-commit fault and recovers a post-commit fault by retry', async () => {
      const before = await factory();
      try {
        await before.seedMatch(state());
        await before.injectCommitFailure('before_commit');
        const rotate = command(MATCH_A, 1);
        await expect(service(before.persistence).execute('player-1', rotate))
          .resolves.toMatchObject({ status: 'rejected', code: 'internal_error' });
        await expect(before.readPrivateMatch(MATCH_A)).resolves.toMatchObject({
          stateVersion: 0,
          eventSequence: 0,
        });
        await expect(before.readEvents(MATCH_A)).resolves.toEqual([]);
      } finally {
        await before.dispose();
      }

      const after = await factory();
      try {
        await after.seedMatch(state());
        await after.injectCommitFailure('after_commit');
        const rotate = command(MATCH_A, 1);
        await expect(service(after.persistence).execute('player-1', rotate))
          .resolves.toMatchObject({ status: 'rejected', code: 'internal_error' });
        await expect(after.readPrivateMatch(MATCH_A)).resolves.toMatchObject({
          stateVersion: 1,
          eventSequence: 1,
        });
        await expect(service(after.persistence).execute('player-1', rotate))
          .resolves.toMatchObject({ status: 'duplicate', stateVersion: 1 });
        await expect(after.readEvents(MATCH_A)).resolves.toHaveLength(1);
      } finally {
        await after.dispose();
      }
    });
  });
}

