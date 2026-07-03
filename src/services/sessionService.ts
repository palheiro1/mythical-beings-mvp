import {
  supabase,
  normalizeSession,
  PLAYHUB_COMPETITIVE_MODE_ID,
  PLAYHUB_GAME_ID,
  PLAYHUB_MODE_ID,
  PLAYHUB_STAKE_TIERS_GEM,
} from '../utils/supabaseClient.js';
import type { PlayHubSession, SessionParticipant, MatchDetails } from '../utils/supabaseClient.js';
import { getCardGameSessionState } from './gameStateService.js';
import { mythical } from './mythicalClient.js';

export type PlayHubCardGameMode = typeof PLAYHUB_MODE_ID | typeof PLAYHUB_COMPETITIVE_MODE_ID;

export async function getSessionParticipants(sessionId: string): Promise<SessionParticipant[]> {
  const { data, error } = await supabase
    .from('session_participants')
    .select('session_id, player_id, slot, is_ready, joined_at')
    .eq('session_id', sessionId)
    .order('slot', { ascending: true });

  if (error) {
    console.error('[getSessionParticipants] failed:', error);
    return [];
  }

  return (data ?? []) as SessionParticipant[];
}

function getPlayHubErrorMessage(error: any): string {
  const message = error?.message || 'Play Hub request failed.';

  if (message === 'Game mode is not available.') {
    return 'Game mode is not available. The Card Game casual mode is not registered or enabled in Play Hub.';
  }

  return message;
}

function normalizeStakeGem(stakeGem: string | number): string {
  const stake = String(stakeGem).trim();
  if (!(PLAYHUB_STAKE_TIERS_GEM as readonly string[]).includes(stake)) {
    throw new Error(`Unsupported GEM stake tier. Choose ${PLAYHUB_STAKE_TIERS_GEM.join(', ')} GEM.`);
  }
  return stake;
}

export async function createPlayHubSession(): Promise<PlayHubSession | null> {
  try {
    const session = await mythical.sessions.create();
    return normalizeSession(session as any);
  } catch (error) {
    console.error('[playhub_create_session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function joinPlayHubSession(code: string): Promise<PlayHubSession | null> {
  try {
    const session = await mythical.sessions.join({ code: code.trim().toUpperCase() });
    return normalizeSession(session as any);
  } catch (error) {
    console.error('[playhub_join_session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function createCompetitiveSession(stakeGem: string | number): Promise<PlayHubSession | null> {
  try {
    const session = await mythical.competition.createSession({ stakeGem: normalizeStakeGem(stakeGem) });
    return normalizeSession(session as any);
  } catch (error) {
    console.error('[card-game-create-competition-session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function joinCompetitiveSession(code: string): Promise<PlayHubSession | null> {
  try {
    const session = await mythical.competition.joinSession({ code: code.trim().toUpperCase() });
    return normalizeSession(session as any);
  } catch (error) {
    console.error('[card-game-join-competition-session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function getCompetitionStatus(sessionId: string) {
  try {
    return await mythical.competition.getStatus(sessionId);
  } catch (error) {
    console.error('[card-game-competition-status] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function depositCompetitionStake(sessionId: string) {
  try {
    return await mythical.competition.depositStake(sessionId);
  } catch (error) {
    console.error('[card-game-competition-deposit] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function lockCompetitiveCards(sessionId: string, selectedCardIds: string[]) {
  try {
    return await mythical.competition.lockCards(sessionId, selectedCardIds);
  } catch (error) {
    console.error('[card-game-competition-card-lock] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function settleCompetitionSession(sessionId: string) {
  try {
    return await mythical.competition.settle(sessionId);
  } catch (error) {
    console.error('[card-game-competition-settle] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }
}

export async function leavePlayHubSession(sessionId: string): Promise<boolean> {
  try {
    await mythical.sessions.leave(sessionId);
    return true;
  } catch (error) {
    console.error('[playhub_leave_session] failed:', error);
    return false;
  }
}

export async function setPlayHubReady(sessionId: string, ready: boolean): Promise<boolean> {
  try {
    await mythical.sessions.setReady(sessionId, ready);
    return true;
  } catch (error) {
    console.error('[playhub_set_ready] failed:', error);
    return false;
  }
}

export async function startPlayHubSession(sessionId: string): Promise<boolean> {
  try {
    await mythical.sessions.start(sessionId);
    return true;
  } catch (error) {
    console.error('[playhub_start_session] failed:', error);
    return false;
  }
}

export async function finishPlayHubSession(sessionId: string, results: any[]): Promise<boolean> {
  try {
    await mythical.sessions.finish({ sessionId, results });
    return true;
  } catch (error) {
    console.error('[playhub_finish_session] failed:', error);
    return false;
  }
}

export async function getPlayHubSession(sessionId: string): Promise<PlayHubSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('id', sessionId)
    .eq('game_id', PLAYHUB_GAME_ID)
    .single();

  if (error) {
    console.error('[getPlayHubSession] failed:', error);
    return null;
  }

  const participants = await getSessionParticipants(sessionId);
  return normalizeSession(data as any, participants);
}

export async function getAvailableGames(modeId: PlayHubCardGameMode = PLAYHUB_MODE_ID): Promise<PlayHubSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('game_id', PLAYHUB_GAME_ID)
    .eq('mode_id', modeId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAvailableGames] failed:', error);
    return [];
  }

  return Promise.all((data ?? []).map(async (row: any) => normalizeSession(row, await getSessionParticipants(row.id))));
}

export async function getActiveGames(modeId: PlayHubCardGameMode = PLAYHUB_MODE_ID): Promise<PlayHubSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('game_id', PLAYHUB_GAME_ID)
    .eq('mode_id', modeId)
    .eq('status', 'playing')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[getActiveGames] failed:', error);
    return [];
  }

  return Promise.all((data ?? []).map(async (row: any) => normalizeSession(row, await getSessionParticipants(row.id))));
}

export async function getGameDetails(sessionId: string): Promise<MatchDetails | null> {
  const session = await getPlayHubSession(sessionId);
  if (!session) return null;

  const cardState = await getCardGameSessionState(sessionId);
  const participants = session.participants ?? [];
  const player1 = participants.find((p) => p.slot === 0) ?? null;
  const player2 = participants.find((p) => p.slot === 1) ?? null;

  return {
    ...session,
    player1_id: player1?.player_id ?? null,
    player2_id: player2?.player_id ?? null,
    player1_selected_creatures: cardState?.selected_creatures?.['0'] ?? null,
    player2_selected_creatures: cardState?.selected_creatures?.['1'] ?? null,
    state: cardState?.state ?? null,
  };
}

export function subscribeToSession(
  sessionId: string,
  callback: (session: PlayHubSession) => void,
): import('../utils/supabase.js').RealtimeChannel {
  return supabase
    .channel(`playhub-session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      },
      async (payload: { new?: any }) => {
        if (payload.new) {
          callback(normalizeSession(payload.new, await getSessionParticipants(sessionId)));
        }
      },
    )
    .subscribe();
}

export function subscribeToParticipants(
  sessionId: string,
  callback: (participants: SessionParticipant[]) => void,
): import('../utils/supabase.js').RealtimeChannel {
  return supabase
    .channel(`playhub-participants-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        callback(await getSessionParticipants(sessionId));
      },
    )
    .subscribe();
}

export function subscribeToSessionLifecycle(
  sessionId: string,
  handlers: {
    onSessionChange?: (session: PlayHubSession) => void;
    onParticipantsChange?: (participants: SessionParticipant[]) => void;
    onError?: (error: unknown) => void;
  },
): import('../utils/supabase.js').RealtimeChannel {
  return mythical.sessions.subscribe(sessionId, {
    onSessionChange: async () => {
      const session = await getPlayHubSession(sessionId);
      if (session) handlers.onSessionChange?.(session);
    },
    onParticipantsChange: async () => {
      const participants = await getSessionParticipants(sessionId);
      handlers.onParticipantsChange?.(participants);
    },
    onError: handlers.onError,
  }) as unknown as import('../utils/supabase.js').RealtimeChannel;
}

// Backwards-compatible aliases used by older call sites.
export async function createGame(_gameId?: string, _player1Id?: string, _betAmount?: number): Promise<PlayHubSession | null> {
  return createPlayHubSession();
}

export async function joinGame(code: string, _player2Id?: string): Promise<PlayHubSession | null> {
  return joinPlayHubSession(code);
}
