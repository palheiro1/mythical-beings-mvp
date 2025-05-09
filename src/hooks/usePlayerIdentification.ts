import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react'; // Changed to use Clerk's useAuth

/**
 * Hook to determine the current player's ID based on the authenticated user from Clerk.
 * @returns The current player's ID or null if not authenticated or loading.
 */
export function usePlayerIdentification(): [
  string | null, // currentPlayerId (derived from Clerk's userId)
  React.Dispatch<React.SetStateAction<string | null>>, // setCurrentPlayerId (likely not needed externally with Clerk)
  string | null, // error
  React.Dispatch<React.SetStateAction<string | null>>, // setError
  boolean // loading state from Clerk (isLoaded)
] {
  const { userId, isLoaded, isSignedIn } = useAuth(); // Get user ID, loading, and signed-in state from Clerk
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[usePlayerIdentification] Clerk Auth state update:', { isLoaded, isSignedIn, clerkUserId: userId });
    if (isLoaded) {
      if (isSignedIn && userId) {
        setCurrentPlayerId(userId);
        setError(null);
        console.log(`[usePlayerIdentification] Player ID set from Clerk user: ${userId}`);
      } else {
        setCurrentPlayerId(null);
        if (!isSignedIn) {
          setError('User not logged in via Clerk.');
          console.log('[usePlayerIdentification] No authenticated Clerk user found.');
        } else {
          setError(null); // Should not happen if isSignedIn is true but no userId
          console.log('[usePlayerIdentification] Clerk user signed in but no userId found (unexpected).');
        }
      }
    } else {
      // Still loading Clerk auth state
      setCurrentPlayerId(null);
      setError(null); // Clear error while loading
      console.log('[usePlayerIdentification] Waiting for Clerk authentication status...');
    }
  }, [userId, isLoaded, isSignedIn]);

  // Return Clerk's isLoaded as the primary loading indicator for this hook
  // Note: setCurrentPlayerId and setError are returned for interface consistency but might be less used externally now.
  return [currentPlayerId, setCurrentPlayerId, error, setError, !isLoaded];
}