import { useState, useCallback, useRef } from 'react'; // Import useRef
import { GameState, GameAction } from '../game/types';
import { isValidAction } from '../game/rules';
import { gameReducer as originalGameReducer } from '../game/state';
import { updateGameState, logMove } from '../utils/supabase'; // Import logMove

type GameScreenState = GameState | null;
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;
const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') return action.payload ?? null;
  if (action.type === 'INITIALIZE_GAME') return null; // Should be handled by initialization hook
  if (state === null) return null;
  return originalGameReducer(state, action);
};

/**
 * Hook to manage game actions, validation, optimistic updates, and persistence.
 * @param state The current game state.
 * @param dispatch The dispatch function from the game state reducer.
 * @param gameId The current game ID.
 * @param currentPlayerId The ID of the current player.
 * @param setError Callback to set error messages.
 * @returns An object containing action handler functions and selection state.
 */
export function useGameActions(
    state: GameScreenState,
    dispatch: React.Dispatch<GameAction>,
    gameId: string | undefined,
    currentPlayerId: string | null,
    setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const isProcessingAction = useRef(false); // Add ref to prevent concurrent actions

  const handleAction = useCallback(async (action: GameAction) => {
    // Prevent concurrent actions
    if (isProcessingAction.current) {
        console.warn(`[handleAction] Action ${action.type} blocked, another action is already processing.`);
        return;
    }
    isProcessingAction.current = true;

    // Log entry point
    console.log(`[handleAction] Received action: ${action.type}`, action.payload);

    if (!state || !gameId || !currentPlayerId) {
      console.error("[handleAction] Cannot handle action: State, gameId, or currentPlayerId missing.");
      isProcessingAction.current = false; // Release lock
      return;
    }

    // *** Add check to prevent duplicate END_TURN processing ***
    if (action.type === 'END_TURN') {
        const playerIndexEndingTurn = state.players.findIndex(p => p.id === action.payload.playerId);
        if (state.currentPlayerIndex !== playerIndexEndingTurn) {
             console.warn(`[handleAction] Ignoring END_TURN from player ${action.payload.playerId} because currentPlayerIndex (${state.currentPlayerIndex}) doesn't match player index (${playerIndexEndingTurn}).`);
             isProcessingAction.current = false; // Release lock
             return;
        }
        console.log(`[handleAction] Processing END_TURN for player ${action.payload.playerId}. Current state player index: ${state.currentPlayerIndex}`);
    }

    // Ensure payload has correct player ID (except for system actions)
    if ('payload' in action && typeof action.payload === 'object' && action.payload && 'playerId' in action.payload) {
        if (action.payload.playerId !== currentPlayerId) {
            console.warn("Action originated from wrong player context?", action);
            // return; // Optional: prevent action
        }
    } else if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
        console.error("[handleAction] Action payload missing playerId:", action);
        isProcessingAction.current = false; // Release lock
        return;
    }

    // Validate Action
    console.log(`[handleAction] Validating action ${action.type}...`);
    if (!isValidAction(state, action)) {
      console.warn(`[handleAction] Invalid action attempted: ${action.type}`, action.payload);
      setError(`Invalid action: ${action.type}. Check game rules or state.`);
      setSelectedKnowledgeId(null); // Clear selection on invalid action
      isProcessingAction.current = false; // Release lock
      return;
    }
    console.log(`[handleAction] Action ${action.type} is valid.`);

    // Calculate next state using the reducer
    console.log(`[handleAction] Calculating next state for action ${action.type}...`);
    const nextState = gameScreenReducer(state, action);
    if (!nextState) {
        console.error(`[handleAction] Reducer returned null state after action: ${action.type}`);
        setError("An error occurred processing the action.");
        isProcessingAction.current = false; // Release lock
        return;
    }
    console.log(`[handleAction] Reducer finished. Next state phase: ${nextState.phase}, Player: ${nextState.currentPlayerIndex}`);

    // Persist the calculated state to Supabase BEFORE dispatching locally
    try {
        console.log(`[handleAction] Persisting state BEFORE dispatch for action ${action.type}. Phase: ${nextState.phase}, Player: ${nextState.currentPlayerIndex}`);
        await updateGameState(gameId, nextState); // Await the update
        console.log(`[handleAction] State persisted successfully for action ${action.type}.`);

        // Log the move AFTER successful state persistence
        // Avoid logging SET_GAME_STATE or INITIALIZE_GAME
        if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
            console.log(`[handleAction] Logging move ${action.type}...`);
            await logMove(gameId, action.payload.playerId, action.type, action.payload);
            console.log(`[handleAction] Move ${action.type} logged.`);
        }

        // Update local state ONLY after successful persistence
        console.log(`[handleAction] Dispatching SET_GAME_STATE with persisted state.`);
        dispatch({ type: 'SET_GAME_STATE', payload: nextState });
        setError(null); // Clear previous errors

    } catch (error) {
        console.error(`[handleAction] Failed to persist state or log move after action ${action.type}:`, error);
        setError("Failed to save game state or log move. Please check connection or try again.");
        // Do NOT dispatch if persistence failed
    } finally {
        // Clear selection after successful summon (regardless of persistence outcome?)
        // Maybe move this inside the try block after dispatch?
        if (action.type === 'SUMMON_KNOWLEDGE') {
            setSelectedKnowledgeId(null);
        }
        isProcessingAction.current = false; // Release lock in finally block
        console.log(`[handleAction] Finished processing action ${action.type}. Released lock.`);
    }

  }, [state, gameId, currentPlayerId, dispatch, setError, setSelectedKnowledgeId]); // Removed isProcessingAction from dependencies

  // --- Specific Action Handlers (Memoized) ---
  const handleRotateCreature = useCallback((creatureId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
  }, [currentPlayerId, handleAction]);

  const handleDrawKnowledge = useCallback((knowledgeId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId } });
  }, [currentPlayerId, handleAction]);

  const handleHandCardClick = useCallback((knowledgeId: string) => {
    setSelectedKnowledgeId(prevId => (prevId === knowledgeId ? null : knowledgeId));
  }, [setSelectedKnowledgeId]); // Only depends on the setter

  const handleCreatureClickForSummon = useCallback((creatureId: string) => {
    if (!currentPlayerId || !selectedKnowledgeId) return;
    handleAction({
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: currentPlayerId, knowledgeId: selectedKnowledgeId, creatureId }
    });
  }, [currentPlayerId, selectedKnowledgeId, handleAction]);

  const handleEndTurn = useCallback(() => {
    if (!currentPlayerId) return;
    handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
  }, [currentPlayerId, handleAction]);

  const cancelSelection = useCallback(() => {
    setSelectedKnowledgeId(null);
  }, [setSelectedKnowledgeId]);

  return {
    selectedKnowledgeId,
    handleRotateCreature,
    handleDrawKnowledge,
    handleHandCardClick,
    handleCreatureClickForSummon,
    handleEndTurn,
    cancelSelection,
  };
}