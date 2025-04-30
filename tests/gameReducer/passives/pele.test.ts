// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/pele.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Pele Passive', () => {
  describe('AFTER_SUMMON (Owner) - If owner summoned earth knowledge, discard 1 opponent knowledge with lower cost', () => {
    it('should discard 1 opponent knowledge with lower cost when owner summons earth knowledge', () => {
      const p1Id = 'player1'; // Pele's owner and summoner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game25', ['pele', 'adaro'], ['kyzy', 'lisovik'], { // P1 has Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an earth knowledge card to summon (cost 2)
      const earthCardSummoned = createTestKnowledge('terrestrial2', { cost: 2 });
      initialState.players[0].hand = [earthCardSummoned];
      const adaroIndexP1 = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndexP1].currentWisdom = 2; // Ensure wisdom

      // Give opponent knowledge cards on their creatures
      const lowerCostKnowledge = createTestKnowledge('aerial1', { cost: 1 }); // Cost 1 (Lower)
      const higherCostKnowledge = createTestKnowledge('aquatic3', { cost: 3 }); // Cost 3 (Higher)
      const kyzyFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'kyzy');
      const lisovikFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'lisovik');
      initialState.players[1].field[kyzyFieldIndexP2].knowledge = lowerCostKnowledge;
      initialState.players[1].field[lisovikFieldIndexP2].knowledge = higherCostKnowledge;

      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCardSummoned.id,
          instanceId: earthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P1's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size increased by 1
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The discarded card is the lower cost one
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: lowerCostKnowledge.instanceId })
      ]));
      // Assert: The lower cost card is removed from opponent's field
      expect(stateAfterSummon.players[1].field[kyzyFieldIndexP2].knowledge).toBeNull();
      // Assert: The higher cost card remains on opponent's field
      expect(stateAfterSummon.players[1].field[lisovikFieldIndexP2].knowledge?.instanceId).toBe(higherCostKnowledge.instanceId);
      // Assert: Log message indicates discard
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards ${lowerCostKnowledge.name} (Cost: ${lowerCostKnowledge.cost}) from opponent ${p2Id}'s ${initialState.players[1].field[kyzyFieldIndexP2].creatureId}.`);
    });

    it('should discard only the first lower cost opponent knowledge if multiple exist', () => {
      const p1Id = 'player1'; // Pele's owner and summoner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game26', ['pele', 'adaro'], ['kyzy', 'lisovik'], { // P1 has Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an earth knowledge card to summon (cost 3)
      const earthCardSummoned = createTestKnowledge('terrestrial3', { cost: 3 });
      initialState.players[0].hand = [earthCardSummoned];
      const adaroIndexP1 = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndexP1].currentWisdom = 3; // Ensure wisdom

      // Give opponent multiple knowledge cards with lower cost
      const lowerCostKnowledge1 = createTestKnowledge('aerial1', { cost: 1 }); // Cost 1
      const lowerCostKnowledge2 = createTestKnowledge('aquatic2', { cost: 2 }); // Cost 2
      const kyzyFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'kyzy');
      const lisovikFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'lisovik');
      // Place them in a specific order to test which one is discarded (Kyzy first)
      initialState.players[1].field[kyzyFieldIndexP2].knowledge = lowerCostKnowledge1;
      initialState.players[1].field[lisovikFieldIndexP2].knowledge = lowerCostKnowledge2;

      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCardSummoned.id,
          instanceId: earthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P1's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size increased by 1
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The discarded card is the FIRST lower cost one found (lowerCostKnowledge1 on Kyzy)
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: lowerCostKnowledge1.instanceId })
      ]));
      // Assert: The first lower cost card is removed from opponent's field
      expect(stateAfterSummon.players[1].field[kyzyFieldIndexP2].knowledge).toBeNull();
      // Assert: The second lower cost card remains on opponent's field
      expect(stateAfterSummon.players[1].field[lisovikFieldIndexP2].knowledge?.instanceId).toBe(lowerCostKnowledge2.instanceId);
      // Assert: Log message indicates discard of the first card
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards ${lowerCostKnowledge1.name} (Cost: ${lowerCostKnowledge1.cost}) from opponent ${p2Id}'s ${initialState.players[1].field[kyzyFieldIndexP2].creatureId}.`);
      // Assert: Log message does NOT indicate discard of the second card
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards ${lowerCostKnowledge2.name}`);
    });

    it('should NOT discard if opponent only has equal/higher cost knowledge', () => {
      const p1Id = 'player1'; // Pele's owner and summoner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game27', ['pele', 'adaro'], ['kyzy', 'lisovik'], { // P1 has Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an earth knowledge card to summon (cost 2)
      const earthCardSummoned = createTestKnowledge('terrestrial2', { cost: 2 });
      initialState.players[0].hand = [earthCardSummoned];
      const adaroIndexP1 = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndexP1].currentWisdom = 2; // Ensure wisdom

      // Give opponent knowledge cards with equal or higher cost
      const equalCostKnowledge = createTestKnowledge('aerial2', { cost: 2 }); // Cost 2 (Equal)
      const higherCostKnowledge = createTestKnowledge('aquatic3', { cost: 3 }); // Cost 3 (Higher)
      const kyzyFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'kyzy');
      const lisovikFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'lisovik');
      initialState.players[1].field[kyzyFieldIndexP2].knowledge = equalCostKnowledge;
      initialState.players[1].field[lisovikFieldIndexP2].knowledge = higherCostKnowledge;

      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCardSummoned.id,
          instanceId: earthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P1's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Opponent's knowledge cards remain on their field
      expect(stateAfterSummon.players[1].field[kyzyFieldIndexP2].knowledge?.instanceId).toBe(equalCostKnowledge.instanceId);
      expect(stateAfterSummon.players[1].field[lisovikFieldIndexP2].knowledge?.instanceId).toBe(higherCostKnowledge.instanceId);
      // Assert: Log message for Pele discard should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards`);
    });

    it('should NOT discard if opponent has no knowledge cards', () => {
      const p1Id = 'player1'; // Pele's owner and summoner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game28', ['pele', 'adaro'], ['kyzy', 'lisovik'], { // P1 has Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 an earth knowledge card to summon (cost 2)
      const earthCardSummoned = createTestKnowledge('terrestrial2', { cost: 2 });
      initialState.players[0].hand = [earthCardSummoned];
      const adaroIndexP1 = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndexP1].currentWisdom = 2; // Ensure wisdom

      // Ensure opponent has no knowledge cards
      initialState.players[1].field.forEach(slot => slot.knowledge = null);

      const initialDiscardSize = initialState.discardPile.length;
      const initialOpponentField = JSON.parse(JSON.stringify(initialState.players[1].field)); // Deep clone for comparison

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCardSummoned.id,
          instanceId: earthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P1's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Opponent's field remains unchanged (empty of knowledge)
      expect(stateAfterSummon.players[1].field).toEqual(initialOpponentField);
      // Assert: Log message for Pele discard should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards`);
    });

    it('should NOT discard if owner summons non-earth knowledge', () => {
      const p1Id = 'player1'; // Pele's owner and summoner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game29', ['pele', 'adaro'], ['kyzy'], { // P1 has Pele
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a NON-earth knowledge card to summon (cost 2)
      const nonEarthCardSummoned = createTestKnowledge('aerial2', { cost: 2 }); // Air card
      initialState.players[0].hand = [nonEarthCardSummoned];
      const adaroIndexP1 = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndexP1].currentWisdom = 2; // Ensure wisdom

      // Give opponent a knowledge card (lower cost)
      const opponentKnowledge = createTestKnowledge('aquatic1', { cost: 1 });
      const kyzyFieldIndexP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'kyzy');
      initialState.players[1].field[kyzyFieldIndexP2].knowledge = opponentKnowledge;

      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: nonEarthCardSummoned.id,
          instanceId: nonEarthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P1's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Opponent's knowledge card remains on their field
      expect(stateAfterSummon.players[1].field[kyzyFieldIndexP2].knowledge?.instanceId).toBe(opponentKnowledge.instanceId);
      // Assert: Log message for Pele discard should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards`);
    });

    it('should NOT discard if opponent summons earth knowledge', () => {
      const p1Id = 'player1'; // Pele's owner
      const p2Id = 'player2'; // Opponent / Summoner
      const initialState = createInitialTestState('game30', ['pele', 'kyzy'], ['adaro'], { // P1 has Pele
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 an earth knowledge card to summon (cost 2)
      const earthCardSummoned = createTestKnowledge('terrestrial2', { cost: 2 });
      initialState.players[1].hand = [earthCardSummoned];
      const adaroIndexP2 = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndexP2].currentWisdom = 2; // Ensure wisdom

      // Give player 1 (Pele's owner) a knowledge card (lower cost)
      const ownerKnowledge = createTestKnowledge('aerial1', { cost: 1 });
      const kyzyFieldIndexP1 = initialState.players[0].field.findIndex(f => f.creatureId === 'kyzy');
      initialState.players[0].field[kyzyFieldIndexP1].knowledge = ownerKnowledge;

      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: earthCardSummoned.id,
          instanceId: earthCardSummoned.instanceId!,
          creatureId: 'adaro', // Target P2's Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Player 1's (Pele's owner) knowledge card remains on their field
      expect(stateAfterSummon.players[0].field[kyzyFieldIndexP1].knowledge?.instanceId).toBe(ownerKnowledge.instanceId);
      // Assert: Log message for Pele discard should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards`);
    });
  });
});