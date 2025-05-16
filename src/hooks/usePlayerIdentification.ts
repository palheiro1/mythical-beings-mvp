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
        // First check localStorage directly for diagnostic purposes
        const localStorageToken = localStorage.getItem('supabase.auth.token');
        console.log('[usePlayerIdentification] Raw localStorage token present:', !!localStorageToken);
        
        // Try to refresh the session first to ensure we have the latest
        await supabase.auth.refreshSession();
        
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[usePlayerIdentification] Error fetching session:', sessionError);
          setError('Failed to fetch authentication session');
          setLoading(false);
          return;
        }

        if (data?.session) {
          console.log('[usePlayerIdentification] Session found, user is authenticated', data.session);
          setUser(data.session.user);
          
          // Try to get the raw Ethereum address from user metadata
          // This is needed because the JWT sub claim is the UUID-formatted ID,
          // but our app uses raw Ethereum addresses in some places
          const rawEthAddress = data.session.user.user_metadata?.eth_address;
          
          if (rawEthAddress && rawEthAddress.startsWith('0x')) {
            console.log('[usePlayerIdentification] Using eth_address from user metadata:', rawEthAddress);
            setPlayerId(rawEthAddress);
            
            // Store this for later use
            try {
              localStorage.setItem('eth_address', rawEthAddress);
            } catch (e) {
              console.warn('[usePlayerIdentification] Failed to store eth_address in localStorage:', e);
            }
          } else {
            // Fallback to the UUID-formatted id (sub claim of JWT)
            console.log('[usePlayerIdentification] No eth_address in metadata, using user.id:', data.session.user.id);
            setPlayerId(data.session.user.id);
          }
          
          setError(null);
        } else {
          console.log('[usePlayerIdentification] No active session found - checking localStorage backup');
          
          // Check for a stored ethereum address that would be set during wallet auth
          const ethAddress = localStorage.getItem('eth_address');
          if (ethAddress) {
            console.log('[usePlayerIdentification] Found ethereum address in localStorage:', ethAddress);
            
            // Use the ethereum address as the player ID even without an active session
            setPlayerId(ethAddress);
            
            // Create a minimal user object
            const minimalUser = {
              id: ethAddress,
              app_metadata: { provider: 'moralis' },
              user_metadata: { eth_address: ethAddress }
            };
            setUser(minimalUser as any);
            setError(null);
            return;
          }
          
          // Try to recover from localStorage if API call didn't work
          if (localStorageToken) {
            try {
              const parsedToken = JSON.parse(localStorageToken);
              console.log('[usePlayerIdentification] Found localStorage token, using as fallback:', parsedToken);
              
              // Check if this is our manual session workaround
              if (parsedToken.user && parsedToken.user.user_metadata?.eth_address) {
                console.log('[usePlayerIdentification] Using manual session workaround from localStorage');
                setUser(parsedToken.user as any);
                setPlayerId(parsedToken.user.user_metadata.eth_address);
                setError(null);
                return;
              }
              
              // If we have a token in localStorage but getSession failed, try to set it again
              await supabase.auth.setSession({
                access_token: parsedToken.access_token,
                refresh_token: parsedToken.access_token
              });
              // Check if it worked
              const { data: refreshData } = await supabase.auth.getSession();
              if (refreshData?.session) {
                console.log('[usePlayerIdentification] Session recovered from localStorage');
                setUser(refreshData.session.user);
                setPlayerId(refreshData.session.user.id);
                setError(null);
                return;
              }
            } catch (parseError) {
              console.error('[usePlayerIdentification] Error recovering session from localStorage:', parseError);
            }
          }
          
          // If we reached here, there's truly no session
          console.log('[usePlayerIdentification] No active session available');
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