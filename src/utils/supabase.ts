import { createClient, SupabaseClient, RealtimeChannel as SupabaseRealtimeChannel } from '@supabase/supabase-js';
import { GameState } from '../game/types.js';

export type RealtimeChannel = SupabaseRealtimeChannel;

export const PLAYHUB_GAME_ID = 'card_game';
export const PLAYHUB_MODE_ID = 'casual';
export const PLAYHUB_SEASON_ID = 'card_game_casual_season_1';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not set. Please check your .env.local file.');
}
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not set. Please check your .env.local file.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type PlayHubSessionStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';

export interface ProfileInfo {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_guest?: boolean | null;
}

export interface SessionParticipant {
  session_id: string;
  player_id: string;
  slot: number;
  is_ready: boolean;
  joined_at?: string | null;
}

export interface PlayHubSession {
  id: string;
  code: string;
  status: PlayHubSessionStatus;
  game_id: string;
  mode_id: string;
  host_id: string;
  min_players: number;
  max_players: number;
  created_at: string;
  updated_at?: string | null;
  participants?: SessionParticipant[];
}

export interface CardGameSessionState {
  session_id: string;
  dealt_hands: Record<string, string[]>;
  selected_creatures: Record<string, string[]>;
  state: GameState | null;
  created_at: string;
  updated_at: string;
}

export interface MatchDetails extends PlayHubSession {
  player1_id: string | null;
  player2_id: string | null;
  player1_selected_creatures?: string[] | null;
  player2_selected_creatures?: string[] | null;
  state?: GameState | null;
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function normalizeProfile(row: any): ProfileInfo | null {
  if (!row) return null;
  const displayName = row.display_name ?? row.username ?? null;
  return {
    id: row.id,
    username: displayName,
    display_name: displayName,
    avatar_url: row.avatar_url ?? null,
    is_guest: row.is_guest ?? null,
  };
}

function normalizeSession(row: any, participants?: SessionParticipant[]): PlayHubSession {
  return {
    id: row.session_id ?? row.id,
    code: row.session_code ?? row.code,
    status: row.session_status ?? row.status,
    game_id: row.game_id,
    mode_id: row.mode_id,
    host_id: row.host_id,
    min_players: row.min_players,
    max_players: row.max_players,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    participants,
  };
}

function normalizeCardGameState(row: any): CardGameSessionState | null {
  if (!row) return null;
  return {
    session_id: row.session_id,
    dealt_hands: (row.dealt_hands ?? {}) as Record<string, string[]>,
    selected_creatures: (row.selected_creatures ?? {}) as Record<string, string[]>,
    state: (row.state ?? null) as GameState | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isFullGameState(value: unknown): value is GameState {
  const state = value as GameState | null;
  return Boolean(state && typeof state === 'object' && state.phase && state.players && state.gameId);
}

export async function getOrCreatePlayHubProfile(displayName?: string | null): Promise<ProfileInfo | null> {
  const { data, error } = await supabase.rpc('playhub_get_or_create_profile', {
    p_display_name: displayName ?? null,
  });

  if (error) {
    console.error('[playhub_get_or_create_profile] failed:', error);
    return null;
  }

  return normalizeProfile(firstRow(data as any));
}

export async function createPlayHubSession(): Promise<PlayHubSession | null> {
  const { data, error } = await supabase.rpc('playhub_create_session', {
    p_game_id: PLAYHUB_GAME_ID,
    p_mode_id: PLAYHUB_MODE_ID,
  });

  if (error) {
    console.error('[playhub_create_session] failed:', error);
    return null;
  }

  const row = firstRow(data as any);
  return row ? normalizeSession(row) : null;
}

export async function joinPlayHubSession(code: string): Promise<PlayHubSession | null> {
  const { data, error } = await supabase.rpc('playhub_join_session', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error('[playhub_join_session] failed:', error);
    return null;
  }

  const row = firstRow(data as any);
  return row ? normalizeSession(row) : null;
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
  return normalizeSession(data, participants);
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

export async function getCardGameSessionState(sessionId: string): Promise<CardGameSessionState | null> {
  const { data, error } = await supabase.rpc('card_game_get_session_state', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[card_game_get_session_state] failed:', error);
    return null;
  }

  return normalizeCardGameState(firstRow(data as any));
}

export async function setCardGameSelection(sessionId: string, selectedCreatures: string[]): Promise<CardGameSessionState | null> {
  const { data, error } = await supabase.rpc('card_game_set_selection', {
    p_session_id: sessionId,
    p_selected_creatures: selectedCreatures,
  });

  if (error) {
    console.error('[card_game_set_selection] failed:', error);
    return null;
  }

  return normalizeCardGameState(firstRow(data as any));
}

export async function getGameState(sessionId: string): Promise<GameState | null> {
  const cardState = await getCardGameSessionState(sessionId);
  return isFullGameState(cardState?.state) ? cardState.state : null;
}

export async function updateGameState(sessionId: string, newState: GameState): Promise<boolean> {
  const { error } = await supabase.rpc('card_game_set_state', {
    p_session_id: sessionId,
    p_state: newState,
  });

  if (error) {
    console.error('[card_game_set_state] failed:', error);
    return false;
  }

  return true;
}

export async function getProfile(userId: string): Promise<ProfileInfo | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_guest')
      .eq('id', userId)
      .single();

    if (!error) return normalizeProfile(data);

    console.warn('[getProfile] display_name lookup failed, trying legacy username:', error.message);
    const legacy = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .single();

    if (legacy.error) {
      console.error('[getProfile] failed:', legacy.error);
      return null;
    }

    return normalizeProfile(legacy.data);
  } catch (error) {
    console.error('[getProfile] unexpected failure:', error);
    return null;
  }
}

export async function updateProfile(
  userId: string,
  updates: { username?: string; avatar_url?: string },
): Promise<ProfileInfo | null> {
  const payload = {
    display_name: updates.username,
    avatar_url: updates.avatar_url,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, display_name, avatar_url, is_guest')
    .single();

  if (!error) return normalizeProfile(data);

  console.warn('[updateProfile] display_name update failed, trying legacy username:', error.message);
  const legacy = await supabase
    .from('profiles')
    .update({
      username: updates.username,
      avatar_url: updates.avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, username, avatar_url')
    .single();

  if (legacy.error) {
    console.error('[updateProfile] failed:', legacy.error);
    return null;
  }

  return normalizeProfile(legacy.data);
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data?.publicUrl ?? null;
  } catch (error) {
    console.error('[uploadAvatar] failed:', error);
    return null;
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(999, Math.round(value)));
}

export async function recordGameOutcomeAndUpdateStats(
  sessionId: string,
  winnerId: string | null,
  player1Id: string,
  player2Id: string,
  gameState?: GameState | null,
): Promise<void> {
  const { data: authData } = await supabase.auth.getSession();
  const currentUserId = authData.session?.user?.id;
  if (!currentUserId) return;

  const session = await getPlayHubSession(sessionId);
  if (!session || session.status !== 'playing') return;
  if (session.host_id !== currentUserId) {
    console.log('[recordGameOutcome] Skipping finish: only host finalizes Play Hub sessions.');
    return;
  }

  const participants = (session.participants ?? []).slice().sort((a, b) => a.slot - b.slot);
  if (participants.length !== 2) {
    console.error('[recordGameOutcome] Cannot finish: expected exactly two human participants.', participants);
    return;
  }

  const powerByPlayer = new Map<string, number>();
  gameState?.players?.forEach((player) => powerByPlayer.set(player.id, clampScore(player.power)));

  const isDraw = winnerId === null;
  const results = participants.map((participant) => {
    const isWinner = !isDraw && participant.player_id === winnerId;
    const rank = isDraw ? participant.slot + 1 : (isWinner ? 1 : 2);
    const score = isDraw ? 0 : clampScore(powerByPlayer.get(participant.player_id) ?? (isWinner ? 1 : 0));

    return {
      player_id: participant.player_id,
      rank,
      score,
      result_payload: {
        outcome: isDraw ? 'draw' : (isWinner ? 'win' : 'loss'),
        slot: participant.slot,
        reported_by: currentUserId,
        player1_id: player1Id,
        player2_id: player2Id,
      },
    };
  });

  const finished = await finishPlayHubSession(sessionId, results);
  if (finished) {
    console.log('[recordGameOutcome] Play Hub session finished:', sessionId);
  }
}

export async function logMove(_sessionId: string, _playerId: string, _action: string, _payload: any): Promise<void> {
  // The Play Hub core persists authoritative results only. Detailed move logs remain in GameState.log.
}

export function subscribeToGameState(
  sessionId: string,
  callback: (newState: GameState) => void,
  subscriberId?: string,
): RealtimeChannel {
  const channelName = `card-game-state-${sessionId}`;
  const subIdForLog = subscriberId || 'UnknownSubscriber';
  console.log(`[Realtime] ${subIdForLog} subscribing to ${channelName}`);

  return supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'card_game_session_state',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: { new?: { state?: GameState | null } }) => {
        if (payload.new?.state && isFullGameState(payload.new.state)) {
          callback(payload.new.state);
        }
      },
    )
    .subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] ${subIdForLog} subscribed to card_game_session_state ${sessionId}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Realtime] ${subIdForLog} subscription error for ${sessionId}:`, err || status);
      }
    });
}

export function subscribeToSession(
  sessionId: string,
  callback: (session: PlayHubSession) => void,
): RealtimeChannel {
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
): RealtimeChannel {
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

export async function unsubscribeFromGameState(channel: RealtimeChannel): Promise<void> {
  try {
    await channel.unsubscribe();
  } catch (error) {
    console.error('[Realtime] Error unsubscribing:', error);
  }
}

// Backwards-compatible names used by older call sites during the migration.
export async function createGame(_gameId?: string, _player1Id?: string, _betAmount?: number): Promise<PlayHubSession | null> {
  return createPlayHubSession();
}

export async function joinGame(code: string, _player2Id?: string): Promise<PlayHubSession | null> {
  return joinPlayHubSession(code);
}
