import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js'; // Import supabase client (with .js extension)
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

/**
 * Hook to determine the current player's ID (EVM address) from Supabase session.
 * This is set after successful Moralis authentication and JWT setup.
 * @returns Tuple with currentPlayerId (EVM address), user, loading state, and error
 */
export function usePlayerIdentification(): [
  string | null, // currentPlayerId (EVM Address from Supabase session)
  User | null,   // Supabase user object
  boolean,       // loading
  string | null  // error message
] {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[usePlayerIdentification] Checking Supabase session...');
    
    // Get the initial session
    const fetchSession = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[usePlayerIdentification] Error fetching session:', sessionError);
          setError('Failed to fetch authentication session');
          setLoading(false);
          return;
        }

        if (data?.session) {
          console.log('[usePlayerIdentification] Session found, user is authenticated');
          setUser(data.session.user);
          // The user ID in the session is the EVM address (from the sub claim in the JWT)
          setPlayerId(data.session.user.id);
          setError(null);
        } else {
          console.log('[usePlayerIdentification] No active session found');
          setPlayerId(null);
          setUser(null);
          setError(null); // Not an error state, just not authenticated
        }
      } catch (e) {
        console.error('[usePlayerIdentification] Unexpected error:', e);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // Set up the auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`[usePlayerIdentification] Auth state changed: ${event}`, newSession?.user?.id);
        
        setUser(newSession?.user ?? null);
        setPlayerId(newSession?.user?.id ?? null);
        
        if (event === 'SIGNED_OUT') {
          console.log('[usePlayerIdentification] User signed out');
          setPlayerId(null);
          setUser(null);
        }
      }
    );

    // Clean up the listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return [playerId, user, loading, error];
}