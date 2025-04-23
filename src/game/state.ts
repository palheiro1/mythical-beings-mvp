import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import { applyPassiveAbilities } from './passives';
import knowledgeData from '../assets/knowledges.json';
import { getPlayerState } from './utils';
import { v4 as uuidv4 } from 'uuid';

// Constants
const INITIAL_POWER = 20;
const MARKET_SIZE = 5;
const ACTIONS_PER_TURN = 2;

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

/**
 * Initializes a new game state.
 * @param payload Data for initialization.
 * @returns The initial game state.
 */
export function initializeGame(
  payload: {
    gameId: string;
    player1Id: string;
    player2Id: string;
    selectedCreaturesP1: Creature[];
    selectedCreaturesP2: Creature[];
  }
): GameState {
  const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = payload;

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
    selectedCreatures: creatures,
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

  const nextPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
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
    if (action.type === 'INITIALIZE_GAME') {
      console.log("[Reducer] Received INITIALIZE_GAME on null state.");
      return initializeGame(action.payload);
    } else if (action.type === 'SET_GAME_STATE' && action.payload) {
      console.log("[Reducer] Received SET_GAME_STATE on null state.");
      const newState = action.payload as GameState;
      return {
        ...newState,
        actionsTakenThisTurn: newState.actionsTakenThisTurn ?? 0,
        actionsPerTurn: newState.actionsPerTurn ?? ACTIONS_PER_TURN,
        log: newState.log ?? [],
      };
    } else {
      console.error("[Reducer] Received action on null state:", action.type);
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
  if (action.type === 'INITIALIZE_GAME') {
    console.warn("[Reducer] Received INITIALIZE_GAME on non-null state. Re-initializing.");
    return initializeGame(action.payload);
  }

  const validation = isValidAction(state, action);
  if (!validation.isValid) {
    console.warn(`[Reducer] Invalid action received: ${action.type} - ${validation.reason}`);
    return state;
  }

  if (!action.payload || !('playerId' in action.payload)) {
    console.error("[Reducer] Non-player action reached player processing stage:", action);
    return state;
  }

  let intermediateState: GameState;

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
    default:
      console.error("[Reducer] Unhandled valid action type in switch:", action);
      return state;
  }

  const currentActionsPerTurn = intermediateState.actionsPerTurn ?? ACTIONS_PER_TURN;
  const newActionsTaken = intermediateState.actionsTakenThisTurn + 1;
  intermediateState = {
    ...intermediateState,
    actionsTakenThisTurn: newActionsTaken,
    log: [...intermediateState.log, `Action ${action.type} completed. Actions: ${newActionsTaken}/${currentActionsPerTurn}`]
  };
  console.log(`[Reducer] Action ${action.type} processed. Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);

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
