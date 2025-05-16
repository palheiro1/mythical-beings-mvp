// supabase/functions/create-game/index.ts
// Edge function to create a new game, bypassing RLS
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let gameId, player1Id, formattedPlayerId, betAmount, effectivePlayerId;
  
  try {
    // Parse request body
    const requestBody = await req.json();
    gameId = requestBody.gameId;
    player1Id = requestBody.player1Id;
    formattedPlayerId = requestBody.formattedPlayerId;
    betAmount = requestBody.betAmount;

    // Validate required parameters
    if (!gameId || (!player1Id && !formattedPlayerId)) {
      console.error("Missing required parameters:", { gameId, player1Id, formattedPlayerId });
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Use formattedPlayerId if provided, otherwise use player1Id
    effectivePlayerId = formattedPlayerId || player1Id;
    console.log("Using player ID:", { 
      original: player1Id,
      formatted: formattedPlayerId, 
      effective: effectivePlayerId
    });

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Log environment variables and player ID details for debugging
    console.log("Environment check:", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceRoleKey: !!serviceRoleKey,
      playerIdType: typeof player1Id,
      playerIdValue: player1Id?.substring(0, 10) + '...',
      effectiveIdType: typeof effectivePlayerId,
      effectiveIdValue: effectivePlayerId?.substring(0, 10) + '...'
    });
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables for Supabase");
      return new Response(JSON.stringify({ error: 'Server configuration error: missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create game record with service role privileges (bypasses RLS)
    console.log("Attempting to insert game with service role client:", { 
      gameId, 
      player1Id: player1Id?.substring(0, 10) + '...',
      effectivePlayerId: effectivePlayerId?.substring(0, 10) + '...',
      betAmount 
    });
    
    let gameData;
    
    try {
      // Add extra error handling and logging for debugging
      if (!effectivePlayerId) {
        console.error("No valid player ID available for insert");
        return new Response(JSON.stringify({ 
          error: 'Missing or invalid player ID', 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      console.log(`Using player ID for database insert: ${effectivePlayerId}`);
      
      // First, ensure the player profile exists
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: effectivePlayerId,
            eth_address: player1Id?.startsWith('0x') ? player1Id : null,
            username: `Player_${effectivePlayerId.substring(0, 6)}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
          
        if (profileError) {
          console.warn("Failed to ensure player profile:", profileError);
        } else {
          console.log("Ensured player profile exists");
        }
      } catch (profileErr) {
        console.warn("Error during profile check:", profileErr);
      }
      
      // Insert the game record with the effective player ID
      const { data, error } = await supabase
        .from('games')
        .insert([{
          id: gameId,
          player1_id: effectivePlayerId,  // Use the effective ID
          player2_id: null,
          state: null,
          status: 'waiting',
          bet_amount: betAmount || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error("Database error creating game:", error);
        return new Response(JSON.stringify({ 
          error: `Database error: ${error.message}`, 
          code: error.code,
          details: error.details 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      console.log("Game created successfully:", data);
      gameData = data;
    } catch (insertError) {
      console.error("Exception during game creation:", insertError);
      return new Response(JSON.stringify({ 
        error: `Exception during game creation: ${insertError instanceof Error ? insertError.message : String(insertError)}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Return the created game data
    return new Response(JSON.stringify(gameData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error in Edge Function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error && (error as any).details 
      ? (error as any).details
      : 'No additional details';
      
    return new Response(JSON.stringify({ 
      error: `Server error: ${errorMessage}`, 
      details: errorDetails,
      originalError: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
