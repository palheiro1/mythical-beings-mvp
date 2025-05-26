import { useEffect, useReducer, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
// Remove getGameDetails, add supabase
import { getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState, RealtimeChannel, supabase } from '../utils/supabase.js';
// Remove unused Creature import
import { GameState, GameAction, Knowledge, PlayerState } from '../game/types.js';
import { initializeGame, gameReducer as originalGameReducer } from '../game/state.js';
import { v4 as uuidv4 } from 'uuid';

// Assign a unique instanceId to each knowledge card for React keys
function assignInstanceIds(state: GameState): GameState {
  const mapCard = (c: Knowledge) => ({ ...c, instanceId: c.instanceId || uuidv4() });
  return {
    ...state,
    market: state.market.map(mapCard),
    knowledgeDeck: state.knowledgeDeck.map(mapCard),
    discardPile: state.discardPile.map(mapCard),
    players: state.players.map((p: PlayerState) => ({
      ...p,
      hand: p.hand.map(mapCard),
      field: p.field.map(slot => slot.knowledge
        ? { creatureId: slot.creatureId, knowledge: mapCard(slot.knowledge) }
        : slot
      ),
    })) as [PlayerState, PlayerState],
  };
}

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
    let subscription: RealtimeChannel | null = null; // Use RealtimeChannel type
    let isMounted = true;

    const handleRealtimeUpdate = (newState: GameState | null) => { // Allow null updates
      // Check mount status and if the update is for the gameId currently being managed by this effect instance
      if (!isMounted || currentInitializedGameId.current !== gameId) {
          console.log(`[Realtime] Ignoring update: isMounted=${isMounted}, gameId mismatch (current: ${currentInitializedGameId.current}, update: ${gameId})`);
          return;
      }
       if (!newState) {
           console.warn(`[Realtime] Received null state update for game ${gameId}.`);
           // Optionally handle this - maybe show an error or revert to loading?
           // For now, we'll just ignore it and keep the current state.
           return;
       }
      console.log(`[Realtime] Received state update for game ${gameId}. Phase: ${newState?.phase}`);
      // Optional: Add validation if needed
      // if (newState.players[0]?.id?.startsWith('p') || newState.players[1]?.id?.startsWith('p')) { ... }
      dispatch({ type: 'SET_GAME_STATE', payload: assignInstanceIds(newState) });
      // Ensure loading is false if we receive an update (might happen if initial load failed but subscription worked)
      if (loading) {
          console.log("[Realtime] Setting loading to false after receiving update.");
          setLoading(false);
      }
    };

    const setupGame = async () => {
      console.log(`[setupGame] Starting setup logic for game: ${gameId}, player: ${currentPlayerId}`);
      try {
        // 1. Fetch game details (including selected creatures from state or columns)
        const { data: gameDetails, error: detailsError } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_selected_creatures, player2_selected_creatures, state') // Fetch selected creatures and state
          .eq('id', gameId)
          .single();

        if (detailsError) throw detailsError;

        // Check mount status and if the gameId hasn't changed since the effect started
        if (!isMounted || currentInitializedGameId.current !== gameId) {
            console.log(`[setupGame] Aborting fetch details: isMounted=${isMounted}, gameId mismatch.`);
            isInitializing.current = false; // Allow re-initialization if needed later
            return;
        }
        if (!gameDetails) {
            // If details are missing, the game likely doesn't exist or isn't ready.
            throw new Error(`Game details not found for game ID: ${gameId}. It might not exist or hasn't been fully created.`);
        }
        const player1Id = gameDetails.player1_id;
        const player2Id = gameDetails.player2_id;
        
        // --- Get selected creature IDs from columns or state ---
        let player1SelectedIds = gameDetails.player1_selected_creatures;
        let player2SelectedIds = gameDetails.player2_selected_creatures;
        
        // If not in columns, try to get from NFT selection state
        if ((!player1SelectedIds || !player2SelectedIds) && gameDetails.state) {
            const state = gameDetails.state as any;
            if (state.player1SelectedCreatures) {
                player1SelectedIds = state.player1SelectedCreatures;
                console.log(`[setupGame] Retrieved player1 selected creatures from state:`, player1SelectedIds);
            }
            if (state.player2SelectedCreatures) {
                player2SelectedIds = state.player2SelectedCreatures;
                console.log(`[setupGame] Retrieved player2 selected creatures from state:`, player2SelectedIds);
            }
        }
        // --- End get selected creature IDs ---

        if (!player2Id) {
            // If second player hasn't joined yet, retry after a delay
            console.log(`[setupGame] Player 2 not joined yet for game ${gameId}. Retrying in 2s...`);
            setTimeout(() => {
                if (isMounted && currentInitializedGameId.current === gameId) {
                    setupGame();
                }
            }, 2000);
            // keep loading and wait
            return;
        }
        console.log(`[setupGame] Fetched game details. P1: ${player1Id}, P2: ${player2Id}`);

        // 2. Fetch existing game state
        let gameState = await getGameState(gameId);
        if (!isMounted || currentInitializedGameId.current !== gameId) {
             console.log(`[setupGame] Aborting fetch state: isMounted=${isMounted}, gameId mismatch.`);
             isInitializing.current = false;
             return;
        }

        // 3. Initialize state LOCALLY if null and current player is P1
        let isNewGameInitialization = false;
        let initializedState: GameState | null = null; // Variable to hold newly initialized state

        if (!gameState) {
          if (currentPlayerId === player1Id) {
            console.log(`[setupGame] Game state for ${gameId} not found. Initializing as Player 1...`);
            isNewGameInitialization = true;

            // --- Use selected creature IDs for initialization ---
            if (!player1SelectedIds || !player2SelectedIds || player1SelectedIds.length !== 3 || player2SelectedIds.length !== 3) {
              throw new Error("Selected creature data is missing or incomplete in the database.");
            }

            initializedState = initializeGame({
                gameId,
                player1Id,
                player2Id,
                player1SelectedIds: player1SelectedIds, // Pass IDs
                player2SelectedIds: player2SelectedIds, // Pass IDs
            });
            // --- End use selected creature IDs ---
            console.log(`[setupGame] Game ${gameId} initialized locally by Player 1. Phase: ${initializedState.phase}`);

            // 4. Update DB immediately if P1 just initialized
            console.log(`[setupGame] Updating initial game state in Supabase for ${gameId} as Player 1...`);
            const stateWithIds = assignInstanceIds(initializedState!);
            const updateResult = await updateGameState(gameId, stateWithIds);
            // Check mount status and gameId *again* before proceeding
            if (!isMounted || currentInitializedGameId.current !== gameId) {
                 console.log(`[setupGame] Aborting post-update: isMounted=${isMounted}, gameId mismatch.`);
                 isInitializing.current = false;
                 return;
            }
            if (!updateResult) {
                console.error(`[setupGame] Failed to update initial game state in Supabase for ${gameId}.`);
                // Check mount status before setting error
                if (isMounted && currentInitializedGameId.current === gameId) {
                    setError("Failed to save initial game state."); // Inform user
                }
                // Don't proceed to dispatch if DB update failed
                initializedState = null; // Prevent dispatching the failed state
            } else {
                console.log(`[setupGame] Successfully updated initial game state in Supabase.`);
                // Proceed to dispatch this initializedState below
            }
          } else {
            // Player 2: State is null, but wait for Player 1 to initialize it.
            console.log(`[setupGame] Game state for ${gameId} not found. Waiting for Player 1 to initialize...`);
            // Keep loading=true, state=null. The subscription or next fetch should get the state.
            // No return needed here, let it proceed to subscription setup. Loading remains true.
          }
        } else {
          // Game state WAS found initially
          console.log(`[setupGame] Game ${gameId} state found. Phase: ${gameState.phase}`);
          if (gameState.players[0].id !== player1Id || gameState.players[1].id !== player2Id) {
              console.warn(`[setupGame] Mismatch between game_states player IDs and games table IDs.`);
              // Potentially throw an error or try to recover
          }
          // Use the fetched state
          initializedState = gameState;
        }

        // 5. Set local state and loading status (only if state is available)
        // Check mount status and gameId *again* before dispatching
        if (isMounted && currentInitializedGameId.current === gameId) {
            if (initializedState) {
                dispatch({ type: 'SET_GAME_STATE', payload: initializedState });
                console.log(`[setupGame] Dispatched ${isNewGameInitialization ? 'new' : 'existing'} SET_GAME_STATE. Setting loading to false.`);
                setLoading(false); // Set loading false *after* dispatching state
            } else if (currentPlayerId !== player1Id && !gameState) {
                // Player 2 is still waiting, do nothing here, loading remains true
                console.log(`[setupGame] Player 2 still waiting for initial state, keeping loading=true.`);
            } else {
                // State is unexpectedly null (e.g., P1 init failed DB save)
                console.error(`[setupGame] State is null after initialization/fetch attempt for ${gameId}.`);
                setError("Error: Game not found or unable to load initial state. Ensure initialization happened after NFT selection.");
                setLoading(false);
            }
        } else {
             console.log(`[setupGame] Aborting dispatch: isMounted=${isMounted}, gameId mismatch.`);
             isInitializing.current = false; // Reset flag if we abort
             return;
        }

        // 6. Subscribe to real-time updates (Both players do this, even if P2 is still waiting for initial state)
        // Check mount status and gameId *again* before subscribing
        if (isMounted && currentInitializedGameId.current === gameId) {
            // Avoid subscribing if already subscribed (e.g., due to HMR without full unmount)
            if (!subscription) {
                console.log(`[setupGame] Subscribing to realtime updates for ${gameId} via useGameInitialization.`);
                subscription = subscribeToGameState(gameId, handleRealtimeUpdate, "GameInitialization"); // Added subscriberId
            } else {
                console.log(`[setupGame] Already subscribed to ${gameId} via useGameInitialization.`);
            }
        } else {
             console.log(`[setupGame] Aborting subscription: isMounted=${isMounted}, gameId mismatch.`);
        }

      } catch (err) {
        console.error('[setupGame] Error:', err);
        // Check mount status and gameId *again* before setting error/loading
        if (isMounted && currentInitializedGameId.current === gameId) {
            setError(`Failed to setup game: ${err instanceof Error ? err.message : String(err)}`);
            setLoading(false); // Ensure loading is false on error
        } else {
             console.log(`[setupGame] Error occurred, but component unmounted or gameId changed. Ignoring error.`);
        }
      } finally {
          // Only mark as not initializing if this effect instance was for the current gameId
          if (currentInitializedGameId.current === gameId) {
              isInitializing.current = false;
              console.log(`[setupGame] Finished setup attempt for game: ${gameId}. isInitializing set to false.`);
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
        subscription = null; // Clear subscription variable
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