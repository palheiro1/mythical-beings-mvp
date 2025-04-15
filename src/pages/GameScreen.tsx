import React, { useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
// Import createGame and mock creature data
import { getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState, logMove, createGame } from '../utils/supabase';
import { gameReducer, initializeGame } from '../game/state';
import { isValidAction } from '../game/rules';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../game/types';
import Card from '../components/Card';
import Hand from '../components/Hand';
import Market from '../components/Market';
import CreatureZone from '../components/CreatureZone';
import creatureData from '../assets/creatures.json'; // Import creature data

// Define a type for the state that can be null initially
type GameScreenState = GameState | null;

// Define the reducer function type explicitly
// It now correctly handles GameState | null as input and output
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;

// Wrapper for the original reducer to handle the null case gracefully
const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') {
    // Directly set the state, which might be GameState or null
    // Ensure payload is not undefined before returning
    return action.payload ?? null;
  }
  if (action.type === 'INITIALIZE_GAME') {
    // Call the actual initializeGame function
    const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = action.payload;
    return initializeGame(gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2);
  }
  // For all other actions, state must be non-null
  if (state === null) {
    console.error("Reducer called with null state for action type:", action.type);
    // Return null or throw an error, depending on desired behavior for invalid states
    return null;
  }
  // Delegate to the original gameReducer for actual game logic
  return gameReducer(state, action);
};


const GameScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  // Initialize reducer with null state and the wrapper reducer
  const [state, dispatch] = useReducer(gameScreenReducer, null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TODO: Replace with actual authenticated player ID (e.g., from wallet connection context)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null); // Example: 'p1' or 'p2'
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null); // For summon action flow

  // --- Mock Player ID Setup (Replace with actual auth) ---
  useEffect(() => {
    // Simulate fetching player ID or determining it based on URL/session
    // For testing, alternate between p1 and p2 based on a query param or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const mockPlayer = urlParams.get('player');
    if (mockPlayer === 'p1' || mockPlayer === 'p2') {
        setCurrentPlayerId(mockPlayer);
        console.log(`Mock Player ID set to: ${mockPlayer}`);
    } else {
        // Default or prompt for player ID for testing
        const assignedPlayer = prompt("Enter player ID for testing (p1 or p2):", "p1");
        if (assignedPlayer === 'p1' || assignedPlayer === 'p2') {
            setCurrentPlayerId(assignedPlayer);
            console.log(`Mock Player ID set to: ${assignedPlayer}`);
        } else {
            setError("Could not determine player ID for this session.");
        }
    }
  }, []);
  // --- End Mock Player ID Setup ---


  useEffect(() => {
    if (!gameId || !currentPlayerId) { // Also wait for currentPlayerId
      // setError('No game ID or Player ID provided.'); // Don't set error yet, might just be loading
      setLoading(true); // Keep loading until both are available
      return;
    }

    setLoading(true);
    setError(null);
    let subscription: any = null; // Use 'any' for Supabase channel type for simplicity

    const handleRealtimeUpdate = (newState: GameState) => {
      console.log('Realtime update received:', newState);
      dispatch({ type: 'SET_GAME_STATE', payload: newState });
    };

    const setupGame = async () => {
      try {
        let gameState = await getGameState(gameId); // Use let
        if (!gameState) {
          // --- Game Initialization Logic --- 
          console.log(`Game state for ${gameId} not found. Attempting to initialize...`);
          // Use mock data and IDs for testing initialization
          const mockCreaturesP1: Creature[] = creatureData.slice(0, 3) as Creature[];
          const mockCreaturesP2: Creature[] = creatureData.slice(3, 6) as Creature[];
          const player1Id = 'p1'; // Mock player ID
          const player2Id = 'p2'; // Mock player ID

          if (mockCreaturesP1.length < 3 || mockCreaturesP2.length < 3) {
              throw new Error("Not enough mock creature data available for initialization.");
          }

          // Initialize the state locally
          const initializedState = initializeGame(gameId, player1Id, player2Id, mockCreaturesP1, mockCreaturesP2);

          // Create the game record in Supabase, passing the desired gameId
          const createdGame = await createGame(gameId, player1Id, player2Id, initializedState);

          if (!createdGame || !createdGame.state) {
            throw new Error("Failed to create game in Supabase.");
          }
          gameState = createdGame.state as GameState; // Use the newly created state
          console.log(`Game ${gameId} created and initialized.`);
          // --- End Initialization Logic ---
        }

        // Set the state (either fetched or newly initialized)
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        setLoading(false);

        // Subscribe after initial state is set or created
        subscription = subscribeToGameState(gameId, handleRealtimeUpdate);

      } catch (err) {
        console.error('Error setting up game:', err);
        setError(`Failed to fetch or initialize game state: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    setupGame();

    // Cleanup function
    return () => {
      if (subscription) {
        unsubscribeFromGameState(subscription);
      }
    };
  }, [gameId, currentPlayerId]); // Add currentPlayerId dependency


  // --- Action Handling ---
  const handleAction = async (action: GameAction) => {
    if (!state || !gameId || !currentPlayerId) {
      console.error("Cannot handle action: State, gameId, or currentPlayerId missing.");
      return;
    }

    // Ensure the action payload has the correct player ID
    if ('payload' in action && typeof action.payload === 'object' && action.payload && 'playerId' in action.payload) {
        if (action.payload.playerId !== currentPlayerId) {
            console.warn("Action originated from wrong player context?", action);
            // Optionally prevent action if payload.playerId doesn't match currentPlayerId
            // return;
        }
    } else if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
        console.error("Action payload missing playerId:", action);
        return; // Don't process actions without player context (except system ones)
    }


    // Validate action before dispatching locally or sending to Supabase
    if (!isValidAction(state, action)) {
      console.warn("Invalid action attempted:", action.type, action.payload);
      setError(`Invalid action: ${action.type}. Check game rules or state.`);
      // Clear selection if the invalid action was part of summon flow
      setSelectedKnowledgeId(null);
      return; // Don't proceed if action is invalid
    }

    // Optimistic UI update
    const nextState = gameScreenReducer(state, action); // Use the wrapper reducer
    if (!nextState) {
        console.error("Reducer returned null state after action:", action);
        setError("An error occurred processing the action.");
        return;
    }
    dispatch(action); // Dispatch the original action to the reducer managing the component's state

    // Persist state change and log move via Supabase
    try {
      const updateResult = await updateGameState(gameId, nextState);
      if (!updateResult) {
          throw new Error("Failed to update game state in Supabase.");
      }
      // Only log actions with payloads (i.e., player actions)
      if ('payload' in action && action.payload) {
          await logMove(gameId, currentPlayerId, action.type, action.payload);
      }
      setError(null); // Clear previous errors on successful action
    } catch (err) {
      console.error('Error updating game state or logging move:', err);
      setError('Failed to sync game state. Please try again.');
      // TODO: Consider reverting optimistic update if Supabase fails
      // dispatch({ type: 'SET_GAME_STATE', payload: state }); // Revert state
    }

    // Clear selection after successful summon
    if (action.type === 'SUMMON_KNOWLEDGE') {
        setSelectedKnowledgeId(null);
    }
  };

  // --- Click Handlers ---

  const handleRotateCreature = (creatureId: string) => {
    console.log('[GameScreen] handleRotateCreature called for creature:', creatureId);
    if (!currentPlayerId) return;
    handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
  };

  const handleDrawKnowledge = (knowledgeId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId } });
  };

  const handleHandCardClick = (knowledgeId: string) => {
    // Start the summon process: select the knowledge card
    setSelectedKnowledgeId(knowledgeId);
    console.log(`Selected knowledge card ${knowledgeId} to summon. Click a creature to target.`);
    setError(`Selected ${state?.players[state.currentPlayerIndex].hand.find(k=>k.id === knowledgeId)?.name}. Click a creature to summon onto.`); // Provide feedback
  };

  const handleCreatureClickForSummon = (creatureId: string) => {
    if (!currentPlayerId || !selectedKnowledgeId) return; // Only proceed if a knowledge card is selected

    // Clear error message related to selection prompt
    setError(null);

    handleAction({
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: currentPlayerId, knowledgeId: selectedKnowledgeId, creatureId }
    });
    // handleAction will clear selectedKnowledgeId on success
  };

  const handleEndTurn = () => {
    if (!currentPlayerId) return;
    handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
  };

  // --- Render Logic ---

  if (loading) return <div className="text-center p-10">Loading game...</div>;
  if (!state) return <div className="text-center p-10">Game data not available.</div>;

  const currentPlayer: PlayerState | undefined = state.players[state.currentPlayerIndex];
  const opponentPlayer: PlayerState | undefined = state.players[(state.currentPlayerIndex + 1) % 2];
  const isMyTurn = currentPlayer?.id === currentPlayerId;

  if (!currentPlayer || !opponentPlayer) {
      return <div className="text-center p-10 text-red-500">Error: Player data is missing.</div>;
  }

  return (
    // Use min-h-screen to allow scrolling if content overflows
    <div className="flex flex-col min-h-screen bg-gray-900 text-white p-2 md:p-4">
      {/* Game Info Bar - Remains at the top */}
      <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center bg-gray-800 p-1 md:p-2 rounded shadow-md mb-2"> {/* Reduced bottom margin */} 
        <h1 className="text-sm md:text-xl font-bold mb-1 md:mb-0">Game: {gameId}</h1>
        <div className="text-center mb-1 md:mb-0">
          <p className="text-sm md:text-lg">Turn: {state.turn} - Phase: {state.phase}</p>
          {state.winner ? (
            <p className="text-lg md:text-2xl font-bold text-yellow-400">
              Player {state.players.findIndex(p => p.id === state.winner) + 1} ({state.winner}) Wins!
            </p>
          ) : (
            <p className={`text-sm md:text-lg font-semibold ${isMyTurn ? 'text-green-400' : 'text-red-400'}`}>
              {isMyTurn ? `Your Turn (${currentPlayerId})` : `Opponent's Turn (${opponentPlayer.id})`}
              {isMyTurn && state.phase === 'action' && ` - Actions Left: ${2 - state.actionsTakenThisTurn}`}
            </p>
          )}
        </div>
        <div className="text-xs md:text-base">Player ID: {currentPlayerId}</div>
      </div>

      {/* Error Display Area */} 
      {error && (
        <div className="flex-shrink-0 bg-red-800/80 text-white p-2 rounded mb-2 text-center text-sm md:text-base">
          Error: {error}
        </div>
      )}

      {/* Main Game Area - Use flex-grow to fill space */}
      <div className="flex-grow flex flex-col space-y-4 overflow-hidden"> {/* Added overflow-hidden */}

        {/* Opponent's Area - Use flex basis for sizing */}
        <div className="flex-shrink-0 bg-gray-800/50 p-2 rounded border border-red-700/50 flex flex-col min-h-0"> {/* Added min-h-0 */}
          <h2 className="flex-shrink-0 text-center text-sm md:text-base font-semibold mb-2">Opponent ({opponentPlayer.id}) - Power: {opponentPlayer.power}</h2>
          {/* Make internal content scrollable if needed */}
          <div className="flex-grow overflow-auto space-y-2">
            <CreatureZone creatures={opponentPlayer.creatures} field={opponentPlayer.field} />
            <Hand cards={opponentPlayer.hand} /> {/* Show opponent hand count or cards if desired */}
          </div>
        </div>

        {/* Market - Use flex basis */}
        <div className="flex-shrink-0 bg-blue-900/50 p-2 rounded flex flex-col min-h-0"> {/* Added min-h-0 */}
           <h2 className="flex-shrink-0 text-center text-sm md:text-base font-semibold mb-2">Market</h2>
           <div className="flex-grow overflow-auto">
             <Market
               cards={state.market}
               onCardClick={isMyTurn && state.phase === 'action' ? handleDrawKnowledge : undefined}
             />
           </div>
        </div>

        {/* Current Player's Area - Use flex basis */}
        <div className="flex-shrink-0 bg-gray-800/50 p-2 rounded border border-green-700/50 flex flex-col min-h-0"> {/* Added min-h-0 */}
           <h2 className="flex-shrink-0 text-center text-sm md:text-base font-semibold mb-2">You ({currentPlayer.id}) - Power: {currentPlayer.power}</h2>
           <div className="flex-grow overflow-auto space-y-2">
             <CreatureZone
                creatures={currentPlayer.creatures}
                field={currentPlayer.field}
                onCreatureClick={isMyTurn && state.phase === 'action'
                    ? (selectedKnowledgeId ? handleCreatureClickForSummon : handleRotateCreature)
                    : undefined}
             />
             <Hand
                cards={currentPlayer.hand}
                onCardClick={isMyTurn && state.phase === 'action' ? handleHandCardClick : undefined}
             />
           </div>
        </div>
      </div>

      {/* Action Buttons & Log - Remains at the bottom */}
      <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center md:items-start mt-4 pt-4 border-t border-gray-700">
        <div className="flex space-x-2 mb-2 md:mb-0">
            {isMyTurn && state.phase === 'action' && state.winner === null && (
                <button
                    onClick={handleEndTurn}
                    disabled={state.actionsTakenThisTurn < 2} // Can only end turn after 2 actions
                    className={`px-3 py-1 md:px-4 md:py-2 rounded text-xs md:text-base ${state.actionsTakenThisTurn < 2 ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    End Turn
                </button>
            )}
             {selectedKnowledgeId && (
                <button
                    onClick={() => { setSelectedKnowledgeId(null); setError(null); }}
                    className="px-3 py-1 md:px-4 md:py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-xs md:text-base"
                >
                    Cancel Summon
                </button>
            )}
        </div>

        {/* Game Log */}
        <div className="w-full md:w-1/3 h-24 md:h-32 overflow-y-auto bg-black/50 p-2 rounded border border-gray-600 text-[10px] md:text-xs">
            <h3 className="font-semibold mb-1">Game Log:</h3>
            {state.log.slice(-10).map((entry, index) => ( // Show last 10 log entries
                <p key={index}>{entry}</p>
            ))}
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
