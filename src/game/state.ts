import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules.js';
import { rotateCreature, drawKnowledge, summonKnowledge, SummonKnowledgePayload } from './actions.js';
import { applyPassiveAbilities } from './passives.js';
import knowledgeData from '../assets/knowledges.json';
import creatureData from '../assets/creatures.json';
import { getPlayerState } from './utils.js';

// Constants
const INITIAL_POWER = 20;
const MARKET_SIZE = 5;
const ACTIONS_PER_TURN = 2;
const ALL_CREATURES: Creature[] = creatureData as Creature[];

// Helper functions
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper function for debugging duplicate IDs
function checkForDuplicateIds(state: GameState, stepName: string): void {
  const ids = new Set<string>();
  let duplicateFound = false;
  const check = (card: Knowledge | null | undefined, location: string) => {
    if (card?.instanceId) {
      if (ids.has(card.instanceId)) {
        console.error(`DUPLICATE ID DETECTED at step "${stepName}" in ${location}: ${card.instanceId}`, card);
        duplicateFound = true;
      }
      ids.add(card.instanceId);
    }
  };
  state.market.forEach(c => check(c, 'market'));
  state.knowledgeDeck.forEach(c => check(c, 'knowledgeDeck'));
  state.players.forEach((p, idx) => p.hand.forEach(c => check(c, `player ${idx+1} hand`)));
  state.players.forEach((p, idx) => p.field.forEach(s => check(s.knowledge, `player ${idx+1} field`)));
  state.discardPile.forEach(c => check(c, 'discardPile'));

  if (duplicateFound) {
    console.error(`---> Duplicate instanceId found during step: ${stepName}`);
  } else {
     console.log(`---> No duplicate instanceIds found after step: ${stepName}`);
  }
}

// Export for testing purposes
export function injectInstanceIds(state: GameState): GameState {
  // Always assign a new unique instanceId to every knowledge card
  const assignNewInstanceId = (card: Knowledge) => ({ ...card, instanceId: crypto.randomUUID() });
  return {
    ...state,
    market: state.market.map(assignNewInstanceId),
    knowledgeDeck: state.knowledgeDeck.map(assignNewInstanceId),
    discardPile: state.discardPile.map(assignNewInstanceId),
    players: state.players.map(p => ({
      ...p,
      hand: p.hand.map(assignNewInstanceId),
      field: p.field.map(slot =>
        slot.knowledge
          ? { creatureId: slot.creatureId, knowledge: assignNewInstanceId(slot.knowledge) }
          : slot
      ),
    })) as [PlayerState, PlayerState],
  };
}

export type InitializeGamePayload = {
  gameId: string;
  player1Id: string;
  player2Id: string;
  player1SelectedIds: string[];
  player2SelectedIds: string[];
};

const lookupCreatures = (ids: string[], allCreatures: Creature[]): Creature[] => {
  const foundCreatures = ids.map(id => allCreatures.find(c => c.id === id)).filter((c): c is Creature => !!c);
  if (foundCreatures.length !== ids.length) {
    console.error("Could not find all selected creatures! IDs:", ids, "Found:", foundCreatures);
    throw new Error(`Failed to initialize game: Could not find all selected creatures for IDs: ${ids.join(', ')}`);
  }
  // Re-add deep clone to ensure creature data is independent
  return JSON.parse(JSON.stringify(foundCreatures));
};

const initialPlayerState = (id: string, creatures: Creature[]): PlayerState => ({
  id,
  power: INITIAL_POWER,
  creatures: creatures.map(c => ({ ...c, currentWisdom: c.baseWisdom, rotation: 0 })),
  hand: [],
  field: creatures.map(c => ({ creatureId: c.id, knowledge: null })),
  selectedCreatures: creatures,
});

export function initializeGame(payload: InitializeGamePayload): GameState {
  const { gameId, player1Id, player2Id, player1SelectedIds, player2SelectedIds } = payload;

  const selectedCreaturesP1 = lookupCreatures(player1SelectedIds, ALL_CREATURES);
  const selectedCreaturesP2 = lookupCreatures(player2SelectedIds, ALL_CREATURES);

  const fullDeck: Knowledge[] = [];
  (knowledgeData as any[]).forEach((card: Knowledge) => {
    let copies = 0;
    switch (card.cost) {
      case 1:
      case 2:
        copies = 4;
        break;
      case 3:
        copies = 3;
        break;
      case 4:
      case 5:
        copies = 2;
        break;
      default:
        copies = 1;
        break;
    }
    for (let i = 0; i < copies; i++) {
      fullDeck.push({ ...card, instanceId: crypto.randomUUID() });
    }
  });

  const shuffledDeck = shuffleArray(fullDeck);
  const initialMarket = shuffledDeck.slice(0, MARKET_SIZE);
  const remainingDeck = shuffledDeck.slice(MARKET_SIZE);

  let initialState: GameState = {
    gameId,
    players: [
      initialPlayerState(player1Id, selectedCreaturesP1),
      initialPlayerState(player2Id, selectedCreaturesP2),
    ],
    knowledgeDeck: remainingDeck,
    market: initialMarket,
    discardPile: [],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'knowledge',
    actionsTakenThisTurn: 0,
    actionsPerTurn: ACTIONS_PER_TURN,
    winner: null,
    log: [`Game ${gameId} initialized. Player 1 starts.`],
    blockedSlots: { 0: [], 1: [] }, // Initialize blockedSlots
  };
  checkForDuplicateIds(initialState, "After initial deal"); // Check 1

  initialState = applyPassiveAbilities(initialState, 'TURN_START', { playerId: initialState.players[0].id });
  checkForDuplicateIds(initialState, "After applyPassiveAbilities"); // Check 2

  initialState = executeKnowledgePhase(initialState);
  checkForDuplicateIds(initialState, "After executeKnowledgePhase"); // Check 3

  const winner = checkWinCondition(initialState);
  if (winner) {
    initialState = { ...initialState, winner, phase: 'end', log: [...initialState.log, `Player ${winner} wins!`] };
  }

  const finalState = injectInstanceIds(initialState);
  checkForDuplicateIds(finalState, "After injectInstanceIds"); // Check 4

  console.log("[Reducer] INITIALIZE_GAME completed. Initial state:", finalState);
  return finalState;
}

function endTurnSequence(state: GameState): GameState {
  console.log(`[Reducer] Starting endTurnSequence for Player ${state.players[state.currentPlayerIndex].id}`);
  let workingState = state;

  // --- Rotate Creatures ---
  const currentPlayerId = workingState.players[workingState.currentPlayerIndex].id;
  workingState.players[workingState.currentPlayerIndex].creatures.forEach(creature => {
    if (creature.rotation < creature.maxRotations) {
      creature.rotation += 1;
      workingState.log.push(`Creature ${creature.name} (Owner: ${currentPlayerId}) rotated to ${creature.rotation}/${creature.maxRotations}.`);
    }
  });

  // --- Transition Turn ---
  workingState.currentPlayerIndex = (workingState.currentPlayerIndex + 1) % workingState.players.length;
  if (workingState.currentPlayerIndex === 0) {
    workingState.turn += 1;
  }
  const newPlayerId = workingState.players[workingState.currentPlayerIndex].id;
  workingState.phase = 'knowledge';
  workingState.actionsTakenThisTurn = 0;
  workingState.log.push(`Turn ${workingState.turn}: Player ${newPlayerId} starts.`);
  console.log(`[Reducer] Transitioning to Turn ${workingState.turn}, Player ${newPlayerId}. Phase: ${workingState.phase}`);

  // --- Apply TURN_START Passives ---
  console.log(`[Reducer] Applying TURN_START passives for Player ${newPlayerId}`);
  workingState = applyPassiveAbilities(workingState, 'TURN_START', { playerId: newPlayerId });

  // Explicit knowledge-phase draw
  const curr = workingState.players[workingState.currentPlayerIndex];
  if (workingState.market.length > 0) {
    const drawn = workingState.market.shift()!;
    curr.hand.push(drawn);
    // simple draw log for tests
    workingState.log.push(`[Game] ${curr.id} drew`);
    workingState.log.push(`[Game] ${curr.id} drew ${drawn.name}.`);
    if (workingState.knowledgeDeck.length > 0) {
      const refill = workingState.knowledgeDeck.shift()!;
      workingState.market.push(refill);
      workingState.log.push(`[Game] Market refilled with ${refill.name}.`);
    }
  }

  // --- Execute Knowledge Phase ---
  console.log(`[Reducer] Executing knowledge phase for Player ${newPlayerId}`);
  workingState = executeKnowledgePhase(workingState);

  // --- Transition to Action Phase ---
  workingState.phase = 'action';
  workingState.log.push(`Turn ${workingState.turn}: Action Phase started.`);
  console.log(`[Reducer] endTurnSequence complete. New phase: ${workingState.phase}`);

  return workingState;
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {

  if (!state) {
    if (action.type === 'SET_GAME_STATE' && action.payload) {
      console.log("[Reducer] Received SET_GAME_STATE on null state.");
      const newState = action.payload as GameState;
      return {
        ...newState,
        actionsTakenThisTurn: newState.actionsTakenThisTurn ?? 0,
        actionsPerTurn: newState.actionsPerTurn ?? ACTIONS_PER_TURN,
        log: newState.log ?? [],
      };
    } else {
      console.error("[Reducer] Received action on null state (expected SET_GAME_STATE with payload):", action.type);
      return null;
    }
  }

  console.log(`[Reducer] Action: ${action.type}`, action.payload);

  // After logging the action, handle rotate knowledge
  if (action.type === 'ROTATE_KNOWLEDGE' && action.payload && 'playerId' in action.payload && 'creatureId' in action.payload) {
    const { playerId, creatureId } = action.payload as { playerId: string; creatureId: string };
    let newState = state;
    // Find the player's field slot
    const player = newState.players.find(p => p.id === playerId);
    if (!player) return state;
    const fieldSlot = player.field.find(slot => slot.creatureId === creatureId);
    if (!fieldSlot || !fieldSlot.knowledge) return state;
    const knowledgeCard = fieldSlot.knowledge;
    const currentRotation = knowledgeCard.rotation ?? 0;
    const maxRotations = (knowledgeCard.maxRotations ?? 4) * 90;
    if (currentRotation + 90 >= maxRotations) {
      // Knowledge leaves play
      fieldSlot.knowledge = null;
      newState.discardPile.push(knowledgeCard);
      // Trigger KNOWLEDGE_LEAVE passives
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', { playerId, creatureId, knowledgeCard });
    } else {
      // Just rotate
      knowledgeCard.rotation = currentRotation + 90;
    }
    return newState;
  }

  let intermediateState = state!;
  let actionConsumed = false;

  if (action.type === 'END_TURN') {
    const validation = isValidAction(state, action);
    if (!validation.isValid) {
      console.warn(`[Reducer] Invalid action: ${action.type} - ${validation.reason}`);
      return state;
    }
    console.log("[Reducer] Handling END_TURN action.");
    return endTurnSequence(intermediateState);
  }

  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
    console.error("[Reducer] Action requires a payload with playerId:", action);
    return state;
  }

  const validation = isValidAction(intermediateState, action);
  if (!validation.isValid) {
    console.warn(`[Reducer] Invalid action: ${action.type} - ${validation.reason}`);
    return state;
  }

  switch (action.type) {
    case 'ROTATE_CREATURE':
      intermediateState = rotateCreature(intermediateState, action.payload);
      actionConsumed = true;
      break;

    case 'DRAW_KNOWLEDGE': {
      if (!('instanceId' in action.payload) || !action.payload.instanceId) {
        console.error("[Reducer] DRAW_KNOWLEDGE requires instanceId in payload:", action);
        return state;
      }
      const cardToDraw = intermediateState.market.find(k => k.instanceId === action.payload.instanceId);
      intermediateState = drawKnowledge(intermediateState, action.payload as { playerId: string; knowledgeId: string; instanceId: string });
      const eventDataDraw = {
        playerId: action.payload.playerId,
        knowledgeId: action.payload.knowledgeId,
        instanceId: action.payload.instanceId,
        knowledgeCard: cardToDraw,
      };
      const drawTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_DRAW'
        : 'AFTER_OPPONENT_DRAW';
      console.log(`[Reducer] Applying ${drawTrigger} passives.`);
      intermediateState = applyPassiveAbilities(intermediateState, drawTrigger, eventDataDraw);
      actionConsumed = true;
      break;
    }

    case 'SUMMON_KNOWLEDGE': {
      const playerSummoning = getPlayerState(intermediateState, action.payload.playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.instanceId === action.payload.instanceId);
      const targetCreature = playerSummoning?.creatures.find(c => c.id === action.payload.creatureId);

      console.log(`[Reducer Debug] Calling summonKnowledge for ${action.payload.instanceId} onto ${action.payload.creatureId}`);
      const { newState: stateAfterSummon, leavingKnowledgeInfo } = summonKnowledge(intermediateState, action.payload as SummonKnowledgePayload);
      intermediateState = stateAfterSummon;

      if (leavingKnowledgeInfo) {
        console.log(`[Reducer Debug] Found leavingKnowledgeInfo. Applying KNOWLEDGE_LEAVE passives.`);
        intermediateState = applyPassiveAbilities(intermediateState, 'KNOWLEDGE_LEAVE', leavingKnowledgeInfo);
        console.log(`[Reducer Debug] State log after KNOWLEDGE_LEAVE passives:`, intermediateState.log);
      } else {
        console.log(`[Reducer Debug] No leavingKnowledgeInfo found. Skipping KNOWLEDGE_LEAVE passives.`);
      }

      let isFreeSummon = false;
      const playerAfterLeavePassives = getPlayerState(intermediateState, action.payload.playerId);

      if (targetCreature?.id === 'dudugera' && playerAfterLeavePassives?.creatures.some(c => c.id === 'dudugera')) {
        isFreeSummon = true;
        intermediateState.log = [...intermediateState.log, `[Passive Effect] Dudugera allows summoning ${knowledgeToSummon?.name || 'Knowledge'} onto itself without spending an action.`];
        console.log(`[Reducer] Dudugera passive active: SUMMON_KNOWLEDGE does not consume action.`);
      } else if (knowledgeToSummon?.element === 'water' && playerAfterLeavePassives?.creatures.some(c => c.id === 'kappa')) {
        isFreeSummon = true;
        intermediateState.log = [...intermediateState.log, `[Passive Effect] Kappa allows summoning aquatic knowledge ${knowledgeToSummon?.name || 'Knowledge'} without spending an action.`];
        console.log(`[Reducer] Kappa passive active: SUMMON_KNOWLEDGE does not consume action.`);
      }

      actionConsumed = !isFreeSummon;

      const eventDataSummon = {
        playerId: action.payload.playerId,
        creatureId: action.payload.creatureId,
        knowledgeId: action.payload.knowledgeId,
        instanceId: action.payload.instanceId,
        knowledgeCard: knowledgeToSummon,
      };
      const summonTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_SUMMON'
        : 'AFTER_OPPONENT_SUMMON';
      console.log(`[Reducer] Applying ${summonTrigger} passives.`);
      intermediateState = applyPassiveAbilities(intermediateState, summonTrigger, eventDataSummon);
      break;
    }

    default:
      console.error("[Reducer] Unhandled valid action type in switch:", action);
      return state;
  }

  const currentActionsPerTurn = intermediateState.actionsPerTurn ?? ACTIONS_PER_TURN;
  let newActionsTaken = intermediateState.actionsTakenThisTurn;
  let finalState = intermediateState;

  if (actionConsumed) {
    newActionsTaken++;
    finalState = {
      ...intermediateState,
      actionsTakenThisTurn: newActionsTaken,
      log: [...intermediateState.log, `Action ${action.type} completed. Actions: ${newActionsTaken}/${currentActionsPerTurn}`],
    };
    console.log(`[Reducer] Action ${action.type} processed. Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
  } else {
    finalState.log = [...intermediateState.log, `Action ${action.type} completed (Free). Actions: ${newActionsTaken}/${currentActionsPerTurn}`];
    console.log(`[Reducer] Action ${action.type} processed (Free). Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
  }

  let winner = checkWinCondition(finalState);
  if (winner) {
    console.log(`[Reducer] Win condition met after action ${action.type}. Winner: ${winner}`);
    return { ...finalState, winner, phase: 'end', log: [...finalState.log, `Player ${winner} wins!`] };
  }

  if (newActionsTaken >= currentActionsPerTurn) {
    console.log(`[Reducer] Action limit reached (${newActionsTaken}/${currentActionsPerTurn}). Ending turn.`);
    const stateBeforeEnd = {
      ...finalState,
      log: [...finalState.log, `Action limit reached (${newActionsTaken}/${currentActionsPerTurn}). Ending turn.`],
    };
    return endTurnSequence(stateBeforeEnd);
  }

  return finalState;
}
