// filepath: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/src/utils/wallet.ts
import { ethers } from 'ethers';
import Moralis from 'moralis';
import { supabase } from './supabase.js';

declare global {
  interface Window {
    ethereum: any;
  }
}

/**
 * Connect to MetaMask and return the provider, signer and address.
 */
export async function connectWallet() {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to proceed.');
    }

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Check if accounts array is not empty
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask and try again.');
    }

    const address = accounts[0];
    // Updated for ethers v6
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    return { provider, signer, address, chainId };
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    throw error;
  }
}

/**
 * Authenticate with Moralis and Supabase using the connected wallet.
 * This function handles the full authentication flow:
 * 1. Request a message from Moralis
 * 2. Sign the message with the wallet
 * 3. Verify the signature with our Edge Function
 * 4. Set the returned JWT in Supabase session
 */
export async function authenticateWithMoralis() {
  try {
    // First connect the wallet
    const { signer, address, chainId } = await connectWallet();

    // Request challenge from Moralis
    const messageResponse = await Moralis.Auth.requestMessage({
      address,
      chain: chainId,
      networkType: 'evm',
      domain: window.location.host,
      statement: 'Please sign this message to authenticate with Mythical Beings Card Game.',
      uri: window.location.origin,
      // Optional fields for additional security
      timeout: 60
    });

    const { message } = messageResponse.toJSON();
    
    // Sign the message with user's wallet
    const signature = await signer.signMessage(message);
    
    // Call our Supabase Edge Function for verification and JWT minting
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/moralis-auth`;
    
    console.log("Calling Edge Function at:", functionUrl);
    console.log("With payload:", { message, signature });
    
    const response = await fetch(
      functionUrl,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Adding mode and credentials for better CORS handling
          'Accept': 'application/json'
        },
        // Using no-cors mode can help with CORS issues but limits response access
        // mode: 'no-cors', 
        // Including credentials if your server supports it
        // credentials: 'include',
        body: JSON.stringify({ message, signature }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const errorInfo = {
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      };
      console.error('Authentication response error:', errorInfo);
      
      // If it's a CORS error, it will usually show up as a network error or status 0
      if (response.status === 0 || response.type === 'opaque') {
        throw new Error(`CORS issue detected. Please check CORS configuration on the server: ${JSON.stringify(errorInfo)}`);
      }
      
      throw new Error(`Authentication failed: ${response.status} ${errorText}`);
    }

    // Parse response
    const { token, user: userProfileFromFunction } = await response.json();
    
    console.log('[wallet] Token received:', token);
    console.log('[wallet] User profile from function:', userProfileFromFunction);

    if (!token) {
      console.error('[wallet] No token received from Edge Function.');
      throw new Error('Authentication failed: No token received.');
    }
    if (!userProfileFromFunction) {
      console.error('[wallet] No user profile received from Edge Function.');
      throw new Error('Authentication failed: No user profile received.');
    }

    console.log('[wallet] Setting up session with token.');

    let sessionData, sessionError;
    try {
      // First, store the token in localStorage to ensure persistence
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: token,
        expires_at: Date.now() + 3600 * 1000, // 1 hour from now
        token_type: 'bearer',
        user: userProfileFromFunction
      }));
      
      console.log('[wallet] Token stored in localStorage. Setting session with Supabase.');
      
      // Check if the token is valid by parsing it (basic check)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Decode the payload to check the subject format
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('[wallet] JWT payload:', payload);
      
      // Store both the ETH address for reference (no UUID conversion needed)
      localStorage.setItem('eth_address', userProfileFromFunction.id);
      
      const result = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token // For custom JWT flows, using the same token works better
      });
      sessionData = result.data;
      sessionError = result.error;
      console.log('[wallet] supabase.auth.setSession call completed.'); // Log completion
    } catch (e) {
      console.error('[wallet] CRITICAL ERROR during supabase.auth.setSession call:', e);
      throw e; // Re-throw to be caught by the outer catch block
    }

    if (sessionError) {
      console.error('[wallet] Error setting Supabase session (from result.error):', sessionError);
      
      // If the error mentions "sub claim must be a UUID", we need to deploy the updated Edge function
      if (sessionError.message && sessionError.message.includes('sub claim must be a UUID')) {
        console.error('[wallet] The Edge Function needs to be updated to format the ETH address as a UUID');
        console.log('[wallet] Using a client-side workaround for now...');
        
        try {
          // Create a manual session object and store it in localStorage
          const session = {
            access_token: token,
            token_type: 'bearer',
            user: {
              id: userProfileFromFunction.id,
              app_metadata: { provider: 'moralis' },
              user_metadata: {
                eth_address: userProfileFromFunction.id,
                username: userProfileFromFunction.username,
                avatar_url: userProfileFromFunction.avatar_url
              },
              aud: 'authenticated'
            }
          };
          
          // Store this manually in localStorage
          localStorage.setItem('supabase.auth.token', JSON.stringify(session));
          
          // Create manual session data to return
          sessionData = { session, user: session.user };
          console.log('[wallet] Created manual session as workaround:', sessionData);
          
          // Continue with the workaround session
          return { user: userProfileFromFunction, address: userProfileFromFunction.id, sessionUser: session.user };
        } catch (workaroundError) {
          console.error('[wallet] Workaround attempt failed:', workaroundError);
        }
      }
      
      // If we get here, try a more standard fallback approach
      console.log('[wallet] Attempting standard fallback authentication...');
      try {
        // Try a simple auth refresh
        const { data } = await supabase.auth.refreshSession();
        
        if (data.session) {
          sessionData = data;
          console.log('[wallet] Session refresh successful:', data);
        } else {
          console.error('[wallet] All authentication attempts failed');
          throw sessionError;
        }
      } catch (fallbackError) {
        console.error('[wallet] All authentication attempts failed');
        throw sessionError; // Throw original error if fallback also fails
      }
    }

    if (!sessionData?.session) {
        console.error('[wallet] Supabase session not set, sessionData or sessionData.session is null/undefined after setSession call.', sessionData);
        
        // Try one more approach - manually create a session
        try {
          // Force a session refresh
          await supabase.auth.refreshSession();
          const { data } = await supabase.auth.getSession();
          
          if (data.session) {
            console.log('[wallet] Successfully recovered session after refresh');
            sessionData = data;
          } else {
            throw new Error('Failed to set Supabase session: No session data returned after refresh.');
          }
        } catch (refreshError) {
          console.error('[wallet] Session refresh attempt failed:', refreshError);
          throw new Error('Failed to set Supabase session: No session data returned.');
        }
    }

    console.log('[wallet] Supabase session set successfully:', sessionData);

    // Return the user information
    return { user: userProfileFromFunction, address, sessionUser: sessionData?.session?.user };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Sign out the current user from Supabase.
 */
export async function signOut() {
  await supabase.auth.signOut();
}
