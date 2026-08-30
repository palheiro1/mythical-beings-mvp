import { describe, expect, it } from 'vitest';
import { buildGameProjection } from '../../src/game/projections.js';
import { isGameProjectionWire } from '../../src/game/projectionWire.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';

const state = initializeGame({
  gameId: MATCH_ID,
  player1Id: PLAYER_1_ID,
  player2Id: PLAYER_2_ID,
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
}, createGameRandomState('56'.repeat(32)));

const validProjection = () => buildGameProjection(
  state,
  { kind: 'player', playerId: PLAYER_1_ID },
  {
    stateVersion: 3,
    eventSequence: 3,
    seedCommitment: '78'.repeat(32),
    turnDeadline: '2026-08-28T12:02:00.000Z',
  },
);

describe('game projection v1 wire guard', () => {
  it('accepts a complete player projection emitted by the authoritative builder', () => {
    expect(isGameProjectionWire(validProjection())).toBe(true);
  });

  it('rejects unknown top-level fields that could accidentally carry private state', () => {
    expect(isGameProjectionWire({
      ...validProjection(),
      privateRandom: { seedHex: 'secret' },
    })).toBe(false);
    expect(isGameProjectionWire({
      ...validProjection(),
      knowledgeDeck: [{ id: 'future-card' }],
    })).toBe(false);
  });

  it('rejects hidden hands that contain cards', () => {
    const value = validProjection();
    value.players[1].hand = {
      visibility: 'hidden',
      count: 1,
      cards: [value.market[0]],
    } as never;
    expect(isGameProjectionWire(value)).toBe(false);
  });

  it('rejects invalid versions, participant identity, and commitments', () => {
    expect(isGameProjectionWire({ ...validProjection(), stateVersion: -1 })).toBe(false);
    expect(isGameProjectionWire({ ...validProjection(), currentPlayerId: 'outsider' })).toBe(false);
    expect(isGameProjectionWire({ ...validProjection(), seedCommitment: 'not-a-digest' })).toBe(false);
  });
});
