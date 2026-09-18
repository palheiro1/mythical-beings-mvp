import { cardAnchor, type PresentationCue } from '../game/presentation.js';
import type { Creature, GameState, Knowledge } from '../game/types.js';

export interface CardPosition {
  card: Creature | Knowledge;
  anchor: string;
  zone: string;
}
export type MotionStep =
  | { kind: 'move'; from: CardPosition; to: CardPosition }
  | { kind: 'rotate'; from: CardPosition; to: CardPosition }
  | PresentationCue;

function positions(game: GameState) {
  const cards = new Map<string, CardPosition>();
  const add = (card: Creature | Knowledge, owner: string, zone: string) => {
    const anchor = cardAnchor(owner, card);
    cards.set(anchor, { card, anchor, zone });
  };
  game.market.forEach(card => add(card, '', 'market'));
  game.knowledgeDeck.forEach(card => add(card, '', 'deck'));
  game.discardPile.forEach(card => add(card, '', 'discard'));
  game.players.forEach(player => {
    player.hand.forEach(card => add(card, player.id, `hand:${player.id}`));
    player.creatures.forEach(card => add(card, player.id, `creature:${player.id}:${card.id}`));
    player.field.forEach(slot => {
      if (slot.knowledge) add(slot.knowledge, player.id, `slot:${player.id}:${slot.creatureId}`);
    });
  });
  return cards;
}

/** Instance IDs distinguish identical cards. No log parsing or guessed attackers. */
export function trainingMotion(previous: GameState, current: GameState): MotionStep[] {
  if (previous.gameId !== current.gameId || previous === current) return [];
  const before = positions(previous);
  const after = positions(current);
  const occupied = new Set([...after.values()].map(position => position.zone));
  const moves: MotionStep[] = [];
  const rotations: MotionStep[] = [];
  const discards: MotionStep[] = [];
  for (const [id, to] of after) {
    const from = before.get(id);
    if (!from) continue;
    if (from.zone !== to.zone) {
      // A reshuffle is represented by the deck counter; don't fly the whole pile.
      if (to.zone === 'deck') continue;
      const replacement = from.zone.startsWith('slot:') && occupied.has(from.zone);
      if (!replacement && from.zone.startsWith('slot:') && to.zone === 'discard' && (to.card.rotation ?? 0) > (from.card.rotation ?? 0)) {
        rotations.push({ kind: 'rotate', from, to: { ...to, zone: from.zone } });
      }
      // Replacements depart alongside the incoming card; final rotations finish first.
      (to.zone === 'discard' && !replacement ? discards : moves).push({ kind: 'move', from, to });
    } else if (!['deck', 'discard'].includes(to.zone) && (from.card.rotation ?? 0) !== (to.card.rotation ?? 0)) {
      rotations.push({ kind: 'rotate', from, to });
    }
  }
  const cues: MotionStep[] = [...current.presentationCues ?? []];
  const pending = current.pendingEffect;
  if (pending && pending.id !== previous.pendingEffect?.id) {
    const owner = current.players.find(player => player.id === pending.sourcePlayerId);
    const candidates = owner?.field.filter(slot => slot.knowledge?.id === pending.sourceKnowledgeId) ?? [];
    const source = owner?.creatures.find(card => card.name === pending.sourceKnowledgeName)
      ?? (candidates.length === 1 ? candidates[0].knowledge : undefined);
    if (source && owner) cues.push({ kind: 'effect', source: cardAnchor(owner.id, source),
      target: cardAnchor(owner.id, source), element: source.element, label: `${source.name} · Choose a target` });
  }
  return [...moves, ...rotations, ...cues, ...discards];
}

export function describeMotion(step: MotionStep) {
  if (step.kind === 'move') {
    const zone = step.to.zone === 'market' ? 'the market' : step.to.zone === 'discard' ? 'the discards'
      : step.to.zone.startsWith('hand:') ? 'hand' : 'the board';
    return `${step.to.card.name} → ${zone}`;
  }
  if (step.kind === 'rotate') return `${step.to.card.name} · ${(step.to.card.rotation ?? 0)}°`;
  if (step.kind === 'combat') return `${step.label} · ${step.blocked ? `${step.blocked} blocked · ` : ''}${step.amount ?? 0} damage${step.bypass ? ' · Defense bypassed' : ''}`;
  if (step.kind === 'power') return `${step.label} · ${(step.amount ?? 0) > 0 ? '+' : ''}${step.amount} Power`;
  return step.label;
}
