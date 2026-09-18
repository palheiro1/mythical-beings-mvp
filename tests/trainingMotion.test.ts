import { describe, expect, it } from 'vitest';
import { createTrainingSession, trainingSessionReducer, HUMAN_ID, BOT_ID } from '../src/game/trainingSession.js';
import { calculateDamage, knowledgeEffects } from '../src/game/effects.js';
import { executeKnowledgePhase } from '../src/game/rules.js';
import { applyPassiveAbilities } from '../src/game/passives.js';
import { gameReducer } from '../src/game/state.js';
import { trainingMotion } from '../src/utils/trainingMotion.js';
import { cardAnchor } from '../src/game/presentation.js';
import type { GameState, Knowledge } from '../src/game/types.js';

const session = () => createTrainingSession(['tarasca', 'adaro', 'tulpar'], 'guided', 'motion-test');
function take(game: GameState, id: string) {
  const index = game.knowledgeDeck.findIndex(card => card.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  return game.knowledgeDeck.splice(index, 1)[0];
}

describe('practice motion and combat cues', () => {
  it('tracks one of two identical market cards by instance, never animating the other', () => {
    const before = session().game;
    const first = before.market.find(card => card.id === 'aquatic1')!;
    const duplicate = before.market.find(card => card.id === first.id && card.instanceId !== first.instanceId)!;
    expect(duplicate).toBeDefined();
    const after = structuredClone(before);
    after.market = after.market.filter(card => card.instanceId !== first.instanceId);
    after.players[0].hand.push(first);
    const events = trainingMotion(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'move', from: { anchor: `card:${first.instanceId}`, zone: 'market' }, to: { zone: `hand:${HUMAN_ID}` } });
  });

  it('keeps the source card available for replacement, simultaneous discards and its final rotation', () => {
    const before = session().game;
    const incoming = take(before, 'terrestrial1');
    const outgoing = take(before, 'aerial1');
    const other = take(before, 'aquatic2');
    before.players[0].hand = [incoming];
    before.players[0].field[0].knowledge = outgoing;
    before.players[1].field[0].knowledge = other;
    const after = structuredClone(before);
    after.players[0].hand = [];
    after.players[0].field[0].knowledge = incoming;
    after.players[1].field[0].knowledge = null;
    after.discardPile.push(outgoing, { ...other, rotation: 360 });
    const events = trainingMotion(before, after);
    expect(events.filter(step => step.kind === 'move')).toHaveLength(3);
    expect(events.find(step => step.kind === 'rotate')).toMatchObject({ from: { card: { instanceId: other.instanceId } } });
    expect(events.at(-1)).toMatchObject({ kind: 'move', to: { zone: 'discard', card: { instanceId: other.instanceId } } });
    expect(events.findIndex(step => step.kind === 'move' && step.to.card.instanceId === outgoing.instanceId)).toBeLessThan(events.findIndex(step => step.kind === 'rotate'));
  });

  it('records fully blocked damage once, from the actual source, despite duplicate human logs', () => {
    const game = session().game;
    const attack = take(game, 'terrestrial1');
    attack.valueCycle = [2, 2, 2, 2];
    const defense = take(game, 'aquatic2');
    defense.valueCycle = [-5, -5, -5, -5];
    game.players[0].field[0].knowledge = attack;
    game.players[1].field[0].knowledge = defense;
    game.presentationCues = [];
    const after = knowledgeEffects.terrestrial1({ state: game, playerIndex: 0, fieldSlotIndex: 0, knowledge: attack, rotation: 0, isFinalRotation: false, trigger: 'onPhase' });
    expect(after.players[1].power).toBe(game.players[1].power);
    expect(after.presentationCues).toEqual([expect.objectContaining({ kind: 'combat', amount: 0, blocked: 2, source: `card:${attack.instanceId}`, target: `power:${BOT_ID}`, defenders: [`card:${defense.instanceId}`] })]);
    expect(game.presentationCues).toEqual([]);
  });

  it('caps the blocked amount and distinguishes pierced defense', () => {
    const game = session().game;
    const attack = take(game, 'aerial1');
    const defense = take(game, 'aquatic2');
    defense.valueCycle = [-5];
    game.players[0].creatures[0].id = 'zhar-ptitsa';
    game.players[0].field[0] = { creatureId: 'zhar-ptitsa', knowledge: attack };
    game.players[1].field[0].knowledge = defense;
    const result = calculateDamage(game, 1, 2, 0, attack, 0);
    expect(result.finalDamage).toBe(2);
    expect(result.cue).toMatchObject({ amount: 2, blocked: 0, bypass: true });
  });

  it('preserves the ordered sources of multiple phase attacks and healing', () => {
    const game = session().game;
    const attack = take(game, 'terrestrial1');
    const heal = take(game, 'aerial2');
    const second = take(game, 'terrestrial3');
    game.players[0].creatures[2].rotation = 270;
    game.players[0].creatures[2].currentWisdom = 3;
    game.players[0].field.forEach((slot, i) => { slot.knowledge = [attack, heal, second][i]; });
    game.presentationCues = [];
    const after = executeKnowledgePhase(game, 0);
    const sources = after.presentationCues!.map(cue => cue.source);
    expect(sources).toContain(cardAnchor(HUMAN_ID, attack));
    expect(sources).toContain(cardAnchor(HUMAN_ID, heal));
    expect(new Set(sources).size).toBe(sources.length);
    expect(after.presentationCues!.filter(cue => cue.kind === 'power').every(cue => cue.amount! > 0)).toBe(true);
  });

  it('attributes a passive to its creature even when its knowledge has already left', () => {
    const game = session().game;
    game.presentationCues = [];
    const card = { ...take(game, 'terrestrial1'), element: 'earth' } as Knowledge;
    const after = applyPassiveAbilities(game, 'KNOWLEDGE_LEAVE', { playerId: BOT_ID, knowledgeCard: card });
    expect(after.presentationCues).toEqual([expect.objectContaining({ kind: 'power', source: `creature:${BOT_ID}:lisovik`, target: `power:${HUMAN_ID}`, amount: -1 })]);
  });

  it('does not change the rules, accumulate cues, or replay on selection/invalid actions', () => {
    let s = trainingSessionReducer(session(), { type: 'start-guide' });
    const card = s.game.market[0];
    const action = { type: 'DRAW_KNOWLEDGE' as const, payload: { playerId: HUMAN_ID, knowledgeId: card.id, instanceId: card.instanceId! } };
    const normal = gameReducer(s.game, action);
    const next = trainingSessionReducer(s, { type: 'play', action });
    const { presentationCues, ...rest } = next.game;
    expect(rest).toEqual(normal);
    expect(presentationCues).toEqual([]);
    const selected = trainingSessionReducer(next, { type: 'select', instanceId: card.instanceId! });
    expect(trainingMotion(next.game, selected.game)).toEqual([]);
    s = trainingSessionReducer(next, { type: 'play', action });
    expect(s.rejected).toBe(true);
    expect(trainingMotion(next.game, s.game)).toEqual([]);
    expect(trainingMotion(next.game, { ...next.game, gameId: 'new-match' })).toEqual([]);
  });
});
