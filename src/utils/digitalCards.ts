import type { Creature, Knowledge } from '../game/types.js';

export type DisplayCard = Creature | Knowledge;
export type CycleKind = 'wisdom' | 'damage' | 'defense' | 'power' | 'rotate' | 'block' | 'limit' | 'effect';
export interface CardCycleStep { value: number | string; kind: CycleKind; label: string }

export const isKnowledgeCard = (card: DisplayCard): card is Knowledge => 'cost' in card && 'effect' in card;
export const normalizeCardRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

export function getCardCycle(card: DisplayCard): CardCycleStep[] {
  if (!isKnowledgeCard(card)) {
    return (card.wisdomCycle?.length ? card.wisdomCycle : [card.baseWisdom ?? 0]).map(value => ({ value, kind: 'wisdom', label: `Wisdom ${value}` }));
  }
  const steps = Math.max(1, card.maxRotations ?? card.valueCycle?.length ?? 4);
  return Array.from({ length: steps }, (_, index): CardCycleStep => {
    const value = card.valueCycle?.[index];
    if (typeof value === 'number') {
      const kind = value < 0 ? 'defense' : 'damage';
      return { value: Math.abs(value), kind, label: `${value < 0 ? 'Defense' : 'Damage'} ${Math.abs(value)}` };
    }
    if (card.id === 'aerial2') return { value: index + 1, kind: 'power', label: `Gain ${index + 1} Power` };
    if (card.id === 'aquatic1') return { value: 1, kind: 'rotate', label: 'Rotate a Knowledge 1 step' };
    if (card.id === 'aquatic3') return { value: '—', kind: 'block', label: 'Block opposing summons' };
    if (card.id === 'terrestrial3') return { value: 'W', kind: 'damage', label: 'Damage equal to summoner Wisdom' };
    if (card.id === 'terrestrial4') return { value: Math.max(0, 2 - index), kind: 'limit', label: `Discard opposing Knowledge costing ${Math.max(0, 2 - index)} or less` };
    return { value: '✦', kind: 'effect', label: 'Card effect' };
  });
}

export function getCardPresentation(card: DisplayCard, rotation = card.rotation ?? 0) {
  const knowledge = isKnowledgeCard(card);
  const cycle = getCardCycle(card);
  const step = Math.min(cycle.length - 1, Math.floor(normalizeCardRotation(rotation) / 90));
  const current = cycle[step];
  const value = knowledge ? card.cost : (card.currentWisdom ?? Number(current.value));
  const description = knowledge ? card.effect : card.passiveAbility;
  return {
    knowledge, cycle, step, current, value, description,
    final: knowledge && step === cycle.length - 1,
    nameIsLong: card.name.length > 11,
    // The numeric rotation track already communicates this information.
    rules: description.replace(/\s*Deals damage(?:\/defense)? based on rotation\.?/i, '').trim(),
  };
}

// Artwork is displayed from the original files. Only its paper frame is clipped.
// Coordinates are percentages of the source, so responsive 360/720px images agree.
export function getCardArtClass(card: DisplayCard) {
  if (card.id === 'lafaic') return 'dc-art-lafaic';
  if (['aerial2', 'aquatic1', 'aquatic3', 'terrestrial3'].includes(card.id)) return 'dc-art-knowledge dc-art-scene';
  return isKnowledgeCard(card) ? 'dc-art-knowledge' : 'dc-art-being';
}
