import { supabase, normalizeSession, PLAYHUB_GAME_ID, PLAYHUB_MODE_ID } from '../utils/supabaseClient.js';
import type { PlayHubSession, SessionParticipant, MatchDetails } from '../utils/supabaseClient.js';
import { getCardGameSessionState } from './gameStateService.js';

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

export async function createPlayHubSession(): Promise<PlayHubSession | null> {
  const { data, error } = await supabase.rpc('playhub_create_session', {
    p_game_id: PLAYHUB_GAME_ID,
    p_mode_id: PLAYHUB_MODE_ID,
  });

  if (error) {
    console.error('[playhub_create_session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return row ? normalizeSession(row as any) : null;
}

export async function joinPlayHubSession(code: string): Promise<PlayHubSession | null> {
  const { data, error } = await supabase.rpc('playhub_join_session', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error('[playhub_join_session] failed:', error);
    throw new Error(getPlayHubErrorMessage(error));
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return row ? normalizeSession(row as any) : null;
}

export async function leavePlayHubSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.rpc('playhub_leave_session', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[playhub_leave_session] failed:', error);
    return false;
  }

  return true;
}

export async function setPlayHubReady(sessionId: string, ready: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('playhub_set_ready', {
    p_session_id: sessionId,
    p_ready: ready,
  });

  if (error) {
    console.error('[playhub_set_ready] failed:', error);
    return false;
  }

  return true;
}

export async function startPlayHubSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.rpc('playhub_start_session', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[playhub_start_session] failed:', error);
    return false;
  }

  return true;
}

export async function finishPlayHubSession(sessionId: string, results: any[]): Promise<boolean> {
  const { error } = await supabase.rpc('playhub_finish_session', {
    p_session_id: sessionId,
    p_results: results,
  });

  if (error) {
    console.error('[playhub_finish_session] failed:', error);
    return false;
  }

  return true;
}

export async function getPlayHubSession(sessionId: string): Promise<PlayHubSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('id', sessionId)
    .eq('game_id', PLAYHUB_GAME_ID)
    .eq('mode_id', PLAYHUB_MODE_ID)
    .single();

  if (error) {
    console.error('[getPlayHubSession] failed:', error);
    return null;
  }

  const participants = await getSessionParticipants(sessionId);
  return normalizeSession(data as any, participants);
}

export async function getAvailableGames(): Promise<PlayHubSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('game_id', PLAYHUB_GAME_ID)
    .eq('mode_id', PLAYHUB_MODE_ID)
    .eq('status', 'waiting')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAvailableGames] failed:', error);
    return [];
  }

  return Promise.all((data ?? []).map(async (row: any) => normalizeSession(row, await getSessionParticipants(row.id))));
}

export async function getActiveGames(): Promise<PlayHubSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, code, status, game_id, mode_id, host_id, min_players, max_players, created_at, updated_at')
    .eq('game_id', PLAYHUB_GAME_ID)
    .eq('mode_id', PLAYHUB_MODE_ID)
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

// Backwards-compatible aliases used by older call sites.
export async function createGame(_gameId?: string, _player1Id?: string, _betAmount?: number): Promise<PlayHubSession | null> {
  return createPlayHubSession();
}

export async function joinGame(code: string, _player2Id?: string): Promise<PlayHubSession | null> {
  return joinPlayHubSession(code);
}
