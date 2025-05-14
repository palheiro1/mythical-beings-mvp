import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { supabase } from '../utils/supabase.js'; // Import supabase client

/**
 * Hook to determine the current player's Supabase UUID based on the authenticated user from Clerk.
 * @returns The current player's Supabase UUID or null if not authenticated, not found, or loading.
 */
export function usePlayerIdentification(): [
  string | null, // currentPlayerId (Supabase UUID from profiles.id)
  React.Dispatch<React.SetStateAction<string | null>>,
  string | null, // error
  React.Dispatch<React.SetStateAction<string | null>>,
  boolean // loading state (combination of Clerk and Supabase fetch)
] {
  const { userId: clerkUserId, isLoaded: clerkAuthLoaded, isSignedIn } = useAuth();
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  useEffect(() => {
    console.log('[usePlayerIdentification] Clerk Auth state update:', { clerkAuthLoaded, isSignedIn, clerkUserId });

    if (!clerkAuthLoaded) {
      console.log('[usePlayerIdentification] Waiting for Clerk authentication status...');
      setCurrentPlayerId(null);
      setError(null);
      setLoadingProfile(true); // Still loading Clerk auth
      return;
    }

    if (isSignedIn && clerkUserId) {
      console.log(`[usePlayerIdentification] Clerk user signed in: ${clerkUserId}. Fetching Supabase profile ID...`);
      setLoadingProfile(true);
      setError(null);

      const fetchSupabaseId = async () => {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id') // Select the Supabase UUID
            .eq('clerk_id', clerkUserId) // Match using the Clerk ID
            .single();

          if (profileError) {
            if (profileError.code === 'PGRST116') { // "No rows found"
              console.warn(`[usePlayerIdentification] No Supabase profile found for clerk_id: ${clerkUserId}. User might need to complete profile creation or trigger isn't working.`);
              setError('Supabase profile not found. Please ensure you have signed up completely.');
            } else {
              console.error('[usePlayerIdentification] Error fetching Supabase profile ID:', profileError);
              setError('Failed to fetch Supabase profile ID.');
            }
            setCurrentPlayerId(null);
          } else if (profile && profile.id) {
            console.log(`[usePlayerIdentification] Supabase profile ID (UUID) found: ${profile.id} for clerk_id: ${clerkUserId}`);
            setCurrentPlayerId(profile.id);
            setError(null);
          } else {
            console.warn(`[usePlayerIdentification] Supabase profile found but no ID for clerk_id: ${clerkUserId}`, profile);
            setError('Supabase profile ID is missing.');
            setCurrentPlayerId(null);
          }
        } catch (e) {
          console.error('[usePlayerIdentification] Unexpected error fetching Supabase profile ID:', e);
          setError('An unexpected error occurred while fetching the profile ID.');
          setCurrentPlayerId(null);
        } finally {
          setLoadingProfile(false);
        }
      };

      fetchSupabaseId();
    } else {
      console.log('[usePlayerIdentification] Clerk user not signed in or no clerkUserId.');
      setCurrentPlayerId(null);
      setError(isSignedIn ? 'Clerk user ID missing.' : 'User not logged in via Clerk.');
      setLoadingProfile(false); // Not loading if not signed in
    }
  }, [clerkUserId, clerkAuthLoaded, isSignedIn]);

  const overallLoading = !clerkAuthLoaded || loadingProfile;

  return [currentPlayerId, setCurrentPlayerId, error, setError, overallLoading];
}