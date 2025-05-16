import { createClient, SupabaseClient, RealtimeChannel as SupabaseRealtimeChannel } from '@supabase/supabase-js';
import { GameState } from '../game/types.js';

export type RealtimeChannel = SupabaseRealtimeChannel;

// Load Supabase URL and Anon Key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// For admin operations like bypassing RLS (use cautiously!)
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not set. Please check your .env.local file.");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not set. Please check your .env.local file.");
}

// Optional service client for admin operations (will be null if key not provided)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Helper function to convert an Ethereum address to a UUID format
 * This ensures consistent ID format between the JWT and database operations
 * @param address The Ethereum address to convert to UUID
 * @returns UUID string formatted from the Ethereum address
 */
export function ethAddressToUUID(address: string): string {
  // Remove 0x prefix and ensure lowercase
  const cleanAddress = address.toLowerCase().replace('0x', '');
  
  // Pad or truncate to ensure we have exactly 32 hex characters (16 bytes)
  let normalizedHex = cleanAddress;
  if (normalizedHex.length > 32) {
    normalizedHex = normalizedHex.substring(0, 32);
  } else {
    while (normalizedHex.length < 32) {
      normalizedHex += '0';
    }
  }
  
  // Format as UUID
  return [
    normalizedHex.substring(0, 8),
    normalizedHex.substring(8, 12),
    normalizedHex.substring(12, 16),
    normalizedHex.substring(16, 20),
    normalizedHex.substring(20, 32)
  ].join('-');
}

/**
 * Helper function to get the correct player ID format for database operations
 * This checks localStorage for the original Ethereum address format when needed
 * @param id Either Ethereum address or UUID format
 * @returns The correct ID format to use for database operations
 */
export function getCorrectPlayerId(id: string): string {
  if (!id) {
    console.error('[getCorrectPlayerId] No ID provided');
    return '';
  }
  
  // If it's already a UUID format, return it
  if (id.includes('-') && id.length === 36) {
    return id;
  }
  
  // If it's an ETH address, convert it to UUID
  if (id.startsWith('0x') && id.length === 42) {
    return ethAddressToUUID(id);
  }
  
  // Check if we have the original ETH address in localStorage
  try {
    const storedEthAddress = localStorage.getItem('eth_address');
    if (storedEthAddress && storedEthAddress.startsWith('0x')) {
      console.log(`[getCorrectPlayerId] Using stored ETH address: ${storedEthAddress.substring(0, 10)}...`);
      return ethAddressToUUID(storedEthAddress);
    }
    
    // Check alternative storage formats
    const storedSession = localStorage.getItem('sb-session');
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession);
        if (sessionData?.user?.user_metadata?.eth_address) {
          console.log(`[getCorrectPlayerId] Using ETH address from session metadata`);
          return ethAddressToUUID(sessionData.user.user_metadata.eth_address);
        }
      } catch (e) {
        console.warn('[getCorrectPlayerId] Failed to parse session data', e);
      }
    }
  } catch (e) {
    console.warn('[getCorrectPlayerId] Error accessing localStorage:', e);
  }
  
  // If we reach here and have a non-empty id that's not in standard format,
  // try our best to convert it
  if (id && !id.includes('-')) {
    // Clean up the id - remove any 0x prefix and ensure 32 chars
    console.log(`[getCorrectPlayerId] Converting non-standard ID format: ${id.substring(0, 10)}...`);
    return ethAddressToUUID(id);
  }
  
  console.warn(`[getCorrectPlayerId] Could not determine correct ID format for: ${id}`);
  return id; // Return as-is as a last resort
  
  // If all else fails, return the original id
  return id;
}

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
export async function createGame(gameId: string, player1Id: string, betAmount: number): Promise<any | null> {
  try {
    // Ensure player1Id is in the correct format (UUID)
    const formattedPlayerId = getCorrectPlayerId(player1Id);
    
    console.log(`[createGame] Creating game ${gameId} by player ${player1Id} (formatted: ${formattedPlayerId}) with bet ${betAmount}`);
    
    // Store both formats in localStorage for debugging
    localStorage.setItem('last_player_id_raw', player1Id);
    localStorage.setItem('last_player_id_formatted', formattedPlayerId);
    localStorage.setItem('last_game_id', gameId);
    
    // Define the game record we want to insert
    const gameRecord = {
      id: gameId,
      player1_id: formattedPlayerId,
      player2_id: null, // Player 2 joins later
      state: null,      // State initialized when game starts
      status: 'waiting', // Initial status
      bet_amount: betAmount, // Store the bet amount
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // ATTEMPT 1: Try using the Edge Function to create the game (bypassing RLS)
    try {
      console.log('[createGame] Attempt 1: Creating game via edge function...');
      // Pass both the raw and formatted player IDs for maximum compatibility
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-game', {
        body: { 
          gameId, 
          player1Id: player1Id,        // Send the original ETH address 
          formattedPlayerId: formattedPlayerId, // And the UUID version
          betAmount 
        }
      });
      
      if (!edgeError && edgeData) {
        console.log('[createGame] Successfully created game via edge function:', edgeData);
        return edgeData;
      } else if (edgeError) {
        console.warn('[createGame] Edge function error:', edgeError);
        // Print more details about the error for debugging
        if (edgeError.message) {
          console.warn('[createGame] Error message:', edgeError.message);
        }
        if (edgeError.context) {
          console.warn('[createGame] Error context:', edgeError.context);
        }
        // Try to extract JSON from the error message if available
        try {
          const errorObject = JSON.parse(edgeError.message);
          console.warn('[createGame] Parsed error details:', errorObject);
        } catch (e) {
          // Not JSON, skip
        }
        // Continue to next attempt
      }
    } catch (edgeErr) {
      console.warn('[createGame] Edge function not available:', edgeErr);
      // Continue to next attempt
    }
    
    // ATTEMPT 2: Try using supabaseAdmin client with service role key (if available)
    if (supabaseAdmin) {
      try {
        console.log('[createGame] Attempt 2: Creating game via admin client (bypasses RLS)...');
        
        // First see if we need to create the player's profile
        // This ensures the player exists in the profiles table with both ID formats
        try {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: formattedPlayerId,
              eth_address: player1Id.startsWith('0x') ? player1Id : null,
              username: `Player_${formattedPlayerId.substring(0, 6)}`,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });
            
          if (profileError) {
            console.warn('[createGame] Admin client profile upsert failed:', profileError);
          } else {
            console.log('[createGame] Admin client ensured player profile exists');
          }
        } catch (profileErr) {
          console.warn('[createGame] Error ensuring player profile:', profileErr);
        }
        
        // Now try to insert the game record
        const { data: adminData, error: adminError } = await supabaseAdmin
          .from('games')
          .insert([gameRecord])
          .select()
          .single();
          
        if (!adminError && adminData) {
          console.log('[createGame] Successfully created game via admin client:', adminData);
          return adminData;
        } else if (adminError) {
          console.warn('[createGame] Admin client error:', adminError);
          // Continue to next attempt
        }
      } catch (adminErr) {
        console.warn('[createGame] Admin client operation failed:', adminErr);
        // Continue to next attempt
      }
    } else {
      console.log('[createGame] No admin client available, skipping that attempt');
    }
    
    // ATTEMPT 3: Direct insert using regular supabase client with JWT token
    console.log('[createGame] Attempt 3: Creating game via standard client...');
    
    // Get the current session and try to refresh it first to ensure it's valid
    try {
      await supabase.auth.refreshSession();
    } catch (refreshErr) {
      console.log('[createGame] Session refresh attempt failed (might be normal):', refreshErr);
    }
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      console.log('[createGame] User is authenticated with session:', 
        sessionData.session.user?.id ? `User ID: ${sessionData.session.user.id}` : 'No user ID in session');
      
      // Compare IDs to help debug format issues
      console.log('[createGame] ID comparison:', { 
        session_user_id: sessionData.session.user?.id,
        player1Id: player1Id,
        formattedPlayerId: formattedPlayerId,
        areStringEqual: sessionData.session.user?.id === player1Id || sessionData.session.user?.id === formattedPlayerId,
        eth_address_in_metadata: sessionData.session.user?.user_metadata?.eth_address || 'not found'
      });
    } else {
      console.warn('[createGame] No active session found - auth may be required for this operation');
      
      // Try to recover the session from localStorage as a fallback
      const storedEthAddress = localStorage.getItem('eth_address');
      if (storedEthAddress) {
        console.log('[createGame] Found ethereum address in localStorage:', storedEthAddress);
      }
    }
    
    // Try the insert operation
    const { data, error } = await supabase
      .from('games')
      .insert([gameRecord])
      .select()
      .single();

    if (error) {
      console.error('[createGame] Error with standard client:', error);
      
      // Handle potential unique constraint violation if gameId already exists
      if (error.code === '23505') { // Unique violation code for PostgreSQL
        console.error(`[createGame] Error: Game ID ${gameId} already exists.`);
        // Optionally, retry with a new ID or inform the user
        return null; // Indicate failure due to duplicate ID
      }
      else if (error.code === '42501' || error.code === 'PGRST301') {
        console.error('[createGame] RLS policy violation. User not authorized to create game.');
        console.error('[createGame] This could indicate an authentication issue or incorrect player ID format.');
        
        // Let's log more details for debugging
        console.log('[createGame] Auth state check:');
        console.log('- Formatted player ID:', formattedPlayerId);
        console.log('- Original player ID:', player1Id);
        console.log('- Session user ID:', sessionData?.session?.user?.id || 'No session user ID');
        
        // Try one last effort to fix common issues:
        // 1. Check if session is stale
        try {
          console.log('[createGame] Attempting to refresh authentication session...');
          await supabase.auth.refreshSession();
          
          // 2. Try again with the alternative ID format
          const alternativeId = player1Id.includes('-') ? player1Id.replace(/-/g, '') : ethAddressToUUID(player1Id);
          console.log('[createGame] Making one more attempt with alternative ID format:', alternativeId);
          
          const { data: retryData, error: retryError } = await supabase
            .from('games')
            .insert([{
              ...gameRecord,
              player1_id: alternativeId
            }])
            .select()
            .single();
            
          if (!retryError && retryData) {
            console.log('[createGame] Success on retry attempt!', retryData);
            return retryData;
          } else {
            console.error('[createGame] Retry attempt also failed:', retryError);
          }
        } catch (retryErr) {
          console.error('[createGame] Error during retry:', retryErr);
        }
        
        return null; // RLS policy violation
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
    // Ensure player2Id is in the correct format (UUID)
    const formattedPlayerId = getCorrectPlayerId(player2Id);
    
    console.log(`[joinGame] Joining game ${gameId} as player ${player2Id} (formatted: ${formattedPlayerId})`);
    const { data, error } = await supabase
      .from('games')
      .update({
          player2_id: formattedPlayerId,
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
        console.log(`[getGameState] Fetched state phase: ${ (data.state as GameState).phase}`);
        // You might want to add validation here to ensure data.state matches GameState structure
        return data.state as GameState;
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
        const { data, error } = await supabase
            .from('games')
            .update({
                state: newState,
                updated_at: new Date().toISOString(), // Explicitly set updated_at
             })
            .eq('id', gameId) // *** Use the validated gameId string ***
            .select('id') // Select something small to confirm success
            .single(); // Ensure only one row is updated

        if (error) {
            console.error(`[updateGameState] Error updating game state for ${gameId}:`, error);
            // Log details that might help debug (like invalid state structure)
            if (error.message.includes('invalid input syntax')) {
                 console.error("[updateGameState] Potential issue: State object might not match DB column type.", newState);
            }
            return false;
        }

        if (data) {
             console.log(`[updateGameState] Successfully updated state for game ${gameId}.`);
             return true;
        } else {
             console.warn(`[updateGameState] Update call succeeded but returned no data for ${gameId}.`);
             return false; // Or true depending on whether no data is acceptable
        }

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
    // Ensure userId is in the correct format
    const formattedUserId = getCorrectPlayerId(userId);
    
    console.log(`[getProfile] Fetching profile for ${userId} (formatted: ${formattedUserId})`);
    const { data, error, status } = await supabase
      .from('profiles')
            .select(`username, avatar_url, created_at`)
      .eq('id', formattedUserId)
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
    // Ensure userId is in the correct format
    const formattedUserId = getCorrectPlayerId(userId);
    
    console.log(`[updateProfile] Updating profile for ${userId} (formatted: ${formattedUserId})`);
    const profileUpdates = {
      ...updates,
      id: formattedUserId, // Ensure the ID is included for upsert and in correct format
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
    // 1. Update game status to 'finished'
    console.log(`[recordGameOutcome] Attempting to update game ${gameId} status to 'finished'.`);
    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', gameId);

    if (gameUpdateError) {
      console.error(`[recordGameOutcome] Error updating game status for ${gameId}:`, gameUpdateError);
      // Not returning here, will still attempt to update stats
    } else {
      console.log(`[recordGameOutcome] Successfully updated game ${gameId} status to 'finished'.`);
    }

    // 2. Update stats for both players
    const playersToUpdate = [player1Id, player2Id];
    console.log(`[recordGameOutcome] Players to update stats for:`, playersToUpdate);

    for (const playerId of playersToUpdate) {
      if (!playerId) {
        console.warn(`[recordGameOutcome] Skipping update for a null/undefined playerId.`);
        continue;
      }
      console.log(`[recordGameOutcome] Processing stats for player ${playerId}.`);

      // Fetch current stats
      console.log(`[recordGameOutcome] Fetching current profile for player ${playerId}.`);
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('games_played, games_won')
        .eq('id', playerId)
        .single();

      if (fetchError) {
        console.error(`[recordGameOutcome] Error fetching profile for player ${playerId}:`, fetchError);
        continue; // Skip this player if profile fetch fails
      }

      if (!profile) {
        console.warn(`[recordGameOutcome] No profile found for player ${playerId}. Skipping stats update.`);
        continue;
      }

      console.log(`[recordGameOutcome] Current profile for ${playerId}:`, profile);

      const currentGamesPlayed = profile.games_played ?? 0;
      const currentGamesWon = profile.games_won ?? 0;
      console.log(`[recordGameOutcome] Player ${playerId} - Current stats: Played=${currentGamesPlayed}, Won=${currentGamesWon}`);

      const newGamesPlayed = currentGamesPlayed + 1;
      const newGamesWon = (playerId === winnerId) ? currentGamesWon + 1 : currentGamesWon;
      console.log(`[recordGameOutcome] Player ${playerId} - New stats: Played=${newGamesPlayed}, Won=${newGamesWon}`);

      console.log(`[recordGameOutcome] Attempting to update profile for player ${playerId} with new stats.`);
      const { error: statsUpdateError } = await supabase
        .from('profiles')
        .update({
          games_played: newGamesPlayed,
          games_won: newGamesWon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playerId);

      if (statsUpdateError) {
        console.error(`[recordGameOutcome] Error updating stats for player ${playerId}:`, statsUpdateError);
      } else {
        console.log(`[recordGameOutcome] Successfully updated stats for player ${playerId}.`);
      }
    }
    console.log(`[recordGameOutcome] Finished processing for game ${gameId}.`);
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
