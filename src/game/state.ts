import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules';
import { rotateCreature, drawKnowledge, summonKnowledge } from './actions';
import { applyPassiveAbilities } from './passives'; // Import the new function
import knowledgeData from '../assets/knowledges.json';
import { getPlayerState } from './utils'; // Removed unused imports

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
    discardPile: [], // Initialize discardPile
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
    // Ensure payload is not null before assigning
    if (action.payload) {
        return action.payload;
    } else {
        console.warn("Reducer: Received null payload for SET_GAME_STATE, returning current state.");
        return state; // Or handle differently if null means reset/initial state
    }
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

  let processedState: GameState;
  let eventData: any = { playerId: action.payload.playerId }; // Basic event data

  // Apply the action using action handlers
  switch (action.type) {
    case 'ROTATE_CREATURE':
      processedState = rotateCreature(state, action.payload);
      // TODO: Add applyPassiveAbilities call for ROTATE triggers if needed
      // eventData.creatureId = action.payload.creatureId;
      // processedState = applyPassiveAbilities(processedState, 'CREATURE_ROTATE', eventData);
      break;
    case 'DRAW_KNOWLEDGE':
      // Find the card *before* the state is updated by drawKnowledge
      const marketCard = state.market.find(k => k.id === action.payload.knowledgeId);
      processedState = drawKnowledge(state, action.payload);
      // Apply passives triggered AFTER drawing
      eventData.knowledgeId = action.payload.knowledgeId;
      eventData.knowledgeCard = marketCard; // Pass the actual card drawn
      // Determine which trigger based on whose turn it is vs who drew
      const drawTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id ? 'AFTER_PLAYER_DRAW' : 'AFTER_OPPONENT_DRAW';
      processedState = applyPassiveAbilities(processedState, drawTrigger, eventData);
      break;
    case 'SUMMON_KNOWLEDGE':
      const playerSummoning = getPlayerState(state, action.payload.playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.id === action.payload.knowledgeId);

      // Apply passives BEFORE summon validation (e.g., Dudugera, Kappa cost reduction)
      eventData.creatureId = action.payload.creatureId;
      eventData.knowledgeId = action.payload.knowledgeId;
      eventData.knowledgeCard = knowledgeToSummon;
      const stateBeforeSummon = applyPassiveAbilities(state, 'BEFORE_SUMMON_VALIDATION', eventData);
      
      processedState = summonKnowledge(stateBeforeSummon, action.payload);

      // Apply passives triggered AFTER summoning
      eventData.creatureId = action.payload.creatureId;
      eventData.knowledgeId = action.payload.knowledgeId;
      eventData.knowledgeCard = knowledgeToSummon; // Pass the actual card summoned
      eventData.targetCreatureId = action.payload.creatureId; // Creature being summoned onto

      // Determine which trigger based on whose turn it is vs who summoned
      const summonTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id ? 'AFTER_PLAYER_SUMMON' : 'AFTER_OPPONENT_SUMMON';
      processedState = applyPassiveAbilities(processedState, summonTrigger, eventData);
      break;
    case 'END_TURN':
      const nextPlayerIndex = ((state.currentPlayerIndex + 1) % 2) as 0 | 1;
      const nextTurn = state.currentPlayerIndex === 1 ? state.turn + 1 : state.turn;
      let turnStartState: GameState = {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        turn: nextTurn,
        phase: 'knowledge', // Will transition to knowledge phase
        actionsTakenThisTurn: 0,
        log: [...state.log, `Player ${state.currentPlayerIndex + 1} ended their turn. Turn ${nextTurn} begins.`]
      };

      // Apply passives triggered at the START of the new player's turn
      turnStartState = applyPassiveAbilities(turnStartState, 'TURN_START', {
          playerId: turnStartState.players[nextPlayerIndex].id // ID of the player whose turn is starting
      });

      // Execute the knowledge phase for the new turn
      processedState = executeKnowledgePhase(turnStartState);
      break;
    default:
      console.error("Reducer: Unhandled valid action", action);
      return state;
  }

  // TODO: Integrate KNOWLEDGE_LEAVE trigger
  // This needs to be called from logic that handles knowledge destruction/discarding
  // e.g., after combat resolution or effects like Pele's passive.
  // Example call: applyPassiveAbilities(state, 'KNOWLEDGE_LEAVE', { playerId: ownerId, knowledgeCard: leavingCard });

  // Increment actions taken if it was an action phase move (not END_TURN)
  if (action.type !== 'END_TURN') {
      processedState = {
          ...processedState,
          actionsTakenThisTurn: state.actionsTakenThisTurn + 1, // Base on original state's count before action
      };
      if (processedState.actionsTakenThisTurn >= ACTIONS_PER_TURN) {
          processedState.log.push(`Player ${state.currentPlayerIndex + 1} has taken ${ACTIONS_PER_TURN} actions.`);
      }
  }

  // Check for win condition after action and passives are processed
  const winner = checkWinCondition(processedState);
  if (winner) {
    processedState = {
      ...processedState,
      winner: winner,
      phase: 'end',
      log: [...processedState.log, `Game Over! Player ${winner === processedState.players[0].id ? 1 : 2} wins!`],
    };
  }

  return processedState;
}
