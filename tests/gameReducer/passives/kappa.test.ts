// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/kappa.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Kappa Passive', () => {
  describe('SUMMON_KNOWLEDGE (Owner) - Summoning aquatic knowledge is free', () => {
    it('should NOT consume an action when owner summons aquatic knowledge', () => {
      const p1Id = 'player1'; // Kappa's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game19', ['kappa', 'adaro'], ['pele'], { // P1 has Kappa
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an aquatic knowledge card
      const aquaticCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[0].hand = [aquaticCard];
      // Ensure a creature (Adaro) has enough wisdom
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      const initialActionsTaken = initialState.actionsTakenThisTurn; // 0

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: aquaticCard.id,
          instanceId: aquaticCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: actionsTakenThisTurn is still 0
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(initialActionsTaken);
      // Assert: Log message indicates free action
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Kappa allows summoning aquatic knowledge ${aquaticCard.name} without spending an action.`);
      expect(stateAfterSummon.log).toContain(`Action SUMMON_KNOWLEDGE completed (Free). Actions: 0/2`); // Check specific log
    });

    it('should consume an action when owner summons non-aquatic knowledge', () => {
      const p1Id = 'player1'; // Kappa's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game20', ['kappa', 'adaro'], ['pele'], { // P1 has Kappa
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a non-aquatic knowledge card
      const nonAquaticCard = createTestKnowledge('terrestrial1', { cost: 1 }); // Earth card
      initialState.players[0].hand = [nonAquaticCard];
      // Ensure a creature (Adaro) has enough wisdom
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      const initialActionsTaken = initialState.actionsTakenThisTurn; // 0

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: nonAquaticCard.id,
          instanceId: nonAquaticCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: actionsTakenThisTurn increased by 1
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(initialActionsTaken + 1);
      // Assert: Log message for Kappa passive should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Kappa allows summoning`);
      // Assert: Standard action log IS present
      expect(stateAfterSummon.log).toContain(`Action SUMMON_KNOWLEDGE completed. Actions: 1/2`);
    });

    it('should consume an action when opponent summons aquatic knowledge', () => {
      const p1Id = 'player1'; // Kappa's owner
      const p2Id = 'player2'; // Opponent / Summoner
      const initialState = createInitialTestState('game21', ['kappa'], ['pele', 'adaro'], { // P1 has Kappa
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 an aquatic knowledge card
      const aquaticCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[1].hand = [aquaticCard];
      // Ensure opponent's creature (Adaro) has enough wisdom
      const adaroIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndex].currentWisdom = 1;

      const initialActionsTaken = initialState.actionsTakenThisTurn; // 0

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: aquaticCard.id,
          instanceId: aquaticCard.instanceId!,
          creatureId: 'adaro', // Target opponent's creature
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: actionsTakenThisTurn increased by 1 for the opponent (current player)
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(initialActionsTaken + 1);
      // Assert: Log message for Kappa passive should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Kappa allows summoning`);
      // Assert: Standard action log IS present
      expect(stateAfterSummon.log).toContain(`Action SUMMON_KNOWLEDGE completed. Actions: 1/2`);
    });
  });
});