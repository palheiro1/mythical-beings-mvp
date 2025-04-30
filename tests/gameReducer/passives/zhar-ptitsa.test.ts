import { describe, it, expect } from 'vitest';
import { executeKnowledgePhase } from '../../../src/game/rules';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Zhar-Ptitsa Passive', () => {
  describe('Knowledge Phase damage resolution', () => {
    it('should bypass defense for aerial knowledge damage', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      // Set up state at knowledge phase
      const initialState = createInitialTestState('game50', ['zhar-ptitsa'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
      });

      // Place an aerial knowledge card on Zhar-Ptitsa (slot 0)
      initialState.players[0].field[0].knowledge = createTestKnowledge('aerial4');
      // Place a defense knowledge card on opponent in same slot
      initialState.players[1].field[0].knowledge = createTestKnowledge('aquatic2');

      const beforePower = initialState.players[1].power;
      const result = executeKnowledgePhase(initialState);

      // Aerial knowledge deals 1 damage and should ignore asteroid's defense
      expect(result.players[1].power).toBe(beforePower - 1);
      expect(result.log).toContain(
        `[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) bypasses defense for aerial knowledge.`
      );
    });

    it('should allow defense to apply for non-aerial knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game51', ['zhar-ptitsa'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
      });

      // Place a non-aerial knowledge card (e.g., Ursos deals 2 damage) on slot 0
      initialState.players[0].field[0].knowledge = createTestKnowledge('terrestrial1', { cost: 2 });
      // Place defense knowledge on opponent in same slot
      initialState.players[1].field[0].knowledge = createTestKnowledge('aquatic2');

      const beforePower = initialState.players[1].power;
      const result = executeKnowledgePhase(initialState);

      // Non-aerial knowledge should be reduced by defense (2 damage - 1 defense = 1)
      expect(result.players[1].power).toBe(beforePower - 1);
      // Bypass log should NOT appear for non-aerial
      expect(result.log).not.toContain('bypass');
    });
  });
});