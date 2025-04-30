// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/zhar-ptitsa.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Zhar-Ptitsa Passive', () => {
  describe('TURN_START - Owner draws 1 card from market (free)', () => {
    it('should draw 1 card and refill market when owner starts turn and market/deck have cards', () => {
      const p1Id = 'player1'; // Zhar-Ptitsa's owner
      const p2Id = 'player2';
      const initialMarketCard = createTestKnowledge('aerial1');
      const initialDeckCard = createTestKnowledge('terrestrial1');

      const initialState = createInitialTestState('game36', ['zhar-ptitsa'], ['adaro'], {
        currentPlayerIndex: 1, // Set to player 2 initially
        phase: 'action', // Assume P2 finished their turn
        actionsTakenThisTurn: 2,
        market: [initialMarketCard], // Market has one card
        knowledgeDeck: [initialDeckCard], // Deck has one card
      });

      const initialP1HandSize = initialState.players[0].hand.length;
      const initialMarketSize = initialState.market.length;
      const initialDeckSize = initialState.knowledgeDeck.length;

      // Action: End Player 2's turn, triggering Player 1's TURN_START
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      // Assert: Player 1's turn, action phase
      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);
      expect(stateAfterTurnEnd.phase).toBe('action');

      // Assert: Player 1 drew the card
      expect(stateAfterTurnEnd.players[0].hand.length).toBe(initialP1HandSize + 1);
      expect(stateAfterTurnEnd.players[0].hand).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: initialMarketCard.instanceId })
      ]));

      // Assert: Market was refilled
      expect(stateAfterTurnEnd.market.length).toBe(initialMarketSize); // Size remains 1
      expect(stateAfterTurnEnd.market[0].id).toBe(initialDeckCard.id); // Contains the correct card type from the deck

      // Assert: Deck size decreased
      expect(stateAfterTurnEnd.knowledgeDeck.length).toBe(initialDeckSize - 1);

      // Assert: Log messages
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) triggers free draw.`);
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) draws ${initialMarketCard.name}. Hand size: ${initialP1HandSize + 1}`);
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Market refilled with ${initialDeckCard.name}.`);
    });

    it('should draw 1 card and NOT refill market when owner starts turn and market has cards but deck is empty', () => {
        const p1Id = 'player1'; // Zhar-Ptitsa's owner
        const p2Id = 'player2';
        const initialMarketCard = createTestKnowledge('aerial1');

        const initialState = createInitialTestState('game37', ['zhar-ptitsa'], ['adaro'], {
          currentPlayerIndex: 1,
          phase: 'action',
          actionsTakenThisTurn: 2,
          market: [initialMarketCard], // Market has one card
          knowledgeDeck: [], // Deck is empty
        });

        const initialP1HandSize = initialState.players[0].hand.length; // Should be 5 from setup
        const initialMarketSize = initialState.market.length;

        const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
        const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

        expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);
        expect(stateAfterTurnEnd.phase).toBe('action');
        expect(stateAfterTurnEnd.players[0].hand.length).toBe(initialP1HandSize + 1); // Should be 6
        expect(stateAfterTurnEnd.players[0].hand).toEqual(expect.arrayContaining([
          expect.objectContaining({ instanceId: initialMarketCard.instanceId })
        ]));
        expect(stateAfterTurnEnd.market.length).toBe(initialMarketSize - 1); // Market size decreased
        expect(stateAfterTurnEnd.knowledgeDeck.length).toBe(0); // Deck remains empty

        const expectedHandSize = initialP1HandSize + 1;
        expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) draws ${initialMarketCard.name}. Hand size: ${expectedHandSize}`);
        expect(stateAfterTurnEnd.log).not.toContain(`[Passive Effect] Market refilled`);
      });

    it('should NOT draw card when owner starts turn and market is empty', () => {
      const p1Id = 'player1'; // Zhar-Ptitsa's owner
      const p2Id = 'player2';

      const initialState = createInitialTestState('game38', ['zhar-ptitsa'], ['adaro'], {
        currentPlayerIndex: 1,
        phase: 'action',
        actionsTakenThisTurn: 2,
        market: [], // Market is empty
        knowledgeDeck: [createTestKnowledge('terrestrial1')],
      });

      const initialP1HandSize = initialState.players[0].hand.length;
      const initialMarketSize = initialState.market.length;

      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);
      expect(stateAfterTurnEnd.phase).toBe('action');
      expect(stateAfterTurnEnd.players[0].hand.length).toBe(initialP1HandSize); // Hand size unchanged
      expect(stateAfterTurnEnd.market.length).toBe(initialMarketSize); // Market remains empty
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Zhar-Ptitsa triggered, but Market is empty.`);
      expect(stateAfterTurnEnd.log).not.toContain(`draws`); // No draw message
    });

    it('should NOT draw card when opponent starts turn', () => {
      const p1Id = 'player1'; // Zhar-Ptitsa's owner
      const p2Id = 'player2';
      const initialMarketCard = createTestKnowledge('aerial1');
      const initialDeckCard = createTestKnowledge('terrestrial1');

      const initialState = createInitialTestState('game39', ['zhar-ptitsa'], ['adaro'], {
        currentPlayerIndex: 0, // Player 1's turn initially
        phase: 'action',
        actionsTakenThisTurn: 2,
        market: [initialMarketCard],
        knowledgeDeck: [initialDeckCard],
      });

      const initialP2HandSize = initialState.players[1].hand.length;
      const initialMarketSize = initialState.market.length;

      // Action: End Player 1's turn, triggering Player 2's TURN_START
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p1Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      // Assert: Player 2's turn
      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(1);
      expect(stateAfterTurnEnd.phase).toBe('action');

      // Assert: Player 2's hand size unchanged by Zhar-Ptitsa
      expect(stateAfterTurnEnd.players[1].hand.length).toBe(initialP2HandSize);

      // Assert: Market unchanged by Zhar-Ptitsa
      expect(stateAfterTurnEnd.market.length).toBe(initialMarketSize);
      expect(stateAfterTurnEnd.market[0].instanceId).toBe(initialMarketCard.instanceId);

      // Assert: Log does NOT contain Zhar-Ptitsa draw message
      expect(stateAfterTurnEnd.log).not.toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id})`);
    });
  });
});