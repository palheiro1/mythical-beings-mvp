import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import { applyPassiveAbilities } from './passives';
import knowledgeData from '../assets/knowledges.json';
import creatureData from '../assets/creatures.json';
import { getPlayerState } from './utils';
import { v4 as uuidv4 } from 'uuid';

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

// Export for testing purposes
export function injectInstanceIds(state: GameState): GameState {
  const ensureInstanceId = (card: Knowledge) => ({ ...card, instanceId: card.instanceId || uuidv4() });
  return {
    ...state,
    market: state.market.map(ensureInstanceId),
    knowledgeDeck: state.knowledgeDeck.map(ensureInstanceId),
    discardPile: state.discardPile.map(ensureInstanceId),
    players: state.players.map(p => ({
      ...p,
      hand: p.hand.map(ensureInstanceId),
      field: p.field.map(slot =>
        slot.knowledge
          ? { creatureId: slot.creatureId, knowledge: ensureInstanceId(slot.knowledge) }
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
      fullDeck.push({ ...card, instanceId: uuidv4() });
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

  initialState = applyPassiveAbilities(initialState, 'TURN_START', { playerId: initialState.players[0].id });
  initialState = executeKnowledgePhase(initialState);

  const winner = checkWinCondition(initialState);
  if (winner) {
    initialState = { ...initialState, winner, phase: 'end', log: [...initialState.log, `Player ${winner} wins!`] };
  }

  const finalState = injectInstanceIds(initialState);
  console.log("[Reducer] INITIALIZE_GAME completed. Initial state:", finalState);
  return finalState;
}

function endTurnSequence(state: GameState): GameState {
  console.log(`[Reducer] Starting endTurnSequence for Player ${state.players[state.currentPlayerIndex].id}`);
  let newState = JSON.parse(JSON.stringify(state)) as GameState;

  let winner = checkWinCondition(newState);
  if (winner) {
    console.log(`[Reducer] Win condition met at start of endTurnSequence. Winner: ${winner}`);
    return { ...newState, winner, phase: 'end', log: [...newState.log, `Player ${winner} wins!`] };
  }

  const nextPlayerIndex = ((newState.currentPlayerIndex + 1) % 2) as 0 | 1;
  const nextTurn = newState.currentPlayerIndex === 1 ? newState.turn + 1 : newState.turn;
  const nextPlayerId = newState.players[nextPlayerIndex].id;

  newState = {
    ...newState,
    currentPlayerIndex: nextPlayerIndex,
    turn: nextTurn,
    phase: 'knowledge',
    actionsTakenThisTurn: 0,
    log: [...newState.log, `--- Turn ${nextTurn} (Player ${nextPlayerId}) ---`],
  };
  console.log(`[Reducer] Transitioning to Turn ${nextTurn}, Player ${nextPlayerId}. Phase: knowledge`);

  console.log(`[Reducer] Applying TURN_START passives for Player ${nextPlayerId}`);
  newState = applyPassiveAbilities(newState, 'TURN_START', { playerId: nextPlayerId });

  console.log(`[Reducer] Executing knowledge phase for Player ${nextPlayerId}`);
  newState = executeKnowledgePhase(newState);

  winner = checkWinCondition(newState);
  if (winner) {
    console.log(`[Reducer] Win condition met after knowledge phase for Player ${nextPlayerId}. Winner: ${winner}`);
    return { ...newState, winner: winner, phase: 'end', log: [...newState.log, `Player ${winner} wins!`] };
  }

  newState.phase = 'action';
  newState.actionsTakenThisTurn = 0;
  newState.log = [...newState.log, `Turn ${newState.turn}: Action Phase started.`];

  console.log(`[Reducer] endTurnSequence complete. New phase: ${newState.phase}`);
  return newState;
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

  if (action.type === 'SET_GAME_STATE') {
    console.log('[Reducer] SET_GAME_STATE received payload:', action.payload);
    if (!action.payload) {
      console.warn('[Reducer] SET_GAME_STATE received null payload. Resetting state might require re-initialization.');
      return null;
    }
    const newState = action.payload as GameState;
    const actionsTaken = typeof newState.actionsTakenThisTurn === 'number' && !isNaN(newState.actionsTakenThisTurn) ? newState.actionsTakenThisTurn : 0;
    const actionsPer = typeof newState.actionsPerTurn === 'number' && !isNaN(newState.actionsPerTurn) ? newState.actionsPerTurn : ACTIONS_PER_TURN;
    console.log(`[Reducer] SET_GAME_STATE - Processed actionsTaken: ${actionsTaken}, actionsPerTurn: ${actionsPer}`);
    return {
      ...newState,
      actionsTakenThisTurn: actionsTaken,
      actionsPerTurn: actionsPer,
      log: newState.log ?? [],
    };
  }

  let nextState = state;
  let actionConsumed = false;

  if (action.type === 'END_TURN') {
    const validation = isValidAction(state, action);
    if (!validation.isValid) {
      console.warn(`[Reducer] Invalid action: ${action.type} - ${validation.reason}`);
      return state;
    }
    console.log("[Reducer] Handling END_TURN action.");
    return endTurnSequence(state);
  }

  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
    console.error("[Reducer] Action requires a payload with playerId:", action);
    return state;
  }

  const validation = isValidAction(state, action);
  if (!validation.isValid) {
    console.warn(`[Reducer] Invalid action: ${action.type} - ${validation.reason}`);
    return state;
  }

  nextState = { ...state };

  switch (action.type) {
    case 'ROTATE_CREATURE':
      nextState = rotateCreature(nextState, action.payload);
      actionConsumed = true;
      break;

    case 'DRAW_KNOWLEDGE': {
      if (!('instanceId' in action.payload) || !action.payload.instanceId) {
        console.error("[Reducer] DRAW_KNOWLEDGE requires instanceId in payload:", action);
        return state;
      }
      const cardToDraw = state.market.find(k => k.instanceId === action.payload.instanceId);
      nextState = drawKnowledge(nextState, action.payload as { playerId: string; knowledgeId: string; instanceId: string });
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
      nextState = applyPassiveAbilities(nextState, drawTrigger, eventDataDraw);
      actionConsumed = true;
      break;
    }

    case 'SUMMON_KNOWLEDGE': {
      if (!('instanceId' in action.payload) || !action.payload.instanceId || !('creatureId' in action.payload)) {
        console.error("[Reducer] SUMMON_KNOWLEDGE requires instanceId and creatureId in payload:", action);
        return state;
      }
      const playerSummoning = getPlayerState(state, action.payload.playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.instanceId === action.payload.instanceId);
      const targetCreature = playerSummoning?.creatures.find(c => c.id === action.payload.creatureId);

      nextState = summonKnowledge(nextState, action.payload as { playerId: string; knowledgeId: string; instanceId: string; creatureId: string });

      let isFreeSummon = false;
      const playerAfterSummon = getPlayerState(nextState, action.payload.playerId);

      if (targetCreature?.id === 'dudugera' && playerAfterSummon?.creatures.some(c => c.id === 'dudugera')) {
        isFreeSummon = true;
        nextState.log = [...nextState.log, `[Passive Effect] Dudugera allows summoning ${knowledgeToSummon?.name || 'Knowledge'} onto itself without spending an action.`];
        console.log(`[Reducer] Dudugera passive active: SUMMON_KNOWLEDGE does not consume action.`);
      } else if (knowledgeToSummon?.element === 'water' && playerAfterSummon?.creatures.some(c => c.id === 'kappa')) {
        isFreeSummon = true;
        nextState.log = [...nextState.log, `[Passive Effect] Kappa allows summoning aquatic knowledge ${knowledgeToSummon?.name || 'Knowledge'} without spending an action.`];
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
      nextState = applyPassiveAbilities(nextState, summonTrigger, eventDataSummon);
      break;
    }

    default:
      console.error("[Reducer] Unhandled valid action type in switch:", action);
      return state;
  }

  const currentActionsPerTurn = nextState.actionsPerTurn ?? ACTIONS_PER_TURN;
  let newActionsTaken = nextState.actionsTakenThisTurn;

  if (actionConsumed) {
    newActionsTaken++;
    nextState = {
      ...nextState,
      actionsTakenThisTurn: newActionsTaken,
      log: [...nextState.log, `Action ${action.type} completed. Actions: ${newActionsTaken}/${currentActionsPerTurn}`],
    };
    console.log(`[Reducer] Action ${action.type} processed. Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
  } else {
    console.log(`[Reducer] Action ${action.type} processed (Free). Actions taken: ${newActionsTaken}/${currentActionsPerTurn}`);
    nextState = { ...nextState };
    nextState.log = [...nextState.log, `Action ${action.type} completed (Free). Actions: ${newActionsTaken}/${currentActionsPerTurn}`];
  }

  let winner = checkWinCondition(nextState);
  if (winner) {
    console.log(`[Reducer] Win condition met after action ${action.type}. Winner: ${winner}`);
    return { ...nextState, winner, phase: 'end', log: [...nextState.log, `Player ${winner} wins!`] };
  }

  if (newActionsTaken >= currentActionsPerTurn) {
    console.log(`[Reducer] Action limit reached (${newActionsTaken}/${currentActionsPerTurn}). Ending turn.`);
    const stateBeforeEnd = {
      ...nextState,
      log: [...nextState.log, `Action limit reached (${newActionsTaken}/${currentActionsPerTurn}). Ending turn.`],
    };
    return endTurnSequence(stateBeforeEnd);
  }

  return nextState;
}
