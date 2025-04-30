// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/trepulcahue.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Trepulcahue Passive', () => {
  describe('TURN_START - If owner has > cards in hand than opponent, deal 1 damage to opponent', () => {
    it('should deal 1 damage to opponent if owner starts turn with more cards', () => {
      const p1Id = 'player1'; // Trepulcahue's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game43', ['trepulcahue'], ['adaro'], {
        currentPlayerIndex: 1, // P2's turn initially
        phase: 'action',
        actionsTakenThisTurn: 2, // End of P2's turn
      });

      // P1 (owner) has more cards than P2 (opponent) - Use valid IDs
      initialState.players[0].hand = [createTestKnowledge('aerial1'), createTestKnowledge('terrestrial1'), createTestKnowledge('aquatic1')];
      initialState.players[1].hand = [createTestKnowledge('aerial2'), createTestKnowledge('terrestrial2')];

      const initialOpponentHealth = initialState.players[1].health;

      // Action: End P2's turn, starting P1's turn
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      // Assert: P1's turn started
      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);

      // Assert: Opponent (P2) took 1 damage
      expect(stateAfterTurnEnd.players[1].health).toBe(initialOpponentHealth - 1);
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Trepulcahue (Owner: ${p1Id}) deals 1 damage to ${p2Id} (Hand size ${initialState.players[0].hand.length} > ${initialState.players[1].hand.length}).`);
      expect(stateAfterTurnEnd.log).toContain(`Health: ${initialOpponentHealth} -> ${initialOpponentHealth - 1}`);
    });

    it('should NOT deal damage if owner starts turn with equal cards', () => {
      const p1Id = 'player1'; // Trepulcahue's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game44', ['trepulcahue'], ['adaro'], {
        currentPlayerIndex: 1,
        phase: 'action',
        actionsTakenThisTurn: 2,
      });

      // Equal hand sizes - Use valid IDs
      initialState.players[0].hand = [createTestKnowledge('aerial1'), createTestKnowledge('terrestrial1')];
      initialState.players[1].hand = [createTestKnowledge('aerial2'), createTestKnowledge('terrestrial2')];

      const initialOpponentHealth = initialState.players[1].health;

      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);
      expect(stateAfterTurnEnd.players[1].health).toBe(initialOpponentHealth); // Health unchanged
      expect(stateAfterTurnEnd.log).not.toContain(`[Passive Effect] Trepulcahue (Owner: ${p1Id}) deals 1 damage`);
    });

    it('should NOT deal damage if owner starts turn with fewer cards', () => {
      const p1Id = 'player1'; // Trepulcahue's owner
      const p2Id = 'player2';
      const initialState = createInitialTestState('game45', ['trepulcahue'], ['adaro'], {
        currentPlayerIndex: 1,
        phase: 'action',
        actionsTakenThisTurn: 2,
      });

      // P1 (owner) has fewer cards - Use valid IDs
      initialState.players[0].hand = [createTestKnowledge('aerial1')];
      initialState.players[1].hand = [createTestKnowledge('aerial2'), createTestKnowledge('terrestrial1')];

      const initialOpponentHealth = initialState.players[1].health;

      const endTurnAction = { type: 'END_TURN', payload: { playerId: p2Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(0);
      expect(stateAfterTurnEnd.players[1].health).toBe(initialOpponentHealth); // Health unchanged
      expect(stateAfterTurnEnd.log).not.toContain(`[Passive Effect] Trepulcahue (Owner: ${p1Id}) deals 1 damage`);
    });

    it('should deal 1 damage to the other player if OPPONENT (owner) starts turn with more cards', () => {
      const p1Id = 'player1';
      const p2Id = 'player2'; // Trepulcahue's owner
      const initialState = createInitialTestState('game46', ['adaro'], ['trepulcahue'], { // P2 owns Trepulcahue
        currentPlayerIndex: 0, // P1's turn initially
        phase: 'action',
        actionsTakenThisTurn: 2, // End of P1's turn
      });

      // P2 (owner) has more cards than P1 (opponent) - Use valid IDs
      initialState.players[1].hand = [createTestKnowledge('aerial1'), createTestKnowledge('terrestrial1'), createTestKnowledge('aquatic1')];
      initialState.players[0].hand = [createTestKnowledge('aerial2'), createTestKnowledge('terrestrial2')];

      const initialP1Health = initialState.players[0].health;

      // Action: End P1's turn, starting P2's turn
      const endTurnAction = { type: 'END_TURN', payload: { playerId: p1Id } };
      const stateAfterTurnEnd = gameReducer(initialState, endTurnAction) as GameState;

      // Assert: P2's turn started
      expect(stateAfterTurnEnd.currentPlayerIndex).toBe(1);

      // Assert: P1 took 1 damage
      expect(stateAfterTurnEnd.players[0].health).toBe(initialP1Health - 1);
      expect(stateAfterTurnEnd.log).toContain(`[Passive Effect] Trepulcahue (Owner: ${p2Id}) deals 1 damage to ${p1Id} (Hand size ${initialState.players[1].hand.length} > ${initialState.players[0].hand.length}).`);
      expect(stateAfterTurnEnd.log).toContain(`Health: ${initialP1Health} -> ${initialP1Health - 1}`);
    });
  });
});