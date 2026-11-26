import type { Database } from '@mythicalb/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mythical } from './mythicalClient.js';

export type Seat = 0 | 1;
export type DuelKind = 'casual' | 'weekly' | 'league' | 'wager';
export const duelKindNames: Record<DuelKind, string> = {
  casual: 'Casual duel', weekly: 'Weekly Challenge', league: 'League duel', wager: 'Wager duel',
};

export interface LiveDuel {
  match_id: string;
  kind: DuelKind;
  started_at: string;
  turn_number: number;
  paused: boolean;
}
export interface PublicCard { id: string; rotation: number; wisdom?: number }
export interface SpectatorSide {
  power: number;
  handCount: number;
  creatures: PublicCard[];
  field: Array<{ creatureId: string; knowledge: PublicCard | null }>;
}
export interface WatchedDuel {
  matchId: string;
  version: number;
  kind: DuelKind;
  status: 'playing' | 'suspended' | 'finished';
  turn: number;
  phase: string;
  currentSeat: Seat;
  choosing: boolean;
  actionsLeft: number;
  actionsPerTurn: number;
  players: [SpectatorSide, SpectatorSide];
  market: PublicCard[];
  discard: PublicCard[];
  deckCount: number;
  clock: { remainingMs: [number, number]; runningSeat: Seat | null; updatedAt: string };
  outcome: { winner: Seat | null; reason: string } | null;
  events: Array<{ sequence: number; seat: Seat | null; kind: string; creatureId: string | null }>;
  serverNow: string;
}

type WatchDatabase = Database & { public: { Functions: {
  wisdom_duel_live_matches: { Args: Record<string, never>; Returns: LiveDuel[] };
  wisdom_duel_watch_match: { Args: { p_match_id: string }; Returns: WatchedDuel | null };
} } };
const client = mythical.supabase as SupabaseClient<WatchDatabase>;
export const LIVE_PAGE_SIZE = 12;

export async function listLiveDuels(offset: number): Promise<LiveDuel[]> {
  const { data, error } = await client.rpc('wisdom_duel_live_matches', {})
    .order('started_at', { ascending: false }).order('match_id').range(offset, offset + LIVE_PAGE_SIZE);
  if (error) throw error;
  return data ?? [];
}

export async function readWatchedDuel(matchId: string): Promise<WatchedDuel | null> {
  const { data, error } = await client.rpc('wisdom_duel_watch_match', { p_match_id: matchId });
  if (error) throw error;
  return data;
}

export function subscribeToSpectators(topic: string, refresh: () => void) {
  const channel = client.channel(topic)
    .on('broadcast', { event: 'changed' }, refresh)
    .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
  return () => { void client.removeChannel(channel); };
}
