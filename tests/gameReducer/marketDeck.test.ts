import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '../../src/game/state';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers';

let state;
let marketCard;
let deckCard;

beforeEach(() => {
  state = createInitialTestState('market-test', ['dudugera'], ['pele']);
  state.phase = 'action';
  state.currentPlayerIndex = 0;
  state.actionsTakenThisTurn = 0;
  marketCard = createTestKnowledge('aerial1');
  const marketCard2 = createTestKnowledge('aerial2');
  deckCard = createTestKnowledge('terrestrial1');
  const deckCard2 = createTestKnowledge('aquatic1');
  state.market = [marketCard, marketCard2];
  state.knowledgeDeck = [deckCard, deckCard2];
  state.players[0].hand = [];
});

describe('market and deck logic', () => {
  it('refills market from deck when drawing and deck not empty', () => {
    const action: any = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'player1', knowledgeId: marketCard.id, instanceId: marketCard.instanceId } };
    const next = gameReducer(state, action) as any;
    expect(next.players[0].hand.map(k => k.instanceId)).toContain(marketCard.instanceId);
    expect(next.market.find(k => k.instanceId === deckCard.instanceId)).toBeDefined();
    expect(next.knowledgeDeck.length).toBe(state.knowledgeDeck.length - 1);
  });

  it('does not refill market when drawing and deck empty', () => {
    state.knowledgeDeck = [];
    const action: any = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'player1', knowledgeId: marketCard.id, instanceId: marketCard.instanceId } };
    const next = gameReducer(state, action) as any;
    expect(next.market.length).toBe(state.market.length - 1);
    expect(next.players[0].hand.map(k => k.instanceId)).toContain(marketCard.instanceId);
  });
});