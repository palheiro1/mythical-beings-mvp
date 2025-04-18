import { GameState, GameAction, PlayerState, Knowledge, Creature } from './types';
import { isValidAction, executeKnowledgePhase, checkWinCondition } from './rules'; // <-- Import executeKnowledgePhase
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
  // Cast to any[] first to bypass stricter type checking during iteration, then assume elements match Knowledge
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
        copies = 1; // Default for any other cost (shouldn't happen with current data)
    }
    for (let i = 0; i < copies; i++) {
      // Create a unique instance for each copy if needed, or just push the reference
      // For MVP, pushing references is fine as Knowledge cards don't hold unique state yet
      // Ensure all required properties, including 'element', are present if copying
      fullDeck.push({ ...card }); 
    }
  });

  const shuffledDeck = shuffleArray(fullDeck);
  const initialMarket = shuffledDeck.slice(0, MARKET_SIZE);
  const remainingDeck = shuffledDeck.slice(MARKET_SIZE);

  const initialPlayerState = (id: string, creatures: Creature[]): PlayerState => ({
    id,
    power: INITIAL_POWER,
    creatures: creatures.map(c => ({ ...c, currentWisdom: c.baseWisdom, rotation: 0 })), // Initialize wisdom and rotation
    hand: [],
    field: creatures.map(c => ({ creatureId: c.id, knowledge: null })), // Initialize field slots
    selectedCreatures: creatures, // Keep track of originally selected creatures if needed
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
    phase: 'knowledge', // Start with knowledge phase for turn 1 setup/rotation
    actionsTakenThisTurn: 0,
    winner: null,
    log: [`Game ${gameId} initialized. Player 1 starts.`],
  };

  // Execute the first knowledge phase immediately after initialization
  // This will transition to 'action' phase if no effects resolve
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
  // Handle state setting actions first as they don't require validation or player context
  if (action.type === 'SET_GAME_STATE') {
    return action.payload ?? state; // Return current state if payload is null
  }
  if (action.type === 'INITIALIZE_GAME') {
    // Assuming initializeGame is called elsewhere and this reducer just applies the result
    // If the reducer itself needs to call initializeGame, the logic would be different.
    // For now, let's assume it returns the state passed in payload if valid.
    // This case might not even be needed if initialization happens outside the reducer flow.
    console.warn("INITIALIZE_GAME action handled in reducer. Ensure this is intended.");
    // If initializeGame is meant to be called here:
    // const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = action.payload;
    // return initializeGame(gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2);
    // If it just sets the state:
    // return action.payload; // Assuming payload is a valid GameState
    return state; // No change for now, needs clarification
  }

  // --- Player Action Validation ---
  // Ensure payload exists and has playerId for player-specific actions
  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
    console.error("Reducer: Action payload missing or invalid for player action", action);
    // Do NOT log this in the game log (keep logs clean)
    return state;
  }
  const playerId = action.payload.playerId as string; // Assert playerId exists based on the check above

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    console.error(`Reducer: Player ${playerId} not found in state.`);
    // Do NOT log this in the game log
    return state;
  }

  // Basic validation: Check if it's the player's turn and if they have actions remaining
  // Note: isValidAction handles more complex rules, this is a preliminary check.
  if (playerIndex !== state.currentPlayerIndex) {
      // Allow actions from non-current player only if specifically handled (e.g., opponent effects)
      // For now, log a warning but do NOT add to game log
      console.warn(`Action ${action.type} received from non-current player ${playerId}`);
  }

  // Validate the action based on game rules BEFORE processing
  if (!isValidAction(state, action)) {
    console.error("Reducer: Invalid action received", action);
    // Do NOT log this in the game log
    return state;
  }

  let processedState: GameState;
  let eventData: any = { playerId: playerId }; // Basic event data, playerId is now guaranteed

  // Apply the action using action handlers
  switch (action.type) {
    case 'ROTATE_CREATURE':
      processedState = rotateCreature(state, action.payload as { playerId: string; creatureId: string });
      break;
    case 'DRAW_KNOWLEDGE':
      // Find the card *before* the state is updated by drawKnowledge
      const marketCard = state.market.find(k => k.id === (action.payload as { knowledgeId: string }).knowledgeId);
      processedState = drawKnowledge(state, action.payload as { playerId: string; knowledgeId: string });
      // Apply passives triggered AFTER drawing
      eventData.knowledgeId = (action.payload as { knowledgeId: string }).knowledgeId;
      eventData.knowledgeCard = marketCard; // Pass the actual card drawn
      // Determine which trigger based on whose turn it is vs who drew
      const drawTrigger = playerId === state.players[state.currentPlayerIndex].id ? 'AFTER_PLAYER_DRAW' : 'AFTER_OPPONENT_DRAW';
      // Ensure eventData includes the player who performed the action
      eventData.playerId = playerId; 
      processedState = applyPassiveAbilities(processedState, drawTrigger, eventData);
      break;
    case 'SUMMON_KNOWLEDGE':
      const playerSummoning = getPlayerState(state, playerId);
      const knowledgeToSummon = playerSummoning?.hand.find(k => k.id === (action.payload as { knowledgeId: string }).knowledgeId);

      // Apply passives BEFORE summon validation (e.g., Dudugera, Kappa cost modification/prevention)
      // Note: Prevention logic might be better suited for isValidAction
      eventData.creatureId = (action.payload as { creatureId: string }).creatureId;
      eventData.knowledgeId = (action.payload as { knowledgeId: string }).knowledgeId;
      eventData.knowledgeCard = knowledgeToSummon;
      // Align trigger name with types.ts
      const stateBeforeSummon = applyPassiveAbilities(state, 'BEFORE_ACTION_VALIDATION', eventData); 
      
      // Re-check validity *after* potential cost modifications from passives
      // This assumes applyPassiveAbilities might change costs affecting validity.
      // If BEFORE_ACTION_VALIDATION is purely for prevention (like Dudugera),
      // the check might belong in isValidAction instead.
      // For now, proceed with summonKnowledge using the potentially modified state.
      if (!isValidAction(stateBeforeSummon, action)) {
          console.error("Reducer: Action became invalid after BEFORE_ACTION_VALIDATION passive check", action);
          return {
              ...state, // Return original state if action becomes invalid
              log: [...state.log, `Invalid action after passive check: ${action.type}`]
          };
      }

      processedState = summonKnowledge(stateBeforeSummon, action.payload as { playerId: string; knowledgeId: string; creatureId: string });

      // Apply passives triggered AFTER summoning
      eventData.creatureId = (action.payload as { creatureId: string }).creatureId;
      eventData.knowledgeId = (action.payload as { knowledgeId: string }).knowledgeId;
      eventData.knowledgeCard = knowledgeToSummon; // Pass the actual card summoned
      // Ensure eventData includes the player who performed the action
      eventData.playerId = playerId; 
      const summonTrigger = playerId === state.players[state.currentPlayerIndex].id ? 'AFTER_PLAYER_SUMMON' : 'AFTER_OPPONENT_SUMMON';
      processedState = applyPassiveAbilities(processedState, summonTrigger, eventData);
      break;
    case 'END_TURN': {
      const nextPlayerIndex = ((state.currentPlayerIndex + 1) % 2) as 0 | 1;
      const nextTurn = state.currentPlayerIndex === 1 ? state.turn + 1 : state.turn;
      let turnStartState: GameState = {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        turn: nextTurn,
        phase: 'knowledge',
        actionsTakenThisTurn: 0,
        // Remove turn log: do not log turn changes
        log: state.log
      };
      turnStartState = applyPassiveAbilities(turnStartState, 'TURN_START', {
          playerId: turnStartState.players[nextPlayerIndex].id
      });
      processedState = executeKnowledgePhase(turnStartState);
      break;
    }
    default:
      // This should ideally be caught by type checking, but as a fallback:
      console.error("Reducer: Unhandled valid action type", action);
      // To satisfy TypeScript, ensure action is never here
      const _exhaustiveCheck: never = action;
      return state;
  }

  // Increment actions taken if it was an action phase action (not END_TURN)
  let finalState = processedState;
  if (state.phase === 'action' && action.type !== 'END_TURN') {
    const actionsTaken = state.actionsTakenThisTurn + 1;
    finalState = { ...finalState, actionsTakenThisTurn: actionsTaken };
  }

  // Check for win condition after every action is fully processed
  const winner = checkWinCondition(finalState);
  if (winner) {
    finalState = { ...finalState, winner, phase: 'end' };
    finalState.log = [...finalState.log, `Game Over! Player ${winner === finalState.players[0].id ? 1 : 2} wins!`];
  }

  return finalState;
}
