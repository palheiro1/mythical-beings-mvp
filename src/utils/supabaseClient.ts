import { SupabaseClient, RealtimeChannel as SupabaseRealtimeChannel } from '@supabase/supabase-js';
import { GameState } from '../game/types.js';
import { playHubSupabase } from '../services/mythicalClient.js';

export type RealtimeChannel = SupabaseRealtimeChannel;

export {
  PLAYHUB_COMPETITIVE_MODE_ID,
  PLAYHUB_DEFAULT_STAKE_GEM,
  PLAYHUB_GAME_ID,
  PLAYHUB_JOINABLE_SESSION_TTL_MS,
  PLAYHUB_MODE_ID,
  PLAYHUB_SEASON_ID,
  PLAYHUB_WAITING_SESSION_TTL_MS,
} from '../config/playhub.js';

export const supabase: SupabaseClient = playHubSupabase as unknown as SupabaseClient;

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
  competition?: unknown;
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

export function normalizeProfile(row: any): ProfileInfo | null {
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

export function normalizeSession(row: any, participants?: SessionParticipant[]): PlayHubSession {
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
    competition: row.competition,
  };
}
