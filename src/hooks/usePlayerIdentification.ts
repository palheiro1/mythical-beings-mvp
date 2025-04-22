import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth

/**
 * Hook to determine the current player's ID based on the authenticated user.
 * @returns The current player's ID or null if not authenticated or loading.
 */
export function usePlayerIdentification(): [
  string | null, // currentPlayerId
  React.Dispatch<React.SetStateAction<string | null>>, // setCurrentPlayerId (less likely needed externally now)
  string | null, // error
  React.Dispatch<React.SetStateAction<string | null>>, // setError
  boolean // loading state from auth
] {
  const { user, loading: authLoading, session } = useAuth(); // Get user and loading state from context
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[usePlayerIdentification] Auth state update:', { authLoading, user: user?.id, sessionExists: !!session });
    if (!authLoading) {
      if (user) {
        setCurrentPlayerId(user.id);
        setError(null);
        console.log(`[usePlayerIdentification] Player ID set from authenticated user: ${user.id}`);
      } else {
        setCurrentPlayerId(null);
        setError('User not logged in.');
        console.log('[usePlayerIdentification] No authenticated user found.');
      }
    } else {
      // Still loading auth state
      setCurrentPlayerId(null);
      setError(null); // Clear error while loading
      console.log('[usePlayerIdentification] Waiting for authentication status...');
    }
    // Depend on user object and authLoading state
  }, [user, authLoading, session]);

  // Return authLoading as the primary loading indicator for this hook
  return [currentPlayerId, setCurrentPlayerId, error, setError, authLoading];
}