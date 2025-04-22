import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition, MAX_ACTIONS_PER_TURN } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import { applyPassiveAbilities } from './passives';
import knowledgeData from '../assets/knowledges.json';
import { getPlayerState } from './utils';

// Constants
const INITIAL_POWER = 20;
const MARKET_SIZE = 5;

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Initializes a new game state.
 * @param gameId Unique ID for the game.
 * @param player1Id ID for player 1.
 * @param player2Id ID for player 2.
 * @param selectedCreaturesP1 Creatures selected by player 1.
 * @param selectedCreaturesP2 Creatures selected by player 2.
 * @returns The initial game state.
 */
export function initializeGame(
  gameId: string,
  player1Id: string,
  player2Id: string,
  selectedCreaturesP1: Creature[],
  selectedCreaturesP2: Creature[]
): GameState {
  // Create the full knowledge deck based on cost distribution
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
    actionsTakenThisTurn: 0,
  });

  const initialState: GameState = {
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
    phase: 'loading',
    actionsTaken: 0,
    winner: null,
    log: [`Game ${gameId} initialized. Player 1 starts.`],
  };

  return executeKnowledgePhase(initialState);
}

/**
 * Game state reducer function.
 * Takes the current state and an action, returns the new state.
 * @param state The current game state.
 * @param action The action to process.
 * @returns The new game state.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  console.log(`[Reducer] Action: ${action.type}`, action.payload);

  switch (action.type) {
    case 'SET_GAME_STATE': {
      const newState = action.payload as GameState;
      console.log('[Reducer] SET_GAME_STATE received payload:', newState);

      const actionsTaken = typeof newState.actionsTaken === 'number' && !isNaN(newState.actionsTaken
        ) ? newState.actionsTaken : 0;

      console.log(`[Reducer] SET_GAME_STATE - Processed actionsTaken: ${actionsTaken}`);

      return {
        ...newState,
        actionsTaken: actionsTaken,
      };
    }
    case 'START_TURN': {
      return {
        ...state,
        phase: 'action',
        actionsTaken: 0,
      };
    }
    case 'END_TURN': {
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % 2;
      console.log(`[Reducer] END_TURN: Current Player ${state.currentPlayerIndex}, Next Player ${nextPlayerIndex}`);
      return {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        turn: state.currentPlayerIndex === 1 ? state.turn + 1 : state.turn,
        phase: 'draw',
        actionsTaken: 0,
      };
    }
    case 'INCREMENT_ACTION_COUNT': {
      const currentActions = typeof state.actionsTaken === 'number' ? state.actionsTaken : 0;
      const newActionsTaken = currentActions + 1;
      console.log(`[Reducer] INCREMENT_ACTION_COUNT: Old: ${currentActions}, New: ${newActionsTaken}`);
      return {
        ...state,
        actionsTaken: newActionsTaken,
      };
    }
    case 'ROTATE_CREATURE':
      return rotateCreature(state, action.payload as { playerId: string; creatureId: string });
    case 'DRAW_KNOWLEDGE': {
      const marketCard = state.market.find(k => k.id === (action.payload as { knowledgeId: string }).knowledgeId);
      let processedState = drawKnowledge(state, action.payload as { playerId: string; knowledgeId: string });
      const eventData = {
        playerId: action.payload.playerId,
        knowledgeId: (action.payload as { knowledgeId: string }).knowledgeId,
        knowledgeCard: marketCard,
      };
      const drawTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_DRAW'
        : 'AFTER_OPPONENT_DRAW';
      processedState = applyPassiveAbilities(processedState, drawTrigger, eventData);
      return processedState;
    }
    case 'SUMMON_KNOWLEDGE': {
      const playerSummoning = getPlayerState(state, action.payload.playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.id === (action.payload as { knowledgeId: string }).knowledgeId);

      const eventData = {
        playerId: action.payload.playerId,
        creatureId: (action.payload as { creatureId: string }).creatureId,
        knowledgeId: (action.payload as { knowledgeId: string }).knowledgeId,
        knowledgeCard: knowledgeToSummon,
      };
      const stateBeforeSummon = applyPassiveAbilities(state, 'BEFORE_ACTION_VALIDATION', eventData);

      if (!isValidAction(stateBeforeSummon, action)) {
        console.error("Reducer: Action became invalid after BEFORE_ACTION_VALIDATION passive check", action);
        return {
          ...state,
          log: [...state.log, `Invalid action after passive check: ${action.type}`],
        };
      }

      let processedState = summonKnowledge(stateBeforeSummon, action.payload as { playerId: string; knowledgeId: string; creatureId: string });

      const summonTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
        ? 'AFTER_PLAYER_SUMMON'
        : 'AFTER_OPPONENT_SUMMON';
      processedState = applyPassiveAbilities(processedState, summonTrigger, eventData);
      return processedState;
    }
    default:
      console.error("Reducer: Unhandled valid action type", action);
      return state;
  }
}
