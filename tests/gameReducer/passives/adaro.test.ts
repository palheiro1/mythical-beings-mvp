// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/adaro.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Adaro Passive', () => {
  describe('AFTER_PLAYER_SUMMON (on self) - If summoned knowledge is water, draw 1 card from market (free)', () => {
    it('should draw 1 card from market when water knowledge is summoned onto Adaro', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game3', ['adaro'], ['pele'], {
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a water knowledge card in hand
      const waterCard = createTestKnowledge('aquatic1', { cost: 1 }); // Ensure cost is low enough for wisdom
      initialState.players[0].hand = [waterCard];
      initialState.players[0].creatures[0].currentWisdom = 1; // Ensure Adaro has enough wisdom

      const initialHandSize = initialState.players[0].hand.length;
      const initialMarketSize = initialState.market.length;
      const initialDeckSize = initialState.knowledgeDeck.length;
      const cardDrawnFromMarket = initialState.market[0]; // The card expected to be drawn

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: waterCard.id,
          instanceId: waterCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Hand size increased by 1 (summoned card removed, market card added)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialHandSize); // -1 summon +1 draw = 0 change
      // Assert: The drawn card is in the hand
      expect(stateAfterSummon.players[0].hand).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardDrawnFromMarket.instanceId })
      ]));
      // Assert: Market size is unchanged (card drawn, card refilled from deck)
      expect(stateAfterSummon.market.length).toBe(initialMarketSize);
      // Assert: Deck size decreased by 1 (refilled market)
      expect(stateAfterSummon.knowledgeDeck.length).toBe(initialDeckSize - 1);
      // Assert: Log message is present
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Adaro (Owner: ${p1Id}) triggers free draw.`);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] ${p1Id} drew ${cardDrawnFromMarket.name} from Market due to Adaro passive.`);
    });

    it('should NOT draw a card if non-water knowledge is summoned onto Adaro', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game4', ['adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a non-water knowledge card
      const nonWaterCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [nonWaterCard];
      initialState.players[0].creatures[0].currentWisdom = 1;

      const initialHandSize = initialState.players[0].hand.length;
      const initialMarketSize = initialState.market.length;
      const initialDeckSize = initialState.knowledgeDeck.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: nonWaterCard.id,
          instanceId: nonWaterCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Hand size decreased by 1 (summoned card removed, no draw)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialHandSize - 1);
      // Assert: Market size is unchanged (no draw)
      expect(stateAfterSummon.market.length).toBe(initialMarketSize);
      // Assert: Deck size is unchanged (no draw)
      expect(stateAfterSummon.knowledgeDeck.length).toBe(initialDeckSize);
      // Assert: Log message for Adaro draw should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Adaro (Owner: ${p1Id}) triggers free draw.`);
      expect(stateAfterSummon.log).not.toContain(`drew`); // General check for any draw log
    });

    it('should NOT draw a card if water knowledge is summoned onto a different creature', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      // Player 1 has Adaro and another creature (e.g., Dudugera)
      const initialState = createInitialTestState('game5', ['adaro', 'dudugera'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Give player 1 a water knowledge card
      const waterCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[0].hand = [waterCard];
      // Ensure the target creature (Dudugera) has enough wisdom
      const dudugeraIndex = initialState.players[0].creatures.findIndex(c => c.id === 'dudugera');
      initialState.players[0].creatures[dudugeraIndex].currentWisdom = 1;

      const initialHandSize = initialState.players[0].hand.length;
      const initialMarketSize = initialState.market.length;
      const initialDeckSize = initialState.knowledgeDeck.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: waterCard.id,
          instanceId: waterCard.instanceId!,
          creatureId: 'dudugera', // Target Dudugera, NOT Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Hand size decreased by 1 (summoned card removed, no draw)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialHandSize - 1);
      // Assert: Market size is unchanged (no draw)
      expect(stateAfterSummon.market.length).toBe(initialMarketSize);
      // Assert: Deck size is unchanged (no draw)
      expect(stateAfterSummon.knowledgeDeck.length).toBe(initialDeckSize);
      // Assert: Log message for Adaro draw should NOT be present
      expect(stateAfterSummon.log).not.toContain(`[Passive Effect] Adaro (Owner: ${p1Id}) triggers free draw.`);
      expect(stateAfterSummon.log).not.toContain(`drew`); // General check for any draw log
    });

    it('should NOT draw a card if the market is empty when passive triggers', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game6', ['adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
        market: [], // Empty market
        knowledgeDeck: [], // Ensure deck is also empty so market doesn't refill
      });

      // Give player 1 a water knowledge card
      const waterCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[0].hand = [waterCard];
      initialState.players[0].creatures[0].currentWisdom = 1;

      const initialHandSize = initialState.players[0].hand.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: waterCard.id,
          instanceId: waterCard.instanceId!,
          creatureId: 'adaro', // Target Adaro
        }
      };

      const stateAfterSummon = gameReducer(initialState, summonAction) as GameState;

      // Assert: Hand size decreased by 1 (summoned card removed, no draw)
      expect(stateAfterSummon.players[0].hand.length).toBe(initialHandSize - 1);
      // Assert: Market remains empty
      expect(stateAfterSummon.market.length).toBe(0);
      // Assert: Deck remains empty
      expect(stateAfterSummon.knowledgeDeck.length).toBe(0);
      // Assert: Log message indicates trigger but empty market
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Adaro (Owner: ${p1Id}) triggers free draw.`);
      expect(stateAfterSummon.log).toContain(`[Passive Effect] Adaro triggered, but Market is empty.`);
      expect(stateAfterSummon.log).not.toContain(`drew`); // General check for any draw log
    });
  });
});