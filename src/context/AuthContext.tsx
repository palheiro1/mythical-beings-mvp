// File: src/context/AuthContext.tsx
import { createContext, useState, useEffect, useContext, type ReactNode, type JSX } from 'react';
import type { AuthSession as Session, AuthUser as User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase.js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log('[AuthProvider] Initial session:', session);
    }).catch((error: any) => {
        console.error("[AuthProvider] Error getting initial session:", error);
        setLoading(false);
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        console.log('[AuthProvider] Auth state changed:', _event, session);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            // Check if profile exists for Clerk user ID
            const { error } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .single();

            if (error?.code === 'PGRST116') { // No rows found
              console.log('[AuthProvider] Creating new profile for user:', session.user.id);
              await supabase.from('profiles').insert({
                id: session.user.id,
                username: `Player${Math.floor(Math.random() * 1000)}`,
                avatar_url: null
              });
            }
          } catch (error) {
            console.error('[AuthProvider] Profile check/create error:', error);
          }
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("[AuthProvider] Error signing out:", error);
    } else {
        console.log("[AuthProvider] User signed out.");
        // State updates handled by onAuthStateChange
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
