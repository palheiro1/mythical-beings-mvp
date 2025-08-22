// supabase/functions/deal-cards/index.ts
// Deals 5 random creature ids to each player and sets status to 'selecting'
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { gameId } = await req.json();
    if (!gameId) {
      return new Response(JSON.stringify({ error: 'Missing gameId' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch game and player ids
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, status')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Allow dealing when game is 'waiting' or 'selecting'.
    // Also be tolerant of 'active' if hands have not yet been dealt (legacy client may have set status early).
    const statusAllowsDealing =
      game.status === 'waiting' ||
      game.status === 'selecting' ||
      (game.status === 'active' &&
        (!game.player1_dealt_hand || game.player1_dealt_hand.length === 0) &&
        (!game.player2_dealt_hand || game.player2_dealt_hand.length === 0));

    // Allow dealing in 'waiting' or 'selecting'. If 'active', allow only if hands are empty (backward compatibility).
    const p1HasHand = Array.isArray(game.player1_dealt_hand) && game.player1_dealt_hand.length > 0;
    const p2HasHand = Array.isArray(game.player2_dealt_hand) && game.player2_dealt_hand.length > 0;
    const handsEmpty = !p1HasHand && !p2HasHand;

    if (!(['waiting', 'selecting'].includes(game.status) || (game.status === 'active' && handsEmpty))) {
      return new Response(
        JSON.stringify({ error: `Game not in correct status to deal (status=${game.status})` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!game.player1_id || !game.player2_id) {
      return new Response(JSON.stringify({ error: 'Both players must be present to deal cards' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // If already dealt, do not redeal
    if ((game.player1_dealt_hand?.length || 0) > 0 && (game.player2_dealt_hand?.length || 0) > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Already dealt' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Define available creature IDs (should match assets/creatures.json ids)
    const allCreatures = [
      'adaro','pele','kappa','dudugera','kyzy','lisovik','tulpar','tsenehale','caapora','zhar-ptitsa','inkanyamba','japinunus','lafaic','tarasca','trempulcahue','tsenehale','tulpar'
    ];

    function randomHand(size: number): string[] {
      const shuffled = [...new Set(allCreatures)].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, size);
    }

    const player1Hand = randomHand(5);
    const player2Hand = randomHand(5);

    const { data: updated, error: updateError } = await supabase
      .from('games')
      .update({
        player1_dealt_hand: player1Hand,
        player2_dealt_hand: player2Hand,
    status: 'selecting', // This line remains unchanged
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select('id, player1_dealt_hand, player2_dealt_hand, status')
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
