// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/tsenehale.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Tsenehale Passive', () => {
  describe('KNOWLEDGE_LEAVE (On Self) - If leaving knowledge is air, owner gains +1 Power', () => {
    it('should give owner +1 Power when owner replaces air knowledge on Tsenehale', () => {
      try {
        const p1Id = 'player1';
        const p2Id = 'player2';
        const initialState = createInitialTestState('game31', ['tsenehale'], ['pele'], {
          currentPlayerIndex: 0,
          phase: 'action',
          actionsTakenThisTurn: 0,
        });

        const newKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
        initialState.players[0].hand = [newKnowledge];

        const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });

        const tsenehaleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tsenehale');
        if (tsenehaleIndex === -1) throw new Error("Tsenehale creature not found in initial state");
        initialState.players[0].creatures[tsenehaleIndex].currentWisdom = 1;

        const tsenehaleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'tsenehale');
        if (tsenehaleFieldIndex === -1) throw new Error("Tsenehale field slot not found in initial state");
        initialState.players[0].field[tsenehaleFieldIndex].knowledge = airKnowledge;

        const initialOwnerPower = initialState.players[0].power;
        const initialDiscardSize = initialState.discardPile.length;

        const summonAction = {
          type: 'SUMMON_KNOWLEDGE',
          payload: {
            playerId: p1Id,
            knowledgeId: newKnowledge.id,
            instanceId: newKnowledge.instanceId!,
            creatureId: 'tsenehale',
          }
        };
        if (!newKnowledge.instanceId) throw new Error("newKnowledge.instanceId is missing!");

        const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

        // Assertions...
        expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower + 1);
        expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
        expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
          expect.objectContaining({ instanceId: airKnowledge.instanceId })
        ]));
        expect(stateAfterSummon.log).toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power to owner as ${airKnowledge.name} leaves play from tsenehale.`);
        expect(stateAfterSummon.log).toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);

      } catch (error) {
        throw error;
      }
    });

    it('should NOT give owner Power when owner replaces non-air knowledge on Tsenehale', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game40', ['tsenehale'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
      });

      const newKnowledge = createTestKnowledge('aerial1', { cost: 1 }); // New knowledge to summon
      initialState.players[0].hand = [newKnowledge];

      const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 }); // Knowledge currently on Tsenehale

      const tsenehaleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'tsenehale');
      initialState.players[0].creatures[tsenehaleIndex].currentWisdom = 1;

      const tsenehaleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'tsenehale');
      initialState.players[0].field[tsenehaleFieldIndex].knowledge = earthKnowledge; // Place earth knowledge

      const initialOwnerPower = initialState.players[0].power;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'tsenehale',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: Power should NOT change, log message should NOT be present
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power`);
      expect(stateAfterSummon.log).not.toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);
    });

    it('should give owner Power when owner replaces air knowledge on a DIFFERENT creature', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game41', ['tsenehale', 'pele'], ['adaro'], { // P1 has Tsenehale and Pele
        currentPlayerIndex: 0,
        phase: 'action',
      });

      const newKnowledge = createTestKnowledge('terrestrial1', { cost: 1 }); // New knowledge to summon
      initialState.players[0].hand = [newKnowledge];

      const airKnowledge = createTestKnowledge('aerial1', { cost: 1 }); // Knowledge currently on Pele

      // Ensure Pele has wisdom and the air knowledge
      const peleIndex = initialState.players[0].creatures.findIndex(c => c.id === 'pele');
      initialState.players[0].creatures[peleIndex].currentWisdom = 1;
      const peleFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'pele');
      initialState.players[0].field[peleFieldIndex].knowledge = airKnowledge; // Place air knowledge on Pele

      const initialOwnerPower = initialState.players[0].power;

      // Action: Summon onto Pele, replacing the air knowledge
      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'pele', // Target Pele, not Tsenehale
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: Power SHOULD change due to Tsenehale's passive
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower + 1);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power to owner as ${airKnowledge.name} leaves play from pele.`); // Check log includes correct creature ID
      expect(stateAfterSummon.log).toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);
    });

    it('should give OPPONENT +1 Power when opponent replaces air knowledge on their Tsenehale', () => {
      const p1Id = 'player1';
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game42', ['pele'], ['tsenehale'], { // P2 has Tsenehale
        currentPlayerIndex: 1, // Opponent's turn
        phase: 'action',
      });

      const newKnowledge = createTestKnowledge('terrestrial1', { cost: 1 }); // New knowledge for P2 to summon
      initialState.players[1].hand = [newKnowledge];

      const airKnowledge = createTestKnowledge('aerial1', { cost: 1 }); // Knowledge currently on P2's Tsenehale

      // Ensure P2's Tsenehale has wisdom and the air knowledge
      const tsenehaleIndex = initialState.players[1].creatures.findIndex(c => c.id === 'tsenehale');
      initialState.players[1].creatures[tsenehaleIndex].currentWisdom = 1;
      const tsenehaleFieldIndex = initialState.players[1].field.findIndex(f => f.creatureId === 'tsenehale');
      initialState.players[1].field[tsenehaleFieldIndex].knowledge = airKnowledge; // Place air knowledge on P2's Tsenehale

      const initialP1Power = initialState.players[0].power;
      const initialP2Power = initialState.players[1].power;

      // Action: P2 summons onto their Tsenehale
      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Opponent summons
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'tsenehale', // Target P2's Tsenehale
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assertions: P2's power increases, P1's power is unchanged
      expect(stateAfterSummon.players[1].power).toBe(initialP2Power + 1);
      expect(stateAfterSummon.players[0].power).toBe(initialP1Power);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Tsenehale (Owner: ${p2Id}) grants +1 Power to owner as ${airKnowledge.name} leaves play from tsenehale.`);
      expect(stateAfterSummon.log).toContain(`Power: ${initialP2Power} -> ${initialP2Power + 1}`);
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id})`); // P1's passive shouldn't trigger
    });
  });
});