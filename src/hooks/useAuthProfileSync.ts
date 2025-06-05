import { useEffect } from 'react';
import { useAuth } from '../context/AuthProvider.js';
import { supabase } from '../utils/supabase.js';

export function useAuthProfileSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Only sync profile when user exists and is different from previous
    if (user) {
      ensureProfileExists(user.id, user.user_metadata?.eth_address);
    }
  }, [user?.id]); // Only trigger when user ID changes
}

async function ensureProfileExists(userId: string, ethAddress?: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    if (error && error.code === 'PGRST116') {
      console.log('[AuthSync] No profile found, creating new one for:', userId);
      const { error: insertError } = await supabase.from('profiles').upsert({
        id: userId,
        username: `Player_${userId.substring(0, 6)}`,
        eth_address: ethAddress,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      
      if (insertError) {
        console.error('[AuthSync] Error creating profile:', insertError.message);
      } else {
        console.log('[AuthSync] Profile created successfully');
      }
    } else if (!error) {
      console.log('[AuthSync] Profile already exists for:', userId);
    } else {
      console.error('[AuthSync] Error checking profile:', error.message);
    }
  } catch (e) {
    console.error('[AuthSync] Exception in ensureProfileExists:', e instanceof Error ? e.message : String(e));
  }
}
