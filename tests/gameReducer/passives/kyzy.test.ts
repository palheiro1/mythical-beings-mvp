// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/kyzy.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Kyzy Passive', () => {
  describe('AFTER_SUMMON (Any) - If earth knowledge summoned, force OPPONENT of Kyzy\'s owner to discard 1 card', () => {
    it('should force opponent (summoner) to discard 1 card when they summon earth knowledge', () => {
      const p1Id = 'player1'; // Kyzy's owner
      const p2Id = 'player2'; // Summoner
      const initialState = createInitialTestState('game7', ['kyzy'], ['pele'], { // P1 has Kyzy
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      const otherCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [earthCard, otherCard]; // Summoner's hand
      initialState.players[1].creatures[0].currentWisdom = 1;

      const initialSummonerHandSize = initialState.players[1].hand.length;
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id, // Player 2 summons
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'pele', // Target Pele
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Summoner (Player 2) hand size decreased by 2 (summon + discard)
      expect(stateAfterSummon.players[1].hand.length).toBe(initialSummonerHandSize - 2);
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The discarded card is the 'otherCard' from the summoner's hand
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: otherCard.instanceId })
      ]));
      // Assert: Log message confirms Player 2 discarded
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Kyzy (Owner: ${p1Id}) forces discard from opponent ${p2Id}.`);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] ${p2Id} discarded ${otherCard.name} due to Kyzy passive.`);
    });

    it('should NOT force discard if non-earth knowledge is summoned', () => {
      const p1Id = 'player1'; // Kyzy's owner
      const p2Id = 'player2'; // Summoner
      const initialState = createInitialTestState('game8', ['kyzy'], ['pele'], { // P1 has Kyzy
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 a non-earth knowledge card and another card
      const nonEarthCard = createTestKnowledge('aerial1', { cost: 1 }); // Air card
      const otherCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[1].hand = [nonEarthCard, otherCard];
      initialState.players[1].creatures[0].currentWisdom = 1;

      const initialSummonerHandSize = initialState.players[1].hand.length;
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: nonEarthCard.id,
          instanceId: nonEarthCard.instanceId!,
          creatureId: 'pele',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Summoner's hand size decreased by 1 (only the summoned card)
      expect(stateAfterSummon.players[1].hand.length).toBe(initialSummonerHandSize - 1);
      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: The other card is still in hand
      expect(stateAfterSummon.players[1].hand).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: otherCard.instanceId })
      ]));
      // Assert: Log message for Kyzy discard should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Kyzy (Owner: ${p1Id}) forces discard`);
      expect(stateAfterSummon.log).not.toContain(`discarded`); // General check for discard log
    });

    it('should NOT force discard if opponent summons earth knowledge but has no other cards', () => {
      const p1Id = 'player1'; // Kyzy's owner
      const p2Id = 'player2'; // Summoner
      const initialState = createInitialTestState('game10', ['kyzy'], ['pele'], { // P1 has Kyzy
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 2 only the earth knowledge card
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[1].hand = [earthCard]; // Summoner's hand has only this card
      initialState.players[1].creatures[0].currentWisdom = 1;

      const initialSummonerHandSize = initialState.players[1].hand.length; // Should be 1
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'pele',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Summoner (Player 2) hand size is 0 (only summoned card removed)
      expect(stateAfterSummon.players[1].hand.length).toBe(0);
      // Assert: Discard pile size is unchanged (no discard occurred)
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Log message indicates no other cards to discard, and the initial "forces discard" is NOT present
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Kyzy triggered discard, but opponent ${p2Id} had no other cards to discard.`);
      expect(stateAfterSummon.log).not.toContain(`discarded`); // Check specific discard log isn't present
    });

    it('should force OPPONENT to discard if Kyzy\'s owner summons earth knowledge', () => {
      const p1Id = 'player1'; // Kyzy's owner and summoner
      const p2Id = 'player2'; // Opponent (should discard)
      const initialState = createInitialTestState('game9', ['kyzy', 'adaro'], ['pele'], { // P1 has Kyzy
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 (summoner) an earth knowledge card
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [earthCard];
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      // Give player 2 (opponent) a card to discard
      const opponentCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [opponentCard];

      const initialP1HandSize = initialState.players[0].hand.length;
      const initialP2HandSize = initialState.players[1].hand.length;
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Player 1's hand size decreased by 1 (summoned card)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize - 1);
      // Assert: Player 2's hand size decreased by 1 (discarded card)
      expect(stateAfterSummon.players[1].hand.length).toBe(initialP2HandSize - 1);
      // Assert: Discard pile size increased by 1
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The discarded card is the opponent's card
      expect(stateAfterSummon.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: opponentCard.instanceId })
      ]));
      // Assert: Log message confirms Player 2 discarded
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Kyzy (Owner: ${p1Id}) forces discard from opponent ${p2Id}.`);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] ${p2Id} discarded ${opponentCard.name} due to Kyzy passive.`);
    });

    it('should NOT force discard if opponent has no cards when owner summons earth knowledge', () => {
      const p1Id = 'player1'; // Kyzy's owner and summoner
      const p2Id = 'player2'; // Opponent (should discard, but has no cards)
      const initialState = createInitialTestState('game11', ['kyzy', 'adaro'], ['pele'], { // P1 has Kyzy
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 (summoner) an earth knowledge card
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [earthCard];
      const adaroIndex = initialState.players[0].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[0].creatures[adaroIndex].currentWisdom = 1;

      // Ensure player 2 (opponent) has no cards
      initialState.players[1].hand = [];

      const initialP1HandSize = initialState.players[0].hand.length;
      const initialP2HandSize = initialState.players[1].hand.length; // Should be 0
      const initialDiscardSize = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id, // Player 1 summons
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Player 1's hand size decreased by 1 (summoned card)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialP1HandSize - 1);
      // Assert: Player 2's hand size remains 0
      expect(stateAfterSummon.players[1].hand.length).toBe(0);
      // Assert: Discard pile size is unchanged
      expect(stateAfterSummon.discardPile.length).toBe(initialDiscardSize);
      // Assert: Log message indicates no cards to discard
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Kyzy triggered discard, but opponent ${p2Id} had no other cards to discard.`);
      expect(stateAfterSummon.log).not.toContain(`discarded`); // Check specific discard log isn't present
    });
  });
});