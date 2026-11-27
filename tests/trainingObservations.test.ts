import { describe, it, expect, vi } from 'vitest';
const { emit } = vi.hoisted(() => ({emit:vi.fn()}));
vi.mock('../src/utils/observationClient.js', () => ({createObservationClient:()=>({emit}),readJourney:()=> 'journey'}));
import { observeTraining } from '../src/utils/trainingObservations.js';
import type { GameState } from '../src/game/types.js';

describe('public training observations', () => {
  const state = (overrides = {}) => ({gameId:'local-game',currentPlayerIndex:0,actionsTakenThisTurn:0,phase:'action',log:[],...overrides}) as unknown as GameState;
  it('records a human state transition, not a bot turn or unchanged state', () => {
    emit.mockClear();
    const initial = state();
    observeTraining(null, initial);
    observeTraining(initial, initial);
    observeTraining(state({currentPlayerIndex:1}), state({currentPlayerIndex:1, actionsTakenThisTurn:1}));
    expect(emit.mock.calls.filter(c=>c[0]==='first_action')).toHaveLength(0);
    observeTraining(initial,state({actionsTakenThisTurn:1}));
    expect(emit).toHaveBeenCalledWith('first_action','journey','local-game');
  });
  it('records a terminal training state without sending game details', () => {
    emit.mockClear();
    observeTraining(state(),state({phase:'gameOver',winner:'local-player'}));
    expect(emit).toHaveBeenCalledWith('training_complete','journey','local-game');
    expect(JSON.stringify(emit.mock.calls)).not.toContain('local-player');
  });
});
