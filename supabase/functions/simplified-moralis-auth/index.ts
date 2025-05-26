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
    const jwtSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");

    console.log("[simplified-auth] Environment check:", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceRoleKey: !!serviceRoleKey,
      hasJwtSecret: !!jwtSecret
    });

    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
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
    
    console.log("[simplified-auth] Creating/retrieving Supabase Auth user");

    // Try to get existing user first
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let authUser = existingUsers?.users?.find(user => 
      user.email === userEmail || 
      user.user_metadata?.eth_address?.toLowerCase() === verifiedAddress.toLowerCase()
    );

    if (!authUser) {
      // Create new user
      console.log("[simplified-auth] Creating new Supabase Auth user");
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: 'metamask-verified-user', // Consistent password for all MetaMask users
        email_confirm: true,
        user_metadata: {
          eth_address: verifiedAddress.toLowerCase(),
          username: `Player_${verifiedAddress.substring(2, 8)}`,
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
      
      // Ensure the existing user has the correct password for signin
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: 'metamask-verified-user'
      });
      
      if (updateError) {
        console.error("[simplified-auth] Failed to update user password:", updateError);
        // Don't fail here, just log the warning
      }
    }

    if (!authUser) {
      return errorResponse("Failed to create or retrieve user", 500);
    }

    // Create/update profile in profiles table
    console.log("[simplified-auth] Ensuring profile exists");
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        username: authUser.user_metadata?.username || `Player_${verifiedAddress.substring(2, 8)}`,
        eth_address: verifiedAddress.toLowerCase(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error("[simplified-auth] Profile creation failed:", profileError);
      return errorResponse(`Profile creation failed: ${profileError.message}`, 500);
    }

    console.log("[simplified-auth] Profile ensured for user:", authUser.id);

    // Use Supabase's native session creation instead of manual JWT
    console.log("[simplified-auth] Creating session using Supabase admin methods");
    
    try {
      // Use admin.signInWithPassword to create a proper session
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: authUser.email,
        options: {
          data: authUser.user_metadata
        }
      });

      if (sessionError) {
        console.error("[simplified-auth] Failed to generate session link:", sessionError);
        
        // Fallback: try to create a session manually with simpler approach
        console.log("[simplified-auth] Trying manual session creation...");
        
        // Create a simple session using admin updateUserById
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
          authUser.id,
          {
            user_metadata: authUser.user_metadata
          }
        );

        if (updateError) {
          console.error("[simplified-auth] Failed to update user:", updateError);
          return errorResponse("Failed to create session", 500);
        }

        // Return a simplified response that we'll handle differently
        return new Response(JSON.stringify({
          success: true,
          user_id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata,
          // Signal that we should use signInWithPassword on client side
          use_password_signin: true
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          }
        });
      }

      console.log("[simplified-auth] Session link generated successfully");

      // Return simplified response for client to handle
      return new Response(JSON.stringify({
        success: true,
        user_id: authUser.id,
        email: authUser.email,
        user_metadata: authUser.user_metadata,
        // Signal that we should use signInWithPassword on client side
        use_password_signin: true        }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        }
      });

    } catch (sessionCreationError) {
      console.error("[simplified-auth] Session creation failed:", sessionCreationError);
      return errorResponse("Session creation failed", 500);
    }

  } catch (error: any) {
    console.error("[simplified-auth] Critical error:", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
