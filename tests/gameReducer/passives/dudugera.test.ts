import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Dudugera Passive', () => {
  describe('SUMMON_KNOWLEDGE - Summoning onto Dudugera is a free action', () => {
    it('should not consume an action when summoning onto Dudugera', () => {
      const p1 = 'player1';
      // P1 has Dudugera and Adaro
      const initialState = createInitialTestState('game50', ['dudugera', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      // give P1 a knowledge card
      const card = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [card];
      // ensure Dudugera has wisdom to summon
      const idx = initialState.players[0].creatures.findIndex(c => c.id === 'dudugera');
      initialState.players[0].creatures[idx].currentWisdom = 1;

      const before = initialState.actionsTakenThisTurn;
      const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: p1, knowledgeId: card.id, instanceId: card.instanceId!, creatureId: 'dudugera' } };
      const result = gameReducer(initialState, action) as GameState;

      // no action consumed
      expect(result.actionsTakenThisTurn).toBe(before);
      // log contains passive effect
      expect(result.log).toContain(
        `[Passive Effect] Dudugera allows summoning ${card.name} onto itself without spending an action.`
      );
    });

    it('should consume an action when summoning onto another creature', () => {
      const p1 = 'player1';
      const initialState = createInitialTestState('game51', ['dudugera', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      const card = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [card];
      // ensure Adaro has wisdom
      const ad = initialState.players[0].creatures.find(c => c.id === 'adaro')!;
      ad.currentWisdom = 1;

      const before = initialState.actionsTakenThisTurn;
      const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: p1, knowledgeId: card.id, instanceId: card.instanceId!, creatureId: 'adaro' } };
      const result = gameReducer(initialState, action) as GameState;

      expect(result.actionsTakenThisTurn).toBe(before + 1);
      expect(result.log).not.toContain('Dudugera allows summoning');
    });
  });
});