// Simplified Authentication Hook for Supabase-Only Architecture
// This replaces the complex usePlayerIdentification with a clean, simple approach

import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase.js';
import { metamaskAuth, AuthenticationResult } from '../services/metamaskAuth.js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): AuthState & {
  signInWithMetaMask: () => Promise<AuthenticationResult>;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useAuth] Initializing authentication state...');

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[useAuth] Error getting initial session:', sessionError);
          setError(sessionError.message);
        } else {
          console.log('[useAuth] Initial session:', session ? 'Found' : 'Not found');
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error: any) {
        console.error('[useAuth] Error in getInitialSession:', error);
        setError(error.message);
      } finally {
        console.log('[useAuth] Setting loading to false after initial session check');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth state changed:', event, session ? 'Session exists' : 'No session');
        console.log('[useAuth] Setting loading to false due to auth state change');
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Clear error on successful auth
        if (session) {
          setError(null);
        }
      }
    );

    return () => {
      console.log('[useAuth] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to only run once

  const signInWithMetaMask = async (): Promise<AuthenticationResult> => {
    console.log('[useAuth] Starting MetaMask authentication...');
    setLoading(true);
    setError(null);

    try {
      const result = await metamaskAuth.authenticate();
      
      if (!result.success) {
        setError(result.error || 'Authentication failed');
        setLoading(false);
        return result;
      }

      console.log('[useAuth] MetaMask authentication successful');
      
      // The auth state will be updated automatically via the auth listener
      return result;

    } catch (error: any) {
      console.error('[useAuth] MetaMask authentication error:', error);
      const errorMessage = error.message || 'Authentication failed';
      setError(errorMessage);
      setLoading(false);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const signOut = async (): Promise<void> => {
    console.log('[useAuth] Signing out...');
    setLoading(true);
    setError(null);

    try {
      await metamaskAuth.signOut();
      // The auth state will be updated automatically via the auth listener
    } catch (error: any) {
      console.error('[useAuth] Sign out error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    session,
    loading,
    error,
    signInWithMetaMask,
    signOut
  };
}
