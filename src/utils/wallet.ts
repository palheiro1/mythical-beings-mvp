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

    // Set the session in Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // No refresh token with custom JWT
    });

    if (sessionError) {
      console.error('[wallet] Error setting Supabase session:', sessionError);
      throw sessionError;
    }

    console.log('[wallet] Supabase session set successfully:', sessionData);

    // The user object from setSession might be more aligned with Supabase's internal state
    // or use supabase.auth.getUser() if preferred after setting session.
    // For now, let's return the user profile we got from the function, 
    // as AuthContext/usePlayerIdentification will pick up the official Supabase user.
    return { user: userProfileFromFunction, address, sessionUser: sessionData?.user };
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
