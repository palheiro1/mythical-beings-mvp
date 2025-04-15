import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import knowledgeData from '../assets/knowledges.json';

// Constants
const INITIAL_POWER = 20;
// const MAX_HAND_SIZE = 5; // Removed, validation handled in rules.ts
const ACTIONS_PER_TURN = 2;
const MARKET_SIZE = 5;

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Initializes a new game state.
 * @param gameId Unique ID for the game.
 * @param player1Id ID for player 1.
 * @param player2Id ID for player 2.
 * @param selectedCreaturesP1 Creatures selected by player 1.
 * @param selectedCreaturesP2 Creatures selected by player 2.
 * @returns The initial GameState object.
 */
export function initializeGame(
  gameId: string,
  player1Id: string,
  player2Id: string,
  selectedCreaturesP1: Creature[],
  selectedCreaturesP2: Creature[]
): GameState {
  const allKnowledgeCards: Knowledge[] = knowledgeData as Knowledge[];
  const shuffledDeck = shuffleArray(allKnowledgeCards);

  const initialMarket = shuffledDeck.slice(0, MARKET_SIZE);
  const remainingDeck = shuffledDeck.slice(MARKET_SIZE);

  const createInitialPlayerState = (id: string, creatures: Creature[]): PlayerState => ({
    id,
    power: INITIAL_POWER,
    creatures: creatures.map(c => ({ ...c, currentWisdom: c.baseWisdom })), // Initialize currentWisdom
    hand: [],
    field: creatures.map(c => ({ creatureId: c.id, knowledge: null })), // Initialize field slots
    selectedCreatures: creatures, // Keep track of original selection if needed
  });

  const initialState: GameState = {
    gameId,
    players: [
      createInitialPlayerState(player1Id, selectedCreaturesP1),
      createInitialPlayerState(player2Id, selectedCreaturesP2),
    ],
    market: initialMarket,
    knowledgeDeck: remainingDeck,
    turn: 1,
    currentPlayerIndex: 0,
    phase: 'knowledge', // Start with Knowledge Phase of Turn 1
    actionsTakenThisTurn: 0,
    winner: null,
    log: [`Game ${gameId} initialized. Player 1 starts.`],
  };

  // Immediately execute the first Knowledge Phase
  const stateAfterFirstKnowledgePhase = executeKnowledgePhase(initialState);
  stateAfterFirstKnowledgePhase.log.push(`Turn 1: Action Phase started for Player 1.`);

  return stateAfterFirstKnowledgePhase;
}

/**
 * Game state reducer function.
 * Takes the current state and an action, returns the new state.
 * @param state The current game state.
 * @param action The action to process.
 * @returns The new game state.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  // Handle state setting actions first
  if (action.type === 'SET_GAME_STATE') {
    return action.payload;
  }
  if (action.type === 'INITIALIZE_GAME') {
    const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = action.payload;
    return initializeGame(gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2);
  }

  // Validate the action
  if (!isValidAction(state, action)) {
    console.error("Reducer: Invalid action received", action);
    return {
        ...state,
        log: [...state.log, `Invalid action attempted by Player ${state.currentPlayerIndex + 1}: ${action.type}`]
    };
  }

  let nextState: GameState;

  // Apply the action using action handlers
  switch (action.type) {
    case 'ROTATE_CREATURE':
      nextState = rotateCreature(state, action.payload);
      break;
    case 'DRAW_KNOWLEDGE':
      nextState = drawKnowledge(state, action.payload);
      break;
    case 'SUMMON_KNOWLEDGE':
      nextState = summonKnowledge(state, action.payload);
      break;
    case 'END_TURN':
      const nextPlayerIndex = ((state.currentPlayerIndex + 1) % 2) as 0 | 1; // Cast to 0 | 1
      const nextTurn = state.currentPlayerIndex === 1 ? state.turn + 1 : state.turn;
      nextState = {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        turn: nextTurn,
        phase: 'knowledge',
        actionsTakenThisTurn: 0,
        log: [...state.log, `Player ${state.currentPlayerIndex + 1} ended their turn. Turn ${nextTurn} begins.`]
      };
      nextState = executeKnowledgePhase(nextState);
      break;
    default:
      console.error("Reducer: Unhandled valid action", action);
      return state;
  }

  // Increment actions taken if it was an action phase move (not END_TURN)
  if (action.type !== 'END_TURN') {
      nextState = {
          ...nextState,
          actionsTakenThisTurn: state.actionsTakenThisTurn + 1,
      };
      if (nextState.actionsTakenThisTurn >= ACTIONS_PER_TURN) {
          nextState.log.push(`Player ${state.currentPlayerIndex + 1} has taken ${ACTIONS_PER_TURN} actions.`);
      }
  }

  // Check for win condition after every valid action
  const winner = checkWinCondition(nextState);
  if (winner) {
    nextState = {
      ...nextState,
      winner: winner,
      phase: 'end',
      log: [...nextState.log, `Game Over! Player ${winner === nextState.players[0].id ? 1 : 2} wins!`],
    };
  }

  return nextState;
}
