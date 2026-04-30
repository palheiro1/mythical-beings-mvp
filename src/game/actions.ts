import { GameState, Knowledge, PlayerState, SummonKnowledgePayload } from './types';
import { getCreatureWisdom, getPlayerState, makeKnowledgeInstance, refillMarket } from './utils.js';


// Define a return type that includes info about leaving knowledge
export type SummonKnowledgeResult = {
  newState: GameState;
  leavingKnowledgeInfo: {
    playerId: string;
    creatureId: string;
    knowledgeCard: Knowledge;
  } | null;
};

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

  let nextState: GameState = {
    ...state,
    players: updatedPlayers as [PlayerState, PlayerState],
    market: state.market.filter(k => k.instanceId !== instanceId),
    knowledgeDeck: [...state.knowledgeDeck],
    discardPile: [...state.discardPile],
    log: [...state.log, `Player ${playerId} drew ${cardToDraw.name} from the market.`]
  };

  nextState = refillMarket(nextState, state.market.length);
  return nextState;
}

/**
 * Summons a knowledge card from the player's hand onto a creature.
 * Assumes the action is valid.
 * Applies any immediate 'effect' defined on the knowledge card.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, instanceId, creatureId).
 * @returns The updated game state and info about any knowledge that left.
 */
export function summonKnowledge(state: GameState, payload: SummonKnowledgePayload): SummonKnowledgeResult {
  const { playerId, knowledgeId, instanceId, creatureId } = payload;
  // Use a mutable copy for intermediate steps within this function
  let workingState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = getPlayerState(workingState, playerId);

  // Basic validation (should ideally be covered by isValidAction, but good safety net)
  if (!player) return { newState: workingState, leavingKnowledgeInfo: null };
  const knowledgeIndex = player.hand.findIndex(k => k.instanceId === instanceId);
  if (knowledgeIndex === -1) {
    console.error(`[Action] summonKnowledge: Knowledge ${instanceId} not found in hand of player ${playerId}`);
    return { newState: workingState, leavingKnowledgeInfo: null };
  }
  const knowledgeToSummon = makeKnowledgeInstance({ ...player.hand[knowledgeIndex], rotation: 0 });
  const fieldIndex = player.field.findIndex(f => f.creatureId === creatureId);
  if (fieldIndex === -1) {
    console.error(`[Action] summonKnowledge: Creature slot ${creatureId} not found for player ${playerId}`);
    return { newState: workingState, leavingKnowledgeInfo: null };
  }

  const replacedKnowledge = player.field[fieldIndex].knowledge
    ? { ...player.field[fieldIndex].knowledge! }
    : null;

  let leavingKnowledgeInfo: SummonKnowledgeResult['leavingKnowledgeInfo'] = null;
  if (replacedKnowledge) {
    workingState.discardPile = [...workingState.discardPile, replacedKnowledge];
    leavingKnowledgeInfo = {
      playerId,
      creatureId,
      knowledgeCard: replacedKnowledge,
    };
  }

  // Place the new knowledge
  player.field[fieldIndex].knowledge = knowledgeToSummon;
  // Remove the summoned card from hand
  player.hand.splice(knowledgeIndex, 1);

  workingState.log = [
    ...workingState.log,
    replacedKnowledge
      ? `${playerId} replaced ${replacedKnowledge.name} with ${knowledgeToSummon.name} onto ${creatureId}.`
      : `${playerId} summoned ${knowledgeToSummon.name} onto ${creatureId}.`
  ];

  // Return the modified state and the info about any knowledge that left
  return { newState: workingState, leavingKnowledgeInfo };
}
