// MetaMask auth Edge Function with local signature verification (no Moralis dependency)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, type JoseHeader } from "https://deno.land/x/djwt@v2.8/mod.ts"; // Deno JWT library
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

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[moralis-auth] ERROR: Supabase URL or Service Role Key not configured");
      return errorResponse("Internal server error: Supabase config missing", 500);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure user profile exists (creates a profile and returns it, creating user row if needed)
    console.log("[moralis-auth] INFO: Ensuring user profile exists for:", evmAddress);
    const { data: profileData, error: profileError } = await supabase
      .rpc("ensure_user_profile_exists", { p_evm_address: evmAddress });

    if (profileError) {
      console.error("[moralis-auth] ERROR: Error calling ensure_user_profile_exists:", JSON.stringify(profileError));
      return errorResponse(`Failed to ensure user profile: ${profileError.message}`, 500);
    }
    if (!profileData || profileData.length === 0) {
      console.error("[moralis-auth] ERROR: Profile data not returned from ensure_user_profile_exists", JSON.stringify(profileData));
      return errorResponse("Profile creation or retrieval failed", 500);
    }

    // Create or retrieve Supabase Auth user (by email derived from wallet)
    const userEmail = `${evmAddress}@metamask.local`;
    let authUser = (await supabase.auth.admin.listUsers()).data?.users?.find((u: any) => u.email === userEmail);
    if (!authUser) {
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: "metamask-verified-user",
        email_confirm: true,
        user_metadata: {
          eth_address: evmAddress,
          username: profileData[0]?.username || `Player_${evmAddress.substring(2, 8)}`,
          avatar_url: profileData[0]?.avatar_url || null,
        },
      });
      if (createErr) {
        console.error("[moralis-auth] ERROR: Failed to create user:", createErr);
        return errorResponse(`Failed to create user: ${createErr.message}`, 500);
      }
      authUser = createData.user;
      console.log("[moralis-auth] INFO: New user created:", authUser?.id);
    } else {
      // Ensure metadata stays in sync
      await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          eth_address: evmAddress,
        },
      });
    }

    if (!authUser) {
      return errorResponse("Failed to create or retrieve user", 500);
    }

    // Update profile with the Supabase Auth user ID (id column)
    const { error: profileUpsertErr } = await supabase
      .from("profiles")
      .upsert({
        id: authUser.id,
        eth_address: evmAddress,
        username: profileData[0]?.username || `Player_${evmAddress.substring(2, 8)}`,
        avatar_url: profileData[0]?.avatar_url || null,
        updated_at: new Date().toISOString(),
      });
    if (profileUpsertErr) {
      console.error("[moralis-auth] ERROR: Failed to upsert profile with auth user id:", profileUpsertErr);
      return errorResponse("Profile sync failed", 500);
    }

    // Generate JWT token signed with project secret
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
    if (!jwtSecret) {
      console.error("[moralis-auth] ERROR: JWT_SECRET not configured");
      return errorResponse("Internal server error: JWT secret missing", 500);
    }

  const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
  const payload = {
      sub: authUser.id, // Use the actual Supabase Auth user ID
      role: "authenticated",
      email: authUser.email || userEmail,
      user_metadata: {
    username: authUser.user_metadata?.username || profileData[0]?.username,
    avatar_url: authUser.user_metadata?.avatar_url || profileData[0]?.avatar_url,
        eth_address: evmAddress, // Store the actual ETH address in metadata
      },
      aud: "authenticated",
      iss: supabaseUrl,
      exp: expirationTime,
    };

    // Convert the secret to a CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const header: JoseHeader = {
      alg: "HS256",
      typ: "JWT",
    };

  const token = await create(header, payload, cryptoKey);
    console.log("[moralis-auth] INFO: JWT token generated successfully");

  // Return successful response with token and user data
  return new Response(JSON.stringify({ token, user: profileData[0] }), {
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
