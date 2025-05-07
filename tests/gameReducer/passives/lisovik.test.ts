// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/lisovik.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState, GameAction } from '../../../src/game/types'; // Added GameAction
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Lisovik Passive', () => {
  describe('KNOWLEDGE_LEAVE (Owner) - If leaving knowledge is earth, deal 1 damage to opponent', () => {
    it('should NOT deal damage and NOT replace when owner attempts to summon onto an occupied slot (formerly: should deal 1 damage to opponent when owner replaces earth knowledge)', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game22', ['lisovik', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a new knowledge card to summon
      const newKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[0].hand = [newKnowledge];

      // Place an earth knowledge card on Adaro initially
      const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;
      const adaroFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIndex].knowledge = earthKnowledge;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP1HandSize = initialState.players[0].hand.length; // Added to check hand

      const summonAction: GameAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'adaro',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Opponent's power is UNCHANGED (action is invalid)
      expect(stateAfterSummon.players[1].power).toBe(initialOpponentPower);
      // Assert: Discard pile size is UNCHANGED
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original earth card is STILL on the field
      const adaroSlotAfter = stateAfterSummon.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotAfter?.knowledge?.instanceId).toBe(earthKnowledge.instanceId);
      // Assert: The new knowledge card is still in hand
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize);
      expect(stateAfterSummon.players[0].hand.find(k => k.instanceId === newKnowledge.instanceId)).toBeDefined();
      // Assert: Log message indicates damage dealt should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id} as ${earthKnowledge.name} leaves play.`);
      expect(stateAfterSummon.log).not.toContain(`Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
      // Assert: Action was invalid, so it should not have been consumed
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });

    it('should NOT deal damage and NOT replace when owner attempts to summon onto an occupied slot with non-earth knowledge', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game23', ['lisovik', 'adaro'], ['pele'], { // P1 has Lisovik & Adaro
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a new knowledge card to summon
      const newKnowledgeToSummon = createTestKnowledge('terrestrial1', { cost: 1 }); // Earth card this time
      initialState.players[0].hand = [newKnowledgeToSummon];

      // Place a NON-earth knowledge card on Adaro initially
      const nonEarthKnowledgeOnField = createTestKnowledge('aerial1', { cost: 1 }); // Air card
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIndex].knowledge = nonEarthKnowledgeOnField;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP1HandSize = initialState.players[0].hand.length;

      const summonAction: GameAction = { // Specified GameAction type
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: newKnowledgeToSummon.id,
          instanceId: newKnowledgeToSummon.instanceId!,
          creatureId: 'adaro', // Target Adaro (occupied by nonEarthKnowledgeOnField)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Opponent's power is unchanged
      expect(stateAfterSummon.players[1].power).toBe(initialOpponentPower);
      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original non-earth card is still on the field
      const adaroSlotAfter = stateAfterSummon.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotAfter?.knowledge?.instanceId).toBe(nonEarthKnowledgeOnField.instanceId);
      // Assert: The new knowledge card is still in hand
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize);
      expect(stateAfterSummon.players[0].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage`);
      // Assert: Action was invalid
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });

    it('should NOT deal damage and NOT replace when opponent attempts to summon onto their occupied slot with earth knowledge', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent / Summoner
      const initialState = createInitialTestState('game24', ['lisovik'], ['pele', 'adaro'], { // P1 has Lisovik
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 a new knowledge card to summon
      const newKnowledgeToSummon = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [newKnowledgeToSummon];

      // Place an earth knowledge card on Player 2's Adaro initially
      const earthKnowledgeOnField = createTestKnowledge('terrestrial1', { cost: 1 });
      const adaroIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[1].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[1].field[adaroFieldIndex].knowledge = earthKnowledgeOnField;

      const initialP1Power = initialState.players[0].power; // Lisovik's owner's power
      const initialDiscardSize = initialState.discardPile.length;
      const initialP2HandSize = initialState.players[1].hand.length;

      const summonAction: GameAction = { // Specified GameAction type
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: newKnowledgeToSummon.id,
          instanceId: newKnowledgeToSummon.instanceId!,
          creatureId: 'adaro', // Target Player 2's Adaro (occupied by earthKnowledgeOnField)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Player 1's (Lisovik's owner) power is unchanged
      expect(stateAfterSummon.players[0].power).toBe(initialP1Power);
      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original earth card is still on P2's field
      const adaroSlotP2After = stateAfterSummon.players[1].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotP2After?.knowledge?.instanceId).toBe(earthKnowledgeOnField.instanceId);
      // Assert: The new knowledge card is still in P2's hand
      expect(stateAfterSummon.players[1].hand.length).toBe(initialP2HandSize);
      expect(stateAfterSummon.players[1].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage`);
      // Assert: Action was invalid
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });

    // Add test case for knowledge leaving via other means (if applicable later)
  });
});