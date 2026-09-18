import { gameReducer, initializeGame } from './state.js';
import { createGameRandomState } from './random.js';
import { isValidAction, type RuleValidationResult } from './rules.js';
import type { GameAction, GameState } from './types.js';
import { GUIDED_TEAM, type TrainingMode } from '../utils/trainingMode.js';

export const HUMAN_ID = 'local-player';
export const BOT_ID = 'bot';
export const BOT_TEAM = ['adaro', 'lisovik', 'kappa'];
export type GuideStep = 'welcome' | 'draw' | 'rotate' | 'watch' | 'summon' | 'end' | 'complete' | 'handoff' | 'free';
export type TrainingAction = Exclude<GameAction, { type: 'SET_GAME_STATE' | 'INITIALIZE_GAME' }>;
export interface TrainingSession {
  game: GameState;
  guide: GuideStep;
  selectedId: string | null;
  feedback: string;
  rejected: boolean;
  humanActions: number;
  resigned: boolean;
  tutorialCompleted: boolean;
}
export type TrainingEvent =
  | { type: 'play'; action: TrainingAction }
  | { type: 'select'; instanceId: string | null }
  | { type: 'start-guide' | 'skip-guide' | 'continue' | 'resign' };

/** A prepared, reproducible practice deal; every subsequent move uses the real rules. */
export function createTrainingSession(team: string[], mode: TrainingMode, gameId: string): TrainingSession {
  const game = initializeGame({
    gameId, player1Id: HUMAN_ID, player2Id: BOT_ID,
    player1SelectedIds: mode === 'guided' ? GUIDED_TEAM : team,
    player2SelectedIds: BOT_TEAM,
  }, mode === 'guided' ? createGameRandomState('42'.repeat(32)) : undefined);
  if (mode === 'guided') {
    const marketIndex = game.market.findIndex(card => card.id === 'aerial1');
    if (marketIndex >= 0) {
      [game.market[0], game.market[marketIndex]] = [game.market[marketIndex], game.market[0]];
    } else {
      const deckIndex = game.knowledgeDeck.findIndex(card => card.id === 'aerial1');
      if (deckIndex < 0) throw new Error('Tutorial card is missing from the catalog.');
      [game.market[0], game.knowledgeDeck[deckIndex]] = [game.knowledgeDeck[deckIndex], game.market[0]];
    }
  }
  return { game, guide: mode === 'guided' ? 'welcome' : 'free', selectedId: null,
    feedback: '', rejected: false, humanActions: 0, resigned: false, tutorialCompleted: false };
}

export function validateTrainingAction(session: TrainingSession, action: TrainingAction): RuleValidationResult {
  const validation = isValidAction(session.game, action);
  if (!validation.isValid) return validation;
  if (action.payload.playerId !== HUMAN_ID || session.guide === 'free' || action.type === 'RESOLVE_PENDING_EFFECT') return validation;
  const allowed =
    (session.guide === 'draw' && action.type === 'DRAW_KNOWLEDGE' && action.payload.knowledgeId === 'aerial1') ||
    (session.guide === 'rotate' && action.type === 'ROTATE_CREATURE' && action.payload.creatureId === 'tarasca') ||
    (session.guide === 'summon' && action.type === 'SUMMON_KNOWLEDGE' && action.payload.creatureId === 'tarasca' && action.payload.knowledgeId === 'aerial1') ||
    (session.guide === 'end' && action.type === 'END_TURN');
  return allowed ? validation : { isValid: false, reason: 'Follow the highlighted lesson action, or skip the tutorial to practise freely.' };
}

export function trainingSessionReducer(session: TrainingSession, event: TrainingEvent): TrainingSession {
  if (event.type === 'start-guide') return session.guide === 'welcome' ? { ...session, guide: 'draw' } : session;
  if (event.type === 'skip-guide') return { ...session, guide: 'handoff', selectedId: null, feedback: '', rejected: false };
  if (event.type === 'continue') return { ...session, guide: 'free', feedback: '', rejected: false };
  if (event.type === 'select') {
    const card = session.game.players[0].hand.find(item => item.instanceId === event.instanceId);
    if (event.instanceId && !card) return session;
    if (session.guide !== 'free' && event.instanceId && !(session.guide === 'summon' && card?.id === 'aerial1')) return session;
    return { ...session, selectedId: session.selectedId === event.instanceId ? null : event.instanceId, feedback: '', rejected: false };
  }
  if (session.game.phase === 'gameOver') return session;
  if (event.type === 'resign') return { ...session, resigned: true, selectedId: null,
    game: { ...session.game, winner: BOT_ID, phase: 'gameOver', pendingEffect: null,
      log: [...session.game.log, 'You conceded the practice match.'] } };

  if (event.type !== 'play') return session;
  const validation = validateTrainingAction(session, event.action);
  if (!validation.isValid) return { ...session, feedback: validation.reason || 'That action is not available.', rejected: true };
  const game = gameReducer({ ...session.game, presentationCues: [] }, event.action);
  if (!game || game === session.game) return session;
  const human = event.action.payload.playerId === HUMAN_ID;
  let guide = session.guide;
  if (human) {
    if (guide === 'draw' && event.action.type === 'DRAW_KNOWLEDGE') guide = 'rotate';
    else if (guide === 'rotate' && event.action.type === 'ROTATE_CREATURE') guide = 'watch';
    else if (guide === 'summon' && event.action.type === 'SUMMON_KNOWLEDGE') guide = 'end';
    else if (guide === 'end' && event.action.type === 'END_TURN') guide = 'complete';
  }
  if (guide === 'watch' && game.currentPlayerIndex === 0 && game.phase === 'action') guide = 'summon';
  const clearSelection = human && ['SUMMON_KNOWLEDGE', 'DRAW_KNOWLEDGE', 'END_TURN'].includes(event.action.type);
  return { ...session, game, guide, rejected: false, feedback: '',
    selectedId: clearSelection ? null : session.selectedId,
    humanActions: session.humanActions + (human && event.action.type !== 'END_TURN' ? 1 : 0),
    tutorialCompleted: session.tutorialCompleted || (session.guide === 'end' && guide === 'complete'),
  };
}
