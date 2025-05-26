// Global Authentication Provider for React StrictMode Compatibility
// This prevents multiple useAuth instances from conflicting and causing loading state issues

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase.js';
import { metamaskAuth, AuthenticationResult } from '../services/metamaskAuth.js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signInWithMetaMask: () => Promise<AuthenticationResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    console.log('[AuthProvider] Initializing authentication state...');

    // Prevent double initialization in React StrictMode
    if (initializedRef.current) {
      console.log('[AuthProvider] Already initialized, skipping...');
      return;
    }
    initializedRef.current = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthProvider] Error getting initial session:', sessionError);
          setError(sessionError.message);
        } else {
          console.log('[AuthProvider] Initial session:', session ? 'Found' : 'Not found');
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error: any) {
        console.error('[AuthProvider] Error in getInitialSession:', error);
        setError(error.message);
      } finally {
        console.log('[AuthProvider] Setting loading to false after initial session check');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, session ? 'Session exists' : 'No session');
        console.log('[AuthProvider] Auth state change details:', {
          event,
          userId: session?.user?.id,
          hasSession: !!session
        });
        console.log('[AuthProvider] Setting loading to false due to auth state change');
        
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
      console.log('[AuthProvider] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to only run once

  const signInWithMetaMask = async (): Promise<AuthenticationResult> => {
    console.log('[AuthProvider] Starting MetaMask authentication...');
    setLoading(true);
    setError(null);

    try {
      const result = await metamaskAuth.authenticate();
      
      if (!result.success) {
        setError(result.error || 'Authentication failed');
        setLoading(false);
        return result;
      }

      console.log('[AuthProvider] MetaMask authentication successful');
      
      // Update state immediately and let the auth listener handle it later
      if (result.user && result.session) {
        console.log('[AuthProvider] Updating state immediately with user:', result.user.id);
        setUser(result.user);
        setSession(result.session);
        setLoading(false);
      }
      
      // The auth state will be updated automatically via the auth listener
      return result;

    } catch (error: any) {
      console.error('[AuthProvider] MetaMask authentication error:', error);
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
    console.log('[AuthProvider] Signing out...');
    setLoading(true);
    setError(null);

    try {
      await metamaskAuth.signOut();
      // The auth state will be updated automatically via the auth listener
    } catch (error: any) {
      console.error('[AuthProvider] Sign out error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    signInWithMetaMask,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
