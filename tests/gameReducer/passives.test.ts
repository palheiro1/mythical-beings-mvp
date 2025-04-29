import { describe, it, expect } from 'vitest';
import { gameReducer, initializeGame } from '../../src/game/state';
import { GameState, Knowledge } from '../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers';

describe('Passive Abilities', () => {
  describe('Caapora: TURN_START - If opponent has > cards in hand, deal 1 damage to opponent', () => {
    it('should deal 1 damage to opponent if they have more cards at turn start', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game1', ['caapora'], ['adaro'], {
        currentPlayerIndex: 0,
        turn: 2,
        phase: 'knowledge',
      });

      // Give player 2 more cards than player 1 using valid IDs
      initialState.players[1].hand = [createTestKnowledge('aquatic1'), createTestKnowledge('aerial1')]; // Use valid IDs
      initialState.players[0].hand = [createTestKnowledge('terrestrial1')]; // Use valid ID
      const initialOpponentPower = initialState.players[1].power;

      const stateBeforeP1Turn = { ...initialState, currentPlayerIndex: 1, phase: 'action' };
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterEndTurn = gameReducer(stateBeforeP1Turn, endTurnAction) as GameState;

      expect(stateAfterEndTurn.players[1].power).toBe(initialOpponentPower - 1);
      expect(stateAfterEndTurn.log).toContain(`[Passive Effect] Caapora (Owner: ${p1Id}) deals 1 damage to ${p2Id}. Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
    });

    it('should NOT deal damage if opponent has equal or fewer cards', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game2', ['caapora'], ['adaro'], {
        currentPlayerIndex: 0,
        turn: 2,
        phase: 'knowledge',
      });

      // Give player 2 equal cards as player 1
      initialState.players[1].hand = [createTestKnowledge('aquatic1')];
      initialState.players[0].hand = [createTestKnowledge('terrestrial1')];
      const initialOpponentPower = initialState.players[1].power;

      const stateBeforeP1Turn = { ...initialState, currentPlayerIndex: 1, phase: 'action' };
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterEndTurn = gameReducer(stateBeforeP1Turn, endTurnAction) as GameState;

      // Assert: Player 2 (opponent) power should be unchanged
      expect(stateAfterEndTurn.players[1].power).toBe(initialOpponentPower);
      // Assert: Log message for Caapora damage should NOT be present
      expect(stateAfterEndTurn.log).not.toContain(`[Passive Effect] Caapora (Owner: ${p1Id}) deals 1 damage to ${p2Id}.`);

      // Test with fewer cards
      initialState.players[1].hand = []; // Opponent has fewer cards
      const stateBeforeP1TurnFewer = { ...initialState, currentPlayerIndex: 1, phase: 'action' };
      const stateAfterEndTurnFewer = gameReducer(stateBeforeP1TurnFewer, endTurnAction) as GameState;
      expect(stateAfterEndTurnFewer.players[1].power).toBe(initialOpponentPower);
      expect(stateAfterEndTurnFewer.log).not.toContain(`[Passive Effect] Caapora (Owner: ${p1Id}) deals 1 damage to ${p2Id}.`);
    });
  });

  describe('Adaro: AFTER_PLAYER_SUMMON (on self) - If summoned knowledge is water, draw 1 card from market (free)', () => {
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

    // Add test case for non-water knowledge
    // Add test case for summoning onto different creature
    // Add test case for empty market
  });

  // Add describe blocks for other passives
});