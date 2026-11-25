import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { GameState, GameAction } from '../game/types.js';
import { gameReducer } from '../game/state.js';
import { isValidAction } from '../game/rules.js';

export function useLocalGameActions(
  currentGameState: GameState | null,
  setGameState: Dispatch<SetStateAction<GameState | null>>,
  currentPlayerId: string | null,
  selectedKnowledgeId: string | null,
  onAccepted?: (action: GameAction) => void
) {
  const isProcessing = useRef(false);
  const accepted = useRef<GameAction | null>(null);
  useEffect(() => {
    const action = accepted.current; accepted.current = null;
    if (action) onAccepted?.(action);
  }, [currentGameState, onAccepted]);

  const handleAction = useCallback((action: GameAction) => {
    if (action.type !== 'SET_GAME_STATE' && (!currentGameState || !currentPlayerId)) {
      console.warn('[LocalAction] Missing state or player.', { action });
      return;
    }
    if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
      if (!action.payload || !('playerId' in action.payload)) return;
    }
    if (isProcessing.current && action.type !== 'END_TURN') return;
    if (action.type !== 'SET_GAME_STATE') isProcessing.current = true;

    try {
      if (action.type === 'SET_GAME_STATE') {
        setGameState(action.payload as GameState);
        return;
      }

      // Use functional update to always compute from the latest state
      setGameState(prev => {
        if (!prev) return prev;
        if (action.type !== 'INITIALIZE_GAME') {
          const validation = isValidAction(prev, action);
          if (!validation.isValid) {
            console.warn('[LocalAction] Invalid:', action.type, validation.reason);
            return prev;
          }
        }
        const next = gameReducer(prev, action);
        if (next !== prev && ['ROTATE_CREATURE', 'DRAW_KNOWLEDGE', 'SUMMON_KNOWLEDGE', 'RESOLVE_PENDING_EFFECT'].includes(action.type)) accepted.current = action;
        return next;
      });
    } finally {
      if (action.type !== 'SET_GAME_STATE') isProcessing.current = false;
    }
  }, [currentGameState, currentPlayerId, setGameState]);

  const handleRotateCreature = useCallback((creatureId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
  }, [handleAction, currentPlayerId]);

  const handleDrawKnowledge = useCallback((knowledgeId: string) => {
    if (!currentPlayerId || !currentGameState) return;
    const card = currentGameState.market.find(k => k.id === knowledgeId);
    if (!card?.instanceId) return;
    handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId, instanceId: card.instanceId } });
  }, [handleAction, currentPlayerId, currentGameState]);

  const handleCreatureClickForSummon = useCallback((targetCreatureId: string) => {
    if (!currentPlayerId || !selectedKnowledgeId || !currentGameState) return;
    const player = currentGameState.players.find(p => p.id === currentPlayerId);
    if (!player) return;
    const selectedCard = player.hand.find(c => c.instanceId === selectedKnowledgeId);
    if (!selectedCard) return;
    handleAction({
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: currentPlayerId, knowledgeId: selectedCard.id, creatureId: targetCreatureId, instanceId: selectedKnowledgeId }
    });
  }, [handleAction, currentPlayerId, selectedKnowledgeId, currentGameState]);

  const handleEndTurn = useCallback(() => {
    if (!currentPlayerId) return;
    handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
  }, [handleAction, currentPlayerId]);

  return { handleAction, handleRotateCreature, handleDrawKnowledge, handleCreatureClickForSummon, handleEndTurn };
}
