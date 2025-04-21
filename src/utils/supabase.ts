import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameState } from '../game/types'; // Assuming types.ts is in ../game/

// Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://layijhifboyouicxsunq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxheWlqaGlmYm95b3VpY3hzdW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MTcwMzgsImV4cCI6MjA2MDI5MzAzOH0.JXnxYMvDdXHAab2b0TQiDTqf7mBfgs0-OlR4UwU1_E0';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Basic Supabase Functions --- 

/**
 * Creates a new game entry in the 'games' table.
 * @param player1Id ID of player 1.
 * @param player2Id ID of player 2 (can be null initially if waiting for opponent).
 * @param initialState The initial GameState object.
 * @returns The newly created game data or null on error.
 */
export async function createGame(gameId: string, player1Id: string, player2Id: string | null, initialState: GameState): Promise<any | null> {
  try {
    console.log('[createGame] Attempting to save initial state with phase:', initialState.phase);
    const { data, error } = await supabase
      .from('games')
      .insert([{
        id: gameId,
        player1_id: player1Id,
        player2_id: player2Id,
        state: initialState, // Save the state that already went through executeKnowledgePhase
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    console.log('[createGame] Successfully saved initial state. Returned data:', data);
    // It might be redundant to call updateGameState immediately after insert
    // but we'll leave it for now unless it causes issues.
    // await updateGameState(data.id, initialState); 
    return data;
  } catch (error) {
    console.error('Error creating game:', error);
    return null;
  }
}

/**
 * Allows a player to join an existing game.
 * Updates the player2_id in the 'games' table.
 * @param gameId The ID of the game to join.
 * @param player2Id The ID of the player joining.
 * @returns The updated game data or null on error.
 */
export async function joinGame(gameId: string, player2Id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('games')
      .update({ player2_id: player2Id, updated_at: new Date().toISOString() })
      .eq('id', gameId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error joining game:', error);
    return null;
  }
}

/**
 * Fetches the latest game state from the 'games' table.
 * @param gameId The ID of the game.
 * @returns The latest GameState object or null on error.
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
   try {
    // For MVP, maybe fetch directly from 'games' table if state is stored there
    const { data, error } = await supabase
      .from('games') 
      .select('state')
      .eq('id', gameId)
      .single();

    // // Or fetch from 'game_states' if using that table primarily
    // const { data, error } = await supabase
    //   .from('game_states')
    //   .select('state')
    //   .eq('game_id', gameId)
    //   .order('updated_at', { ascending: false })
    //   .limit(1)
    //   .single();

    if (error && error.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
        throw error;
    }
    const fetchedState = data?.state as GameState || null;
    console.log('[getGameState] Fetched state phase:', fetchedState?.phase);
    return fetchedState;
  } catch (error) {
    console.error('Error fetching game state:', error);
    return null;
  }
}

/**
 * Updates the game state in the 'games' table (or inserts into 'game_states').
 * @param gameId The ID of the game.
 * @param newState The new GameState object.
 * @returns The result of the update operation.
 */
export async function updateGameState(gameId: string, newState: GameState): Promise<any | null> {
  try {
    console.log(`[updateGameState] Attempting to save state for turn ${newState.turn}, phase: ${newState.phase}`);
    // Update the state directly in the 'games' table for MVP simplicity
    const { data, error } = await supabase
      .from('games')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('id', gameId)
      .select()
      .single();

    // // Or insert into 'game_states' table
    // const { data, error } = await supabase
    //   .from('game_states')
    //   .insert([{ 
    //     game_id: gameId, 
    //     turn: newState.turn, 
    //     state: newState 
    //   }]);

    if (error) throw error;
    console.log(`[updateGameState] Successfully saved state for turn ${newState.turn}, phase: ${newState.phase}`);
    return data;
  } catch (error) {
    console.error('Error updating game state:', error);
    return null;
  }
}

/**
 * Logs a player's move to the 'moves' table.
 * @param gameId The ID of the game.
 * @param playerId The ID of the player making the move.
 * @param action The action type (e.g., 'ROTATE_CREATURE').
 * @param payload The action payload.
 */
export async function logMove(gameId: string, playerId: string, action: string, payload: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('moves')
      .insert([{ 
        game_id: gameId, 
        player_id: playerId, 
        action: action, // Ensure this is 'action'
        payload: payload 
      }]);
    if (error) throw error;
  } catch (error) {
    console.error('Error logging move:', error);
  }
}

// --- Realtime Subscription --- 

/**
 * Subscribes to real-time updates for a specific game's state.
 * @param gameId The ID of the game to subscribe to.
 * @param callback Function to call when a state update is received.
 * @returns The Supabase subscription channel.
 */
export function subscribeToGameState(gameId: string, callback: (newState: GameState) => void): any {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => {
        console.log('[subscribeToGameState] Realtime UPDATE received:', payload);
        if (payload.new && payload.new.state) {
          callback(payload.new.state as GameState);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to game ${gameId} updates!`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Subscription error for game ${gameId}:`, err || status);
      } else {
        console.log(`Subscription status for game ${gameId}:`, status);
      }
    });

  return channel;
}

/**
 * Unsubscribes from real-time game state updates.
 * @param subscription The Supabase subscription channel to unsubscribe from.
 */
export async function unsubscribeFromGameState(subscription: any): Promise<void> {
  if (subscription) {
    try {
      await supabase.removeChannel(subscription);
      console.log('Unsubscribed from game updates.');
    } catch (error) {
      console.error('Error unsubscribing from game updates:', error);
    }
  }
}

// Reminder: Ensure Supabase tables (games, game_states, moves, users) 
// are created matching the schema in README.md.
