import type { Creature, CreatureElement, GameState, Knowledge } from './types.js';

/** Optional, local presentation data. Never used to decide a game rule. */
export interface PresentationCue {
  kind: 'combat' | 'power' | 'effect';
  source: string;
  target: string;
  label: string;
  element: CreatureElement;
  amount?: number;
  blocked?: number;
  bypass?: boolean;
  defenders?: string[];
}

export const cardAnchor = (playerId: string, card: Creature | Knowledge) =>
  'instanceId' in card && card.instanceId ? `card:${card.instanceId}` : `creature:${playerId}:${card.id}`;

export function recordCue(state: GameState, cue?: PresentationCue) {
  if (cue && state.presentationCues) state.presentationCues.push(cue);
}

export const capturePower = (state: GameState) => ({
  values: state.players.map(player => player.power), count: state.presentationCues?.length ?? 0,
});

/** Attribute changes at the effect boundary, excluding already recorded nested effects. */
export function recordPowerChanges(state: GameState, before: ReturnType<typeof capturePower>, owner: string, card: Creature | Knowledge) {
  if (!state.presentationCues) return;
  const recorded = state.presentationCues.slice(before.count);
  state.players.forEach((player, index) => {
    const target = `power:${player.id}`;
    const accounted = recorded.filter(cue => cue.target === target).reduce((sum, cue) =>
      sum + (cue.kind === 'combat' ? -(cue.amount ?? 0) : cue.kind === 'power' ? cue.amount ?? 0 : 0), 0);
    const amount = player.power - before.values[index] - accounted;
    if (amount) recordCue(state, { kind: 'power', source: cardAnchor(owner, card), target,
      amount, label: card.name, element: card.element });
  });
}
