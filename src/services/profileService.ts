import { supabase, normalizeProfile } from '../utils/supabaseClient.js';
import type { ProfileInfo } from '../utils/supabaseClient.js';
import { mythical } from './mythicalClient.js';

export async function getOrCreatePlayHubProfile(displayName?: string | null): Promise<ProfileInfo | null> {
  try {
    const profile = await mythical.profile.getOrCreate(displayName ?? undefined);
    return normalizeProfile(profile);
  } catch (error) {
    console.error('[profile.getOrCreate] failed:', error);
    return null;
  }
}

export async function getProfile(userId: string): Promise<ProfileInfo | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_guest')
      .eq('id', userId)
      .single();

    if (!error) return normalizeProfile(data);

    console.warn('[getProfile] display_name lookup failed, trying legacy username:', error.message);
    const legacy = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .single();

    if (legacy.error) {
      console.error('[getProfile] failed:', legacy.error);
      return null;
    }

    return normalizeProfile(legacy.data);
  } catch (error) {
    console.error('[getProfile] unexpected failure:', error);
    return null;
  }
}

export async function updateProfile(
  userId: string,
  updates: { username?: string; avatar_url?: string },
): Promise<ProfileInfo | null> {
  try {
    const currentUser = await mythical.auth.getUser();
    if (!currentUser || currentUser.id !== userId) {
      throw new Error('Cannot update another Play Hub profile.');
    }

    const profile = await mythical.profile.update({
      username: updates.username,
      displayName: updates.username,
      avatarUrl: updates.avatar_url,
    });
    return normalizeProfile(profile);
  } catch (error) {
    console.error('[profile.update] failed:', error);
    return null;
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data?.publicUrl ?? null;
  } catch (error) {
    console.error('[uploadAvatar] failed:', error);
    return null;
  }
}
