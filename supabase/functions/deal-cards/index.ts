// supabase/functions/deal-cards/index.ts
// Deals five random creature ids to each human participant in a Play Hub session.
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeFunctionResult, encodeFunctionData } from "https://esm.sh/viem@2.43.1";

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

const functionVersion = "2026-06-23-competitive-gem";
const CASUAL_MODE_ID = "casual";
const COMPETITIVE_MODE_ID = "competitive_gem";
const DEFAULT_CARDS_CONTRACT = "0xcf55f528492768330c0750a6527c1dfb50e2a7c3";

const erc1155Abi = [
  {
    type: "function",
    name: "balanceOfBatch",
    stateMutability: "view",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "ids", type: "uint256[]" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const;

type Participant = {
  player_id: string;
  slot: number;
};

type CatalogCard = {
  cardGameId: string;
  tokenId: string;
  contract: string;
};

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

function randomFrom(values: string[], size: number): string[] {
  const shuffled = [...new Set(values)].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

function normalizeAddress(value: string): string {
  const address = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    throw new Error(`Invalid Polygon address: ${value}`);
  }
  return address;
}

async function getLinkedPolygonWallet(supabase: ReturnType<typeof createClient>, profileId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profile_wallets")
    .select("address")
    .eq("profile_id", profileId)
    .eq("chain", "polygon")
    .single();

  if (error || !data?.address) {
    throw new Error("A linked Polygon wallet is required for Competitive GEM.");
  }

  return normalizeAddress(data.address);
}

async function getCompetitiveCatalog(
  supabase: ReturnType<typeof createClient>,
  cardsContract: string,
): Promise<CatalogCard[]> {
  const { data, error } = await supabase
    .from("mythical_assets")
    .select("id, polygon_contract, polygon_token_id, polygon_standard, metadata")
    .eq("asset_type", "card")
    .not("polygon_contract", "is", null)
    .not("polygon_token_id", "is", null);

  if (error) throw new Error(error.message);

  const allowed = new Set(allCreatures);
  return (data ?? [])
    .map((row: any): CatalogCard | null => {
      if (row.polygon_standard !== "ERC1155") return null;
      const contract = normalizeAddress(row.polygon_contract);
      if (contract !== cardsContract) return null;
      const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const cardGameId = String(metadata.card_game_id ?? row.id ?? "");
      if (!allowed.has(cardGameId)) return null;
      return {
        cardGameId,
        tokenId: String(row.polygon_token_id),
        contract,
      };
    })
    .filter(Boolean) as CatalogCard[];
}

async function readOwnedCompetitiveCards(input: {
  rpcUrl: string;
  owner: string;
  cardsContract: string;
  catalog: CatalogCard[];
}): Promise<string[]> {
  if (input.catalog.length === 0) return [];

  const data = encodeFunctionData({
    abi: erc1155Abi,
    functionName: "balanceOfBatch",
    args: [
      input.catalog.map(() => input.owner as `0x${string}`),
      input.catalog.map((card) => BigInt(card.tokenId)),
    ],
  });

  const response = await fetch(input.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "eth_call",
      params: [{ to: input.cardsContract, data }, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error("Could not read Polygon card ownership.");
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "Polygon RPC returned an error.");
  }

  const balances = decodeFunctionResult({
    abi: erc1155Abi,
    functionName: "balanceOfBatch",
    data: payload.result,
  }) as bigint[];

  return input.catalog
    .filter((_card, index) => balances[index] > 0n)
    .map((card) => card.cardGameId);
}

async function dealCompetitiveHands(input: {
  supabase: ReturnType<typeof createClient>;
  sessionId: string;
  participants: Participant[];
}): Promise<Record<string, string[]>> {
  const { data: competition, error: competitionError } = await input.supabase
    .from("card_game_competitions")
    .select("status, cards_contract")
    .eq("session_id", input.sessionId)
    .single();

  if (competitionError || !competition) {
    throw new Error("Competition metadata was not found.");
  }
  if (competition.status !== "ready") {
    throw new Error("Both GEM deposits must be confirmed before dealing competitive cards.");
  }

  const rpcUrl = Deno.env.get("POLYGON_RPC_URL");
  if (!rpcUrl) {
    throw new Error("POLYGON_RPC_URL is not configured.");
  }

  const cardsContract = normalizeAddress(competition.cards_contract || Deno.env.get("WISDOM_DUEL_CARDS_ADDRESS") || DEFAULT_CARDS_CONTRACT);
  const catalog = await getCompetitiveCatalog(input.supabase, cardsContract);
  if (catalog.length < 5) {
    throw new Error("Competitive card catalog is not configured.");
  }

  const dealtHands: Record<string, string[]> = {};
  for (const participant of input.participants) {
    const wallet = await getLinkedPolygonWallet(input.supabase, participant.player_id);
    const ownedCardIds = await readOwnedCompetitiveCards({
      rpcUrl,
      owner: wallet,
      cardsContract,
      catalog,
    });

    if (ownedCardIds.length < 5) {
      throw new Error("Each player needs at least 5 eligible Mythical cards in the linked Polygon wallet.");
    }

    dealtHands[String(participant.slot)] = randomFrom(ownedCardIds, 5);
  }

  return dealtHands;
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
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Session not found" }, 404);
    }

    if (![CASUAL_MODE_ID, COMPETITIVE_MODE_ID].includes(session.mode_id)) {
      return jsonResponse({ error: "Unsupported session mode" }, 400);
    }

    const canDeal = session.mode_id === COMPETITIVE_MODE_ID
      ? ["waiting", "playing"].includes(session.status)
      : session.status === "playing";

    if (!canDeal) {
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

    const dealtHands = session.mode_id === COMPETITIVE_MODE_ID
      ? await dealCompetitiveHands({
        supabase,
        sessionId,
        participants: participants as Participant[],
      })
      : participants.reduce<Record<string, string[]>>((acc, participant) => {
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
