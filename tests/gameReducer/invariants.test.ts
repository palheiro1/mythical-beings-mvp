import { describe, expect, it } from 'vitest';
import { initializeGame } from '../../src/game/state.js';
import {
  assertGameStateInvariants,
  collectGameStateInvariantViolations,
  GameStateInvariantError,
} from '../../src/game/invariants.js';

function createValidState() {
  return initializeGame({
    gameId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120002',
    player1Id: 'player-1',
    player2Id: 'player-2',
    player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
    player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
  });
}

describe('authoritative game-state invariants', () => {
  it('accepts a state produced by the current initializer', () => {
    expect(collectGameStateInvariantViolations(createValidState())).toEqual([]);
  });

  it('detects duplicated hidden-card instances across zones', () => {
    const state = createValidState();
    state.knowledgeDeck[0].instanceId = state.market[0].instanceId;

    expect(collectGameStateInvariantViolations(state)).toContainEqual(expect.objectContaining({
      code: 'knowledge_instance_duplicate',
    }));
  });

  it('detects forged player identity, winner and action counters', () => {
    const state = createValidState();
    state.players[1].id = state.players[0].id;
    state.winner = 'attacker';
    state.actionsTakenThisTurn = state.actionsPerTurn + 1;

    const codes = collectGameStateInvariantViolations(state).map((violation) => violation.code);
    expect(codes).toEqual(expect.arrayContaining([
      'player_ids_duplicate',
      'winner_invalid',
      'action_counter_invalid',
    ]));
  });

  it('only allows an oversized hand while its mandatory discard is pending', () => {
    const state = createValidState();
    state.players[0].hand = state.knowledgeDeck.splice(0, 6);
    expect(collectGameStateInvariantViolations(state).map((violation) => violation.code)).toContain('hand_limit_invalid');

    state.pendingEffect = {
      id: 'discard-effect',
      type: 'discardToHandLimit',
      playerId: 'player-1',
      sourcePlayerId: 'player-1',
      prompt: 'Discard to the hand limit.',
      choices: state.players[0].hand.map((card) => ({
        kind: 'hand' as const,
        playerIndex: 0 as const,
        instanceId: card.instanceId!,
        label: card.name,
      })),
    };

    expect(collectGameStateInvariantViolations(state).map((violation) => violation.code)).not.toContain('hand_limit_invalid');
  });

  it('throws a structured error that a server boundary can reject atomically', () => {
    const state = createValidState();
    state.currentPlayerIndex = 3 as 0;

    expect(() => assertGameStateInvariants(state)).toThrow(GameStateInvariantError);
  });

  it('rejects stale pending choices and missing private random state', () => {
    const state = createValidState();
    state.pendingEffect = {
      id: 'stale-effect',
      type: 'chooseMarketDraw',
      playerId: 'player-1',
      sourcePlayerId: 'player-1',
      prompt: 'Choose a card.',
      choices: [{ kind: 'market', instanceId: 'not-in-market', label: 'Forged card' }],
    };
    state.privateRandom = undefined;

    const codes = collectGameStateInvariantViolations(state).map((violation) => violation.code);
    expect(codes).toEqual(expect.arrayContaining(['pending_effect_invalid', 'random_state_invalid']));
  });
});
