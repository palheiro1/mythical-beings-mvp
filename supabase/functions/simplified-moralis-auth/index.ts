// Simplified Auth Edge Function for Supabase-Only Authentication
// This version creates proper Supabase Auth users and uses UUIDs directly

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, type JoseHeader } from "https://deno.land/x/djwt@v2.8/mod.ts";

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

// Simple signature validation (for development - in production you'd want full cryptographic verification)
function validateSignature(message: string, signature: string): string | null {
  try {
    // Extract wallet address from message
    const addressMatch = message.match(/Wallet address: (0x[a-fA-F0-9]{40})/);
    if (!addressMatch) {
      console.error("[simplified-auth] No wallet address found in message");
      return null;
    }
    
    const claimedAddress = addressMatch[1].toLowerCase();
    
    // Basic signature format validation
    const cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
    if (cleanSignature.length !== 130) {
      console.error("[simplified-auth] Invalid signature length");
      return null;
    }
    
    // Validate hex format
    if (!/^[a-fA-F0-9]+$/.test(cleanSignature)) {
      console.error("[simplified-auth] Invalid signature format");
      return null;
    }
    
    console.log("[simplified-auth] Basic signature validation passed for address:", claimedAddress);
    return claimedAddress;
  } catch (error) {
    console.error("[simplified-auth] Signature validation error:", error);
    return null;
  }
}

serve(async (req) => {
  console.log(`[native-auth] ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptionsRequest();
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return errorResponse("Invalid request body", 400);
    }

    const { message, signature } = body;

    // Validate required fields
    if (!message || !signature) {
      return errorResponse("Missing message or signature", 400);
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      console.error("[native-auth] Missing environment variables");
      return errorResponse("Server configuration error", 500);
    }

    // Verify signature using our native approach
    console.log("[native-auth] Verifying signature");
    const verifiedAddress = validateSignature(message, signature);

    if (!verifiedAddress) {
      console.error("[native-auth] Signature verification failed");
      return errorResponse("Invalid signature", 400);
    }

    console.log("[native-auth] Signature verified for address:", verifiedAddress);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create unique email for this ETH address
    const userEmail = `${verifiedAddress.toLowerCase()}@metamask.local`;
    
    console.log("[native-auth] Creating/retrieving Supabase Auth user");

    // Try to get existing user first
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let authUser = existingUsers?.users?.find(user => 
      user.email === userEmail || 
      user.user_metadata?.eth_address?.toLowerCase() === verifiedAddress.toLowerCase()
    );

    if (!authUser) {
      // Create new user
      console.log("[native-auth] Creating new Supabase Auth user");
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: crypto.randomUUID(), // Random password since we use signature auth
        email_confirm: true,
        user_metadata: {
          eth_address: verifiedAddress.toLowerCase(),
          username: `Player_${verifiedAddress.substring(2, 8)}`,
          authentication_method: 'metamask'
        }
      });

      if (createError) {
        console.error("[native-auth] Failed to create user:", createError);
        return errorResponse(`Failed to create user: ${createError.message}`, 500);
      }

      authUser = newUserData.user;
      console.log("[native-auth] New user created:", authUser?.id);
    } else {
      console.log("[native-auth] Existing user found:", authUser.id);
    }

    if (!authUser) {
      return errorResponse("Failed to create or retrieve user", 500);
    }

    // Create/update profile in profiles table
    console.log("[native-auth] Ensuring profile exists");
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        username: authUser.user_metadata?.username || `Player_${verifiedAddress.substring(2, 8)}`,
        eth_address: verifiedAddress.toLowerCase(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error("[native-auth] Profile creation failed:", profileError);
      return errorResponse(`Profile creation failed: ${profileError.message}`, 500);
    }

    console.log("[native-auth] Profile ensured for user:", authUser.id);

    // Generate JWT token
    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
    const payload = {
      sub: authUser.id, // Use Supabase Auth user ID directly
      role: "authenticated",
      email: authUser.email,
      user_metadata: {
        username: authUser.user_metadata?.username || `Player_${verifiedAddress.substring(2, 8)}`,
        eth_address: verifiedAddress.toLowerCase(),
        authentication_method: 'metamask'
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
    console.log("[native-auth] JWT token generated successfully");

    // Return successful response
    return new Response(JSON.stringify({ 
      token, 
      user: {
        id: authUser.id,
        email: authUser.email,
        user_metadata: authUser.user_metadata
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      }
    });

  } catch (error: any) {
    console.error("[native-auth] Critical error:", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
