import { GameState, PlayerState } from './types';
import { getCreatureWisdom } from './utils';

/**
 * Rotates a creature, increasing its wisdom.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, creatureId).
 * @returns The updated game state.
 */
export function rotateCreature(state: GameState, payload: { playerId: string; creatureId: string }): GameState {
  const { playerId, creatureId } = payload;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };
  const creatureIndex = player.creatures.findIndex(c => c.id === creatureId);
  if (creatureIndex === -1) return state;

  const creature = { ...player.creatures[creatureIndex] };

  const currentRotation = creature.rotation ?? 0;
  if (currentRotation >= 270) {
    return state; // Already at max rotation
  }

  // Rotate creature
  const newRotation = currentRotation + 90;
  creature.rotation = newRotation;
  // Set wisdom according to wisdomCycle and rotation
  creature.currentWisdom = getCreatureWisdom({ ...creature, rotation: newRotation });

  player.creatures = [
    ...player.creatures.slice(0, creatureIndex),
    creature,
    ...player.creatures.slice(creatureIndex + 1),
  ];

  updatedPlayers[playerIndex] = player;

  return {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    log: [...state.log, `Player ${playerIndex + 1} rotated ${creature.name}.`]
  };
}

/**
 * Draws a knowledge card from the market to the player's hand.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId).
 * @returns The updated game state.
 */
export function drawKnowledge(state: GameState, payload: { playerId: string; knowledgeId: string }): GameState {
  const { playerId, knowledgeId } = payload;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const cardToDraw = state.market.find(k => k.id === knowledgeId);
  if (!cardToDraw) return state;

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };

  player.hand = [...player.hand, cardToDraw];
  updatedPlayers[playerIndex] = player;

  let updatedMarket = state.market.filter(k => k.id !== knowledgeId);
  let updatedDeck = [...state.knowledgeDeck];
  if (updatedDeck.length > 0) {
    const nextCard = updatedDeck.shift();
    if (nextCard) {
      updatedMarket.push(nextCard);
    }
  }

  return {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    market: updatedMarket,
    knowledgeDeck: updatedDeck,
    log: [...state.log, `Player ${playerIndex + 1} drew ${cardToDraw.name} from the market.`]
  };
}

/**
 * Summons a knowledge card from the player's hand onto a creature.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, creatureId).
 * @returns The updated game state.
 */
export function summonKnowledge(state: GameState, payload: { playerId: string; knowledgeId: string; creatureId: string }): GameState {
  const { playerId, knowledgeId, creatureId } = payload;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };

  const knowledgeCardIndex = player.hand.findIndex(k => k.id === knowledgeId);
  if (knowledgeCardIndex === -1) return state;
  const knowledgeCard = player.hand[knowledgeCardIndex];

  const creatureIndex = player.creatures.findIndex(c => c.id === creatureId);
  if (creatureIndex === -1) return state;
  const creature = { ...player.creatures[creatureIndex] };

  // Calculate effective cost considering passives (this might need adjustment based on when passives are applied)
  let effectiveCost = knowledgeCard.cost;
   // Example: Apply cost reductions (ensure passives are applied *before* this action if they modify cost)
   if (knowledgeCard.element === 'water' && player.creatures.some(c => c.id === 'kappa' && player.field.some(f => f.creatureId === 'kappa'))) {
       effectiveCost = Math.max(1, effectiveCost - 1);
   }
   if (knowledgeCard.element === 'earth' && player.creatures.some(c => c.id === 'dudugera' && player.field.some(f => f.creatureId === 'dudugera'))) {
       effectiveCost = Math.max(1, effectiveCost - 1);
   }
  // Deduct effective cost
  creature.currentWisdom = (creature.currentWisdom ?? creature.baseWisdom) - effectiveCost;


  player.creatures = [
    ...player.creatures.slice(0, creatureIndex),
    creature,
    ...player.creatures.slice(creatureIndex + 1),
  ];

  player.hand = player.hand.filter(k => k.id !== knowledgeId);

  const fieldSlotIndex = player.field.findIndex(f => f.creatureId === creatureId);
  if (fieldSlotIndex === -1) return state;

  player.field = [
    ...player.field.slice(0, fieldSlotIndex),
    { creatureId: creatureId, knowledge: { ...knowledgeCard, rotation: 0 } },
    ...player.field.slice(fieldSlotIndex + 1),
  ];

  updatedPlayers[playerIndex] = player;

  return {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    log: [...state.log, `Player ${playerIndex + 1} summoned ${knowledgeCard.name} onto ${creature.name}.`]
  };
}
