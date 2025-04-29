// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/inkanyamba.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Inkanyamba Passive', () => {
  describe('AFTER_PLAYER_DRAW - Discard 1 card from market', () => {
    it('should discard 1 card from market when owner draws a card', () => {
      const p1Id = 'player1'; // Inkanyamba's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game15', ['inkanyamba'], ['pele'], { // P1 has Inkanyamba
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
        market: [ // Ensure market has cards
            createTestKnowledge('aerial1'),
            createTestKnowledge('aquatic1'),
            createTestKnowledge('terrestrial1'),
            createTestKnowledge('aerial2'),
        ],
        knowledgeDeck: [createTestKnowledge('terrestrial2')] // Ensure deck has card to refill market
      });

      const initialMarketSize = initialState.market.length;
      const initialDiscardSize = initialState.discardPile.length;
      const cardToBeDrawn = initialState.market[0]; // The card the player will draw
      const cardToBeDiscardedByPassive = initialState.market[1]; // The card Inkanyamba should discard (now the 2nd card)
      const cardToRefill = initialState.knowledgeDeck[0];

      const drawAction = {
        type: 'DRAW_KNOWLEDGE', // Use DRAW_KNOWLEDGE
        payload: {
          playerId: p1Id,
          knowledgeId: cardToBeDrawn.id, // Add knowledgeId
          instanceId: cardToBeDrawn.instanceId!, // Add instanceId
        }
      };

      const stateAfterDraw = gameReducer(initialState, drawAction) as GameState;

      // Assert: Market size is unchanged (1 drawn, 1 discarded, 1 refilled)
      expect(stateAfterDraw.market.length).toBe(initialMarketSize - 1); // Draw 1, Discard 1, Refill 1 = Net -1
      // Assert: Discard pile size increased by 1 (Inkanyamba discard)
      expect(stateAfterDraw.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The card discarded by the passive is in the discard pile
      expect(stateAfterDraw.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToBeDiscardedByPassive.instanceId })
      ]));
      // Assert: The card drawn by the player is NOT in the market
      expect(stateAfterDraw.market).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToBeDrawn.instanceId })
      ]));
      // Assert: The card discarded by the passive is NOT in the market
      expect(stateAfterDraw.market).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToBeDiscardedByPassive.instanceId })
      ]));
       // Assert: The refill card IS in the market
      expect(stateAfterDraw.market).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToRefill.instanceId })
      ]));
      // Assert: Log message is present for the passive discard
      expect(stateAfterDraw.log).toContain(`[Passive Effect] Inkanyamba (Owner: ${p1Id}) discards ${cardToBeDiscardedByPassive.name} from Market.`);
    });

    it('should NOT discard a card from market if opponent draws a card', () => {
      const p1Id = 'player1'; // Inkanyamba's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game16', ['inkanyamba'], ['pele'], { // P1 has Inkanyamba
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
        market: [ // Ensure market has cards
            createTestKnowledge('aerial1'),
            createTestKnowledge('aquatic1'),
            createTestKnowledge('terrestrial1'),
            createTestKnowledge('aerial2'),
        ],
        knowledgeDeck: [createTestKnowledge('terrestrial2')] // Ensure deck has card to refill market
      });

      const initialMarketSize = initialState.market.length; // 4
      const initialDiscardSize = initialState.discardPile.length;
      const cardToBeDrawn = initialState.market[0];

      const drawAction = {
        type: 'DRAW_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: cardToBeDrawn.id,
          instanceId: cardToBeDrawn.instanceId!,
        }
      };

      const stateAfterDraw = gameReducer(initialState, drawAction) as GameState;

      // Assert: Market size should be unchanged (1 drawn, 1 refilled by drawKnowledge)
      expect(stateAfterDraw.market.length).toBe(initialMarketSize); // Changed from initialMarketSize - 1
      // Assert: Discard pile size is unchanged
      expect(stateAfterDraw.discardPile.length).toBe(initialDiscardSize);
      // Assert: Log message for Inkanyamba discard should NOT be present
      expect(stateAfterDraw.log).not.toContain(`[Passive Effect] Inkanyamba (Owner: ${p1Id}) discards`);
    });

    it('should NOT discard a card if market is empty when owner draws', () => {
      const p1Id = 'player1'; // Inkanyamba's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game17', ['inkanyamba'], ['pele'], { // P1 has Inkanyamba
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
        market: [], // Empty market
        knowledgeDeck: [createTestKnowledge('terrestrial2')] // Deck has card, but market is empty initially
      });

      // Need a card in the deck to draw for the action to be valid
      const cardToDrawFromDeck = initialState.knowledgeDeck[0];
      initialState.knowledgeDeck = []; // Clear deck after getting the card ref
      initialState.market = [cardToDrawFromDeck]; // Put the card in the market to be drawn

      const initialMarketSize = initialState.market.length; // Should be 1
      const initialDiscardSize = initialState.discardPile.length;

      const drawAction = {
        type: 'DRAW_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: cardToDrawFromDeck.id,
          instanceId: cardToDrawFromDeck.instanceId!,
        }
      };

      const stateAfterDraw = gameReducer(initialState, drawAction) as GameState;

      // Assert: Market size should be 0 (1 drawn, passive triggers on empty market, no refill)
      expect(stateAfterDraw.market.length).toBe(0);
      // Assert: Discard pile size is unchanged
      expect(stateAfterDraw.discardPile.length).toBe(initialDiscardSize);
      // Assert: Log message for Inkanyamba discard should NOT be present
      expect(stateAfterDraw.log).not.toContain(`[Passive Effect] Inkanyamba (Owner: ${p1Id}) discards`);
      // Optional: Add a log message in passives.ts for when market is empty?
      // expect(stateAfterDraw.log).toContain(`[Passive Effect] Inkanyamba triggered, but Market is empty.`);
    });

    it('should discard but not refill market if deck is empty when owner draws', () => {
      const p1Id = 'player1'; // Inkanyamba's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game18', ['inkanyamba'], ['pele'], { // P1 has Inkanyamba
        currentPlayerIndex: 0, // Player 1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
        market: [ // Ensure market has cards
            createTestKnowledge('aerial1'), // Card to be drawn
            createTestKnowledge('aquatic1'), // Card to be discarded
            createTestKnowledge('terrestrial1'),
        ],
        knowledgeDeck: [] // Empty deck
      });

      const initialMarketSize = initialState.market.length; // 3
      const initialDiscardSize = initialState.discardPile.length;
      const cardToBeDrawn = initialState.market[0];
      const cardToBeDiscardedByPassive = initialState.market[1];

      const drawAction = {
        type: 'DRAW_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: cardToBeDrawn.id,
          instanceId: cardToBeDrawn.instanceId!,
        }
      };

      const stateAfterDraw = gameReducer(initialState, drawAction) as GameState;

      // Assert: Market size decreased by 2 (1 drawn, 1 discarded, no refill)
      expect(stateAfterDraw.market.length).toBe(initialMarketSize - 2); // Should be 1
      // Assert: Discard pile size increased by 1
      expect(stateAfterDraw.discardPile.length).toBe(initialDiscardSize + 1);
      // Assert: The discarded card is in the discard pile
      expect(stateAfterDraw.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToBeDiscardedByPassive.instanceId })
      ]));
      // Assert: Neither drawn nor discarded card is in the market
      expect(stateAfterDraw.market).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: cardToBeDrawn.instanceId }),
        expect.objectContaining({ instanceId: cardToBeDiscardedByPassive.instanceId })
      ]));
      // Assert: Log message is present
      expect(stateAfterDraw.log).toContain(`[Passive Effect] Inkanyamba (Owner: ${p1Id}) discards ${cardToBeDiscardedByPassive.name} from Market.`);
    });

    // Add test case for owner drawing via other means (e.g., Adaro passive - requires careful setup)
  });
});