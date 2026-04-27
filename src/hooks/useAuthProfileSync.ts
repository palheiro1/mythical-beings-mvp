import { useEffect } from 'react';
import { useAuth } from '../context/AuthProvider.js';
import { getOrCreatePlayHubProfile } from '../utils/supabase.js';

export function useAuthProfileSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Only sync profile when user exists and is different from previous
    if (user) {
      void ensureProfileExists(user.user_metadata?.display_name ?? null);
    }
  }, [user?.id]); // Only trigger when user ID changes
}

async function ensureProfileExists(displayName?: string | null) {
  try {
    const profile = await getOrCreatePlayHubProfile(displayName ?? null);
    if (!profile) console.error('[AuthSync] Error creating or fetching profile');
  } catch (e) {
    console.error('[AuthSync] Exception in ensureProfileExists:', e instanceof Error ? e.message : String(e));
  }
}
