import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '../../src/game/state.js';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers.js';

describe('gameReducer - Passive Abilities', () => {
  let state;

  beforeEach(() => {
    state = createInitialTestState('passive-test', ['japinunus','adaro'], ['kappa','dudugera']);
    state.phase = 'action';
    state.currentPlayerIndex = 0;
    state.actionsTakenThisTurn = 0;
  });

  it('Japinunus grants +1 power when owner summons air knowledge', () => {
    const air = createTestKnowledge('aerial1');
    state.players[0].hand = [air];
    const slotIdx = state.players[0].field.findIndex(f => f.creatureId === 'japinunus');
    // ensure wisdom
    const creature = state.players[0].creatures.find(c => c.id === 'japinunus');
    creature.currentWisdom = air.cost;

    const action = {
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: 'player1', knowledgeId: air.id, creatureId: 'japinunus', instanceId: air.instanceId }
    };
    const next = gameReducer(state, action);
    // power increased by 1
    expect(next.players[0].power).toBe(state.players[0].power + 1);
    // log contains passive effect
    expect(next.log.some(l => l.includes('Japinunus') && l.includes('grants +1 Power'))).toBe(true);
  });
});