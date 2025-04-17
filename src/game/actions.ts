import { GameState, PlayerState } from './types';

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
  if (playerIndex === -1) return state; // Should not happen if validated

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };
  const creatureIndex = player.creatures.findIndex(c => c.id === creatureId);
  if (creatureIndex === -1) return state; // Should not happen if validated

  const creature = { ...player.creatures[creatureIndex] };
  
  // Check if the creature has already been rotated 3 times (270 degrees)
  const currentRotation = creature.rotation ?? 0;
  if (currentRotation >= 270) {
    // Already at max rotation, don't rotate further
    return state;
  }
  
  // Increase wisdom
  creature.currentWisdom = (creature.currentWisdom ?? creature.baseWisdom) + 1;
  
  // Update rotation by 90 degrees counterclockwise (add 90 degrees)
  creature.rotation = currentRotation + 90;

  player.creatures = [
    ...player.creatures.slice(0, creatureIndex),
    creature,
    ...player.creatures.slice(creatureIndex + 1),
  ];

  updatedPlayers[playerIndex] = player;

  return {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    log: [...state.log, `Player ${playerIndex + 1} rotated ${creature.name}, wisdom is now ${creature.currentWisdom}`]
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
  if (!cardToDraw) return state; // Should not happen if validated

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };

  player.hand = [...player.hand, cardToDraw];
  updatedPlayers[playerIndex] = player;

  // Remove card from market and refill from deck
  let updatedMarket = state.market.filter(k => k.id !== knowledgeId);
  let updatedDeck = [...state.knowledgeDeck];
  // Refill the market if the deck has cards
  if (updatedDeck.length > 0) {
    const nextCard = updatedDeck.shift(); // Take the top card
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
  if (knowledgeCardIndex === -1) return state; // Should not happen if validated
  const knowledgeCard = player.hand[knowledgeCardIndex];

  const creatureIndex = player.creatures.findIndex(c => c.id === creatureId);
  if (creatureIndex === -1) return state; // Should not happen if validated
  const creature = { ...player.creatures[creatureIndex] };

  // Deduct cost and update creature wisdom
  creature.currentWisdom = (creature.currentWisdom ?? creature.baseWisdom) - knowledgeCard.cost;

  // Update creature in player's creature list
  player.creatures = [
    ...player.creatures.slice(0, creatureIndex),
    creature,
    ...player.creatures.slice(creatureIndex + 1),
  ];

  // Remove card from hand
  player.hand = player.hand.filter(k => k.id !== knowledgeId);

  // Add card to the creature's field slot, setting initial rotation
  const fieldSlotIndex = player.field.findIndex(f => f.creatureId === creatureId);
  if (fieldSlotIndex === -1) return state; // Should not happen, field should be initialized

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
