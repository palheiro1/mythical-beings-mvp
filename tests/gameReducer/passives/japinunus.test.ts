// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/japinunus.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Japinunus Passive', () => {
  describe('AFTER_SUMMON (Owner) - If owner summoned air knowledge, owner gains +1 Power', () => {
    it('should give owner +1 Power when they summon air knowledge', () => {
      const p1Id = 'player1'; // Japinunus's owner and summoner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game12', ['japinunus', 'adaro'], ['pele'], { // P1 has Japinunus
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an air knowledge card
      const airCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[0].hand = [airCard];
      // Ensure a creature (Adaro) has enough wisdom
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      const initialOwnerPower = initialState.players[0].power;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: airCard.id,
          instanceId: airCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Owner's power increased by 1
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower + 1);
      // Assert: Log message is present
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Japinunus (Owner: ${p1Id}) grants +1 Power to owner.`);
      expect(stateAfterSummon.log).toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);
    });

    it('should NOT give owner Power if they summon non-air knowledge', () => {
      const p1Id = 'player1'; // Japinunus's owner and summoner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game13', ['japinunus', 'adaro'], ['pele'], { // P1 has Japinunus
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a non-air knowledge card
      const nonAirCard = createTestKnowledge('terrestrial1', { cost: 1 }); // Earth card
      initialState.players[0].hand = [nonAirCard];
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      const initialOwnerPower = initialState.players[0].power;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: nonAirCard.id,
          instanceId: nonAirCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Owner's power is unchanged
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
      // Assert: Log message for Japinunus power gain should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Japinunus (Owner: ${p1Id}) grants +1 Power`);
      expect(stateAfterSummon.log).not.toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);
    });

    it('should NOT give owner Power if opponent summons air knowledge', () => {
      const p1Id = 'player1'; // Japinunus's owner
      const p2Id = 'player2'; // Summoner
      const initialState = createInitialTestState('game14', ['japinunus'], ['pele', 'adaro'], { // P1 has Japinunus
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 an air knowledge card
      const airCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [airCard];
      // Ensure opponent's creature (Adaro) has enough wisdom
      const adaroIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndex].currentWisdom = 1;

      const initialOwnerPower = initialState.players[0].power; // Power of Japinunus's owner

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: airCard.id,
          instanceId: airCard.instanceId!,
          creatureId: 'adaro', // Target opponent's creature
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Owner's power is unchanged
      expect(stateAfterSummon.players[0].power).toBe(initialOwnerPower);
      // Assert: Log message for Japinunus power gain should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Japinunus (Owner: ${p1Id}) grants +1 Power`);
      expect(stateAfterSummon.log).not.toContain(`Power: ${initialOwnerPower} -> ${initialOwnerPower + 1}`);
    });
  });
});
