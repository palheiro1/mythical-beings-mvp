// Fixed moralis-auth Edge Function with proper CORS handling
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, type JoseHeader } from "https://deno.land/x/djwt@v2.8/mod.ts"; // Deno JWT library

// Base CORS headers, primarily for preflight (OPTIONS) requests
const baseCorsHeaders = {
  "Access-Control-Allow-Origin": "*", // Using wildcard for development. For production, restrict this.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
};

// Handle OPTIONS request for CORS preflight
function handleOptionsRequest(requestHeadersFromReq) {
  console.log("[moralis-auth] INFO: Handling OPTIONS preflight request.");
  const incomingHeaders = Object.fromEntries(requestHeadersFromReq.entries());
  console.log("[moralis-auth] INFO: Incoming OPTIONS request headers:", JSON.stringify(incomingHeaders));
  
  // Explicitly log the headers object being used for the response
  console.log("[moralis-auth] INFO: Headers being sent for OPTIONS response:", JSON.stringify(baseCorsHeaders));
  return new Response(null, {
    status: 204, // No content response for OPTIONS
    headers: baseCorsHeaders // Use base headers for OPTIONS; Content-Type is not needed for 204
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
      console.error("[moralis-auth] ERROR: MORALIS_API_KEY is not set in environment variables.");
      return errorResponse("Internal server error: Moralis API Key not configured", 500);
    }
    // Log only a portion or a confirmation that it's loaded, not the full key for security.
    console.log(`[moralis-auth] INFO: Using Moralis API Key (type check: ${typeof moralisApiKey === 'string' ? 'string' : 'other'}, first 5 chars): ${moralisApiKey.substring(0, 5)}...`);

    // Verify with Moralis
    const moralisPayload = { message, signature, network: "evm" }; // Changed networkType to network
    console.log("[moralis-auth] INFO: Verifying signature with Moralis at https://authapi.moralis.io/challenge/verify/evm"); // Changed endpoint URL
    console.log("[moralis-auth] INFO: Payload to Moralis:", JSON.stringify(moralisPayload));

    const moralisVerificationResponse = await fetch("https://authapi.moralis.io/challenge/verify/evm", { // Changed endpoint URL
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": moralisApiKey,
      },
      body: JSON.stringify(moralisPayload),
    });

    if (!moralisVerificationResponse.ok) {
      const errorBody = await moralisVerificationResponse.text();
      console.error("Moralis verification failed:", moralisVerificationResponse.status, errorBody);
      return errorResponse(`Moralis verification failed: ${errorBody}`, moralisVerificationResponse.status);
    }

    const moralisResult = await moralisVerificationResponse.json();
    const evmAddress = moralisResult.address;

    if (!evmAddress) {
      console.error("[moralis-auth] ERROR: EVM address not found in Moralis response:", JSON.stringify(moralisResult));
      return errorResponse("Failed to get EVM address from Moralis", 500);
    }

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

    // Ensure user profile exists
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

    const userProfile = profileData[0];
    console.log("[moralis-auth] INFO: User profile retrieved:", JSON.stringify(userProfile));

    // Generate JWT token
    // Check for JWT secret in multiple possible environment variables
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
    if (!jwtSecret) {
      console.error("[moralis-auth] ERROR: JWT_SECRET not configured");
      return errorResponse("Internal server error: JWT secret missing", 500);
    }

    // Create or sign in the user with Supabase Auth using the ETH address as email
    const userEmail = `${evmAddress}@metamask.local`;
    const uniqueUserId = crypto.randomUUID(); // Generate a proper UUID for the user
    
    console.log("[moralis-auth] INFO: Creating/signing in Supabase Auth user with email:", userEmail);

    // Try to sign in the user first, if that fails, create a new user
    let authUser;
    try {
      const { data: signInData, error: signInError } = await supabase.auth.admin.signInWithPassword({
        email: userEmail,
        password: evmAddress // Use ETH address as password (will be hashed)
      });

      if (signInError && signInError.message.includes('Invalid login credentials')) {
        // User doesn't exist, create new user
        console.log("[moralis-auth] INFO: User not found, creating new user");
        const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
          email: userEmail,
          password: evmAddress,
          email_confirm: true,
          user_metadata: {
            eth_address: evmAddress,
            username: userProfile.username || `Player_${evmAddress.substring(2, 8)}`,
            avatar_url: userProfile.avatar_url || null
          }
        });

        if (signUpError) {
          console.error("[moralis-auth] ERROR: Failed to create user:", signUpError);
          return errorResponse(`Failed to create user: ${signUpError.message}`, 500);
        }

        authUser = signUpData.user;
        console.log("[moralis-auth] INFO: New user created:", authUser?.id);
      } else if (signInError) {
        console.error("[moralis-auth] ERROR: Failed to sign in user:", signInError);
        return errorResponse(`Failed to authenticate user: ${signInError.message}`, 500);
      } else {
        authUser = signInData.user;
        console.log("[moralis-auth] INFO: Existing user signed in:", authUser?.id);
      }
    } catch (authError: any) {
      console.error("[moralis-auth] ERROR: Auth operation failed:", authError);
      return errorResponse(`Authentication failed: ${authError.message}`, 500);
    }

    if (!authUser) {
      return errorResponse("Failed to authenticate user", 500);
    }

    // Update user profile with the Supabase Auth user ID
    console.log("[moralis-auth] INFO: Ensuring user profile exists for auth user:", authUser.id);
    const { data: updatedProfileData, error: updatedProfileError } = await supabase
      .rpc("ensure_user_profile_exists", { 
        p_evm_address: evmAddress,
        p_user_id: authUser.id 
      });

    if (updatedProfileError) {
      console.error("[moralis-auth] ERROR: Error calling ensure_user_profile_exists:", JSON.stringify(updatedProfileError));
      return errorResponse(`Failed to ensure user profile: ${updatedProfileError.message}`, 500);
    }

    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
    const payload = {
      sub: authUser.id, // Use the actual Supabase Auth user ID
      role: "authenticated",
      email: authUser.email || userEmail,
      user_metadata: {
        username: authUser.user_metadata?.username || userProfile.username,
        avatar_url: authUser.user_metadata?.avatar_url || userProfile.avatar_url,
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
    return new Response(JSON.stringify({ token, user: userProfile }), {
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
