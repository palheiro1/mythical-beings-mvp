import { useEffect, useReducer, useState, useRef } from 'react';
import { GameState, GameAction } from '../game/types.js'; // Added .js
import { gameReducer } from '../game/state.js'; // Added .js
import { getGameState, subscribeToGameState, unsubscribeFromGameState, recordGameOutcomeAndUpdateStats } from '../utils/supabase.js'; // Added .js
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
    const [gameState, dispatch] = useReducer(gameReducer, null);
    const [isLoading, setIsLoading] = useState(true);
    const prevGameStateRef = useRef<GameState | null>(null);

    useEffect(() => {
        if (!gameId) {
            console.log("[useGameStateSync] No gameId provided, skipping fetch and subscription.");
            setError("No game ID specified.");
            setIsLoading(false);
            if (gameState !== null) {
                 dispatch({ type: 'SET_GAME_STATE', payload: null });
            }
            return;
        }

        console.log(`[useGameStateSync] Initializing for game ${gameId}. Fetching initial state...`);
        setIsLoading(true);
        setError(null);
        let channel: RealtimeChannel | null = null;

        const setupSync = async () => {
            try {
                const initialState = await getGameState(gameId);
                if (initialState) {
                    console.log(`[useGameStateSync] Initial state fetched for game ${gameId}. Phase: ${initialState.phase}. Dispatching SET_GAME_STATE.`);
                    dispatch({ type: 'SET_GAME_STATE', payload: initialState });
                } else {
                    console.error(`[useGameStateSync] Error: Game state is null for game ${gameId}. Initialization likely failed or hasn't occurred.`);
                    setError(`Game not found or unable to load initial state (ID: ${gameId}). Ensure initialization happened after NFT selection.`);
                    if (gameState !== null) {
                         dispatch({ type: 'SET_GAME_STATE', payload: null });
                    }
                }

                console.log(`[useGameStateSync] Subscribing to real-time updates for game ${gameId}.`);
                channel = subscribeToGameState(gameId, (newState: GameState) => {
                    console.error(`%c!!! CALLBACK FIRED IN useGameStateSync for game ${gameId} !!!`, "color: red; font-weight: bold;", newState);
                    console.log(`[useGameStateSync] Realtime update received for game ${gameId}. Phase: ${newState.phase}. Dispatching SET_GAME_STATE.`);
                    dispatch({ type: 'SET_GAME_STATE', payload: newState });
                }, "GameStateSync"); // Added subscriberId

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

        return () => {
            if (channel) {
                console.log(`[useGameStateSync] Cleaning up: Unsubscribing from game ${gameId}.`);
                unsubscribeFromGameState(channel);
                channel = null;
            }
        };
    }, [gameId, setError]);

    useEffect(() => {
        const currentGameState = gameState;
        const previousGameState = prevGameStateRef.current;

        // Check if the game has just ended
        if (currentGameState && currentGameState.phase === 'gameOver' && previousGameState?.phase !== 'gameOver') {
            console.log(`[useGameStateSync] Detected game over. Current phase: ${currentGameState.phase}, Previous phase: ${previousGameState?.phase}`);

            if (currentGameState.players && currentGameState.players.length === 2) {
                const player1Id = currentGameState.players[0]?.id; // Optional chaining for safety
                const player2Id = currentGameState.players[1]?.id; // Optional chaining for safety
                const winnerId = typeof currentGameState.winner === 'string' ? currentGameState.winner : null;

                if (currentGameState.gameId && player1Id && player2Id) {
                    console.log(`[useGameStateSync] Game ${currentGameState.gameId} ended. Winner: ${winnerId}. Player1: ${player1Id}, Player2: ${player2Id}. Recording outcome.`);
                    recordGameOutcomeAndUpdateStats(currentGameState.gameId, winnerId, player1Id, player2Id);
                } else {
                    console.error('[useGameStateSync] Cannot record game outcome: Missing gameId or player IDs.', {
                        gameId: currentGameState.gameId,
                        player1Id,
                        player2Id,
                        winnerId
                    });
                }
            } else {
                 console.error('[useGameStateSync] Cannot record game outcome: Player data is insufficient or not structured as expected.', { players: currentGameState.players });
            }
        }
        // Update previous state ref *after* checking the transition
        prevGameStateRef.current = currentGameState;
    }, [gameState]); // Re-run when gameState changes

    return [gameState, dispatch, isLoading];
}