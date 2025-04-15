import React, { useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState, logMove } from '../utils/supabase';
import { gameReducer } from '../game/state';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../game/types'; // Added PlayerState, Creature, Knowledge

// Define a type for the state that can be null initially
type GameScreenState = GameState | null;

// Define the reducer function type explicitly to handle null initial state
// The reducer itself should handle the case where the initial state is null (e.g., for SET_GAME_STATE)
// but for game actions, it assumes a non-null state.
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;

// Wrapper for the original reducer to handle the null case gracefully
const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') {
    return action.payload; // Directly set the state, which might be GameState or null
  }
  if (action.type === 'INITIALIZE_GAME') {
    // Assuming initializeGame returns GameState
    // This case might not be used directly here if fetching handles init
    return gameReducer(null as unknown as GameState, action); // Need to call original reducer
  }
  // For all other actions, assume state is not null (validated before dispatching handleAction)
  if (state === null) {
    console.error("Reducer called with null state for action type:", action.type);
    return null; // Or handle error appropriately
  }
  return gameReducer(state, action);
};

const GameScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  // Initialize reducer with null state and the wrapper reducer
  const [state, dispatch] = useReducer(gameScreenReducer, null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPlayerId = 'p1'; // TODO: Replace with actual player ID

  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided.');
      setLoading(false);
      return;
    }

    let subscription: any = null;

    const fetchAndSubscribe = async () => {
      setLoading(true);
      setError(null);
      try {
        const initialState = await getGameState(gameId);
        // Dispatch SET_GAME_STATE regardless of whether initialState is null or GameState
        dispatch({ type: 'SET_GAME_STATE', payload: initialState });
        if (!initialState) {
           console.error(`Initial game state for ${gameId} not found.`);
           setError(`Game ${gameId} not found or could not be loaded.`);
        }

        // Subscribe only if initial state was found (or decide based on requirements)
        if (initialState) {
            subscription = subscribeToGameState(gameId, (newState) => {
              console.log('Realtime update received:', newState);
              dispatch({ type: 'SET_GAME_STATE', payload: newState });
            });
        }

      } catch (err: any) {
        console.error('Error fetching initial game state:', err);
        setError(`Failed to load game: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (subscription) {
        unsubscribeFromGameState(subscription);
      }
    };
  }, [gameId]);

  const handleAction = async (action: GameAction) => {
    // State must be non-null to perform game actions
    if (!state || !gameId) return;

    // The wrapper reducer handles the state type, no need for casting here
    const nextState = gameScreenReducer(state, action);
    // Dispatch the result (which could be null if reducer handles errors that way, but unlikely for valid actions)
    dispatch({ type: 'SET_GAME_STATE', payload: nextState as GameState }); // Assume valid actions return GameState

    // Persist the new state and log the move to Supabase
    try {
      // Ensure nextState is a valid GameState before updating Supabase
      if (nextState) {
        await updateGameState(gameId, nextState);
        // Log the move
        if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
          // Use the state *before* the action for logging END_TURN correctly
          const loggingPlayerId = (action.payload && 'playerId' in action.payload) ? action.payload.playerId : state.players[state.currentPlayerIndex]?.id;
          if (loggingPlayerId) {
             await logMove(gameId, loggingPlayerId, action.type, action.payload);
          }
        }
      }
    } catch (err) {
      console.error('Error updating game state in Supabase:', err);
      setError('Failed to save move. Please try again or refresh.');
      // Revert local state (optional)
      // dispatch({ type: 'SET_GAME_STATE', payload: state });
    }
  };

  if (loading) {
    return <div>Loading game...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!state) {
    return <div>Initializing game state or game not found...</div>;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  // const opponentPlayer = state.players[(state.currentPlayerIndex + 1) % 2]; // Still unused

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Game Screen - Game ID: {gameId}</h1>
      <p className="mb-2">Turn: {state.turn}, Phase: {state.phase}</p>
      {state.winner && <p className="text-2xl font-bold text-green-500">Winner: Player {state.players.findIndex(p => p.id === state.winner) + 1} ({state.winner})!</p>}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="font-semibold">Player 1 ({state.players[0].id})</h2>
          <p>Power: {state.players[0].power}</p>
          {/* TODO Task 18: Add <CreatureZone creatures={state.players[0].creatures} field={state.players[0].field} /> */}
          {/* TODO Task 18: Add <Hand cards={state.players[0].hand} /> */}
        </div>
        <div>
          <h2 className="font-semibold">Player 2 ({state.players[1].id})</h2>
          <p>Power: {state.players[1].power}</p>
          {/* TODO Task 18: Add <CreatureZone creatures={state.players[1].creatures} field={state.players[1].field} /> */}
          {/* TODO Task 18: Add <Hand cards={state.players[1].hand} /> */}
        </div>
      </div>

      {!state.winner && (
        <p className="font-semibold mb-2">
          Current Turn: Player {state.currentPlayerIndex + 1} ({currentPlayer.id})
          {state.phase === 'action' && ` - Actions Left: ${2 - state.actionsTakenThisTurn}`}
        </p>
      )}

      {/* TODO Task 18: Replace placeholder with <Market cards={state.market} /> */}
      <div className="my-4 p-2 border rounded bg-gray-700">
        <h3 className="font-semibold mb-1">Market</h3>
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(state.market, null, 2)}</pre>
      </div>

      {state.phase === 'action' && currentPlayerId === currentPlayer.id && !state.winner && (
        <div className="my-4 space-x-2">
          {/* TODO Task 18: Implement onClick handlers for actions */}
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm" disabled>Rotate (NYI)</button>
          <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm" disabled>Draw (NYI)</button>
          <button className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded text-sm" disabled>Summon (NYI)</button>
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
            onClick={() => handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } })}
          >
            End Turn
          </button>
        </div>
      )}

      <div className="mt-4 p-2 border rounded bg-gray-800 h-40 overflow-y-auto text-sm">
        <h3 className="font-semibold mb-1">Game Log</h3>
        {state.log.map((entry, index) => (
          <p key={index} className="text-xs">{entry}</p>
        ))}
      </div>

      {/* <details className="mt-4">
        <summary>Raw Game State (Debug)</summary>
        <pre className="text-xs whitespace-pre-wrap bg-black p-2 rounded">{JSON.stringify(state, null, 2)}</pre>
      </details> */}
    </div>
  );
};

export default GameScreen;
