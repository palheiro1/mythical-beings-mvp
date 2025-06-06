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

// Singleton pattern to prevent React StrictMode race conditions
let authStateManager: AuthStateManager | null = null;

class AuthStateManager {
  private listeners: Set<(state: AuthState) => void> = new Set();
  private currentState: AuthState = { user: null, session: null, loading: true, error: null };
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    console.log('[AuthStateManager] Initializing...');

    try {
      // Get initial session with timeout
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getSession timeout')), 3000)
      );
      
      const { data: { session }, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;
      
      if (sessionError) {
        console.error('[AuthStateManager] Session error:', sessionError);
        this.updateState({ error: sessionError.message, loading: false });
      } else {
        console.log('[AuthStateManager] Initial session:', session ? 'Found' : 'Not found');
        this.updateState({ 
          session, 
          user: session?.user ?? null, 
          loading: false,
          error: null 
        });
      }
    } catch (error: any) {
      console.error('[AuthStateManager] Session check failed:', error);
      if (error.message === 'getSession timeout') {
        console.warn('[AuthStateManager] Session timeout, assuming no session');
        this.updateState({ session: null, user: null, loading: false, error: null });
      } else {
        this.updateState({ error: error.message, loading: false });
      }
    }

    // Set up auth state listener (only once)
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthStateManager] Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      this.updateState({
        session,
        user: session?.user ?? null,
        loading: false,
        error: session ? null : this.currentState.error // Keep error if no session
      });
    });
  }

  private updateState(newState: Partial<AuthState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.currentState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  async signInWithMetaMask(): Promise<AuthenticationResult> {
    console.log('[AuthStateManager] Starting MetaMask authentication...');
    this.updateState({ loading: true, error: null });

    try {
      const result = await metamaskAuth.authenticate();
      
      if (!result.success) {
        this.updateState({ error: result.error || 'Authentication failed', loading: false });
        return result;
      }

      console.log('[AuthStateManager] MetaMask authentication successful');
      
      // Update state immediately - auth listener will handle the final state
      if (result.user && result.session) {
        this.updateState({ 
          user: result.user, 
          session: result.session, 
          loading: false,
          error: null 
        });
      }
      
      return result;

    } catch (error: any) {
      console.error('[AuthStateManager] MetaMask authentication error:', error);
      const errorMessage = error.message || 'Authentication failed';
      this.updateState({ error: errorMessage, loading: false });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async signOut(): Promise<void> {
    console.log('[AuthStateManager] Signing out...');
    this.updateState({ loading: true, error: null });

    try {
      await metamaskAuth.signOut();
      // Auth listener will handle state update
    } catch (error: any) {
      console.error('[AuthStateManager] Sign out error:', error);
      this.updateState({ error: error.message, loading: false });
    }
  }
}

function getAuthStateManager(): AuthStateManager {
  if (!authStateManager) {
    authStateManager = new AuthStateManager();
  }
  return authStateManager;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ 
    user: null, 
    session: null, 
    loading: true, 
    error: null 
  });

  useEffect(() => {
    const manager = getAuthStateManager();
    const unsubscribe = manager.subscribe(setAuthState);
    
    return unsubscribe;
  }, []);

  const signInWithMetaMask = async (): Promise<AuthenticationResult> => {
    const manager = getAuthStateManager();
    return manager.signInWithMetaMask();
  };

  const signOut = async (): Promise<void> => {
    const manager = getAuthStateManager();
    return manager.signOut();
  };

  const value: AuthContextType = {
    ...authState,
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
