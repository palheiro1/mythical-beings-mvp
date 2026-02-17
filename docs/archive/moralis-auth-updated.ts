// Fixed moralis-auth Edge Function with proper CORS handling
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "https://deno.land/x/djwt@v2.8/mod.ts"; // Deno JWT library

// CORS headers with proper configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Using wildcard for development
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
  "Content-Type": "application/json"
};

// Handle OPTIONS request for CORS preflight
function handleOptionsRequest() {
  return new Response(null, {
    status: 204, // No content response for OPTIONS
    headers: corsHeaders
  });
}

// Helper for consistent error responses with CORS headers
function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get Moralis API Key
    const moralisApiKey = Deno.env.get("MORALIS_API_KEY");
    if (!moralisApiKey) {
      console.error("MORALIS_API_KEY is not set");
      return errorResponse("Internal server error: Moralis API Key not configured", 500);
    }

    // Verify with Moralis
    console.log("Verifying signature with Moralis...");
    const moralisVerificationResponse = await fetch("https://deep-index.moralis.io/api/v2.2/auth/challenge/verify/evm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": moralisApiKey,
      },
      body: JSON.stringify({ message, signature, networkType: "evm" }),
    });

    if (!moralisVerificationResponse.ok) {
      const errorBody = await moralisVerificationResponse.text();
      console.error("Moralis verification failed:", moralisVerificationResponse.status, errorBody);
      return errorResponse(`Moralis verification failed: ${errorBody}`, moralisVerificationResponse.status);
    }

    const moralisResult = await moralisVerificationResponse.json();
    const evmAddress = moralisResult.address;

    if (!evmAddress) {
      console.error("EVM address not found in Moralis response:", moralisResult);
      return errorResponse("Failed to get EVM address from Moralis", 500);
    }

    console.log("Signature verified for address:", evmAddress);

    // Get Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase URL or Service Role Key not configured");
      return errorResponse("Internal server error: Supabase config missing", 500);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure user profile exists
    console.log("Ensuring user profile exists for:", evmAddress);
    const { data: profileData, error: profileError } = await supabase
      .rpc("ensure_user_profile_exists", { p_evm_address: evmAddress });

    if (profileError) {
      console.error("Error calling ensure_user_profile_exists:", profileError);
      return errorResponse(`Failed to ensure user profile: ${profileError.message}`, 500);
    }
    
    if (!profileData || profileData.length === 0) {
      console.error("Profile data not returned from ensure_user_profile_exists", profileData);
      return errorResponse("Profile creation or retrieval failed", 500);
    }

    const userProfile = profileData[0];
    console.log("User profile retrieved:", userProfile);

    // Generate JWT token
    // Check for JWT secret in multiple possible environment variables
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
    if (!jwtSecret) {
      console.error("JWT_SECRET not configured");
      return errorResponse("Internal server error: JWT secret missing", 500);
    }

    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
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

    // Convert the secret to a CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    const token = await sign(payload, cryptoKey);
    console.log("JWT token generated successfully");

    // Return successful response with token and user data
    return new Response(JSON.stringify({ token, user: userProfile }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error("Error in moralis-auth function:", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
