/**
 * supabase.ts — Barrel re-export file.
 *
 * All call sites continue importing from this path.
 * Implementation is split across:
 *   src/utils/supabaseClient.ts  — client, constants, types, normalizers
 *   src/services/profileService.ts
 *   src/services/sessionService.ts
 *   src/services/gameStateService.ts
 *   src/services/statsService.ts
 */

export * from '../utils/supabaseClient.js';

export {
  getOrCreatePlayHubProfile,
  getProfile,
  updateProfile,
  uploadAvatar,
} from '../services/profileService.js';

export {
  createPlayHubSession,
  createCompetitiveSession,
  joinPlayHubSession,
  joinCompetitiveSession,
  leavePlayHubSession,
  setPlayHubReady,
  startPlayHubSession,
  finishPlayHubSession,
  getCompetitionStatus,
  depositCompetitionStake,
  lockCompetitiveCards,
  settleCompetitionSession,
  getSessionParticipants,
  getPlayHubSession,
  getAvailableGames,
  getActiveGames,
  getGameDetails,
  subscribeToSession,
  subscribeToParticipants,
  subscribeToSessionLifecycle,
  createGame,
  joinGame,
} from '../services/sessionService.js';

export {
  getCardGameSessionState,
  setCardGameSelection,
  getGameState,
  getPublicGameState,
  updateGameState,
  subscribeToGameState,
  unsubscribeFromGameState,
} from '../services/gameStateService.js';

export {
  COMPETITION_SETTLEMENT_EVENT,
  getPendingCompetitionSettlement,
  retryCompetitionSettlement,
  recordGameOutcomeAndUpdateStats,
  logMove,
} from '../services/statsService.js';

export type { CompetitionSettlementNotice } from '../services/statsService.js';
