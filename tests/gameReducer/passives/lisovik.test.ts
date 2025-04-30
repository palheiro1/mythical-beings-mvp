// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/lisovik.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Lisovik Passive', () => {
  describe('KNOWLEDGE_LEAVE (Owner) - If leaving knowledge is earth, deal 1 damage to opponent', () => {
    it('should deal 1 damage to opponent when owner replaces earth knowledge', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game22', ['lisovik', 'adaro'], ['pele'], { // P1 has Lisovik & Adaro
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a new knowledge card to summon
      const newKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[0].hand = [newKnowledge];

      // Place an earth knowledge card on Adaro initially
      const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIndex].knowledge = earthKnowledge;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'adaro', // Target Adaro (replacing earthKnowledge)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Opponent's power decreased by 1
      expect(stateAfterSummon.players[1].power).toBe(initialOpponentPower - 1);
      // Assert: Discard pile size increased by 1 (the replaced earth card)
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The replaced earth card is in the discard pile
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: earthKnowledge.instanceId })
      ]));
      // Assert: Log message indicates damage dealt
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id} as ${earthKnowledge.name} leaves play.`);
      expect(stateAfterSummon.log).toContain(`Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
    });

    it('should NOT deal damage to opponent when owner replaces non-earth knowledge', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game23', ['lisovik', 'adaro'], ['pele'], { // P1 has Lisovik & Adaro
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a new knowledge card to summon
      const newKnowledge = createTestKnowledge('terrestrial1', { cost: 1 }); // Earth card this time
      initialState.players[0].hand = [newKnowledge];

      // Place a NON-earth knowledge card on Adaro initially
      const nonEarthKnowledge = createTestKnowledge('aerial1', { cost: 1 }); // Air card
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIndex].knowledge = nonEarthKnowledge;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'adaro', // Target Adaro (replacing nonEarthKnowledge)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Opponent's power is unchanged
      expect(stateAfterSummon.players[1].power).toBe(initialOpponentPower);
      // Assert: Discard pile size increased by 1 (the replaced non-earth card)
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The replaced non-earth card is in the discard pile
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: nonEarthKnowledge.instanceId })
      ]));
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage`);
      expect(stateAfterSummon.log).not.toContain(`Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
    });

    it('should NOT deal damage to opponent when opponent replaces earth knowledge', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent / Summoner
      const initialState = createInitialTestState('game24', ['lisovik'], ['pele', 'adaro'], { // P1 has Lisovik
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 a new knowledge card to summon
      const newKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [newKnowledge];

      // Place an earth knowledge card on Player 2's Adaro initially
      const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
      const adaroIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[1].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[1].field[adaroFieldIndex].knowledge = earthKnowledge;

      const initialP1Power = initialState.players[0].power; // Lisovik's owner's power
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: newKnowledge.id,
          instanceId: newKnowledge.instanceId!,
          creatureId: 'adaro', // Target Player 2's Adaro (replacing earthKnowledge)
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Player 1's (Lisovik's owner) power is unchanged
      expect(stateAfterSummon.players[0].power).toBe(initialP1Power);
      // Assert: Discard pile size increased by 1 (the replaced earth card)
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The replaced earth card is in the discard pile
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: earthKnowledge.instanceId })
      ]));
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage`);
      // Check specifically against the opponent ID in the damage log, just in case
      expect(stateAfterSummon.log).not.toContain(`deals 1 damage to ${p2Id}`);
    });

    // Add test case for knowledge leaving via other means (if applicable later)
  });
});