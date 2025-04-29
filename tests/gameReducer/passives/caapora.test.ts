// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/caapora.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Caapora Passive', () => {
  describe('TURN_START - If opponent has > cards in hand, deal 1 damage to opponent', () => {
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
});