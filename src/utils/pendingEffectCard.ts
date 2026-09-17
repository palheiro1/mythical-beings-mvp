import type { GameState, PendingEffectChoice } from '../game/types.js';
import { getEffectiveCreatureWisdom } from '../game/utils.js';
import type { DisplayCard } from './digitalCards.js';

/** Resolve the actual card instance so target choices retain live values and rotation. */
export function getPendingEffectCard(game: GameState, choice: PendingEffectChoice): DisplayCard | undefined {
  if (choice.kind === 'market') return game.market.find(card => card.instanceId === choice.instanceId);
  const player = game.players[choice.playerIndex];
  if (choice.kind === 'hand') return player.hand.find(card => card.instanceId === choice.instanceId);
  if (choice.kind === 'knowledge') return player.field.find(slot => slot.creatureId === choice.creatureId && slot.knowledge?.instanceId === choice.instanceId)?.knowledge ?? undefined;
  const creature = player.creatures.find(card => card.id === choice.creatureId);
  return creature ? { ...creature, currentWisdom: getEffectiveCreatureWisdom(game, choice.playerIndex, creature.id) } : undefined;
}
