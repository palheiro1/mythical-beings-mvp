import { describe, it, expect } from 'vitest';
import { checkWinConditions } from '../../src/game/rules'; // Removed .js, corrected name
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
    expect(result.log).toContain(`[Game] ${p1Id} wins! ${p2Id} reached 0 Power.`);
  });

  it('should declare winner immediately when opponent reaches 0 power during player\'s turn', () => {
    const p1Id = 'player1'; // Summoner, Pele owner
    const p2Id = 'player2'; // Lisovik owner
    const initialState = createInitialTestState('winEdgeOppTurn', ['pele', 'adaro'], ['lisovik'], {
      players: [
        { id: p1Id, name: 'Player 1', power: 1, hand: [], creatures: [createTestCreature('pele'), createTestCreature('adaro')], field: [], deck: [], discard: [] },
        { id: p2Id, name: 'Player 2', power: 20, hand: [], creatures: [createTestCreature('lisovik')], field: [], deck: [], discard: [] },
      ],
      currentPlayerIndex: 0, // P1's turn
      phase: 'action',
      actionsTakenThisTurn: 0,
    });

    const damageKnowledge = createTestKnowledge('terrestrial1', {
      cost: 1,
      effect: { type: 'DAMAGE', target: 'OPPONENT', amount: 1 }
    });
    initialState.players[0].hand = [damageKnowledge];
    initialState.players[0].creatures = [createTestCreature('adaro')];
    initialState.players[0].creatures[0].currentWisdom = 1;
    initialState.players[1].power = 1;

    const summonDamageAction = {
      type: 'SUMMON_KNOWLEDGE' as const,
      payload: { playerId: p1Id, knowledgeId: damageKnowledge.id, instanceId: damageKnowledge.instanceId!, creatureId: 'adaro' }
    };

    const result = gameReducer(initialState, summonDamageAction) as GameState;

    expect(result.winner).toBe(p1Id); // P1 wins because P2 reached 0 power during P1's turn
    expect(result.players[1].power).toBe(0);
    expect(result.log).toContain(`[Effect] ${damageKnowledge.name} deals 1 damage to ${p2Id}.`);
    expect(result.log).toContain(`[Game] ${p1Id} wins! ${p2Id} reached 0 Power.`);
    expect(result.phase).toBe('gameOver'); // Game phase should update
  });

  it('should result in a draw if both players reach 0 power simultaneously', () => {
    const p1Id = 'player1';
    const p2Id = 'player2';
    const initialState = createInitialTestState('winEdgeDraw', ['adaro'], ['pele'], {
      players: [
        { id: p1Id, name: 'Player 1', power: 1, hand: [], creatures: [createTestCreature('adaro')], field: [], deck: [], discard: [] },
        { id: p2Id, name: 'Player 2', power: 1, hand: [], creatures: [createTestCreature('pele')], field: [], deck: [], discard: [] },
      ],
      currentPlayerIndex: 0, // P1's turn
      phase: 'action',
      actionsTakenThisTurn: 0,
    });

    const mutualDestructionKnowledge = createTestKnowledge('terrestrial2', {
      cost: 1,
      effect: { type: 'DAMAGE', target: 'BOTH', amount: 1 }
    });
    initialState.players[0].hand = [mutualDestructionKnowledge];
    initialState.players[0].creatures[0].currentWisdom = 1;

    const summonMutualAction = {
      type: 'SUMMON_KNOWLEDGE' as const,
      payload: { playerId: p1Id, knowledgeId: mutualDestructionKnowledge.id, instanceId: mutualDestructionKnowledge.instanceId!, creatureId: 'adaro' }
    };

    const result = gameReducer(initialState, summonMutualAction) as GameState;

    expect(result.winner).toBeNull(); // Should be a draw
    expect(result.players[0].power).toBe(0);
    expect(result.players[1].power).toBe(0);
    expect(result.log).toContain(`[Effect] ${mutualDestructionKnowledge.name} deals 1 damage to ${p1Id}.`);
    expect(result.log).toContain(`[Effect] ${mutualDestructionKnowledge.name} deals 1 damage to ${p2Id}.`);
    expect(result.log).toContain('[Game] Draw! Both players reached 0 Power simultaneously.');
    expect(result.phase).toBe('gameOver'); // Correct the expected phase
  });
});