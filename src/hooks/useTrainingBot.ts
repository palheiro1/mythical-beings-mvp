import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types.js';
import type { TrainingAction } from '../game/trainingSession.js';
import { BOT_ID } from '../game/trainingSession.js';
import { getEffectiveCreatureWisdom } from '../game/utils.js';
import { isValidAction } from '../game/rules.js';

/** The existing solo policy: rotate once, play the first affordable card or draw, then end. */
export function useTrainingBot(game: GameState, onAction: (action: TrainingAction) => void) {
  const plan = useRef({ turn: -1, stage: 0 });
  useEffect(() => {
    if (game.phase === 'gameOver') return;
    if (game.pendingEffect?.playerId === BOT_ID) {
      const pending = game.pendingEffect;
      const timeout = window.setTimeout(() => onAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: BOT_ID,
        resolution: pending.optional ? { effectId: pending.id, skip: true } : { effectId: pending.id, choice: pending.choices[0] },
      } }), 450);
      return () => window.clearTimeout(timeout);
    }
    if (game.pendingEffect || game.phase !== 'action' || game.players[game.currentPlayerIndex].id !== BOT_ID) return;
    if (plan.current.turn !== game.turn) plan.current = { turn: game.turn, stage: 0 };
    const timeout = window.setTimeout(() => {
      const bot = game.players[game.currentPlayerIndex];
      if (plan.current.stage === 0) {
        plan.current.stage = 1;
        const creature = bot.creatures.find(card => (card.rotation ?? 0) < 270);
        if (creature) { onAction({ type: 'ROTATE_CREATURE', payload: { playerId: BOT_ID, creatureId: creature.id } }); return; }
      }
      if (plan.current.stage === 1) {
        plan.current.stage = 2;
        const target = bot.field.flatMap(slot => {
          const card = bot.hand.find(item => getEffectiveCreatureWisdom(game, game.currentPlayerIndex, slot.creatureId) >= item.cost);
          return card ? [{ creatureId: slot.creatureId, card }] : [];
        })[0];
        const card = game.market[0];
        const action: TrainingAction | null = target ? { type: 'SUMMON_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: target.card.id, instanceId: target.card.instanceId!, creatureId: target.creatureId } } : card ? { type: 'DRAW_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: card.id, instanceId: card.instanceId! } } : null;
        if (action && isValidAction(game, action).isValid) { onAction(action); return; }
      }
      onAction({ type: 'END_TURN', payload: { playerId: BOT_ID } });
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [game, onAction]);
}
