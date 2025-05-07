// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/tsenehale.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState, GameAction, Knowledge } from '../../../src/game/types'; // Added GameAction and Knowledge
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Tsenehale Passive', () => {
  describe('KNOWLEDGE_LEAVE (On Self) - If leaving knowledge is air, owner gains +1 Power', () => {
    it('should NOT give owner +1 Power and NOT replace when owner attempts to summon onto an occupied Tsenehale with air knowledge', () => {
      try {
        const p1Id = 'player1';
        const initialState = createInitialTestState('game31', ['tsenehale'], ['pele'], {
          currentPlayerIndex: 0,
          phase: 'action',
          actionsTakenThisTurn: 0,
        });

        const newKnowledgeToSummon = createTestKnowledge('terrestrial1', { cost: 1 });
        initialState.players[0].hand = [newKnowledgeToSummon];

        const airKnowledgeOnField = createTestKnowledge('aerial1', { cost: 1 });

        const tsenehaleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tsenehale');
        if (tsenehaleIndex === -1) throw new Error("Tsenehale creature not found in initial state");
        initialState.players[0].creatures[tsenehaleIndex].currentWisdom = 1;

        const tsenehaleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'tsenehale');
        if (tsenehaleFieldIndex === -1) throw new Error("Tsenehale field slot not found in initial state");
        initialState.players[0].field[tsenehaleFieldIndex].knowledge = airKnowledgeOnField;

        const initialOwnerPower = initialState.players[0].power;
        const initialDiscardSize = initialState.discardPile.length;
        const initialP1HandSize = initialState.players[0].hand.length;

        const summonAction: GameAction = { // Specified GameAction type
          type: 'SUMMON_KNOWLEDGE',
          payload: {
            playerId: p1Id,
            knowledgeId: newKnowledgeToSummon.id,
            instanceId: newKnowledgeToSummon.instanceId!,
            creatureId: 'tsenehale',
          }
        };
        if (!newKnowledgeToSummon.instanceId) throw new Error("newKnowledgeToSummon.instanceId is missing!");

        const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

        // Assertions: Power should NOT change (Tsenehale passive did not trigger)
        expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
        // Assert: Discard pile size should NOT change (airKnowledgeOnField was not discarded)
        expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
        // Assert: The original air card is still on Tsenehale
        const tsenehaleSlotAfter = stateAfterSummon.players[0].field.find(f => f.creatureId === 'tsenehale');
        expect(tsenehaleSlotAfter?.knowledge?.instanceId).toBe(airKnowledgeOnField.instanceId);
        // Assert: The new knowledge card is still in hand
        expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize);
        expect(stateAfterSummon.players[0].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
        // Assert: Log message for Tsenehale power gain should NOT be present
        expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power`);
        // Assert: Action was invalid
        expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);

      } catch (error) {
        throw error;
      }
    });

    it('should NOT give owner Power and NOT replace when owner attempts to summon onto an occupied Tsenehale with non-air knowledge', () => {
      const p1Id = 'player1';
      const initialState = createInitialTestState('game40', ['tsenehale'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const newKnowledgeToSummon = createTestKnowledge('aerial1', { cost: 1 }); // New knowledge to summon
      initialState.players[0].hand = [newKnowledgeToSummon];

      const earthKnowledgeOnField = createTestKnowledge('terrestrial1', { cost: 1 }); // Knowledge currently on Tsenehale

      const tsenehaleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tsenehale');
      initialState.players[0].creatures[tsenehaleIndex].currentWisdom = 1;

      const tsenehaleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'tsenehale');
      initialState.players[0].field[tsenehaleFieldIndex].knowledge = earthKnowledgeOnField; // Place earth knowledge

      const initialOwnerPower = initialState.players[0].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP1HandSize = initialState.players[0].hand.length;

      const summonAction: GameAction = { // Specified GameAction type
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: newKnowledgeToSummon.id,
          instanceId: newKnowledgeToSummon.instanceId!,
          creatureId: 'tsenehale',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: Power should NOT change
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
      // Assert: Discard pile size should NOT change
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original earth card is still on Tsenehale
      const tsenehaleSlotAfter = stateAfterSummon.players[0].field.find(f => f.creatureId === 'tsenehale');
      expect(tsenehaleSlotAfter?.knowledge?.instanceId).toBe(earthKnowledgeOnField.instanceId);
      // Assert: The new knowledge card is still in hand
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize);
      expect(stateAfterSummon.players[0].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power`);
      // Assert: Action was invalid
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });

    it('should NOT give owner Power and NOT replace when owner attempts to summon onto a DIFFERENT occupied creature with air knowledge', () => {
      const p1Id = 'player1';
      const initialState = createInitialTestState('game41', ['tsenehale', 'pele'], ['adaro'], { // P1 has Tsenehale and Pele
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const newKnowledgeToSummon = createTestKnowledge('terrestrial1', { cost: 1 }); // New knowledge to summon
      initialState.players[0].hand = [newKnowledgeToSummon];

      const airKnowledgeOnField = createTestKnowledge('aerial1', { cost: 1 }); // Knowledge currently on Pele

      // Ensure Pele has wisdom and the air knowledge
      const peleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'pele');
      initialState.players[0].creatures[peleIndex].currentWisdom = 1;
      const peleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'pele');
      initialState.players[0].field[peleFieldIndex].knowledge = airKnowledgeOnField; // Place air knowledge on Pele

      const initialOwnerPower = initialState.players[0].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP1HandSize = initialState.players[0].hand.length;

      // Action: Attempt to summon onto Pele, which is occupied
      const summonAction: GameAction = { // Specified GameAction type
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: newKnowledgeToSummon.id,
          instanceId: newKnowledgeToSummon.instanceId!,
          creatureId: 'pele', // Target Pele, not Tsenehale
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: Power should NOT change
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
      // Assert: Discard pile size should NOT change
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original air card is still on Pele
      const peleSlotAfter = stateAfterSummon.players[0].field.find(f => f.creatureId === 'pele');
      expect(peleSlotAfter?.knowledge?.instanceId).toBe(airKnowledgeOnField.instanceId);
      // Assert: The new knowledge card is still in hand
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize);
      expect(stateAfterSummon.players[0].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power`);
      // Assert: Action was invalid
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });

    it('should NOT give OPPONENT +1 Power and NOT replace when opponent attempts to summon onto their occupied Tsenehale with air knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game42', ['pele'], ['tsenehale'], { // P2 has Tsenehale
        currentPlayerIndex: 1, // Opponent's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const newKnowledgeToSummon = createTestKnowledge('terrestrial1', { cost: 1 }); // New knowledge for P2 to summon
      initialState.players[1].hand = [newKnowledgeToSummon];

      const airKnowledgeOnField = createTestKnowledge('aerial1', { cost: 1 }); // Knowledge currently on P2's Tsenehale

      // Ensure P2's Tsenehale has wisdom and the air knowledge
      const tsenehaleIndex = initialState.players[1].creatures.findIndex(c => c.id === 'tsenehale');
      initialState.players[1].creatures[tsenehaleIndex].currentWisdom = 1;
      const tsenehaleFieldIndex = initialState.players[1].field.findIndex(f => f.creatureId === 'tsenehale');
      initialState.players[1].field[tsenehaleFieldIndex].knowledge = airKnowledgeOnField; // Place air knowledge on P2's Tsenehale

      const initialP1Power = initialState.players[0].power;
      const initialP2Power = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP2HandSize = initialState.players[1].hand.length;

      // Action: P2 attempts to summon onto their Tsenehale
      const summonAction: GameAction = { // Specified GameAction type
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Opponent summons
          knowledgeId: newKnowledgeToSummon.id,
          instanceId: newKnowledgeToSummon.instanceId!,
          creatureId: 'tsenehale', // Target P2's Tsenehale
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: P2's power is unchanged, P1's power is unchanged
      expect(stateAfterSummon.players[1].power).toBe(initialP2Power);
      expect(stateAfterSummon.players[0].power).toBe(initialP1Power);
      // Assert: Discard pile size should NOT change
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The original air card is still on P2's Tsenehale
      const tsenehaleSlotP2After = stateAfterSummon.players[1].field.find(f => f.creatureId === 'tsenehale');
      expect(tsenehaleSlotP2After?.knowledge?.instanceId).toBe(airKnowledgeOnField.instanceId);
      // Assert: The new knowledge card is still in P2's hand
      expect(stateAfterSummon.players[1].hand.length).toBe(initialP2HandSize);
      expect(stateAfterSummon.players[1].hand.find(k => k.instanceId === newKnowledgeToSummon.instanceId)).toBeDefined();
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p2Id}) grants +1 Power`);
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id})`); // P1's passive shouldn't trigger
      // Assert: Action was invalid
      expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    });
  });
});