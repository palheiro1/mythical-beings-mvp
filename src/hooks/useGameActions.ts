import { useState } from 'react';
import { GameState, GameAction } from '../game/types';
import { isValidAction } from '../game/rules';
import { updateGameState, logMove } from '../utils/supabase';
// Assuming gameScreenReducer is accessible, e.g., exported from useGameInitialization or state management context
// For simplicity here, let's assume we pass the original state and reducer logic if needed,
// but ideally, this hook only constructs and validates actions before calling a central dispatcher.

// Re-import the reducer logic if needed for optimistic updates within the hook
import { gameReducer as originalGameReducer } from '../game/state'; // Adjust path if needed
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

  const handleAction = async (action: GameAction) => {
    if (!state || !gameId || !currentPlayerId) {
      console.error("Cannot handle action: State, gameId, or currentPlayerId missing.");
      return;
    }

    // Ensure payload has correct player ID (except for system actions)
    if ('payload' in action && typeof action.payload === 'object' && action.payload && 'playerId' in action.payload) {
        if (action.payload.playerId !== currentPlayerId) {
            console.warn("Action originated from wrong player context?", action);
            // return; // Optional: prevent action
        }
    } else if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
        console.error("Action payload missing playerId:", action);
        return;
    }

    if (!isValidAction(state, action)) {
      console.warn("Invalid action attempted:", action.type, action.payload);
      setError(`Invalid action: ${action.type}. Check game rules or state.`);
      setSelectedKnowledgeId(null); // Clear selection on invalid action
      return;
    }

    // Optimistic UI update
    const nextState = gameScreenReducer(state, action);
    if (!nextState) {
        console.error("Reducer returned null state after action:", action);
        setError("An error occurred processing the action.");
        return;
    }
    dispatch(action); // Update local state immediately

    // Persist state change and log move via Supabase
    try {
      const updateResult = await updateGameState(gameId, nextState);
      if (!updateResult) {
          throw new Error("Failed to update game state in Supabase.");
      }
      if ('payload' in action && action.payload) {
          await logMove(gameId, currentPlayerId, action.type, action.payload);
      }
      setError(null); // Clear previous errors
    } catch (err) {
      console.error('Error updating game state or logging move:', err);
      setError('Failed to sync game state. Please try again.');
      // TODO: Consider reverting optimistic update
      // dispatch({ type: 'SET_GAME_STATE', payload: state });
    }

    // Clear selection after successful summon
    if (action.type === 'SUMMON_KNOWLEDGE') {
        setSelectedKnowledgeId(null);
    }
  };

  // --- Specific Action Handlers ---
  const handleRotateCreature = (creatureId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
  };

  const handleDrawKnowledge = (knowledgeId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId } });
  };

  const handleHandCardClick = (knowledgeId: string) => {
    setSelectedKnowledgeId(knowledgeId);
    const cardName = state?.players[state.currentPlayerIndex].hand.find(k => k.id === knowledgeId)?.name;
    setError(`Selected ${cardName || 'card'}. Click a creature to summon onto.`);
  };

  const handleCreatureClickForSummon = (creatureId: string) => {
    if (!currentPlayerId || !selectedKnowledgeId) return;
    setError(null); // Clear selection prompt message
    handleAction({
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: currentPlayerId, knowledgeId: selectedKnowledgeId, creatureId }
    });
  };

  const handleEndTurn = () => {
    if (!currentPlayerId) return;
    handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
  };

  const cancelSelection = () => {
      setSelectedKnowledgeId(null);
      setError(null);
  };

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