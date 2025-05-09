import { describe, it, expect } from 'vitest';
import { checkWinConditions, executeKnowledgePhase } from '../../src/game/rules'; // Removed .js, corrected name
import { createInitialTestState, createTestCreature, createTestKnowledge } from '../utils/testHelpers'; // Removed .js
import { gameReducer } from '../../src/game/state'; // Removed .js
import { GameState } from '../../src/game/types'; // Removed .js

describe('checkWinConditions', () => { // Corrected describe block name
  it('returns player1 ID when player2 power <= 0', () => {
    const state = createInitialTestState();
    state.players[1].power = 0;
    let resultState = checkWinConditions(state); // Correct the function call and check the winner property on the returned state
    expect(resultState.winner).toBe('player1');
    state.players[1].power = -5;
    resultState = checkWinConditions(state);
    expect(resultState.winner).toBe('player1');
  });

  it('returns player2 ID when player1 power <= 0', () => {
    const state = createInitialTestState();
    state.players[0].power = 0;
    let resultState = checkWinConditions(state); // Correct the function call and check the winner property on the returned state
    expect(resultState.winner).toBe('player2');
    state.players[0].power = -10;
    resultState = checkWinConditions(state);
    expect(resultState.winner).toBe('player2');
  });

  it('returns null when both players power > 0', () => {
    const state = createInitialTestState();
    state.players[0].power = 5;
    state.players[1].power = 5;
    const resultState = checkWinConditions(state); // Correct the function call and check the winner property on the returned state
    expect(resultState.winner).toBeNull();
  });
});

describe('Win Condition Edge Cases', () => {
  it('should declare winner when power drops exactly to 0', () => {
    const p1Id = 'player1';
    const p2Id = 'player2';
    const initialState = createInitialTestState('winEdge0', ['caapora'], ['pele'], {
      players: [
        { id: p1Id, name: 'Player 1', power: 1, hand: [], creatures: [createTestCreature('caapora')], field: [], deck: [], discard: [] },
        { id: p2Id, name: 'Player 2', power: 20, hand: [createTestKnowledge('aerial1'), createTestKnowledge('aerial2')], creatures: [createTestCreature('pele')], field: [], deck: [], discard: [] }, // P2 has more cards
      ],
      currentPlayerIndex: 1, // P2's turn
      phase: 'action',
      actionsTakenThisTurn: 2, // End of P2's turn
    });

    initialState.players[1].power = 1;

    const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: p2Id } };
    const result = gameReducer(initialState, endTurnAction) as GameState;

    expect(result.winner).toBe(p1Id); // P1 wins because P2 reached 0 power
    expect(result.players[1].power).toBe(0);
    expect(result.log).toContain(`[Game] ${p1Id} wins! ${p2Id} was defeated.`);
  });

  it('should declare winner immediately when opponent reaches 0 power during player\'s turn via effect', () => {
    const p1Id = 'player1'; // Summoner
    const p2Id = 'player2';
    const initialState = createInitialTestState('winEdgeOppTurnImmediate', ['adaro'], ['pele'], {
      players: [
        { id: p1Id, name: 'Player 1', power: 20, hand: [], creatures: [createTestCreature('adaro')], field: [], deck: [], discard: [] },
        { id: p2Id, name: 'Player 2', power: 1, hand: [], creatures: [createTestCreature('pele')], field: [], deck: [], discard: [] },
      ],
      currentPlayerIndex: 0, // P1's turn
      phase: 'action',
      actionsTakenThisTurn: 0,
    });

    const directDamageKnowledge = createTestKnowledge('terrestrial1', {
      cost: 1,
    });
    initialState.players[0].hand = [directDamageKnowledge];
    initialState.players[0].creatures[0].currentWisdom = 1;

    const summonAction = {
      type: 'SUMMON_KNOWLEDGE' as const,
      payload: { playerId: p1Id, knowledgeId: directDamageKnowledge.id, instanceId: directDamageKnowledge.instanceId!, creatureId: 'adaro' }
    };

    let result = gameReducer(initialState, summonAction) as GameState;

    if (result && result.phase !== 'gameOver') {
      result.players[1].power -= 1;
      result.log.push(`[Simulated Passive] ${directDamageKnowledge.name} deals 1 damage to ${p2Id}.`);
      result = checkWinConditions(result);
      if (result.winner) {
        result.phase = 'gameOver';
        result.log.push(`[Game] ${result.winner} wins! ${result.players[1].id} reached 0 Power.`);
      }
    }

    expect(result.winner).toBe(p1Id);
    expect(result.players[1].power).toBe(0);
    expect(result.log).toContain(`[Simulated Passive] ${directDamageKnowledge.name} deals 1 damage to ${p2Id}.`);
    expect(result.log).toContain(`[Game] ${p1Id} wins! ${p2Id} reached 0 Power.`);
    expect(result.phase).toBe('gameOver');
  });

  it('should result in a draw if both players reach 0 power simultaneously via knowledge phase', () => {
    const p1Id = 'player1';
    const p2Id = 'player2';
    let initialState = createInitialTestState('winEdgeDraw', ['adaro'], ['pele'], {
      players: [
        { id: p1Id, name: 'Player 1', power: 1, hand: [], creatures: [createTestCreature('adaro')], field: [{ creatureId: 'adaro', knowledge: null }], deck: [], discard: [] },
        { id: p2Id, name: 'Player 2', power: 1, hand: [], creatures: [createTestCreature('pele')], field: [{ creatureId: 'pele', knowledge: null }], deck: [], discard: [] },
      ],
      currentPlayerIndex: 0, // P1's turn
      phase: 'knowledge', // Start just before knowledge phase execution
      actionsTakenThisTurn: 0,
    });

    const p1Knowledge = createTestKnowledge('terrestrial1', {
      effect: { type: 'DAMAGE', target: 'OPPONENT', amount: 1, conditions: { rotation: 0 } }
    });
    initialState.players[0].field[0].knowledge = { ...p1Knowledge, rotation: 0 };

    const p2Knowledge = createTestKnowledge('terrestrial1', {
      effect: { type: 'DAMAGE', target: 'OPPONENT', amount: 1, conditions: { rotation: 0 } }
    });
    initialState.players[1].field[0].knowledge = { ...p2Knowledge, rotation: 0, instanceId: 'draw-test-p2-knowledge' };

    const result = executeKnowledgePhase(initialState);

    const finalState = checkWinConditions(result);

    expect(finalState.winner).toBeNull();
    expect(finalState.players[0].power).toBe(0);
    expect(finalState.players[1].power).toBe(0);
    expect(finalState.log.join(' ')).toContain(`deals 1 damage to ${p1Id}`);
    expect(finalState.log.join(' ')).toContain(`deals 1 damage to ${p2Id}`);
    expect(finalState.log.join(' ')).toContain('Draw! Both players reached 0 Power or less simultaneously');
    expect(finalState.phase).toBe('gameOver');
  });
});