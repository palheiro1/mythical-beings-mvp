import { useCallback, useRef } from 'react';
import { GameState, GameAction } from '../game/types';
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

    const handleAction = useCallback(async (action: GameAction) => {
        if (action.type !== 'SET_GAME_STATE' && (!currentGameState || !currentPlayerId || !gameId)) {
            console.error("[handleAction] Cannot process action: Missing game state, player ID, or game ID.", { currentGameState, currentPlayerId, gameId, actionType: action.type });
            return;
        }

        if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
            if (!action.payload || !('playerId' in action.payload)) {
                console.error("[handleAction] Action is missing player payload:", action);
                return;
            }
        }

        // Allow END_TURN even if processing, otherwise block concurrent actions
        if (isProcessing.current && action.type !== 'SET_GAME_STATE' && action.type !== 'END_TURN') {
            console.warn(`[handleAction] Action ${action.type} blocked, another action is already processing.`);
            return;
        }

        console.log(`[handleAction] Received action: ${action.type}`, action.payload);
        if (action.type !== 'SET_GAME_STATE') {
            isProcessing.current = true;
        }

        try {
            if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
                if (!currentGameState) {
                    throw new Error("Cannot validate action without current game state.");
                }
                console.log(`[handleAction] Validating action ${action.type}...`);
                const validationResult = isValidAction(currentGameState, action);
                if (!validationResult.isValid) {
                    console.warn(`[handleAction] Action ${action.type} is invalid: ${validationResult.reason || 'No reason provided'}`);
                    isProcessing.current = false; // Reset processing state if action is invalid
                    return;
                }
                console.log(`[handleAction] Action ${action.type} is valid.`);
            }

            if (action.type !== 'SET_GAME_STATE') {
                if (!currentGameState) throw new Error("Cannot reduce action without current game state.");
                console.log(`[handleAction] Calculating next state locally for action ${action.type}...`);
                const nextState = gameReducer(currentGameState, action);

                if (!nextState) {
                    throw new Error("Reducer returned null state unexpectedly.");
                }
                console.log(`[handleAction] Local reducer finished. Next phase: ${nextState.phase}, Player: ${nextState.currentPlayerIndex}, Actions: ${nextState.actionsTakenThisTurn}`);

                console.log(`[handleAction] Persisting updated state to Supabase for action ${action.type}.`);
                const updateSuccessful = await updateGameState(gameId!, nextState);

                if (!updateSuccessful) {
                    console.error(`[handleAction] Failed to persist state update to Supabase for action ${action.type}. Local state might be ahead.`);
                } else {
                    console.log(`[handleAction] State successfully persisted for action ${action.type}.`);
                }
            } else {
                console.log(`[handleAction] Dispatching received SET_GAME_STATE.`);
                dispatch(action);
            }
        } catch (error) {
            console.error(`[handleAction] Error processing action ${action.type}:`, error);
        } finally {
            if (action.type !== 'SET_GAME_STATE') {
                isProcessing.current = false;
                console.log(`[handleAction] Finished processing action ${action.type}. isProcessing reset.`);
            }
        }
    }, [currentGameState, dispatch, currentPlayerId, gameId]);

    const handleRotateCreature = useCallback((creatureId: string) => {
        if (!currentPlayerId) return;
        const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } };
        handleAction(action);
    }, [handleAction, currentPlayerId]);

    const handleDrawKnowledge = useCallback((knowledgeId: string) => {
        if (!currentPlayerId) return;
        if (!currentGameState) return;
    const knowledgeCard = currentGameState.market.find(k => k.id === knowledgeId);
    if (!knowledgeCard || !knowledgeCard.instanceId) return;
    const action: GameAction = { 
      type: 'DRAW_KNOWLEDGE', 
      payload: { 
        playerId: currentPlayerId, 
        knowledgeId, 
        instanceId: knowledgeCard.instanceId 
      } 
    };
        handleAction(action);
    }, [handleAction, currentPlayerId]);

    const handleHandCardClick = useCallback((knowledgeId: string) => {
        console.log(`[Action] Hand knowledge clicked (handled by GameScreen): ${knowledgeId}`);
    }, []);

    const handleCreatureClickForSummon = useCallback((targetCreatureId: string) => {
        if (!currentPlayerId || !selectedKnowledgeId) {
            console.warn("[Action] Cannot summon: Missing player ID or selected knowledge card.");
            return;
        }
        const action: GameAction = {
            type: 'SUMMON_KNOWLEDGE',
            payload: {
                playerId: currentPlayerId,
                knowledgeId: selectedKnowledgeId,
                creatureId: targetCreatureId,
                instanceId: selectedKnowledgeId // Assuming selectedKnowledgeId is the instanceId
            }
        };
        handleAction(action);
    }, [handleAction, currentPlayerId, selectedKnowledgeId]);

    const handleEndTurn = useCallback(() => {
        if (!currentPlayerId) return;
        console.log("[handleEndTurn] Triggered (could be manual or timer)");
        const action: GameAction = { type: 'END_TURN', payload: { playerId: currentPlayerId } };
        handleAction(action);
    }, [handleAction, currentPlayerId]);

    return {
        handleRotateCreature,
        handleDrawKnowledge,
        handleHandCardClick,
        handleCreatureClickForSummon,
        handleEndTurn,
    };
}
