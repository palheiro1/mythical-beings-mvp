// MetaMask auth Edge Function with local signature verification (no Moralis dependency)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { utils as ethersUtils } from "https://esm.sh/ethers@5.7.2";

// Base CORS headers, primarily for preflight (OPTIONS) requests
const baseCorsHeaders = {
  "Access-Control-Allow-Origin": "*", // Using wildcard for development. For production, restrict this.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
};

// Handle OPTIONS request for CORS preflight
function handleOptionsRequest(requestHeadersFromReq: Headers) {
  console.log("[moralis-auth] INFO: Handling OPTIONS preflight request.");
  try {
    const incomingHeaders = Object.fromEntries(requestHeadersFromReq.entries());
    console.log("[moralis-auth] INFO: Incoming OPTIONS request headers:", JSON.stringify(incomingHeaders));
  } catch (_) {
    // ignore
  }
  return new Response(null, {
    status: 204,
    headers: baseCorsHeaders
  });
}

// Helper for consistent error responses with CORS headers
function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...baseCorsHeaders, // Include base CORS headers
      "Content-Type": "application/json", // Add Content-Type for responses with a JSON body
    }
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function derivePassword(secret: string, evmAddress: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(evmAddress.toLowerCase())
  );

  // URL-safe base64 for use as a password
  const b64 = bytesToBase64(new Uint8Array(signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `mb_${b64}`;
}

async function findAuthUserIdByEmail(supabaseAdmin: any, userEmail: string): Promise<string | null> {
  // Supabase JS admin API does not provide a direct get-by-email helper.
  // Paginate until found (kept bounded for safety).
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data?.users?.find((u: any) => u.email === userEmail);
    if (found?.id) return found.id;
    if (!data?.users || data.users.length < perPage) break;
  }
  return null;
}

serve(async (req) => {
  console.log(`[moralis-auth] INFO: Received request: ${req.method} ${req.url} from Origin: ${req.headers.get('Origin')}`);
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleOptionsRequest(req.headers);
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      return errorResponse("Invalid request body", 400);
    }

    const { message, signature } = body || {};

    // Validate required fields
    if (!message || !signature) {
      return errorResponse("Missing message or signature", 400);
    }

    // Extract claimed address from our message format
    const addrMatch = String(message).match(/Wallet address:\s*(0x[a-fA-F0-9]{40})/);
    if (!addrMatch) {
      console.error("[moralis-auth] ERROR: No wallet address found in message");
      return errorResponse("Invalid message format", 400);
    }

    const claimedAddress = addrMatch[1].toLowerCase();

    // Recover address from signature using EIP-191 personal_sign semantics
    let recovered: string;
    try {
      recovered = ethersUtils.verifyMessage(message, signature).toLowerCase();
    } catch (e) {
      console.error("[moralis-auth] ERROR: Failed to recover address from signature:", e);
      return errorResponse("Invalid signature", 400);
    }

    if (recovered !== claimedAddress) {
      console.error("[moralis-auth] ERROR: Recovered address does not match claimed address", { recovered, claimedAddress });
      return errorResponse("Signature does not match wallet address", 400);
    }

    const evmAddress = recovered;
    console.log("[moralis-auth] INFO: Signature verified for address:", evmAddress);

    // Get Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authPasswordSecret = Deno.env.get("AUTH_PASSWORD_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      console.error("[moralis-auth] ERROR: Supabase URL or Service Role Key not configured");
      return errorResponse("Internal server error: Supabase config missing", 500);
    }
    if (!authPasswordSecret) {
      console.error("[moralis-auth] ERROR: AUTH_PASSWORD_SECRET not configured");
      return errorResponse("Internal server error: Auth secret missing", 500);
    }

    // Create Supabase clients:
    // - admin client (service role): user admin + profile writes
    // - anon client: password sign-in to get proper session tokens
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    // Create or retrieve Supabase Auth user (by email derived from wallet)
    const userEmail = `${evmAddress}@metamask.local`;
    const password = await derivePassword(authPasswordSecret, evmAddress);

    // Prefer profile lookup by wallet for scale, fallback to admin listUsers by email.
    let authUserId: string | null = null;
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("eth_address", evmAddress)
        .maybeSingle();
      if (existingProfile?.id) authUserId = existingProfile.id;
    } catch (e) {
      console.warn("[moralis-auth] WARN: profile lookup failed:", e);
    }

    if (!authUserId) {
      authUserId = await findAuthUserIdByEmail(supabaseAdmin, userEmail);
    }

    // Ensure auth user exists + has the derived password
    if (!authUserId) {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: {
          eth_address: evmAddress,
          username: `Player_${evmAddress.substring(2, 8)}`,
          avatar_url: null,
        },
      });
      if (createErr) {
        const msg = String((createErr as any)?.message ?? createErr);
        // Race/retry: if the user already exists, fall back to lookup+update.
        if (msg.toLowerCase().includes("already")) {
          try {
            authUserId = await findAuthUserIdByEmail(supabaseAdmin, userEmail);
            if (authUserId) {
              await supabaseAdmin.auth.admin.updateUserById(authUserId, {
                password,
                user_metadata: { eth_address: evmAddress },
              });
            }
          } catch (e) {
            console.error("[moralis-auth] ERROR: Failed to recover existing user after createUser conflict:", e);
          }
          if (!authUserId) {
            console.error("[moralis-auth] ERROR: User already exists but could not be located:", createErr);
            return errorResponse("Failed to locate existing user", 500);
          }
        } else {
          console.error("[moralis-auth] ERROR: Failed to create user:", createErr);
          return errorResponse(`Failed to create user: ${msg}`, 500);
        }
      }
      if (!createErr) {
        authUserId = createData.user?.id ?? null;
        console.log("[moralis-auth] INFO: New user created:", authUserId);
      } else {
        console.log("[moralis-auth] INFO: Using existing user:", authUserId);
      }
    } else {
      // Ensure metadata stays in sync
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: {
          eth_address: evmAddress,
        },
      });
    }

    if (!authUserId) {
      return errorResponse("Failed to create or retrieve user", 500);
    }

    // Ensure profile exists (server-side only)
    console.log("[moralis-auth] INFO: Ensuring user profile exists for:", evmAddress);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .rpc("ensure_user_profile_exists", { p_evm_address: evmAddress, p_user_id: authUserId });

    if (profileError) {
      console.error("[moralis-auth] ERROR: Error calling ensure_user_profile_exists:", JSON.stringify(profileError));
      return errorResponse(`Failed to ensure user profile: ${profileError.message}`, 500);
    }
    if (!profileData || profileData.length === 0) {
      console.error("[moralis-auth] ERROR: Profile data not returned from ensure_user_profile_exists", JSON.stringify(profileData));
      return errorResponse("Profile creation or retrieval failed", 500);
    }

    // Create a proper session via GoTrue (no JWT secret required)
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (signInError || !signInData?.session) {
      console.error("[moralis-auth] ERROR: Failed to sign in after verification:", signInError);
      return errorResponse("Failed to establish session", 500);
    }

    const access_token = signInData.session.access_token;
    const refresh_token = signInData.session.refresh_token;

    // Return successful response with tokens and user profile
    return new Response(JSON.stringify({ access_token, refresh_token, user: profileData[0] }), {
      status: 200,
      headers: {
        ...baseCorsHeaders, // Include base CORS headers
        "Content-Type": "application/json", // Add Content-Type for responses with a JSON body
      }
    });

  } catch (error) {
    console.error("[moralis-auth] CRITICAL ERROR in main try block:", error, error.stack);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
