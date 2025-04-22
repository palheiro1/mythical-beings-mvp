import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { GameState } from '../game/types'; // Assuming types.ts is in ../game/

// Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://layijhifboyouicxsunq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxheWlqaGlmYm95b3VpY3hzdW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MTcwMzgsImV4cCI6MjA2MDI5MzAzOH0.JXnxYMvDdXHAab2b0TQiDTqf7mBfgs0-OlR4UwU1_E0';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Basic Supabase Functions ---

/**
 * Creates a new game entry in the 'games' table, waiting for a second player.
 * @param gameId Unique ID for the game.
 * @param player1Id ID of the player creating the game.
 * @param betAmount The amount of GEMs bet for the game (0 for free play).
 * @returns The newly created game data or null on error.
 */
export async function createGame(gameId: string, player1Id: string, betAmount: number): Promise<any | null> {
  try {
    console.log(`[createGame] Creating game ${gameId} by player ${player1Id} with bet ${betAmount}`);
    const { data, error } = await supabase
      .from('games')
      .insert([{
        id: gameId,
        player1_id: player1Id,
        player2_id: null, // Player 2 joins later
        state: null,      // State initialized when game starts
        status: 'waiting', // Initial status
        bet_amount: betAmount, // Store the bet amount
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
        // Handle potential unique constraint violation if gameId already exists
        if (error.code === '23505') { // Unique violation code for PostgreSQL
            console.error(`[createGame] Error: Game ID ${gameId} already exists.`);
            // Optionally, retry with a new ID or inform the user
            return null; // Indicate failure due to duplicate ID
        }
        throw error; // Re-throw other errors
    }
    console.log('[createGame] Successfully created game entry. Returned data:', data);
    return data;
  } catch (error) {
    console.error('Error creating game:', error);
    return null;
  }
}

/**
 * Allows a player to join an existing game.
 * Updates the player2_id and status in the 'games' table.
 * @param gameId The ID of the game to join.
 * @param player2Id The ID of the player joining.
 * @returns The updated game data or null on error.
 */
export async function joinGame(gameId: string, player2Id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('games')
      .update({
          player2_id: player2Id,
          status: 'active', // <-- Set status to active when player 2 joins
          updated_at: new Date().toISOString()
      })
      .eq('id', gameId)
      .is('player2_id', null) // Ensure we only join if player 2 is not set
      .select()
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // PostgREST code for "No rows found"
            console.warn(`[joinGame] Game ${gameId} not found or already full.`);
            return null;
        }
        throw error;
    }
    console.log(`[joinGame] Player ${player2Id} successfully joined game ${gameId}. Status set to active.`); // Updated log
    return data;
  } catch (error) {
    console.error('Error joining game:', error);
    return null;
  }
}

/**
 * Fetches games that are available to join (status = 'waiting') or are currently active.
 * @returns An array of available/active games or null on error.
 */
export async function getAvailableGames(): Promise<any[] | null> {
    try {
        const { data, error } = await supabase
            .from('games')
            .select('id, player1_id, bet_amount, created_at, status') // Select relevant fields
            // Fetch games that are either 'waiting' or 'active'
            .in('status', ['waiting', 'active'])
            .order('created_at', { ascending: false }); // Show newest first

        if (error) throw error;
        console.log('[getAvailableGames] Fetched available/active games:', data);
        return data || []; // Return data or empty array if null
    } catch (error) {
        console.error('Error fetching available/active games:', error);
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
    const { data, error } = await supabase
      .from('games') 
      .select('state')
      .eq('id', gameId)
      .single();

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
 * Updates the game state in the 'games' table.
 * Also updates the status if necessary (e.g., to 'active' or 'finished').
 * @param gameId The ID of the game.
 * @param newState The new GameState object.
 * @returns The result of the update operation.
 */
export async function updateGameState(gameId: string, newState: GameState): Promise<any | null> {
  try {
    console.log(`[updateGameState] Attempting to save state for turn ${newState.turn}, phase: ${newState.phase}`);

    // Determine status ONLY if there is a winner
    let updatePayload: any = {
        state: newState,
        updated_at: new Date().toISOString()
    };

    let statusLog = 'unchanged'; // For logging
    if (newState.winner) {
        updatePayload.status = 'finished';
        statusLog = 'finished';
    }
    // No 'else' needed - status remains 'waiting' or 'active' otherwise

    const { data, error } = await supabase
      .from('games')
      .update(updatePayload) // Use the dynamically built payload
      .eq('id', gameId)
      .select()
      .single();

    if (error) throw error;
    console.log(`[updateGameState] Successfully saved state for turn ${newState.turn}, phase: ${newState.phase}, status: ${statusLog}`);
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
        action_type: action,
        payload: payload,
        timestamp: new Date().toISOString(),
      }]);
    if (error) throw error;
  } catch (error) {
    console.error('Error logging move:', error);
  }
}

// --- Profile Functions ---

/**
 * Fetches a user profile from the 'profiles' table.
 * @param userId The ID of the user whose profile to fetch.
 * @returns The profile data or null if not found or on error.
 */
export async function getProfile(userId: string): Promise<any | null> {
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select(`username, avatar_url, updated_at`)
      .eq('id', userId)
      .single();

    if (error && status !== 406) { // 406: No rows found, not necessarily an error here
      throw error;
    }

    console.log(`[getProfile] Fetched profile for ${userId}:`, data);
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

/**
 * Updates a user profile in the 'profiles' table.
 * @param userId The ID of the user whose profile to update.
 * @param updates An object containing the fields to update (e.g., { username, avatar_url }).
 * @returns The updated profile data or null on error.
 */
export async function updateProfile(userId: string, updates: { username?: string; avatar_url?: string }): Promise<any | null> {
  try {
    const profileUpdates = {
      ...updates,
      id: userId, // Ensure the ID is included for upsert
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('profiles')
        .upsert(profileUpdates)
        .select()
        .single();

    if (error) throw error;

    console.log(`[updateProfile] Updated profile for ${userId}:`, data);
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    return null;
  }
}

/**
 * Uploads an avatar image to Supabase Storage.
 * @param userId The ID of the user uploading the avatar.
 * @param file The avatar image file.
 * @returns The public URL of the uploaded avatar or null on error.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`; // Use timestamp for uniqueness

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('avatars') // Ensure this matches your bucket name
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL (assuming public bucket)
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

    if (!urlData || !urlData.publicUrl) {
        throw new Error("Could not get public URL for uploaded avatar.");
    }

    console.log(`[uploadAvatar] Avatar uploaded for ${userId}. Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error uploading avatar:', error);
    return null;
  }
}

// --- Realtime Subscription ---

/**
 * Subscribes to real-time updates for a specific game's state.
 * @param gameId The ID of the game to subscribe to.
 * @param callback Function to call when a state update is received.
 * @returns The Supabase subscription channel.
 */
export function subscribeToGameState(gameId: string, callback: (newState: GameState) => void): RealtimeChannel {
  const channel = supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        console.log('[Realtime] Game state change received:', payload);
        if (payload.new && payload.new.state) {
          // Add validation or transformation if needed
          callback(payload.new.state as GameState);
        }
      }
    )
    .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Subscribed successfully to game ${gameId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Realtime] Subscription error for game ${gameId}:`, err || status);
            // Implement retry logic or error handling as needed
        } else {
            console.log(`[Realtime] Subscription status for game ${gameId}:`, status);
        }
    });

  return channel;
}

/**
 * Unsubscribes from game state updates.
 * @param channel The Supabase subscription channel to unsubscribe from.
 */
export async function unsubscribeFromGameState(channel: RealtimeChannel): Promise<void> {
  try {
    const status = await channel.unsubscribe();
    console.log('[Realtime] Unsubscribed from channel:', status);
  } catch (error) {
    console.error('[Realtime] Error unsubscribing:', error);
  }
}
