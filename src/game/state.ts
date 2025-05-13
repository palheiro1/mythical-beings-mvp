import { GameState, GameAction, PlayerState, Knowledge, Creature, SummonKnowledgePayload } from './types.js';
import { isValidAction, executeKnowledgePhase, checkWinConditions } from './rules.js';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions.js';
import { applyPassiveAbilities } from './passives.js';
import knowledgeData from '../assets/knowledges.json' assert { type: 'json' };
import creatureData from '../assets/creatures.json' assert { type: 'json' };
import { getPlayerState } from './utils.js';
import { cloneDeep } from 'lodash'; // Import cloneDeep

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
  state.market.forEach((c: Knowledge) => check(c, 'market'));
  state.knowledgeDeck.forEach((c: Knowledge) => check(c, 'knowledgeDeck'));
  state.players.forEach((p: PlayerState, idx: number) => p.hand.forEach((c: Knowledge) => check(c, `player ${idx+1} hand`)));
  state.players.forEach((p: PlayerState, idx: number) => p.field.forEach(s => check(s.knowledge, `player ${idx+1} field`)));
  state.discardPile.forEach((c: Knowledge) => check(c, 'discardPile'));

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
    players: state.players.map((p: PlayerState) => ({
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
  // Use cloneDeep for safer cloning
  return cloneDeep(foundCreatures);
};

const initialPlayerState = (id: string, creatures: Creature[]): PlayerState => ({
  id,
  power: INITIAL_POWER,
  creatures: creatures.map(c => ({ ...c, currentWisdom: c.baseWisdom, rotation: 0 })),
  hand: [],
  field: creatures.map(c => ({ creatureId: c.id, knowledge: null })),
  selectedCreatures: creatures,
});

export const initialGameState: GameState = {
  gameId: '',
  players: [
    // Dummy placeholder players to satisfy type, will be replaced on game init
    {
      id: '',
      power: 0,
      creatures: [],
      hand: [],
      field: [],
      selectedCreatures: [],
    },
    {
      id: '',
      power: 0,
      creatures: [],
      hand: [],
      field: [],
      selectedCreatures: [],
    },
  ],
  knowledgeDeck: [],
  market: [],
  discardPile: [],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'setup', // Start in setup phase
  actionsTakenThisTurn: 0,
  actionsPerTurn: ACTIONS_PER_TURN,
  winner: null,
  log: [],
  blockedSlots: { 0: [], 1: [] }, // Initialize blockedSlots
  extraActionsNextTurn: { 0: 0, 1: 0 }, // Initialize extraActionsNextTurn
};

export function initializeGame(payload: InitializeGamePayload): GameState {
  const { gameId, player1Id, player2Id, player1SelectedIds, player2SelectedIds } = payload;

  const selectedCreaturesP1 = lookupCreatures(player1SelectedIds, ALL_CREATURES);
  const selectedCreaturesP2 = lookupCreatures(player2SelectedIds, ALL_CREATURES);

  const fullDeck: Knowledge[] = [];
  (knowledgeData as any[]).forEach((card: any) => {
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
    phase: 'knowledge', // Initial phase before first knowledge execution
    actionsTakenThisTurn: 0,
    actionsPerTurn: ACTIONS_PER_TURN,
    winner: null,
    log: [`Game ${gameId} initialized. Player 1 starts.`],
    blockedSlots: { 0: [], 1: [] },
    extraActionsNextTurn: { 0: 0, 1: 0 },
  };
  checkForDuplicateIds(initialState, "After initial deal");

  initialState = applyPassiveAbilities(initialState, 'TURN_START', { playerId: initialState.players[0].id });
  checkForDuplicateIds(initialState, "After applyPassiveAbilities");

  initialState = executeKnowledgePhase(initialState);
  checkForDuplicateIds(initialState, "After executeKnowledgePhase");

  initialState = checkWinConditions(initialState);
  if (initialState.winner) {
    initialState = { ...initialState, phase: 'gameOver', log: [...initialState.log, `Player ${initialState.players.find(p => p.id === initialState.winner)?.id ?? 'Unknown'} wins!`] };
    console.log(`[initializeGame] Game over after initial setup. Winner: ${initialState.winner}`);
  } else {
    // If game is not over, transition to action phase for the first player
    initialState = {
      ...initialState,
      phase: 'action',
      log: [...initialState.log, `Turn ${initialState.turn}: Action Phase started for Player ${initialState.players[initialState.currentPlayerIndex].id}.`]
    };
    console.log(`[initializeGame] Transitioned to action phase for Player ${initialState.players[initialState.currentPlayerIndex].id}. New phase: ${initialState.phase}`);
  }

  const finalState = injectInstanceIds(initialState);
  checkForDuplicateIds(finalState, "After injectInstanceIds");

  console.log("[Reducer] INITIALIZE_GAME completed. Initial state:", finalState);
  return finalState;
}

function endTurnSequence(state: GameState): GameState {
  console.log(`[Reducer] Starting endTurnSequence for Player ${state.players[state.currentPlayerIndex].id}`);
  let workingState = cloneDeep(state); // Use cloneDeep at the beginning of the function

  // --- Rotate Creatures (Current player's creatures) ---
  // const currentPlayerId = workingState.players[workingState.currentPlayerIndex].id; // This was unused
  // TODO: Implement correct creature rotation logic if needed.
  // The previous logic was flawed (referencing Knowledge's maxRotations for Creatures, incorrect increment).
  // For now, creature "rotation" effects (like wisdom changes) should be handled by specific card effects or passives.
  // Commenting out the broken general rotation:
  /*
  workingState.players[workingState.currentPlayerIndex].creatures.forEach((creature: Creature) => {
    // Example of what it might do: update wisdom based on new rotation state
    // This needs to be defined by game rules, e.g., if rotation is 0, 90, 180, 270 degrees
    // and how that maps to wisdomCycle or other effects.
    // creature.rotation = ((creature.rotation ?? 0) + 90) % 360;
    // workingState.log.push(`Creature ${creature.name} (Owner: ${currentPlayerId}) rotated.`);
  });
  */

  // --- Transition Turn ---
  workingState.currentPlayerIndex = (workingState.currentPlayerIndex === 0 ? 1 : 0) as (0 | 1);
  if (workingState.currentPlayerIndex === 0) { // New turn if P2 just finished and it's P1's turn again
    workingState.turn += 1;
  }
  const newPlayerId = workingState.players[workingState.currentPlayerIndex].id;
  workingState.phase = 'knowledge'; // Set to knowledge phase for the new player
  workingState.actionsTakenThisTurn = 0;
  // Apply any extra actions granted for the new player's turn
  workingState.actionsPerTurn = ACTIONS_PER_TURN + (workingState.extraActionsNextTurn?.[workingState.currentPlayerIndex] ?? 0);
  workingState.extraActionsNextTurn = { ...workingState.extraActionsNextTurn, [workingState.currentPlayerIndex]: 0 }; // Reset after applying


  workingState.log.push(`Turn ${workingState.turn}: Player ${newPlayerId} starts. Actions: ${workingState.actionsPerTurn}`);
  console.log(`[Reducer] Transitioning to Turn ${workingState.turn}, Player ${newPlayerId}. Phase: ${workingState.phase}. Actions: ${workingState.actionsPerTurn}`);

  // --- Apply TURN_START Passives for the new current player ---
  console.log(`[Reducer] Applying TURN_START passives for Player ${newPlayerId}`);
  workingState = applyPassiveAbilities(workingState, 'TURN_START', { playerId: newPlayerId });

  // Check win condition after TURN_START passives
  workingState = checkWinConditions(workingState);
  if (workingState.winner !== null || (workingState.players[0].power <= 0 && workingState.players[1].power <= 0)) {
    const isDraw = workingState.players[0].power <= 0 && workingState.players[1].power <= 0 && workingState.winner === null; // Refined draw condition
    const winnerId = workingState.winner; // Can be null for a draw even if one player has <=0 power if checkWinConditions sets it so
    const loser = isDraw || !winnerId ? null : (winnerId === workingState.players[0].id ? workingState.players[1] : workingState.players[0]);
    const winLog = isDraw
      ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
      : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
    console.log(`[Reducer] Win/Draw condition met after TURN_START passives. ${winLog}`);
    // Ensure phase is gameOver
    return { ...workingState, phase: 'gameOver', winner: winnerId, log: [...workingState.log, winLog] };
  }

  // --- Execute Knowledge Phase for the new current player ---
  console.log(`[Reducer] Executing knowledge phase for Player ${newPlayerId}`);
  workingState = executeKnowledgePhase(workingState); // This function logs "Knowledge Phase ended"

  // Check win condition after Knowledge Phase
  workingState = checkWinConditions(workingState);
  if (workingState.winner !== null || (workingState.players[0].power <= 0 && workingState.players[1].power <= 0)) {
    const isDraw = workingState.players[0].power <= 0 && workingState.players[1].power <= 0 && workingState.winner === null;
    const winnerId = workingState.winner;
    const loser = isDraw || !winnerId ? null : (winnerId === workingState.players[0].id ? workingState.players[1] : workingState.players[0]);
    const winLog = isDraw
      ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
      : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
    console.log(`[Reducer] Win/Draw condition met after Knowledge Phase. ${winLog}`);
     // Ensure phase is gameOver
    return { ...workingState, phase: 'gameOver', winner: winnerId, log: [...workingState.log, winLog] };
  }

  // --- Transition to Action Phase for the new current player ---
  workingState.phase = 'action';
  workingState.log.push(`Turn ${workingState.turn}: Action Phase started for Player ${newPlayerId}.`);
  console.log(`[Reducer] endTurnSequence complete. New phase: ${workingState.phase} for player ${newPlayerId}`);

  return workingState;
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {

  if (!state) {
    if (action.type === 'SET_GAME_STATE' && action.payload) {
      console.log("[Reducer] Received SET_GAME_STATE on null state.");
      const newState = action.payload as GameState;
      // Ensure essential properties have defaults if not present in payload
      return {
        ...newState,
        actionsTakenThisTurn: newState.actionsTakenThisTurn ?? 0,
        actionsPerTurn: newState.actionsPerTurn ?? ACTIONS_PER_TURN,
        log: newState.log ?? [],
        blockedSlots: newState.blockedSlots ?? { 0: [], 1: [] },
        extraActionsNextTurn: newState.extraActionsNextTurn ?? { 0: 0, 1: 0 },
      };
    } else {
      console.error("[Reducer] Received action on null state (expected SET_GAME_STATE with payload):", action.type);
      return null;
    }
  }

  console.log(`[Reducer] Action: ${action.type}`, action.payload);

  // ROTATE_KNOWLEDGE is a new action type, ensure it's handled if needed or remove if not used by gameReducer directly
  if (action.type === 'ROTATE_KNOWLEDGE') {
    // Assuming ROTATE_KNOWLEDGE is an action that players can take, it should be handled within the switch
    // or have its own validation and processing logic similar to other actions.
    // If it's purely an internal mechanism (e.g. during knowledge phase), it might not be dispatched directly by players.
    // For now, let's assume it might be a player action and needs proper handling if it's meant to be one.
    // If it's not a player action, this check might be misplaced or the action type is for another purpose.
    // The current type definition includes it in GameAction, implying it could be dispatched.
    // However, the original code did not have a handler for it here.
    // If it's meant to be handled by executeKnowledgePhase, then this direct check might be redundant or incorrect.
    // For safety, and as it's not the primary issue, I will leave this part as it was (no explicit handler here).
    // The type error was in the comparison itself if 'ROTATE_KNOWLEDGE' wasn't in the union. Now it is.
  }


  let intermediateState = cloneDeep(state); // Clone state for modification
  let actionConsumed = false; // Flag to track if the action uses one of the player's available actions

  if (action.type === 'END_TURN') {
    // Player ID in END_TURN payload should match current player
    if (!action.payload || action.payload.playerId !== state.players[state.currentPlayerIndex].id) {
      console.warn(`[Reducer] Invalid END_TURN: Not current player or missing payload. Current: ${state.players[state.currentPlayerIndex].id}, Payload:`, action.payload);
      return state; // Invalid action
    }
    console.log("[Reducer] Handling END_TURN action.");
    let stateAfterEndOfTurn = endTurnSequence(intermediateState); // Pass the cloned state

    // No need to check for win conditions here again if endTurnSequence handles it thoroughly
    return stateAfterEndOfTurn;
  }

  // For other actions, validate if it's the current player's action
  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload) || action.payload.playerId !== state.players[state.currentPlayerIndex].id) {
    console.warn(`[Reducer] Action not for current player or missing/invalid payload. Current: ${state.players[state.currentPlayerIndex].id}, Action:`, action);
    return state; // Not this player's turn or invalid payload
  }


  const validation = isValidAction(intermediateState, action);
  if (!validation.isValid) {
    console.warn(`[Reducer] Invalid action: ${action.type} - ${validation.reason}`);
    intermediateState.log = [...intermediateState.log, `Invalid action: ${action.type} - ${validation.reason}`];
    return intermediateState; // Return the state with the log update
  }

  switch (action.type) {
    case 'ROTATE_CREATURE':
      intermediateState = rotateCreature(intermediateState, action.payload);
      actionConsumed = true;
      break;

    case 'DRAW_KNOWLEDGE': {
      if (!('instanceId' in action.payload) || !action.payload.instanceId) {
        console.error("[Reducer] DRAW_KNOWLEDGE requires instanceId in payload:", action);
        return intermediateState; // Return cloned state
      }
      const cardToDraw = intermediateState.market.find((k: Knowledge) => k.instanceId === action.payload.instanceId);
      intermediateState = drawKnowledge(intermediateState, action.payload as { playerId: string; knowledgeId: string; instanceId: string });
      const eventDataDraw = {
        playerId: action.payload.playerId,
        knowledgeId: action.payload.knowledgeId, 
        instanceId: action.payload.instanceId,
        knowledgeCard: cardToDraw,
      };
      const drawTrigger = action.payload.playerId === intermediateState.players[intermediateState.currentPlayerIndex].id
        ? 'AFTER_PLAYER_DRAW'
        : 'AFTER_OPPONENT_DRAW';
      console.log(`[Reducer] Applying ${drawTrigger} passives.`);
      intermediateState = applyPassiveAbilities(intermediateState, drawTrigger, eventDataDraw);
      intermediateState = checkWinConditions(intermediateState);
      if (intermediateState.winner !== null || (intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0)) { // Corrected line
        const isDraw = intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0 && intermediateState.winner === null;
        const winnerId = intermediateState.winner;
        const loser = isDraw || !winnerId ? null : (winnerId === intermediateState.players[0].id ? intermediateState.players[1] : intermediateState.players[0]);
        const winLog = isDraw
          ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
          : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
        console.log(`[Reducer] Win/Draw condition met after ${drawTrigger} passives. ${winLog}`);
        return { ...intermediateState, phase: 'gameOver', winner: winnerId, log: [...intermediateState.log, winLog] };
      }
      actionConsumed = true;
      break;
    } // End of DRAW_KNOWLEDGE case

    case 'SUMMON_KNOWLEDGE': {
      const { playerId, creatureId, knowledgeId, instanceId } = action.payload;

      const playerSummoning = getPlayerState(intermediateState, playerId);
      const knowledgeToSummon = playerSummoning?.hand.find((k: Knowledge) => k.instanceId === instanceId);
      const targetCreature = playerSummoning?.creatures.find((c: Creature) => c.id === creatureId);

      console.log(`[Reducer Debug] Calling summonKnowledge for ${instanceId} onto ${creatureId}`);
      const { newState: stateAfterSummon, leavingKnowledgeInfo } = summonKnowledge(intermediateState, action.payload as SummonKnowledgePayload);
      intermediateState = stateAfterSummon;

      if (leavingKnowledgeInfo) {
        console.log(`[Reducer Debug] Found leavingKnowledgeInfo. Applying KNOWLEDGE_LEAVE passives.`);
        intermediateState = applyPassiveAbilities(intermediateState, 'KNOWLEDGE_LEAVE', leavingKnowledgeInfo);
      }

      let isFreeSummon = false;
      const playerAfterLeavePassives = getPlayerState(intermediateState, playerId);

      if (targetCreature?.id === 'dudugera' && playerAfterLeavePassives?.creatures.some((c: Creature) => c.id === 'dudugera')) {
        isFreeSummon = true;
        intermediateState.log = [...intermediateState.log, `[Passive Effect] Dudugera allows summoning ${knowledgeToSummon?.name || 'Knowledge'} onto itself without spending an action.`];
      } else if (knowledgeToSummon?.element === 'water' && playerAfterLeavePassives?.creatures.some((c: Creature) => c.id === 'kappa')) {
        isFreeSummon = true;
        intermediateState.log = [...intermediateState.log, `[Passive Effect] Kappa allows summoning aquatic knowledge ${knowledgeToSummon?.name || 'Knowledge'} without spending an action.`];
      }

      actionConsumed = !isFreeSummon;

      const eventDataSummon = {
        playerId: playerId,
        creatureId: creatureId,
        knowledgeId: knowledgeId,
        instanceId: instanceId,
        knowledgeCard: knowledgeToSummon,
      };
      const summonTrigger = playerId === intermediateState.players[intermediateState.currentPlayerIndex].id
        ? 'AFTER_PLAYER_SUMMON'
        : 'AFTER_OPPONENT_SUMMON';
      intermediateState = applyPassiveAbilities(intermediateState, summonTrigger, eventDataSummon);
      intermediateState = checkWinConditions(intermediateState);
      if (intermediateState.winner !== null || (intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0)) {
        const isDraw = intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0 && intermediateState.winner === null;
        const winnerId = intermediateState.winner;
        const loser = isDraw || !winnerId ? null : (winnerId === intermediateState.players[0].id ? intermediateState.players[1] : intermediateState.players[0]);
        const winLog = isDraw
          ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
          : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
        return { ...intermediateState, phase: 'gameOver', winner: winnerId, log: [...intermediateState.log, winLog] };
      }
      break;
    } // End of SUMMON_KNOWLEDGE case

    case 'ROTATE_KNOWLEDGE': {
        const { playerId, creatureId, instanceId } = action.payload;
        const player = intermediateState.players.find((p: PlayerState) => p.id === playerId);
        if (!player) {
            console.warn(`[Reducer] ROTATE_KNOWLEDGE: Player ${playerId} not found.`);
            return intermediateState;
        }

        const fieldSlot = player.field.find((slot: { creatureId: string; knowledge: Knowledge | null }) => slot.creatureId === creatureId && slot.knowledge?.instanceId === instanceId);
        if (!fieldSlot || !fieldSlot.knowledge) {
            console.warn(`[Reducer] ROTATE_KNOWLEDGE: Knowledge ${instanceId} not found on creature ${creatureId} for player ${playerId}.`);
            return intermediateState;
        }

        const knowledgeCard = fieldSlot.knowledge;
        const currentRotation = knowledgeCard.rotation ?? 0;
        const maxRotationSteps = knowledgeCard.maxRotations ?? 4; 
        const rotationIncrement = 90;
        const nextRotation = currentRotation + rotationIncrement;

        if (nextRotation >= maxRotationSteps * 90) { 
            intermediateState.log.push(`[Action] ${knowledgeCard.name} rotated off field for ${player.id}.`);
            fieldSlot.knowledge = null;
            intermediateState.discardPile.push(knowledgeCard); 
            intermediateState = applyPassiveAbilities(intermediateState, 'KNOWLEDGE_LEAVE', { playerId, creatureId, knowledgeCard });
        } else {
            knowledgeCard.rotation = nextRotation;
            intermediateState.log.push(`[Action] ${knowledgeCard.name} rotated to ${nextRotation} degrees for ${player.id}.`);
        }
        
        actionConsumed = true; 
        
        intermediateState = checkWinConditions(intermediateState);
        if (intermediateState.winner !== null || (intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0)) {
            const isDraw = intermediateState.players[0].power <= 0 && intermediateState.players[1].power <= 0 && intermediateState.winner === null;
            const winnerId = intermediateState.winner;
            const loser = isDraw || !winnerId ? null : (winnerId === intermediateState.players[0].id ? intermediateState.players[1] : intermediateState.players[0]);
            const winLog = isDraw
              ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
              : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
            return { ...intermediateState, phase: 'gameOver', winner: winnerId, log: [...intermediateState.log, winLog] };
        }
        break;
    } // End of ROTATE_KNOWLEDGE case

    default:
      console.warn(`[Reducer] Unhandled validated action type in switch: ${(action as any).type}`, action.payload);
      return intermediateState;
  } // End of switch

  // --- Post-action processing ---
  let finalState = intermediateState;

  if (actionConsumed) {
    finalState.actionsTakenThisTurn++;
    finalState.log = [...finalState.log, `Action ${(action as any).type} completed. Actions: ${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}`];
    console.log(`[Reducer] Action ${(action as any).type} processed. Actions taken: ${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}`);
  } else {
    finalState.log = [...finalState.log, `Action ${(action as any).type} completed (Free). Actions: ${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}`];
    console.log(`[Reducer] Action ${(action as any).type} processed (Free). Actions taken: ${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}`);
  }

  finalState = checkWinConditions(finalState);
  if (finalState.winner !== null || (finalState.players[0].power <= 0 && finalState.players[1].power <= 0)) {
    const isDraw = finalState.players[0].power <= 0 && finalState.players[1].power <= 0 && finalState.winner === null;
    const winnerId = finalState.winner;
    const loser = isDraw || !winnerId ? null : (winnerId === finalState.players[0].id ? finalState.players[1] : finalState.players[0]);
    const winLog = isDraw
      ? `[Game] Draw! Both players reached 0 Power simultaneously or by other draw conditions.`
      : `[Game] ${winnerId} wins! ${loser ? loser.id + ' was defeated.' : ''}`;
    console.log(`[Reducer] Win/Draw condition met after action ${(action as any).type}. ${winLog}`);
    return { ...finalState, phase: 'gameOver', winner: winnerId, log: [...finalState.log, winLog] };
  }

  if (finalState.actionsTakenThisTurn >= finalState.actionsPerTurn) {
    console.log(`[Reducer] Action limit reached (${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}). Ending turn.`);
    const stateBeforeEnd = { 
      ...finalState,
      log: [...finalState.log, `Action limit reached (${finalState.actionsTakenThisTurn}/${finalState.actionsPerTurn}). Ending turn.`],
    };
    return endTurnSequence(stateBeforeEnd);
  }

  return finalState; 
} // End of gameReducer function
