import { useEffect, useReducer, useState, useRef } from 'react'; // Import useRef
import { useParams } from 'react-router-dom';
import { getGameDetails, getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState } from '../utils/supabase';
import { initializeGame, gameReducer as originalGameReducer } from '../game/state';
import { GameState, GameAction, Creature } from '../game/types';
import creatureData from '../assets/creatures.json';

// Define a type for the state that can be null initially
type GameScreenState = GameState | null;

// Define the reducer function type explicitly
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;

// Wrapper for the original reducer to handle the null case gracefully
const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') {
    // Ensure payload is not null before setting
    return action.payload ?? null;
  }
  // INITIALIZE_GAME is handled within the hook's effect, not directly by dispatching

  if (state === null) {
    // Don't try to apply game actions to a null state, except for SET_GAME_STATE
    console.error("[Reducer] Attempted action on null state:", action.type);
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
  const isInitializing = useRef(false); // Ref to prevent concurrent initializations
  const currentInitializedGameId = useRef<string | null>(null); // Ref to track the gameId being initialized/initialized

  useEffect(() => {
    // Clear state and reset if gameId or currentPlayerId changes/becomes invalid
    if (!gameId || !currentPlayerId) {
      console.log('[useGameInit] Resetting: Missing gameId or currentPlayerId.');
      setLoading(true);
      if (state !== null) {
        dispatch({ type: 'SET_GAME_STATE', payload: null });
      }
      currentInitializedGameId.current = null; // Reset tracking
      isInitializing.current = false;
      return;
    }

    // Prevent re-initialization if already initializing or if state for this gameId exists and is not loading
    if (isInitializing.current || (state?.gameId === gameId && !loading)) {
        console.log(`[useGameInit] Skipping setup: isInitializing=${isInitializing.current}, state?.gameId=${state?.gameId}, loading=${loading}`);
        // If state exists but loading is true, ensure it gets set to false eventually (e.g., after HMR)
        if (state?.gameId === gameId && loading) {
            console.log(`[useGameInit] State for ${gameId} exists, ensuring loading is false.`);
            setLoading(false);
        }
        return;
    }

    console.log(`[useGameInit] Starting Effect run for gameId: ${gameId}, currentPlayerId: ${currentPlayerId}`);
    isInitializing.current = true; // Mark as initializing
    currentInitializedGameId.current = gameId; // Track the game being initialized
    setLoading(true); // Explicitly set loading true at the start
    setError(null);
    let subscription: any = null;
    let isMounted = true;

    const handleRealtimeUpdate = (newState: GameState) => {
      // Check mount status and if the update is for the gameId currently being managed by this effect instance
      if (!isMounted || currentInitializedGameId.current !== gameId) {
          console.log(`[Realtime] Ignoring update: isMounted=${isMounted}, gameId mismatch (current: ${currentInitializedGameId.current}, update: ${gameId})`);
          return;
      }
      console.log(`[Realtime] Received state update for game ${gameId}. Phase: ${newState?.phase}`);
      // Optional: Add validation if needed
      // if (newState.players[0]?.id?.startsWith('p') || newState.players[1]?.id?.startsWith('p')) { ... }
      dispatch({ type: 'SET_GAME_STATE', payload: newState });
      // Ensure loading is false if we receive an update (might happen if initial load failed but subscription worked)
      if (loading) {
          console.log("[Realtime] Setting loading to false after receiving update.");
          setLoading(false);
      }
    };

    const setupGame = async () => {
      console.log(`[setupGame] Starting setup logic for game: ${gameId}, player: ${currentPlayerId}`);
      try {
        // 1. Fetch game details
        const gameDetails = await getGameDetails(gameId);
        // Check mount status and if the gameId hasn't changed since the effect started
        if (!isMounted || currentInitializedGameId.current !== gameId) {
            console.log(`[setupGame] Aborting fetch details: isMounted=${isMounted}, gameId mismatch.`);
            isInitializing.current = false; // Allow re-initialization if needed later
            return;
        }
        if (!gameDetails) {
            throw new Error(`Game details not found for game ID: ${gameId}.`);
        }
        const player1Id = gameDetails.player1_id;
        const player2Id = gameDetails.player2_id;
        if (!player1Id || !player2Id) {
            throw new Error(`Game ${gameId} is missing valid player IDs.`);
        }
        console.log(`[setupGame] Fetched game details. P1: ${player1Id}, P2: ${player2Id}`);

        // 2. Fetch existing game state
        let gameState = await getGameState(gameId);
        if (!isMounted || currentInitializedGameId.current !== gameId) {
             console.log(`[setupGame] Aborting fetch state: isMounted=${isMounted}, gameId mismatch.`);
             isInitializing.current = false;
             return;
        }
        let isNewGameInitialization = false;

        if (!gameState) {
          console.log(`[setupGame] Game state for ${gameId} not found. Initializing...`);
          isNewGameInitialization = true;

          // Use mock creatures - replace later
          const mockCreaturesP1: Creature[] = creatureData.slice(0, 3) as Creature[];
          const mockCreaturesP2: Creature[] = creatureData.slice(3, 6) as Creature[];
          if (mockCreaturesP1.length < 3 || mockCreaturesP2.length < 3) {
              throw new Error("Not enough mock creature data.");
          }

          gameState = initializeGame(gameId, player1Id, player2Id, mockCreaturesP1, mockCreaturesP2);
          console.log(`[setupGame] Game ${gameId} initialized locally. Phase: ${gameState.phase}`);

        } else {
          console.log(`[setupGame] Game ${gameId} state found. Phase: ${gameState.phase}`);
          // Optional: Validate fetched state player IDs
          if (gameState.players[0].id !== player1Id || gameState.players[1].id !== player2Id) {
              console.warn(`[setupGame] Mismatch between game_states player IDs and games table IDs.`);
          }
        }

        // 3. Set local state and loading status
        // Check mount status and gameId *again* before dispatching
        if (isMounted && currentInitializedGameId.current === gameId) {
            dispatch({ type: 'SET_GAME_STATE', payload: gameState });
            console.log(`[setupGame] Dispatched SET_GAME_STATE. Setting loading to false.`);
            setLoading(false); // Set loading false *after* dispatching initial state
        } else {
            console.log(`[setupGame] Aborting dispatch: isMounted=${isMounted}, gameId mismatch.`);
            isInitializing.current = false; // Reset flag if we abort
            return;
        }

        // 4. Update DB if we just initialized
        if (isNewGameInitialization && gameState) {
            console.log(`[setupGame] Updating initial game state in Supabase for ${gameId}...`);
            const updateResult = await updateGameState(gameId, gameState);
             // Check mount status and gameId *again* before proceeding
             if (!isMounted || currentInitializedGameId.current !== gameId) {
                 console.log(`[setupGame] Aborting post-update: isMounted=${isMounted}, gameId mismatch.`);
                 isInitializing.current = false;
                 return;
             }
            if (!updateResult) {
                console.error(`[setupGame] Failed to update initial game state in Supabase for ${gameId}.`);
                // setError("Failed to save initial game state."); // Optional: Inform user
            } else {
                console.log(`[setupGame] Successfully updated initial game state in Supabase.`);
            }
        }

        // 5. Subscribe to real-time updates
        // Check mount status and gameId *again* before subscribing
        if (isMounted && currentInitializedGameId.current === gameId) {
            console.log(`[setupGame] Setting up real-time subscription for ${gameId}.`);
            subscription = subscribeToGameState(gameId, handleRealtimeUpdate);
            console.log(`[setupGame] Subscribed to realtime updates for ${gameId}.`);
        } else {
             console.log(`[setupGame] Aborting subscription: isMounted=${isMounted}, gameId mismatch.`);
        }

      } catch (err) {
        console.error('[setupGame] Error:', err);
        // Check mount status and gameId *again* before setting error/loading
        if (isMounted && currentInitializedGameId.current === gameId) {
            setError(`Failed to setup game: ${err instanceof Error ? err.message : String(err)}`);
            setLoading(false); // Ensure loading is false on error
        }
      } finally {
          // Only mark as not initializing if this effect instance was for the current gameId
          if (currentInitializedGameId.current === gameId) {
              isInitializing.current = false;
              console.log(`[setupGame] Finished setup for game: ${gameId}. isInitializing set to false.`);
          } else {
              console.log(`[setupGame] Finished setup for a different gameId (${currentInitializedGameId.current}). Not changing isInitializing.`);
          }
      }
    };

    setupGame();

    // Cleanup function
    return () => {
      console.log(`[useGameInit] Cleanup running for effect associated with gameId: ${gameId}.`);
      isMounted = false;
      // Unsubscribe only if this cleanup corresponds to the gameId we initialized *and* subscribed for
      if (subscription && currentInitializedGameId.current === gameId) {
        unsubscribeFromGameState(subscription);
        console.log(`[useGameInit] Unsubscribed from realtime updates for ${gameId}.`);
      } else {
          console.log(`[useGameInit] No unsubscription needed (no subscription object or gameId mismatch).`);
      }
      // Reset initialization flag *only if* this cleanup is for the gameId that was being initialized
      if (isInitializing.current && currentInitializedGameId.current === gameId) {
          console.log(`[useGameInit] Resetting isInitializing flag during cleanup for ${gameId}.`);
          isInitializing.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, currentPlayerId, setError]); // state and loading are managed internally by the hook

  return [state, dispatch, loading, gameId];
}