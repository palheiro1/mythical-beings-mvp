import { describe, expect, it } from 'vitest';
import { gameReducer } from '../../src/game/state';
import { executeKnowledgePhase } from '../../src/game/rules';
import { GameState } from '../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers';

describe('rulebook flow regressions', () => {
  it('replaces an occupied Knowledge slot and discards the previous card', () => {
    const state = createInitialTestState('replace-knowledge', ['adaro'], ['pele'], {
      currentPlayerIndex: 0,
      phase: 'action',
      actionsTakenThisTurn: 0,
    });
    const oldKnowledge = createTestKnowledge('aerial1');
    const newKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
    state.players[0].field[0].knowledge = oldKnowledge;
    state.players[0].hand = [newKnowledge];
    state.players[0].creatures[0].currentWisdom = 1;

    const result = gameReducer(state, {
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: 'player1', knowledgeId: newKnowledge.id, instanceId: newKnowledge.instanceId!, creatureId: 'adaro' },
    }) as GameState;

    expect(result.players[0].field[0].knowledge?.instanceId).toBe(newKnowledge.instanceId);
    expect(result.discardPile).toEqual(expect.arrayContaining([
      expect.objectContaining({ instanceId: oldKnowledge.instanceId }),
    ]));
  });

  it('does not consume an action when a creature at 270 degrees cannot rotate', () => {
    const state = createInitialTestState('max-creature-rotation', ['adaro'], ['pele'], {
      currentPlayerIndex: 0,
      phase: 'action',
      actionsTakenThisTurn: 0,
    });
    state.players[0].creatures[0].rotation = 270;

    const result = gameReducer(state, {
      type: 'ROTATE_CREATURE',
      payload: { playerId: 'player1', creatureId: 'adaro' },
    }) as GameState;

    expect(result.players[0].creatures[0].rotation).toBe(270);
    expect(result.actionsTakenThisTurn).toBe(0);
    expect(result.log.join(' ')).toContain('maximum rotation');
  });

  it('runs Knowledge Phase only for the active player', () => {
    const state = createInitialTestState('active-knowledge-only', ['adaro'], ['pele'], {
      currentPlayerIndex: 0,
      phase: 'knowledge',
    });
    state.players[0].field[0].knowledge = createTestKnowledge('terrestrial1');
    state.players[1].field[0].knowledge = createTestKnowledge('terrestrial1');
    state.players[0].power = 20;
    state.players[1].power = 20;

    const result = executeKnowledgePhase(state, 0);

    expect(result.players[0].power).toBe(20);
    expect(result.players[1].power).toBe(19);
  });

  it('creates a discard choice when drawing above the hand limit', () => {
    const state = createInitialTestState('hand-limit-choice', ['adaro'], ['pele'], {
      currentPlayerIndex: 0,
      phase: 'action',
      actionsTakenThisTurn: 0,
    });
    state.players[0].hand = Array.from({ length: 5 }, (_, index) => createTestKnowledge(index % 2 === 0 ? 'aerial1' : 'aquatic1'));
    const marketCard = state.market[0];

    const result = gameReducer(state, {
      type: 'DRAW_KNOWLEDGE',
      payload: { playerId: 'player1', knowledgeId: marketCard.id, instanceId: marketCard.instanceId! },
    }) as GameState;

    expect(result.players[0].hand).toHaveLength(6);
    expect(result.pendingEffect?.type).toBe('discardToHandLimit');
    expect(result.pendingEffect?.choices).toHaveLength(6);
  });
});
