import { useEffect, useReducer, useState } from 'react';
import { GameState, GameAction } from '../game/types';
import { gameReducer } from '../game/state';
import { getGameState, subscribeToGameState, unsubscribeFromGameState } from '../utils/supabase'; // Assuming unsubscribe is exported
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to fetch the initial game state and subscribe to real-time updates.
 * Assumes the game state should already be initialized in the database.
 *
 * @param gameId The ID of the game to sync with.
 * @param setError Callback to set an error message in the parent component.
 * @returns A tuple: [gameState, dispatch, isLoading]
 */
export function useGameStateSync(
    gameId: string | null,
    setError: (error: string | null) => void
): [GameState | null, React.Dispatch<GameAction>, boolean] {

    // Initialize reducer with null state
    const [gameState, dispatch] = useReducer(gameReducer, null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!gameId) {
            console.log("[useGameStateSync] No gameId provided, skipping fetch and subscription.");
            setError("No game ID specified.");
            setIsLoading(false);
            // Dispatch null state if gameId becomes null after being set
            if (gameState !== null) {
                 dispatch({ type: 'SET_GAME_STATE', payload: null });
            }
            return;
        }

        console.log(`[useGameStateSync] Initializing for game ${gameId}. Fetching initial state...`);
        setIsLoading(true);
        setError(null); // Clear previous errors
        let channel: RealtimeChannel | null = null;

        const setupSync = async () => {
            try {
                // 1. Fetch the current state
                const initialState = await getGameState(gameId);

                if (initialState) {
                    console.log(`[useGameStateSync] Initial state fetched for game ${gameId}. Phase: ${initialState.phase}. Dispatching SET_GAME_STATE.`);
                    dispatch({ type: 'SET_GAME_STATE', payload: initialState });
                } else {
                    // This is now considered an error condition, as initialization should happen before GameScreen
                    console.error(`[useGameStateSync] Error: Game state is null for game ${gameId}. Initialization likely failed or hasn't occurred.`);
                    setError(`Game not found or unable to load initial state (ID: ${gameId}). Ensure initialization happened after NFT selection.`);
                    // Dispatch null state if it wasn't already null
                    if (gameState !== null) {
                         dispatch({ type: 'SET_GAME_STATE', payload: null });
                    }
                }

                // 2. Subscribe to updates (regardless of initial fetch success, maybe state gets created later?)
                // Although, ideally, we shouldn't reach GameScreen without initial state.
                console.log(`[useGameStateSync] Subscribing to real-time updates for game ${gameId}.`);
                channel = subscribeToGameState(gameId, (newState) => {
                    console.log(`[useGameStateSync] Realtime update received for game ${gameId}. Phase: ${newState.phase}. Dispatching SET_GAME_STATE.`);
                    dispatch({ type: 'SET_GAME_STATE', payload: newState });
                });

            } catch (err: any) {
                console.error(`[useGameStateSync] Error setting up game sync for ${gameId}:`, err);
                setError(`Failed to load or sync game state: ${err.message || 'Unknown error'}`);
                 if (gameState !== null) {
                     dispatch({ type: 'SET_GAME_STATE', payload: null });
                 }
            } finally {
                console.log(`[useGameStateSync] Initial setup finished for game ${gameId}. Setting isLoading to false.`);
                setIsLoading(false);
            }
        };

        setupSync();

        // Cleanup function
        return () => {
            if (channel) {
                console.log(`[useGameStateSync] Cleaning up: Unsubscribing from game ${gameId}.`);
                unsubscribeFromGameState(channel); // Use the unsubscribe function
                channel = null;
            }
        };
        // Re-run effect if gameId changes
    }, [gameId, setError]); // Removed gameState from dependencies to avoid potential loops

    return [gameState, dispatch, isLoading];
}