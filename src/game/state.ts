import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import { applyPassiveAbilities } from './passives';
import knowledgeData from '../assets/knowledges.json';
// --- Import creature data ---
import creatureData from '../assets/creatures.json';
// --- End import ---
import { getPlayerState } from './utils';
import { v4 as uuidv4 } from 'uuid';

// Constants
const INITIAL_POWER = 20;
const MARKET_SIZE = 5;
const ACTIONS_PER_TURN = 2;

// --- Define ALL_CREATURES constant ---
const ALL_CREATURES: Creature[] = creatureData as Creature[];
// --- End define ---

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper: add per-instance IDs to all Knowledge cards
function injectInstanceIds(state: GameState): GameState {
  return {
    ...state,
    market: state.market.map(k => ({ ...k, instanceId: uuidv4() })),
    knowledgeDeck: state.knowledgeDeck.map(k => ({ ...k, instanceId: uuidv4() })),
    discardPile: state.discardPile.map(k => ({ ...k, instanceId: uuidv4() })),
    players: state.players.map(p => ({
      ...p,
      hand: p.hand.map(k => ({ ...k, instanceId: uuidv4() })),
      field: p.field.map(slot =>
        slot.knowledge
          ? { creatureId: slot.creatureId, knowledge: { ...slot.knowledge, instanceId: uuidv4() } }
          : slot
      ),
    })) as [PlayerState, PlayerState],
  };
}

// Define the payload type for initializeGame explicitly
export type InitializeGamePayload = {
  gameId: string;
  player1Id: string;
  player2Id: string;
  player1SelectedIds: string[];
  player2SelectedIds: string[];
};

/**
 * Initializes a new game state.
 * @param payload Data for initialization, including selected creature IDs.
 * @returns The initial game state.
 */
export function initializeGame(
  payload: InitializeGamePayload // Use the defined type
): GameState {
  const { gameId, player1Id, player2Id, player1SelectedIds, player2SelectedIds } = payload;

  // --- Look up selected creatures from ALL_CREATURES ---
  const lookupCreatures = (ids: string[]): Creature[] => {
    const foundCreatures = ids.map(id => ALL_CREATURES.find(c => c.id === id)).filter((c): c is Creature => !!c);
    if (foundCreatures.length !== ids.length) {
      console.error("Could not find all selected creatures! IDs:", ids, "Found:", foundCreatures);
      throw new Error(`Failed to initialize game: Could not find all selected creatures for IDs: ${ids.join(', ')}`);
    }
    return foundCreatures;
  };

  const selectedCreaturesP1 = lookupCreatures(player1SelectedIds);
  const selectedCreaturesP2 = lookupCreatures(player2SelectedIds);
  // --- End lookup ---

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
        break; // Added missing break
    }
    for (let i = 0; i < copies; i++) {
      fullDeck.push({ ...card });
    }
  });

  const shuffledDeck = shuffleArray(fullDeck);
  const initialMarket = shuffledDeck.slice(0, MARKET_SIZE);
  const remainingDeck = shuffledDeck.slice(MARKET_SIZE);

  const initialPlayerState = (id: string, creatures: Creature[]): PlayerState => ({
    id,
    power: INITIAL_POWER,
    creatures: creatures.map(c => ({ ...c, currentWisdom: c.baseWisdom, rotation: 0 })),
    hand: [],
    field: creatures.map(c => ({ creatureId: c.id, knowledge: null })),
    selectedCreatures: creatures, // Keep selected creatures info if needed later
  });

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
  };

  // apply passives/phases
  initialState = applyPassiveAbilities(initialState, 'TURN_START', { playerId: initialState.players[0].id });
  initialState = executeKnowledgePhase(initialState);

  const winner = checkWinCondition(initialState);
  if (winner) {
    initialState = { ...initialState, winner, phase: 'end' };
  }

  // inject unique keys on all cards before returning
  const withIds = injectInstanceIds(initialState);
  console.log("[Reducer] INITIALIZE_GAME completed. Initial state with IDs:", withIds);
  return withIds;
}

// Helper function for end-of-turn sequence
function endTurnSequence(state: GameState): GameState {
  console.log(`[Reducer] Starting endTurnSequence for Player ${state.currentPlayerIndex + 1}`);
  let newState = { ...state };

  let winner = checkWinCondition(newState);
  if (winner) {
    console.log(`[Reducer] Win condition met during endTurnSequence. Winner: ${winner}`);
    return { ...newState, winner, phase: 'end' };
  }

  // Explicitly cast the result to 0 | 1
  const nextPlayerIndex = ((newState.currentPlayerIndex + 1) % 2) as 0 | 1;
  const nextTurn = newState.currentPlayerIndex === 1 ? newState.turn + 1 : newState.turn;

  newState = {
    ...newState,
    currentPlayerIndex: nextPlayerIndex,
    turn: nextTurn,
    phase: 'knowledge',
    actionsTakenThisTurn: 0,
    log: [...newState.log, `--- Turn ${nextTurn} (Player ${nextPlayerIndex + 1}) ---`],
  };
  console.log(`[Reducer] Transitioning to Turn ${nextTurn}, Player ${nextPlayerIndex + 1}. Phase: knowledge`);

  console.log(`[Reducer] Applying TURN_START passives for Player ${nextPlayerIndex + 1}`);
  newState = applyPassiveAbilities(newState, 'TURN_START', { playerId: newState.players[nextPlayerIndex].id });

  console.log(`[Reducer] Executing knowledge phase for Player ${nextPlayerIndex + 1}`);
  newState = executeKnowledgePhase(newState);

  winner = checkWinCondition(newState);
  if (winner) {
    console.log(`[Reducer] Win condition met after knowledge phase. Winner: ${winner}`);
    return { ...newState, winner: winner, phase: 'end' };
  }

  console.log(`[Reducer] endTurnSequence complete. New phase: ${newState.phase}`);
  return newState;
}

/**
 * Game state reducer function.
 * Takes the current state and an action, returns the new state.
 * @param state The current game state.
 * @param action The action to process.
 * @returns The new game state.
 */
export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  if (!state) {
    // INITIALIZE_GAME is handled by useGameInitialization hook, not the reducer directly.
    // Reducer should only start with a state set by SET_GAME_STATE.
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

  if (action.type === 'SET_GAME_STATE') {
    console.log('[Reducer] SET_GAME_STATE received payload:', action.payload);
    if (!action.payload) {
      console.warn('[Reducer] SET_GAME_STATE received null payload. Resetting state might require re-initialization.');
      return null;
    }
    const newState = action.payload as GameState;
    const actionsTaken = typeof newState.actionsTakenThisTurn === 'number' && !isNaN(newState.actionsTakenThisTurn)
      ? newState.actionsTakenThisTurn
      : 0;
    const actionsPer = typeof newState.actionsPerTurn === 'number' && !isNaN(newState.actionsPerTurn)
      ? newState.actionsPerTurn
      : ACTIONS_PER_TURN;

    console.log(`[Reducer] SET_GAME_STATE - Processed actionsTaken: ${actionsTaken}, actionsPerTurn: ${actionsPer}`);
    return {
      ...newState,
      actionsTakenThisTurn: actionsTaken,
      actionsPerTurn: actionsPer,
      log: newState.log ?? [],
    };
  }

  const validation = isValidAction(state, action);
  if (!validation.isValid) {
    console.warn(`[Reducer] Invalid action received: ${action.type} - ${validation.reason}`);
    return state;
  }

  // Type guard to ensure payload exists and has playerId for player-specific actions
  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
    // Handle END_TURN specifically as it doesn't need a playerId in payload
    if (action.type === 'END_TURN') {
      console.log("[Reducer] Handling END_TURN action.");
      return endTurnSequence(state);
    }
    // Log error for other actions missing payload or playerId
    console.error("[Reducer] Action requires a payload with playerId:", action);
    return state;
  }

  let intermediateState: GameState;
  let shouldConsumeAction = true; // Flag to determine if the action costs an action point

  switch (action.type) {
    case 'ROTATE_CREATURE':
      intermediateState = rotateCreature(state, action.payload);
      break;
    case 'DRAW_KNOWLEDGE': {
      const cardToDraw = state.market.find(k => k.id === action.payload.knowledgeId);
      intermediateState = drawKnowledge(state, action.payload);
      const eventDataDraw = {
        playerId: action.payload.playerId,
        knowledgeId: action.payload.knowledgeId,
        knowledgeCard: cardToDraw,
      };
      const drawTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_DRAW'
        : 'AFTER_OPPONENT_DRAW';
      console.log(`[Reducer] Applying ${drawTrigger} passives.`);
      intermediateState = applyPassiveAbilities(intermediateState, drawTrigger, eventDataDraw);
      break;
    }
    case 'SUMMON_KNOWLEDGE': {
      const playerSummoning = getPlayerState(state, action.payload.playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.id === action.payload.knowledgeId);

      intermediateState = summonKnowledge(state, action.payload);

      // Check for Dudugera passive: Free summon
      const playerControlsDudugera = playerSummoning?.creatures.some(c => c.id === 'dudugera') &&
                                     playerSummoning?.field.some(f => f.creatureId === 'dudugera');
      // Check for Kappa passive: Free summon for aquatic Knowledges
      const playerControlsKappa = playerSummoning?.creatures.some(c => c.id === 'kappa') &&
                                  playerSummoning?.field.some(f => f.creatureId === 'kappa');
      const isAquaticKnowledge = knowledgeToSummon?.element === 'water';

      if (playerControlsDudugera) {
        shouldConsumeAction = false;
        intermediateState.log.push(`[Passive Effect] Dudugera allows summoning ${knowledgeToSummon?.name || 'Knowledge'} without spending an action.`);
        console.log(`[Reducer] Dudugera passive active: SUMMON_KNOWLEDGE does not consume action.`);
      } else if (playerControlsKappa && isAquaticKnowledge) {
        shouldConsumeAction = false;
        intermediateState.log.push(`[Passive Effect] Kappa allows summoning aquatic knowledge ${knowledgeToSummon?.name || 'Knowledge'} without spending an action.`);
        console.log(`[Reducer] Kappa passive active: SUMMON_KNOWLEDGE does not consume action.`);
      }

      const eventDataSummon = {
        playerId: action.payload.playerId,
        creatureId: action.payload.creatureId,
        knowledgeId: action.payload.knowledgeId,
        knowledgeCard: knowledgeToSummon,
      };
      const summonTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_SUMMON'
        : 'AFTER_OPPONENT_SUMMON';
      console.log(`[Reducer] Applying ${summonTrigger} passives.`);
      intermediateState = applyPassiveAbilities(intermediateState, summonTrigger, eventDataSummon);
      break;
    }
    // END_TURN is handled before the switch now
    default:
      // This should ideally not be reached if validation and payload checks are correct
      console.error("[Reducer] Unhandled valid action type in switch:", action);
      return state;
  }

  // Consume action point only if required
  const currentActionsPerTurn = intermediateState.actionsPerTurn ?? ACTIONS_PER_TURN;
  let newActionsTaken = intermediateState.actionsTakenThisTurn;

  if (shouldConsumeAction) {
    newActionsTaken++;
    intermediateState = {
      ...intermediateState,
      actionsTakenThisTurn: newActionsTaken,
      log: [...intermediateState.log, `Action ${action.type} completed. Actions: ${newActionsTaken}/${currentActionsPerTurn}`]
    };
    console.log(`[Reducer] Action ${action.type} processed. Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
  } else {
    // Log that the action didn't cost an action point if it was due to a passive
    if (action.type === 'SUMMON_KNOWLEDGE') { // Be specific to avoid logging for non-action events if logic changes
       intermediateState = { ...intermediateState }; // Ensure state object is updated if only log changes
       // Log message already added when shouldConsumeAction was set to false
       console.log(`[Reducer] Action ${action.type} processed (Free). Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
    }
  }

  let winner = checkWinCondition(intermediateState);
  if (winner) {
    console.log(`[Reducer] Win condition met after action ${action.type}. Winner: ${winner}`);
    return { ...intermediateState, winner, phase: 'end' };
  }

  if (newActionsTaken >= currentActionsPerTurn) {
    console.log(`[Reducer] Action limit reached (${newActionsTaken}/${currentActionsPerTurn}). Ending turn.`);
    return endTurnSequence(intermediateState);
  }

  return intermediateState;
}
