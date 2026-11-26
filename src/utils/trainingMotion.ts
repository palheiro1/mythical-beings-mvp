import { getDisplayCardById } from './cardCatalog.js';
import type { CompetitiveProjection } from '@mythicalb/wisdom-duel-engine';
import { cardAnchor, projectCues, type PresentationCue, type CueTarget } from '../game/presentation.js';
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
  game.market.forEach((card) => add(card, '', 'market'));
  game.knowledgeDeck.forEach((card) => add(card, '', 'deck'));
  game.discardPile.forEach((card) => add(card, '', 'discard'));
  game.players.forEach((player) => {
    player.hand.forEach((card) => add(card, player.id, `hand:${player.id}`));
    player.creatures.forEach((card) => add(card, player.id, `creature:${player.id}:${card.id}`));
    player.field.forEach((slot) => {
      if (slot.knowledge) add(slot.knowledge, player.id, `slot:${player.id}:${slot.creatureId}`);
    });
  });
  return cards;
}

/** Instance IDs distinguish identical cards. No log parsing or guessed attackers. */
export function trainingMotion(previous: GameState, current: GameState, showPendingChoice = true): MotionStep[] {
  if (previous.gameId !== current.gameId || previous === current) return [];
  if (current.presentationCues?.length) {
    if (previous.presentationCues === current.presentationCues) return [];
    return projectCues(current.presentationCues, current.players[0].id).filter(
      (cue) => showPendingChoice || cue.action !== 'choose',
    );
  }
  const before = positions(previous);
  const after = positions(current);
  const occupied = new Set([...after.values()].map((position) => position.zone));
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
      if (
        !replacement &&
        from.zone.startsWith('slot:') &&
        to.zone === 'discard' &&
        (to.card.rotation ?? 0) > (from.card.rotation ?? 0)
      ) {
        rotations.push({ kind: 'rotate', from, to: { ...to, zone: from.zone } });
      }
      // Replacements depart alongside the incoming card; final rotations finish first.
      (to.zone === 'discard' && !replacement ? discards : moves).push({ kind: 'move', from, to });
    } else if (!['deck', 'discard'].includes(to.zone) && (from.card.rotation ?? 0) !== (to.card.rotation ?? 0)) {
      rotations.push({ kind: 'rotate', from, to });
    }
  }
  return [...moves, ...rotations, ...discards];
}

export type ArenaProjection = Pick<CompetitiveProjection, 'matchId' | 'stateVersion' | 'players' | 'events' | 'pendingEffect' | 'mode' | 'outcome' | 'clock' | 'turn' | 'decisionPlayerId' | 'currentPlayerId' | 'actionsTakenThisTurn' | 'actionsPerTurn' | 'phase' | 'market' | 'discardPile' | 'deckCount' | 'serverNow'>;
export type DuelView = GameState | ArenaProjection;
export const duelId = (game: DuelView) => ('gameId' in game ? game.gameId : game.matchId);

export function duelMotion(previous: DuelView, current: DuelView, showChoices: boolean): MotionStep[] {
  if (duelId(previous) !== duelId(current) || previous === current) return [];
  if ('gameId' in previous && 'gameId' in current) return trainingMotion(previous, current, showChoices);
  if ('events' in previous && 'events' in current) {
    return current.events
      .filter((event) => event.sequence > previous.stateVersion)
      .flatMap((event) => event.cues ?? []);
  }
  return [];
}

function describeTarget(target: CueTarget) {
  if (target.before === undefined || target.after === undefined) return target.label;
  return `${target.label} · ${target.unit === 'Wisdom' ? 'Wisdom ' : ''}${target.before} → ${target.after}${target.unit === '°' ? '°' : ''}`;
}

function zoneName(zone: string, viewer: string) {
  if (zone.startsWith('slot:') || zone.startsWith('creature:')) {
    const [, owner, id] = zone.split(':');
    return `${viewer === 'spectator' ? (owner === '0' ? 'Player 1’s' : 'Player 2’s') : owner === viewer ? 'your' : 'opposing'} ${getDisplayCardById(id)?.name ?? 'Creature'}`;
  }
  if (viewer === 'spectator' && zone.startsWith('hand:')) return zone === 'hand:0' ? 'Player 1’s hand' : 'Player 2’s hand';
  if (zone.startsWith('hand:')) return zone === `hand:${viewer}` ? 'your hand' : 'opponent’s hand';
  return ({ market: 'Market', discard: 'Discards', deck: 'Deck' } as Record<string, string>)[zone] ?? '';
}

export function describeMotion(step: MotionStep, viewer?: string): string {
  if (step.kind === 'move') {
    const zone =
      step.to.zone === 'market'
        ? 'the Market'
        : step.to.zone === 'discard'
          ? 'Discards'
          : step.to.zone.startsWith('hand:')
            ? 'hand'
            : 'the board';
    return `${step.to.card.name} → ${zone}`;
  }
  if (step.kind === 'rotate') return `${step.to.card.name} · ${step.to.card.rotation ?? 0}°`;
  const side =
    step.target.startsWith('power:') && viewer ? (viewer === 'spectator' ? (step.target === 'power:0' ? 'Player 1’s ' : 'Player 2’s ') : step.target === `power:${viewer}` ? 'your ' : 'opponent’s ') : '';
  const score =
    step.before === undefined || step.after === undefined
      ? ''
      : ` · ${Math.max(0, step.before)} → ${Math.max(0, step.after)}`;
  if (step.kind === 'combat') {
    const defenses = step.defense?.map((t) => `${t.label} ${t.amount} Defense`).join(' + ');
    const attack = `${step.label} · ${step.attack ?? (step.amount ?? 0) + (step.blocked ?? 0)} damage`;
    const intercept = step.bypass
      ? `${step.provider?.label ?? step.label} bypasses Defense`
      : step.blocked
        ? `${defenses ? defenses + ' · ' : ''}${step.blocked} blocked`
        : '';
    return [attack, intercept, step.amount ? `−${step.amount} ${side}Power${score}` : `Fully blocked${score}`]
      .filter(Boolean)
      .join(' → ');
  }
  if (step.kind === 'power') {
    const reason = step.triggeredBy ? ` (${step.triggeredBy.label} ${step.trigger ?? 'left play'})` : '';
    return `${step.label}${reason} → ${(step.amount ?? 0) < 0 ? '−' : '+'}${Math.abs(step.amount ?? 0)} ${side}Power${score}`;
  }
  const targets = step.targets?.map(describeTarget).join(' / ') ?? '';
  const cards = step.targets?.map((t) => t.label).join(', ') ?? '';
  const hand =
    viewer && step.targets?.[0]?.destination?.startsWith('hand:')
      ? zoneName(step.targets[0].destination, viewer)
      : 'hand';
  switch (step.action) {
    case 'draw':
      return `${step.reason ? step.label + ' · ' + step.reason + ' · ' : ''}${cards} · Market → ${hand}`;
    case 'play':
      return `${step.label} → ${step.reason ?? 'the board'} · Played`;
    case 'discard':
      return `${step.label} · ${step.reason} → ${cards === step.label ? 'Discards' : cards + ' → Discards'}`;
    case 'reverse':
      return `${step.label} ↶ ${targets}`;
    case 'rotate':
      return `${step.source === step.target ? '↷ ' + targets : step.label + ' ↷ ' + targets}${step.reason ? ' · ' + step.reason : ''}`;
    case 'status':
      return `${step.label} · ${step.reason} → ${targets}`;
    case 'choose':
      return `${step.label} · Choose a target → ${cards}`;
    case 'skip':
      return `${step.label} · Optional effect skipped`;
    case 'bonus':
      return `${step.label} → +1 action next turn`;
    case 'available':
      return `+${step.targets?.[0]?.amount} action available this turn`;
    case 'free':
      return `${step.label} → ${cards} · No action spent`;
    default:
      return step.label;
  }
}

export function describeBoardMotion(
  step: MotionStep,
  viewer: string,
  visible: (anchor: string) => boolean,
  preview?: string,
  shownTargets: readonly CueTarget[] = [],
) {
  const description = preview ?? describeMotion(step, viewer);
  if (step.kind === 'move' || step.kind === 'rotate') return description;
  const locations = new Set<string>();
  function locate(anchor: string, label: string, zone?: string) {
    if (!visible(anchor) && zone) {
      const location = zoneName(zone, viewer);
      if (location && location !== label) locations.add(`${label} · ${location}`);
    }
  }
  locate(step.source, step.label, step.sourceZone);
  const targets = preview === undefined ? [...(step.targets ?? []), ...(step.defense ?? [])] : shownTargets;
  for (const t of targets) locate(t.anchor, t.label, t.zone);
  return locations.size ? `${description} (${[...locations].join(', ')})` : description;
}
