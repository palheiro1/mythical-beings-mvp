import { describe, it, expect } from 'vitest';
import { executeKnowledgePhase } from '../../../src/game/rules';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import { GameState } from '../../../src/game/types'; // Import GameState

describe('Zhar-Ptitsa Passive', () => {
  describe('Knowledge Phase damage resolution', () => {
    it('should deal damage correctly with aerial knowledge (defense not applicable)', () => { // Renamed test slightly
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState: GameState = createInitialTestState('game50', ['zhar-ptitsa'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
      });

      const aerialDamageCard = createTestKnowledge('aerial4', {
        // aerial4 deals 1 damage at rotation 0
      });
      initialState.players[0].field[0].knowledge = { ...aerialDamageCard, rotation: 0 };

      const defenseCard = createTestKnowledge('aquatic2'); // Grants defense only if attacker slot is empty
      initialState.players[1].field[0].knowledge = { ...defenseCard, rotation: 0 };

      const beforePower = initialState.players[1].power;
      const result = executeKnowledgePhase(initialState);

      // Expect 1 damage because aerial4 deals 1 damage at rotation 0.
      // Defense from aquatic2 is not active because the attacker slot (P1) is not empty.
      expect(result.players[1].power).toBe(beforePower - 1);

      // The bypass log should NOT appear because defense was 0 to begin with.
      expect(result.log.join(' ')).not.toContain(
        `[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) bypasses defense`
      );
       // Check that the damage log is present
      expect(result.log.join(' ')).toContain(
        `[Effect] ${aerialDamageCard.name} deals 1 damage to ${p2Id}`
      );
    });

    it('should allow defense to apply for non-aerial knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState: GameState = createInitialTestState('game51', ['zhar-ptitsa'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
      });

      // Place a non-aerial knowledge card (e.g., Ursus deals 2 damage) on slot 0
      const nonAerialDamageCard = createTestKnowledge('terrestrial1', {
        effect: { type: 'DAMAGE', target: 'OPPONENT', amount: 2, conditions: { rotation: 0 } }
      });
      initialState.players[0].field[0].knowledge = { ...nonAerialDamageCard, rotation: 0 };

      // Place defense knowledge on opponent in same slot
      const defenseCard = createTestKnowledge('aquatic2', {
        effect: { type: 'DEFENSE', amount: 1, conditions: { rotation: 0 } }
      });
      initialState.players[1].field[0].knowledge = { ...defenseCard, rotation: 0 };

      const beforePower = initialState.players[1].power;
      const result = executeKnowledgePhase(initialState);

      // Non-aerial knowledge should be reduced by defense (2 damage - 1 defense = 1)
      expect(result.players[1].power).toBe(beforePower - 1);
      // Bypass log should NOT appear for non-aerial
      expect(result.log.join(' ')).not.toContain('bypass');
    });
  });
});