import { createClient, SupabaseClient, RealtimeChannel as SupabaseRealtimeChannel } from '@supabase/supabase-js';
import { GameState } from '../game/types.js';

export type RealtimeChannel = SupabaseRealtimeChannel;

// Load Supabase URL and Anon Key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not set. Please check your .env.local file.");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not set. Please check your .env.local file.");
}

// Legacy functions removed - using Supabase Auth user IDs directly

// Create Supabase client with default authentication
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true, // Enable session persistence
    detectSessionInUrl: true,
    // Custom lock function removed, reverting to default
  },
});

// Type for match details - adjust based on your actual table structure
// Added status and other potential fields based on select('*')
interface MatchDetails {
    id: string;
    created_at: string;
    updated_at: string;
    player1_id: string;
    player2_id: string | null;
    status: 'waiting' | 'selecting' | 'active' | 'finished' | 'cancelled'; // Added 'selecting'
    bet_amount: number;
    state: GameState | null; // State might also be included
    winner_id?: string | null; // Optional winner field
}

/**
 * Fetches the player IDs and details associated with a specific game.
 * Assumes a 'games' table exists with 'id' (matching gameId), 'player1_id', and 'player2_id'.
 * @param gameId The ID of the game.
 * @returns An object with player1_id and player2_id, or null if not found or error.
 */
export async function getGameDetails(gameId: string): Promise<MatchDetails | null> {
    console.log(`[Supabase] Fetching game details for game ${gameId}...`);
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (error) {
        console.error(`[Supabase] Error fetching game details for game ${gameId}:`, error);
        return null;
    }

    if (!data) {
        console.warn(`[Supabase] No game details found for game ${gameId}.`);
        return null;
    }

    console.log(`[Supabase] Successfully fetched game details for game ${gameId}:`, data);
    return data as MatchDetails;
}

// --- Basic Supabase Functions ---

/**
 * Creates a new game entry in the 'games' table, waiting for a second player.
 * @param gameId Unique ID for the game.
 * @param player1Id ID of the player creating the game.
 * @param betAmount The amount of GEMs bet for the game (0 for free play).
 * @returns The newly created game data or null on error.
 */
// Client-side profile creation/updating is disabled to respect RLS.
// Profiles are ensured server-side via the moralis-auth edge function (ensure_user_profile_exists).

export async function createGame(gameId: string, player1Id: string, betAmount: number): Promise<any | null> {
  try {
    // Get current session info
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    
    // Use session user ID if available, otherwise use provided player ID directly
    const effectivePlayerId = sessionUserId || player1Id;
    
    console.log(`[createGame] Creating game ${gameId} by player ${player1Id} (using ID: ${effectivePlayerId}) with bet ${betAmount}`);
    
  // Profile is ensured server-side during auth; no client profile writes here
    
    // Rest of your existing code using effectivePlayerId instead of formattedPlayerId
    const gameRecord = {
      id: gameId,
      player1_id: effectivePlayerId,
      player2_id: null, // Player 2 joins later
      state: null,      // State initialized when game starts
      status: 'waiting', // Initial status
      bet_amount: betAmount, // Store the bet amount
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('games')
      .insert([gameRecord])
      .select()
      .single();

    if (error) {
      console.error('[createGame] Error with standard client:', error);
      return null;
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
    // Get current session info
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    
    // Use session user ID if available, otherwise use provided player ID directly
    const effectivePlayerId = sessionUserId || player2Id;
    
    console.log(`[joinGame] Joining game ${gameId} as player ${player2Id} (using ID: ${effectivePlayerId})`);
    
  // Profile is ensured server-side during auth; no client profile writes here
    const { data, error } = await supabase
      .from('games')
      .update({
          player2_id: effectivePlayerId,
          // Do NOT set status to 'active' here; keep existing status (should be 'waiting').
          updated_at: new Date().toISOString()
      })
      .eq('id', gameId)
  .eq('status', 'waiting')
  .gt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .is('player2_id', null)
      // Only select known columns to avoid missing-field errors
      .select('id, player1_id, player2_id, status, bet_amount, created_at, updated_at')
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // PostgREST code for "No rows found"
            console.warn(`[joinGame] Game ${gameId} not found or already full.`);
            return null;
        }
        throw error;
    }
    console.log(`[joinGame] Player ${player2Id} successfully joined game ${gameId}.`);
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
    // Only show truly joinable games: status='waiting' and not expired (created within last 10 minutes)
    const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('games')
      .select('id, player1_id, bet_amount, created_at, status')
      .eq('status', 'waiting')
      .is('player2_id', null)
      .gt('created_at', tenMinutesAgoIso)
      .order('created_at', { ascending: false });

    if (error) throw error;
    console.log('[getAvailableGames] Fetched joinable games (waiting, not expired):', data);
    return data || [];
  } catch (error) {
    console.error('Error fetching joinable games:', error);
    return null;
  }
}

/**
 * Fetches games that are currently active (spectatable).
 * @returns An array of active games or null on error.
 */
export async function getActiveGames(): Promise<any[] | null> {
  try {
    const thirtyMinutesAgoIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('games')
      .select('id, player1_id, bet_amount, created_at, updated_at, status')
      .eq('status', 'active')
      .not('player2_id', 'is', null)
      .gt('updated_at', thirtyMinutesAgoIso)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    console.log('[getActiveGames] Fetched active games (spectatable):', data);
    return data || [];
  } catch (error) {
    console.error('Error fetching active games:', error);
    return null;
  }
}

/**
 * Fetches the latest game state from the 'games' table.
 * @param gameId The ID of the game.
 * @returns The latest GameState object or null on error.
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
  console.log(`[getGameState] Fetching state for game ${gameId}...`);
  if (!gameId || typeof gameId !== 'string') { // Add check for valid gameId
      console.error('[getGameState] Invalid gameId provided:', gameId);
      return null;
  }
  try {
    const { data, error } = await supabase
      .from('games')
      .select('state')
      .eq('id', gameId)
      .single(); // Use single() as gameId should be unique

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error code for "Resource not found"
          console.log(`[getGameState] No existing game state found for ${gameId}.`);
          return null; // No state found is not necessarily an error here
      }
      console.error(`[getGameState] Error fetching game state for ${gameId}:`, error);
      throw error; // Re-throw other errors
    }

    if (data && data.state && typeof data.state === 'object') {
        // Check if this is a full GameState or just NFT selection state
        const state = data.state as any;
        if (state.phase && state.players && state.gameId) {
            // This is a full GameState
            console.log(`[getGameState] Fetched full game state phase: ${state.phase}`);
            return data.state as GameState;
        } else if (state.player1SelectionComplete !== undefined || state.player2SelectionComplete !== undefined) {
            // This is just NFT selection state, not a full game state
            console.log(`[getGameState] Found NFT selection state, but no full game state for ${gameId}`);
            return null;
        } else {
            console.warn(`[getGameState] Found unknown state format for ${gameId}:`, state);
            return null;
        }
    } else {
        console.warn(`[getGameState] No state data found or invalid format for ${gameId}. Data:`, data);
        return null;
    }
  } catch (err) {
      console.error(`[getGameState] Unexpected error fetching state for ${gameId}:`, err);
      return null; // Return null on unexpected errors
  }
}

/**
 * Updates the game state in the 'games' table.
 * Also updates the status if necessary (e.g., to 'active' or 'finished').
 * @param gameId The ID of the game.
 * @param newState The new GameState object.
 * @returns The result of the update operation.
 */
export async function updateGameState(gameId: string, newState: GameState): Promise<boolean> {
    console.log(`[updateGameState] Attempting to save state for turn ${newState.turn}, phase: ${newState.phase}`);
    if (!gameId || typeof gameId !== 'string') { // *** Add check for valid gameId ***
        console.error('[updateGameState] Invalid gameId provided:', gameId);
        return false;
    }
     if (!newState || typeof newState !== 'object') {
        console.error('[updateGameState] Invalid newState provided:', newState);
        return false;
    }

    try {
    const { error } = await supabase
            .from('games')
            .update({
                state: newState,
                updated_at: new Date().toISOString(), // Explicitly set updated_at
             })
      .eq('id', gameId); // *** Use the validated gameId string ***

    if (error) {
            console.error(`[updateGameState] Error updating game state for ${gameId}:`, error);
            // Log details that might help debug (like invalid state structure)
            if (error.message.includes('invalid input syntax')) {
                 console.error("[updateGameState] Potential issue: State object might not match DB column type.", newState);
            }
            return false;
        }

    console.log(`[updateGameState] Successfully updated state for game ${gameId}.`);
    return true;

    } catch (err) {
         console.error(`[updateGameState] Unexpected error updating state for ${gameId}:`, err);
         return false;
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
    console.log(`[getProfile] Fetching profile for ${userId}`);
    const { data, error, status } = await supabase
      .from('profiles')
            .select(`username, avatar_url, created_at`)
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
    console.log(`[updateProfile] Updating profile for ${userId}`);
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

/**
 * Records the game outcome, updates game status to 'finished', and updates player statistics.
 * @param gameId The ID of the game that ended.
 * @param winnerId The ID of the winning player, or null for a draw.
 * @param player1Id The ID of player 1.
 * @param player2Id The ID of player 2.
 */
export async function recordGameOutcomeAndUpdateStats(
  gameId: string,
  winnerId: string | null,
  player1Id: string,
  player2Id: string
): Promise<void> {
  console.log(`[recordGameOutcome] Initiated for game ${gameId}. Winner: ${winnerId}, P1: ${player1Id}, P2: ${player2Id}`);
  try {
    // Update only the game record; DB trigger will handle stats and earned_gem aggregation
    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ status: 'finished', winner_id: winnerId, updated_at: new Date().toISOString() })
      .eq('id', gameId);

    if (gameUpdateError) {
      console.error(`[recordGameOutcome] Error updating game ${gameId}:`, gameUpdateError);
      return;
    }
    console.log(`[recordGameOutcome] Game ${gameId} marked as finished. Stats will be updated via DB trigger.`);
  } catch (error) {
    console.error(`[recordGameOutcome] Unexpected error during execution for game ${gameId}:`, error);
  }
}

// --- Realtime Subscription ---

/**
 * Subscribes to real-time updates for a specific game's state.
 * @param gameId The ID of the game to subscribe to.
 * @param callback Function to call when a state update is received.
 * @param subscriberId A string identifier for the subscriber (for logging).
 * @returns The Supabase subscription channel.
 */
export function subscribeToGameState(
  gameId: string,
  callback: (newState: GameState) => void,
  subscriberId?: string // Added subscriberId
): RealtimeChannel {
  const channelName = `game-${gameId}`;
  const subIdForLog = subscriberId || 'UnknownSubscriber';
  console.log(`[Realtime] ${subIdForLog} attempting to subscribe to channel: ${channelName}`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload: { new?: { state?: GameState } }) => {
        console.log(`[Realtime] Game state change received on channel ${channelName} for ${subIdForLog}:`, payload);
        if (payload.new && payload.new.state) {
          callback(payload.new.state as GameState);
        }
      }
    )
    .subscribe((status: string, err?: Error) => {
      // Log with subscriberId
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] ${subIdForLog} SUBSCRIBED successfully to game ${gameId}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Realtime] ${subIdForLog} subscription error for game ${gameId}:`, err || status);
      } else {
        console.log(`[Realtime] ${subIdForLog} subscription status for game ${gameId}: ${status}`);
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
