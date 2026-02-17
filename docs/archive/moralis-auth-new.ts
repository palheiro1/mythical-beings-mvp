// moralis-auth Edge Function with improved CORS handling
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "https://deno.land/x/djwt@v2.8/mod.ts"; // Deno JWT library

// CORS headers with proper configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Use specific origin in production
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // 24 hours caching for preflight requests
};

// Helper function for CORS error responses
function corsErrorResponse(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204, // No content for OPTIONS
      headers: corsHeaders,
    });
  }

  // Only allow POST method
  if (req.method !== "POST") {
    return corsErrorResponse("Method not allowed", 405);
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return corsErrorResponse("Invalid JSON", 400);
    }

    const { message, signature } = body;

    if (!message || !signature) {
      return corsErrorResponse("Missing required fields: message and signature", 400);
    }

    // Get Moralis API Key
    const moralisApiKey = Deno.env.get("MORALIS_API_KEY");
    if (!moralisApiKey) {
      console.error("MORALIS_API_KEY is not set");
      return corsErrorResponse("Server configuration error", 500);
    }

    // Call Moralis to verify the message
    console.log("Verifying message with Moralis...");
    const moralisResponse = await fetch("https://deep-index.moralis.io/api/v2.2/auth/challenge/verify/evm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": moralisApiKey,
      },
      body: JSON.stringify({ message, signature, networkType: "evm" }),
    });

    // Handle Moralis verification errors
    if (!moralisResponse.ok) {
      const errorText = await moralisResponse.text();
      console.error("Moralis verification failed:", moralisResponse.status, errorText);
      return corsErrorResponse(`Moralis verification failed: ${errorText}`, moralisResponse.status);
    }

    // Get verified address
    const moralisResult = await moralisResponse.json();
    const evmAddress = moralisResult.address;

    if (!evmAddress) {
      console.error("EVM address not found in Moralis response:", moralisResult);
      return corsErrorResponse("Failed to get EVM address from Moralis", 500);
    }

    console.log("Verification successful for address:", evmAddress);

    // Get Supabase connection info
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase URL or Service Role Key not configured");
      return corsErrorResponse("Server configuration error", 500);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure user profile exists
    console.log("Ensuring user profile exists for address:", evmAddress);
    const { data: profileData, error: profileError } = await supabase
      .rpc("ensure_user_profile_exists", { p_evm_address: evmAddress });

    if (profileError) {
      console.error("Error calling ensure_user_profile_exists:", profileError);
      return corsErrorResponse(`Failed to ensure user profile: ${profileError.message}`, 500);
    }

    if (!profileData || profileData.length === 0) {
      console.error("Profile data not returned from ensure_user_profile_exists", profileData);
      return corsErrorResponse("Profile creation or retrieval failed", 500);
    }

    const userProfile = profileData[0];
    console.log("User profile retrieved:", userProfile);

    // Get JWT secret
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
    if (!jwtSecret) {
      console.error("JWT_SECRET or SUPABASE_JWT_SECRET not configured");
      return corsErrorResponse("Server configuration error", 500);
    }

    // Set token expiration to 7 days
    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7);
    
    // Create JWT payload
    const payload = {
      sub: evmAddress,
      role: "authenticated",
      email: userProfile.email || "",
      user_metadata: {
        username: userProfile.username,
        avatar_url: userProfile.avatar_url,
      },
      aud: "authenticated",
      iss: supabaseUrl,
      exp: expirationTime,
    };

    // Create crypto key and sign token
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    const token = await sign(payload, cryptoKey);
    console.log("JWT token generated successfully");

    // Return successful response
    return new Response(JSON.stringify({ token, user: userProfile }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("Error in moralis-auth function:", error);
    return corsErrorResponse(error.message || "Internal server error", 500);
  }
});
