// Global Authentication Provider for React StrictMode Compatibility
// This prevents multiple useAuth instances from conflicting and causing loading state issues

import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    console.log('[AuthProvider] Initializing...');
    
    let isMounted = true;

    // Get initial session with timeout for Chrome compatibility
    const getInitialSession = async () => {
      try {
        console.log('[AuthProvider] Getting initial session...');
        
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 3000)
        );
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error('[AuthProvider] Session error:', sessionError);
          setError(sessionError.message);
        } else {
          console.log('[AuthProvider] Initial session:', session ? 'Found' : 'Not found');
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error: any) {
        console.error('[AuthProvider] Session check failed:', error);
        if (isMounted) {
          if (error.message === 'getSession timeout') {
            console.warn('[AuthProvider] Session timeout, assuming no session');
            setSession(null);
            setUser(null);
          } else {
            setError(error.message);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Single auth state listener with simple debouncing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('[AuthProvider] Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session) {
          setError(null);
        }
      }
    );

    return () => {
      console.log('[AuthProvider] Cleanup');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // No dependencies to prevent re-initialization

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
