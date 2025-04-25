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
    console.warn(`[Action] Attempted to rotate ${creature.name} beyond max rotation.`);
    return state;
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
    log: [...state.log, `Player ${playerId} rotated ${creature.name}.`]
  };
}

/**
 * Draws a knowledge card from the market to the player's hand.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, instanceId).
 * @returns The updated game state.
 */
export function drawKnowledge(state: GameState, payload: { playerId: string; knowledgeId: string; instanceId: string }): GameState {
  const { playerId, instanceId } = payload;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const cardToDraw = state.market.find(k => k.instanceId === instanceId);
  if (!cardToDraw) {
    console.warn(`[Action] Card with instanceId ${instanceId} not found in market for DRAW_KNOWLEDGE.`);
    return state;
  }

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };

  player.hand = [...player.hand, cardToDraw];
  updatedPlayers[playerIndex] = player;

  let updatedMarket = state.market.filter(k => k.instanceId !== instanceId);
  let updatedDeck = [...state.knowledgeDeck];
  if (updatedDeck.length > 0) {
    const nextCard = updatedDeck.shift();
    if (nextCard) {
      updatedMarket.push({ ...nextCard, instanceId: nextCard.instanceId || uuidv4() });
    }
  }

  return {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    market: updatedMarket,
    knowledgeDeck: updatedDeck,
    log: [...state.log, `Player ${playerId} drew ${cardToDraw.name} from the market.`]
  };
}

/**
 * Summons a knowledge card from the player's hand onto a creature.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, instanceId, creatureId).
 * @returns The updated game state.
 */
export function summonKnowledge(state: GameState, payload: { playerId: string; knowledgeId: string; instanceId: string; creatureId: string }): GameState {
  const { playerId, instanceId, creatureId } = payload;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const updatedPlayers = [...state.players];
  const player = { ...updatedPlayers[playerIndex] };

  const knowledgeCardIndex = player.hand.findIndex(k => k.instanceId === instanceId);
  if (knowledgeCardIndex === -1) {
    console.warn(`[Action] Card with instanceId ${instanceId} not found in hand for SUMMON_KNOWLEDGE.`);
    return state;
  }
  const knowledgeCard = player.hand[knowledgeCardIndex];

  const creatureIndex = player.creatures.findIndex(c => c.id === creatureId);
  if (creatureIndex === -1) return state;
  const creature = { ...player.creatures[creatureIndex] };

  player.hand = player.hand.filter(k => k.instanceId !== instanceId);

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
    log: [...state.log, `Player ${playerId} summoned ${knowledgeCard.name} onto ${creature.name}.`]
  };
}
