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
  joinPlayHubSession,
  leavePlayHubSession,
  setPlayHubReady,
  startPlayHubSession,
  finishPlayHubSession,
  getSessionParticipants,
  getPlayHubSession,
  getAvailableGames,
  getActiveGames,
  getGameDetails,
  subscribeToSession,
  subscribeToParticipants,
  createGame,
  joinGame,
} from '../services/sessionService.js';

export {
  getCardGameSessionState,
  setCardGameSelection,
  getGameState,
  updateGameState,
  subscribeToGameState,
  unsubscribeFromGameState,
} from '../services/gameStateService.js';

export {
  recordGameOutcomeAndUpdateStats,
  logMove,
} from '../services/statsService.js';
