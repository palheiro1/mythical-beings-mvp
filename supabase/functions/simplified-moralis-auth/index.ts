// Simplified Auth Edge Function for Supabase-Only Authentication
// This version creates proper Supabase Auth users and uses UUIDs directly

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { utils as ethersUtils } from "https://esm.sh/ethers@5.7.2";
import { ensureWalletProfile, playerNameFromAddress } from "../_shared/wallet-profile.ts";

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Handle OPTIONS request for CORS preflight
function handleOptionsRequest() {
  console.log("[simplified-auth] Handling OPTIONS preflight request");
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Helper for consistent error responses with CORS headers
function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    }
  });
}

function validateSignature(message: string, signature: string): string | null {
  try {
    const addressMatch = message.match(/Wallet address:\s*(0x[a-fA-F0-9]{40})/);
    if (!addressMatch) {
      console.error("[simplified-auth] No wallet address found in message");
      return null;
    }
    
    const claimedAddress = addressMatch[1].toLowerCase();
    const recoveredAddress = ethersUtils.verifyMessage(message, signature).toLowerCase();

    if (recoveredAddress !== claimedAddress) {
      console.error("[simplified-auth] Signature address mismatch", { recoveredAddress, claimedAddress });
      return null;
    }
    
    console.log("[simplified-auth] Signature validation passed for address:", recoveredAddress);
    return recoveredAddress;
  } catch (error) {
    console.error("[simplified-auth] Signature validation error:", error);
    return null;
  }
}

function createSessionPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `mm_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function findAuthUserForWallet(supabase: any, userEmail: string, verifiedAddress: string): Promise<any | null> {
  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("eth_address", verifiedAddress.toLowerCase())
      .maybeSingle();

    if (existingProfile?.id) {
      const { data, error } = await supabase.auth.admin.getUserById(existingProfile.id);
      if (!error && data?.user) return data.user;
    }
  } catch (error) {
    console.warn("[simplified-auth] Wallet profile lookup failed:", error);
  }

  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data?.users?.find((user: any) =>
      user.email === userEmail ||
      user.user_metadata?.eth_address?.toLowerCase() === verifiedAddress.toLowerCase()
    );

    if (found) return found;
    if (!data?.users || data.users.length < perPage) break;
  }

  return null;
}

serve(async (req) => {
  console.log(`[simplified-auth] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptionsRequest();
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    console.log("[simplified-auth] Starting authentication process");
    
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("[simplified-auth] Request body parsed successfully");
    } catch (error) {
      console.error("[simplified-auth] Failed to parse request body:", error);
      return errorResponse("Invalid request body", 400);
    }

    const { message, signature } = body;

    // Validate required fields
    if (!message || !signature) {
      console.error("[simplified-auth] Missing required fields:", { hasMessage: !!message, hasSignature: !!signature });
      return errorResponse("Missing message or signature", 400);
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("[simplified-auth] Environment check:", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceRoleKey: !!serviceRoleKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[simplified-auth] Missing environment variables");
      return errorResponse("Server configuration error", 500);
    }

    // Verify signature using our native approach
    console.log("[simplified-auth] Verifying signature");
    const verifiedAddress = validateSignature(message, signature);

    if (!verifiedAddress) {
      console.error("[simplified-auth] Signature verification failed");
      return errorResponse("Invalid signature", 400);
    }

    console.log("[simplified-auth] Signature verified for address:", verifiedAddress);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create unique email for this ETH address
    const userEmail = `${verifiedAddress.toLowerCase()}@metamask.local`;
    const displayName = playerNameFromAddress(verifiedAddress);
    const sessionPassword = createSessionPassword();
    
    console.log("[simplified-auth] Creating/retrieving Supabase Auth user");

    // Try to get existing user first
    let authUser = await findAuthUserForWallet(supabase, userEmail, verifiedAddress);

    if (!authUser) {
      // Create new user
      console.log("[simplified-auth] Creating new Supabase Auth user");
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: sessionPassword,
        email_confirm: true,
        user_metadata: {
          eth_address: verifiedAddress.toLowerCase(),
          username: displayName,
          display_name: displayName,
          authentication_method: 'metamask'
        }
      });

      if (createError) {
        console.error("[simplified-auth] Failed to create user:", createError);
        return errorResponse(`Failed to create user: ${createError.message}`, 500);
      }

      authUser = newUserData.user;
      console.log("[simplified-auth] New user created:", authUser?.id);
    } else {
      console.log("[simplified-auth] Existing user found:", authUser.id);
      
      // Rotate a temporary password for this verified wallet login.
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: sessionPassword,
        user_metadata: {
          ...authUser.user_metadata,
          eth_address: verifiedAddress.toLowerCase(),
          username: authUser.user_metadata?.username ?? displayName,
          display_name: authUser.user_metadata?.display_name ?? displayName,
          authentication_method: 'metamask',
        }
      });
      
      if (updateError) {
        console.error("[simplified-auth] Failed to update user password:", updateError);
        return errorResponse("Failed to prepare wallet sign-in", 500);
      }
    }

    if (!authUser) {
      return errorResponse("Failed to create or retrieve user", 500);
    }

    // Create/update profile in profiles table
    console.log("[simplified-auth] Ensuring profile exists");
    let profile: any;
    try {
      profile = await ensureWalletProfile(supabase, authUser.id, verifiedAddress);
    } catch (profileError: any) {
      console.error("[simplified-auth] Profile creation failed:", profileError);
      return errorResponse(`Profile creation failed: ${profileError?.message ?? "profile upsert failed"}`, 500);
    }

    console.log("[simplified-auth] Profile ensured for user:", authUser.id);

    // The client will establish the session with Supabase Auth using this verified local account.
    return new Response(JSON.stringify({
      success: true,
      user_id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
      profile,
      use_password_signin: true,
      signin_password: sessionPassword,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      }
    });

  } catch (error: any) {
    console.error("[simplified-auth] Critical error:", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
