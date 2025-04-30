import { GameState, Knowledge, PlayerState, SummonKnowledgePayload } from './types';
import { getCreatureWisdom, getPlayerState, getOpponentState } from './utils.js';
import { v4 as uuidv4 } from 'uuid';
import { applyPassiveAbilities } from './passives'; // Make sure this is imported

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
export function summonKnowledge(state: GameState, payload: SummonKnowledgePayload): GameState {
  const { playerId, knowledgeId, instanceId, creatureId } = payload;
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = getPlayerState(newState, playerId);
  const opponent = getOpponentState(newState, playerId); // Needed for Lisovik target

  if (!player) return newState; // Should not happen if validation passed

  const knowledgeIndex = player.hand.findIndex(k => k.instanceId === instanceId);
  if (knowledgeIndex === -1) {
    console.error(`[Action] summonKnowledge: Knowledge ${instanceId} not found in hand of player ${playerId}`);
    return newState; // Card not found
  }
  const knowledgeToSummon = player.hand[knowledgeIndex];

  const fieldIndex = player.field.findIndex(f => f.creatureId === creatureId);
  if (fieldIndex === -1) {
    console.error(`[Action] summonKnowledge: Creature slot ${creatureId} not found for player ${playerId}`);
    return newState; // Creature slot not found
  }

  let leavingKnowledge: Knowledge | null = null;

  // --- Handle Knowledge Replacement and KNOWLEDGE_LEAVE Trigger ---
  if (player.field[fieldIndex].knowledge) {
    leavingKnowledge = player.field[fieldIndex].knowledge;
    console.log(`[Action] summonKnowledge: Replacing ${leavingKnowledge?.name} (${leavingKnowledge?.instanceId}) on ${creatureId}`);
    newState.discardPile.push(leavingKnowledge!); // Add replaced card to discard

    // Trigger KNOWLEDGE_LEAVE passive
    const eventDataLeave = {
      playerId: playerId, // The player whose knowledge is leaving
      creatureId: creatureId,
      knowledgeCard: leavingKnowledge,
    };
    console.log(`[Action] summonKnowledge: Applying KNOWLEDGE_LEAVE passives.`);
    // Pass the modified newState into applyPassiveAbilities
    const stateAfterLeavePassive = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', eventDataLeave);
    // Update newState with the result of the passive application
    Object.assign(newState, stateAfterLeavePassive);
    // Re-fetch player/opponent references in case passives modified them
    // player = getPlayerState(newState, playerId);
    // opponent = getOpponentState(newState, playerId);
  }
  // --- End Replacement Logic ---

  // Place the new knowledge
  player.field[fieldIndex].knowledge = knowledgeToSummon;
  // Remove the summoned card from hand
  player.hand.splice(knowledgeIndex, 1);

  newState.log = [...newState.log, `${playerId} summoned ${knowledgeToSummon.name} onto ${creatureId}${leavingKnowledge ? ` (replacing ${leavingKnowledge.name})` : ''}.`];

  return newState;
}
