import { useCallback, useRef } from 'react';
import { GameState, GameAction, ActionType, PlayerAction } from '../game/types';
import { gameReducer } from '../game/state';
import { updateGameState } from '../utils/supabase';
import { isValidAction } from '../game/rules';

export function useGameActions(
    currentGameState: GameState | null,
    gameId: string | null,
    dispatch: React.Dispatch<GameAction>,
    currentPlayerId: string | null,
    selectedKnowledgeId: string | null
): {
    handleRotateCreature: (creatureId: string) => void;
    handleDrawKnowledge: (knowledgeId: string) => void;
    handleHandCardClick: (knowledgeId: string) => void;
    handleCreatureClickForSummon: (targetCreatureId: string) => void;
    handleEndTurn: () => void;
} {
    const isProcessing = useRef(false);

    const handleAction = useCallback(async (action: PlayerAction) => {
        if (!currentGameState || !currentPlayerId || !gameId) {
            console.error("[handleAction] Cannot process action: Missing game state, player ID, or game ID.", { currentGameState, currentPlayerId, gameId });
            return;
        }

        if (isProcessing.current) {
            console.warn(`[handleAction] Action ${action.type} blocked, another action is already processing.`);
            return;
        }

        console.log(`[handleAction] Received action: ${action.type}`, action.payload);
        isProcessing.current = true;

        try {
            console.log(`[handleAction] Validating action ${action.type}...`);
            const validationResult = isValidAction(currentGameState, action, currentPlayerId);
            if (!validationResult.isValid) {
                console.warn(`[handleAction] Action ${action.type} is invalid: ${validationResult.reason}`);
                return;
            }
            console.log(`[handleAction] Action ${action.type} is valid.`);

            console.log(`[handleAction] Calculating next state for action ${action.type}...`);
            const nextState = gameReducer(currentGameState, action);
            console.log(`[handleAction] Reducer finished. Next state phase: ${nextState?.phase}, Player: ${nextState?.currentPlayerIndex}`);

            if (!nextState) {
                throw new Error("Reducer returned null state.");
            }

            console.log(`[handleAction] Persisting state BEFORE dispatch for action ${action.type}. Phase: ${nextState.phase}, Player: ${nextState.currentPlayerIndex}`);
            const updateSuccessful = await updateGameState(gameId, nextState);

            if (!updateSuccessful) {
                console.error(`[handleAction] Failed to persist state update to Supabase for action ${action.type}.`);
            } else {
                console.log(`[handleAction] State successfully persisted for action ${action.type}.`);
            }

            console.log(`[handleAction] Dispatching local state update for action ${action.type}.`);
            dispatch(action);

        } catch (error) {
            console.error(`[handleAction] Error processing action ${action.type}:`, error);
        } finally {
            isProcessing.current = false;
            console.log(`[handleAction] Finished processing action ${action.type}. isProcessing reset.`);
        }
    }, [currentGameState, dispatch, currentPlayerId, gameId]);

    const handleRotateCreature = useCallback((creatureId: string) => {
        if (!currentPlayerId) return;
        handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
    }, [handleAction, currentPlayerId]);

    const handleDrawKnowledge = useCallback((knowledgeId: string) => {
        if (!currentPlayerId) return;
        handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId } });
    }, [handleAction, currentPlayerId]);

    const handleHandCardClick = useCallback((knowledgeId: string) => {
        console.log(`[Action] Hand knowledge clicked (handled by GameScreen): ${knowledgeId}`);
    }, []);

    const handleCreatureClickForSummon = useCallback((targetCreatureId: string) => {
        if (!currentPlayerId || !selectedKnowledgeId) {
            console.warn("[Action] Cannot summon: Missing player ID or selected knowledge card.");
            return;
        }
        handleAction({
            type: 'SUMMON_CREATURE',
            payload: {
                playerId: currentPlayerId,
                knowledgeCardId: selectedKnowledgeId,
                targetCreatureId: targetCreatureId,
            }
        });
    }, [handleAction, currentPlayerId, selectedKnowledgeId]);

    const handleEndTurn = useCallback(() => {
        if (!currentPlayerId) return;
        handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
    }, [handleAction, currentPlayerId]);

    return {
        handleRotateCreature,
        handleDrawKnowledge,
        handleHandCardClick,
        handleCreatureClickForSummon,
        handleEndTurn,
    };
}