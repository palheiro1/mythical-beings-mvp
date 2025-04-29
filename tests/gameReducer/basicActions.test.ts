import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '../../src/game/state.ts';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers';

const player1Id = 'player1';
const terrestrial1Id = 'terrestrial1';

describe('gameReducer basic actions', () => {
  let state;
  let mockCounter;

  beforeEach(() => {
    mockCounter = 0;
    state = createInitialTestState('game2', ['dudugera','adaro'], ['adaro','dudugera']);
    state.phase = 'action';
    state.currentPlayerIndex = 0;
    state.actionsTakenThisTurn = 0;
  });

  it('should allow Dudugera to summon knowledge without spending an action', () => {
    const knowledgeToSummon = createTestKnowledge(terrestrial1Id);
    state.players[0].hand = [knowledgeToSummon];
    const dudugeraCreature = state.players[0].creatures.find(c => c.id === 'dudugera');
    const idx = state.players[0].field.findIndex(f => f.creatureId === 'dudugera');
    dudugeraCreature.currentWisdom = knowledgeToSummon.cost;
    state.players[0].field[idx].knowledge = null;

    const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeToSummon.id, creatureId: 'dudugera', instanceId: knowledgeToSummon.instanceId } };
    const next = gameReducer(state, action) as GameState;
    expect(next.actionsTakenThisTurn).toBe(0);
    expect(next.players[0].field[idx].knowledge?.id).toBe(knowledgeToSummon.id);
  });
});