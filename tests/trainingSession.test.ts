import { describe, expect, it } from 'vitest';
import { BOT_ID, HUMAN_ID, createTrainingSession, trainingSessionReducer as reduce, validateTrainingAction, type TrainingSession, type TrainingAction } from '../src/game/trainingSession.js';
import { GUIDED_TEAM } from '../src/utils/trainingMode.js';
import knowledgeData from '../src/assets/knowledges.json';
import type { Knowledge } from '../src/game/types.js';

const start = () => createTrainingSession(GUIDED_TEAM, 'guided', 'test-lesson');
const play = (session: TrainingSession, action: TrainingAction) => reduce(session, { type: 'play', action });
const draw = (session: TrainingSession) => {
  const card = session.game.market[0];
  return play(session, { type: 'DRAW_KNOWLEDGE', payload: { playerId: HUMAN_ID, knowledgeId: card.id, instanceId: card.instanceId! } });
};
const rotate = (session: TrainingSession, creatureId = 'tarasca') => play(session, { type: 'ROTATE_CREATURE', payload: { playerId: HUMAN_ID, creatureId } });
const summon = (session: TrainingSession) => {
  const card = session.game.players[0].hand[0];
  return play(session, { type: 'SUMMON_KNOWLEDGE', payload: { playerId: HUMAN_ID, creatureId: 'tarasca', knowledgeId: card.id, instanceId: card.instanceId! } });
};

const resolveHumanEffect = (s: TrainingSession) => {
  const pending = s.game.pendingEffect;
  return pending?.playerId === HUMAN_ID ? play(s, { type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: HUMAN_ID, resolution: { effectId: pending.id, choice: pending.choices[0] } } }) : s;
};

const cardsIn = (s: TrainingSession) => [...s.game.market, ...s.game.knowledgeDeck, ...s.game.discardPile, ...s.game.players.flatMap(p => [...p.hand, ...p.field.flatMap(f => f.knowledge ? [f.knowledge] : [])])];

describe('guided practice uses the real game engine', () => {
  it('prepares a reproducible valid deal without duplicating or losing cards', () => {
    const a = start(); const b = start();
    expect(a.game).toEqual(b.game);
    expect(a.game.market[0].id).toBe('aerial1');
    expect(a.game.players[0].creatures.map(c => c.id)).toEqual(GUIDED_TEAM);
    expect(cardsIn(a)).toHaveLength(45);
    expect(new Set(cardsIn(a).map(c => c.instanceId)).size).toBe(45);
    for (const card of knowledgeData) expect(cardsIn(a).filter(c => c.id === card.id)).toHaveLength(card.cost <= 2 ? 4 : card.cost === 3 ? 3 : 2);
  });
  it('advances only after accepted actions, through automatic and manual turn endings', () => {
    let s = start();
    const blocked = draw(s);
    expect(blocked.game).toBe(s.game);
    expect(blocked.guide).toBe('welcome');
    s = reduce(s, { type: 'start-guide' });
    expect(rotate(s).guide).toBe('draw');
    s = draw(s);
    expect(s.guide).toBe('rotate');
    s = rotate(s);
    expect(s.guide).toBe('watch');
    expect(s.game.currentPlayerIndex).toBe(1);
    expect(s.game.players[0].creatures[0].currentWisdom).toBe(2);
    s = play(s, { type: 'END_TURN', payload: { playerId: BOT_ID } });
    expect(s.guide).toBe('summon');
    s = summon(s);
    expect(s.guide).toBe('end');
    expect(s.game.players[0].field[0].knowledge?.id).toBe('aerial1');
    s = resolveHumanEffect(s);
    expect(s.guide).toBe('end');
    s = play(s, { type: 'END_TURN', payload: { playerId: HUMAN_ID } });
    expect(s.guide).toBe('complete');
    expect(s.tutorialCompleted).toBe(true);
    const before = s.game;
    s = reduce(s, { type: 'continue' });
    expect(s.guide).toBe('free');
    expect(s.game).toBe(before);
    expect(s.humanActions).toBe(4);
  });
  it('keeps selected knowledge and game state on an invalid play', () => {
    let s = reduce(start(), { type: 'skip-guide' });
    s = reduce(s, { type: 'continue' });
    s = draw(s);
    s = reduce(s, { type: 'select', instanceId: s.game.players[0].hand[0].instanceId! });
    const before = s;
    s = summon(s);
    expect(s.selectedId).toBe(before.selectedId);
    expect(s.game).toBe(before.game);
    expect(s.feedback).toMatch(/wisdom/);
    expect(s.rejected).toBe(true);
  });
  it('allows replacing a knowledge and retains the conservation of card instances', () => {
    let s = reduce(reduce(start(), { type: 'skip-guide' }), { type: 'continue' });
    s = draw(s); s = rotate(s);
    s = play(s, { type: 'END_TURN', payload: { playerId: BOT_ID } });
    s = resolveHumanEffect(summon(s));
    const original = s.game.players[0].field[0].knowledge!;
    const replacement = s.game.knowledgeDeck.find(c => c.id === 'aerial1')!;
    s.game.knowledgeDeck = s.game.knowledgeDeck.filter(c => c.instanceId !== replacement.instanceId);
    s.game.players[0].hand = [replacement];
    s = summon(s);
    expect(s.rejected).toBe(false);
    expect(s.game.players[0].field[0].knowledge?.instanceId).toBe(replacement.instanceId);
    expect(s.game.discardPile.some(c => c.instanceId === original.instanceId)).toBe(true);
    expect(cardsIn(s)).toHaveLength(45);
  });
  it('uses the existing Hurricane and pending-effect validation', () => {
    const s = reduce(reduce(start(), { type: 'skip-guide' }), { type: 'continue' });
    s.game.players[0].creatures[0].currentWisdom = 5;
    const card = s.game.knowledgeDeck.find(c => c.id === 'aerial1')!;
    s.game.players[0].hand = [card];
    s.game.players[1].field[0].knowledge = { ...knowledgeData.find(c => c.id === 'aquatic3'), instanceId: 'hurricane' } as Knowledge;
    const action: TrainingAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: HUMAN_ID, creatureId: 'tarasca', instanceId: card.instanceId!, knowledgeId: card.id } };
    expect(validateTrainingAction(s, action).reason).toMatch(/Hurricane/);
    s.game.pendingEffect = { id:'choice', type:'chooseMarketDraw', playerId:HUMAN_ID, sourcePlayerId:HUMAN_ID, prompt:'Choose a card', choices:[] };
    expect(validateTrainingAction(s, { type:'END_TURN', payload:{playerId:HUMAN_ID} }).reason).toMatch(/pending/);
  });
  it('continues a skipped lesson without resetting the board or declaring a win', () => {
    let s = reduce(start(), { type:'start-guide' }); s = draw(s);
    const before = s.game;
    s = reduce(s, { type:'skip-guide' });
    expect(s.guide).toBe('handoff');
    s = reduce(s, { type:'continue' });
    expect(s.game).toBe(before); expect(s.tutorialCompleted).toBe(false); expect(s.game.winner).toBe(null);
  });
  it('concedes once and rejects subsequent gameplay', () => {
    const s = reduce(start(), { type:'resign' });
    expect(s.game.phase).toBe('gameOver'); expect(s.game.winner).toBe(BOT_ID);
    expect(rotate(s)).toBe(s);
  });
});
