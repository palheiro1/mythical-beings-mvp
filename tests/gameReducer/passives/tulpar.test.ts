import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Tulpar Passive', () => {
  describe('AFTER_SUMMON (Owner) - If owner summoned air knowledge, rotate one of owner\'s creatures 90 degrees', () => {
    it('should rotate the first non-fully rotated creature 90 degrees when owner summons air knowledge', () => {
      const p1Id = 'player1'; // Tulpar's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game32', ['tulpar', 'pele'], ['adaro'], { // P1 has Tulpar and Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an air knowledge card
      const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[0].hand = [airKnowledge];

      // Ensure Tulpar has wisdom to summon onto
      const tulparCreatureIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tulpar');
      initialState.players[0].creatures[tulparCreatureIndex].currentWisdom = 1;

      // Get initial rotations
      const initialTulparRotation = initialState.players[0].creatures[tulparCreatureIndex].rotation ?? 0;
      const peleCreatureIndex = initialState.players[0].creatures.findIndex(c => c.id === 'pele');
      const initialPeleRotation = initialState.players[0].creatures[peleCreatureIndex].rotation ?? 0;


      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: airKnowledge.id,
          instanceId: airKnowledge.instanceId!,
          creatureId: 'tulpar', // Summon onto Tulpar itself (could be any creature)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Tulpar (the first creature) should be rotated
      const finalTulparRotation = stateAfterSummon.players[0].creatures[tulparCreatureIndex].rotation;
      expect(finalTulparRotation).toBe(initialTulparRotation + 90);

      // Assert: Pele (the second creature) should NOT be rotated
      const finalPeleRotation = stateAfterSummon.players[0].creatures[peleCreatureIndex].rotation;
      expect(finalPeleRotation).toBe(initialPeleRotation);

      // Assert: Log message indicates rotation
      // Use creature ID (lowercase) in assertion
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Tulpar (Owner: ${p1Id}) rotates tulpar 90 degrees due to summoning ${airKnowledge.name}.`);
    });

    it('should NOT rotate any creature when owner summons non-air knowledge', () => {
      const p1Id = 'player1'; // Tulpar's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game33', ['tulpar'], ['adaro'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a non-air knowledge card
      const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [earthKnowledge];

      // Ensure Tulpar has wisdom
      const tulparCreatureIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tulpar');
      initialState.players[0].creatures[tulparCreatureIndex].currentWisdom = 1;
      const initialTulparRotation = initialState.players[0].creatures[tulparCreatureIndex].rotation ?? 0;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: earthKnowledge.id,
          instanceId: earthKnowledge.instanceId!,
          creatureId: 'tulpar',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Tulpar should NOT be rotated
      const finalTulparRotation = stateAfterSummon.players[0].creatures[tulparCreatureIndex].rotation;
      expect(finalTulparRotation).toBe(initialTulparRotation);

      // Assert: Log message does NOT indicate rotation by Tulpar
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tulpar (Owner: ${p1Id}) rotates`);
    });

    it('should NOT rotate any creature when opponent summons air knowledge', () => {
      const p1Id = 'player1'; // Tulpar's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game34', ['tulpar'], ['adaro'], {
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 an air knowledge card
      const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [airKnowledge];

      // Ensure Adaro (P2's creature) has wisdom
      const adaroCreatureIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroCreatureIndex].currentWisdom = 1;

      // Get initial rotation of P1's Tulpar
      const tulparCreatureIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tulpar');
      const initialTulparRotation = initialState.players[0].creatures[tulparCreatureIndex].rotation ?? 0;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: airKnowledge.id,
          instanceId: airKnowledge.instanceId!,
          creatureId: 'adaro', // Summon onto P2's creature
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: P1's Tulpar should NOT be rotated
      const finalTulparRotation = stateAfterSummon.players[0].creatures[tulparCreatureIndex].rotation;
      expect(finalTulparRotation).toBe(initialTulparRotation);

      // Assert: Log message does NOT indicate rotation by Tulpar
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tulpar (Owner: ${p1Id}) rotates`);
    });

     it('should log correctly and not rotate if all owner creatures are fully rotated', () => {
      const p1Id = 'player1'; // Tulpar's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game35', ['tulpar'], ['adaro'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an air knowledge card
      const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[0].hand = [airKnowledge];

      // Ensure Tulpar has wisdom AND is fully rotated
      const tulparCreatureIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tulpar');
      initialState.players[0].creatures[tulparCreatureIndex].currentWisdom = 1;
      initialState.players[0].creatures[tulparCreatureIndex].rotation = 270; // Fully rotated
      const initialTulparRotation = initialState.players[0].creatures[tulparCreatureIndex].rotation;


      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: airKnowledge.id,
          instanceId: airKnowledge.instanceId!,
          creatureId: 'tulpar',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Tulpar should still be fully rotated
      const finalTulparRotation = stateAfterSummon.players[0].creatures[tulparCreatureIndex].rotation;
      expect(finalTulparRotation).toBe(initialTulparRotation); // Should remain 270

      // Assert: Log message indicates no rotation possible
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Tulpar (Owner: ${p1Id}) triggered, but all creatures are fully rotated.`);
    });
  });
});
