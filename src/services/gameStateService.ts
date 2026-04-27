import { supabase } from '../utils/supabaseClient.js';
import type { CardGameSessionState, RealtimeChannel } from '../utils/supabaseClient.js';
import { GameState } from '../game/types.js';

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

export async function getCardGameSessionState(sessionId: string): Promise<CardGameSessionState | null> {
  const { data, error } = await supabase.rpc('card_game_get_session_state', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[card_game_get_session_state] failed:', error);
    return null;
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return normalizeCardGameState(row as any);
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

  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return normalizeCardGameState(row as any);
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

export async function unsubscribeFromGameState(channel: RealtimeChannel): Promise<void> {
  try {
    await channel.unsubscribe();
  } catch (error) {
    console.error('[Realtime] Error unsubscribing:', error);
  }
}
