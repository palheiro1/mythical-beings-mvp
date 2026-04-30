// supabase/functions/deal-cards/index.ts
// Deals five random creature ids to each human participant in a Play Hub session.
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allCreatures = [
  "adaro",
  "pele",
  "kappa",
  "dudugera",
  "kyzy",
  "lisovik",
  "tulpar",
  "tsenehale",
  "caapora",
  "zhar-ptitsa",
  "inkanyamba",
  "japinunus",
  "lafaic",
  "tarasca",
  "trempulcahue",
];

const functionVersion = "2026-04-30-card-game-repair";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomHand(size: number): string[] {
  const shuffled = [...new Set(allCreatures)].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

serve(async (req) => {
  console.log(`[deal-cards] ${functionVersion} ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const sessionId = body.sessionId ?? body.gameId;
    if (!sessionId) {
      return jsonResponse({ error: "Missing sessionId" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, status, game_id, mode_id, host_id")
      .eq("id", sessionId)
      .eq("game_id", "card_game")
      .eq("mode_id", "casual")
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Session not found" }, 404);
    }

    if (session.status !== "playing") {
      return jsonResponse({ error: `Session not in correct status to deal (status=${session.status})` }, 400);
    }

    if (session.host_id !== authData.user.id) {
      return jsonResponse({ error: "Only the session host can deal cards" }, 403);
    }

    const { data: participants, error: participantsError } = await supabase
      .from("session_participants")
      .select("player_id, slot")
      .eq("session_id", sessionId)
      .order("slot", { ascending: true });

    if (participantsError) {
      return jsonResponse({ error: participantsError.message }, 500);
    }

    if (!participants || participants.length !== 2) {
      return jsonResponse({ error: "Exactly two human participants are required to deal cards" }, 400);
    }

    const { data: existing, error: existingError } = await supabase
      .from("card_game_session_state")
      .select("session_id, dealt_hands, selected_creatures, state")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ error: existingError.message }, 500);
    }

    const existingHands = existing?.dealt_hands ?? {};
    const allHandsPresent = participants.every((participant) => {
      const hand = existingHands[String(participant.slot)];
      return Array.isArray(hand) && hand.length > 0;
    });

    if (allHandsPresent) {
      return jsonResponse({
        session_id: sessionId,
        dealt_hands: existingHands,
        selected_creatures: existing?.selected_creatures ?? {},
        state: existing?.state ?? null,
      });
    }

    const dealtHands = participants.reduce<Record<string, string[]>>((acc, participant) => {
      acc[String(participant.slot)] = randomHand(5);
      return acc;
    }, {});

    const { data: updated, error: upsertError } = await supabase
      .from("card_game_session_state")
      .upsert({
        session_id: sessionId,
        dealt_hands: dealtHands,
      }, { onConflict: "session_id" })
      .select("session_id, dealt_hands, selected_creatures, state, created_at, updated_at")
      .single();

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    return jsonResponse(updated);
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
