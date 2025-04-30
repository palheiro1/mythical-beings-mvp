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
    // Add test case: Owner replaces non-air knowledge on Tsenehale
    // Add test case: Owner replaces air knowledge on a DIFFERENT creature
    // Add test case: Opponent replaces air knowledge on their Tsenehale
  });
});