// MetaMask Authentication Service for Simplified Supabase-Only Architecture
// This service handles MetaMask wallet connection and signature verification
// Uses Supabase Auth as the single source of truth

import { supabase } from '../utils/supabase.js';

export interface AuthenticationResult {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
}

export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  error?: string;
}

class MetaMaskAuthService {
  private static instance: MetaMaskAuthService;
  private isConnecting = false;

  public static getInstance(): MetaMaskAuthService {
    if (!MetaMaskAuthService.instance) {
      MetaMaskAuthService.instance = new MetaMaskAuthService();
    }
    return MetaMaskAuthService.instance;
  }

  private constructor() {}

  /**
   * Check if MetaMask is available
   */
  public isMetaMaskAvailable(): boolean {
    return typeof (window as any).ethereum !== 'undefined';
  }

  /**
   * Connect to MetaMask wallet
   */
  public async connectWallet(): Promise<WalletConnectionResult> {
    if (!this.isMetaMaskAvailable()) {
      return {
        success: false,
        error: 'MetaMask is not installed. Please install MetaMask to continue.'
      };
    }

    if (this.isConnecting) {
      return {
        success: false,
        error: 'Connection already in progress'
      };
    }

    try {
      this.isConnecting = true;
      
      const ethereum = (window as any).ethereum;
      
      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        return {
          success: false,
          error: 'No accounts found. Please ensure MetaMask is unlocked.'
        };
      }

      const address = accounts[0];
      console.log('[MetaMaskAuth] Wallet connected:', address);

      return {
        success: true,
        address: address.toLowerCase() // Normalize to lowercase
      };

    } catch (error: any) {
      console.error('[MetaMaskAuth] Wallet connection failed:', error);
      
      // Handle specific MetaMask errors
      if (error.code === 4001) {
        return {
          success: false,
          error: 'Connection rejected by user'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to connect to MetaMask'
      };
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Generate a challenge message for signature
   */
  private generateChallengeMessage(address: string): string {
    const timestamp = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2, 15);
    
    return `Welcome to Mythical Beings Card Game!

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: ${address}
Timestamp: ${timestamp}
Nonce: ${nonce}

By signing this message, you are proving ownership of this wallet address.`;
  }

  /**
   * Request signature from MetaMask
   */
  public async requestSignature(address: string): Promise<{ message: string; signature: string } | null> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask is not available');
    }

    try {
      const ethereum = (window as any).ethereum;
      const message = this.generateChallengeMessage(address);
      
      console.log('[MetaMaskAuth] Requesting signature for message:', message);
      
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      if (!signature) {
        throw new Error('No signature received');
      }

      console.log('[MetaMaskAuth] Signature received');
      
      return {
        message,
        signature
      };

    } catch (error: any) {
      console.error('[MetaMaskAuth] Signature request failed:', error);
      
      if (error.code === 4001) {
        throw new Error('Signature rejected by user');
      }
      
      throw new Error(error.message || 'Failed to get signature');
    }
  }

  /**
   * Verify signature with Supabase and authenticate user
   */
  public async authenticateWithSignature(message: string, signature: string): Promise<AuthenticationResult> {
    try {
      console.log('[MetaMaskAuth] Verifying signature via Edge Function (moralis-auth)...');

      // Prefer the verified Moralis flow which does not require a pre-existing JWT
      const { data, error } = await supabase.functions.invoke('moralis-auth', {
        body: { message, signature }
      });

      if (error) {
        console.error('[MetaMaskAuth] Edge Function error:', error);
        return { success: false, error: error.message || 'Authentication failed' };
      }

      // Expecting { token, user }
  const token: string | undefined = (data as any)?.token;

      if (!token) {
        console.error('[MetaMaskAuth] No token returned from Edge Function');
        return { success: false, error: 'No token returned from auth service' };
      }

      // Establish Supabase session with returned JWT
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token
      });

      if (sessionError || !sessionData?.session) {
        console.error('[MetaMaskAuth] Failed to set session:', sessionError);
        return { success: false, error: 'Failed to establish session' };
      }

      console.log('[MetaMaskAuth] Session established. User:', sessionData.user?.id);

      return {
        success: true,
        user: sessionData.user,
        session: sessionData.session
      };
    } catch (error: any) {
      console.error('[MetaMaskAuth] Authentication error:', error);
      return { success: false, error: error.message || 'Authentication failed' };
    }
  }

  /**
   * Complete authentication flow: connect wallet -> sign message -> authenticate
   */
  public async authenticate(): Promise<AuthenticationResult> {
    try {
      // Step 1: Connect wallet
      const connectionResult = await this.connectWallet();
      if (!connectionResult.success) {
        return {
          success: false,
          error: connectionResult.error
        };
      }

      const address = connectionResult.address!;

      // Step 2: Request signature
      const signatureData = await this.requestSignature(address);
      if (!signatureData) {
        return {
          success: false,
          error: 'Failed to get signature'
        };
      }

      // Step 3: Authenticate with signature
      return await this.authenticateWithSignature(signatureData.message, signatureData.signature);

    } catch (error: any) {
      console.error('[MetaMaskAuth] Full authentication flow failed:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  /**
   * Sign out user
   */
  public async signOut(): Promise<void> {
    await supabase.auth.signOut();
    console.log('[MetaMaskAuth] User signed out');
  }
}

// Export singleton instance
export const metamaskAuth = MetaMaskAuthService.getInstance();
