import { useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState } from '../utils/supabase';
import { initializeGame } from '../game/state';
import { GameState, GameAction, Creature } from '../game/types';
import creatureData from '../assets/creatures.json';

// Define a type for the state that can be null initially
type GameScreenState = GameState | null;

// Define the reducer function type explicitly
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;

// Wrapper for the original reducer to handle the null case gracefully
// Assuming original gameReducer is imported or defined elsewhere
import { gameReducer as originalGameReducer } from '../game/state'; // Adjust path if needed

const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') {
    return action.payload ?? null;
  }
  if (action.type === 'INITIALIZE_GAME') {
    const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = action.payload;
    return initializeGame(gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2);
  }
  if (state === null) {
    console.error("Reducer called with null state for action type:", action.type);
    return null;
  }
  return originalGameReducer(state, action);
};


/**
 * Hook to initialize the game state, fetch existing state, or create a new game,
 * and manage the Supabase real-time subscription.
 * @param currentPlayerId The ID of the currently logged-in player.
 * @param setError Callback to set error messages in the parent component.
 * @returns The game state, dispatch function, loading status, and the game ID.
 */
export function useGameInitialization(
    currentPlayerId: string | null,
    setError: React.Dispatch<React.SetStateAction<string | null>>
): [GameScreenState, React.Dispatch<GameAction>, boolean, string | undefined] {
  const { gameId } = useParams<{ gameId: string }>();
  const [state, dispatch] = useReducer(gameScreenReducer, null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId || !currentPlayerId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    let subscription: any = null;

    const handleRealtimeUpdate = (newState: GameState) => {
      console.log('[handleRealtimeUpdate] Received state phase:', newState.phase);
      dispatch({ type: 'SET_GAME_STATE', payload: newState });
    };

    const setupGame = async () => {
      console.log(`[setupGame] Starting setup for game: ${gameId}, player: ${currentPlayerId}`);
      try {
        let gameState = await getGameState(gameId);
        let isNewGameInitialization = false; // Flag to track if we initialized

        if (!gameState) {
          console.log(`[setupGame] Game state for ${gameId} not found. Initializing...`);
          isNewGameInitialization = true;
          const mockCreaturesP1: Creature[] = creatureData.slice(0, 3) as Creature[];
          const mockCreaturesP2: Creature[] = creatureData.slice(3, 6) as Creature[];
          const player1Id = 'p1'; // Mock player ID
          const player2Id = 'p2'; // Mock player ID

          if (mockCreaturesP1.length < 3 || mockCreaturesP2.length < 3) {
              throw new Error("Not enough mock creature data available for initialization.");
          }

          // Initialize the game state locally
          gameState = initializeGame(gameId, player1Id, player2Id, mockCreaturesP1, mockCreaturesP2);
          console.log(`[setupGame] Game ${gameId} initialized locally. Phase:`, gameState.phase);

        } else {
          console.log(`[setupGame] Game ${gameId} found in DB. Phase:`, gameState.phase);
        }

        // Set the local state first
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        console.log(`[setupGame] Dispatched SET_GAME_STATE.`);

        // If we just initialized the state, update it in the database
        if (isNewGameInitialization && gameState) {
            console.log(`[setupGame] Updating game state in Supabase for ${gameId}...`);
            const updateResult = await updateGameState(gameId, gameState);
            if (!updateResult) {
                // Handle potential update failure (e.g., log error, maybe revert local state?)
                console.error(`[setupGame] Failed to update initial game state in Supabase for ${gameId}.`);
                throw new Error("Failed to save initial game state to database.");
            } else {
                console.log(`[setupGame] Successfully updated initial game state in Supabase for ${gameId}.`);
            }
        }

        console.log(`[setupGame] Setting loading to false.`);
        setLoading(false);
        subscription = subscribeToGameState(gameId, handleRealtimeUpdate);
        console.log(`[setupGame] Subscribed to realtime updates.`);

      } catch (err) {
        console.error('Error setting up game:', err);
        setError(`Failed to fetch or initialize game state: ${err instanceof Error ? err.message : String(err)}`);
        console.log(`[setupGame] Setting loading to false due to error.`);
        setLoading(false);
      }
    };

    setupGame();

    return () => {
      if (subscription) {
        unsubscribeFromGameState(subscription);
      }
    };
  }, [gameId, currentPlayerId, setError, dispatch]);

  return [state, dispatch, loading, gameId];
}