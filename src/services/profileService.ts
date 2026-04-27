import { supabase, normalizeProfile } from '../utils/supabaseClient.js';
import type { ProfileInfo } from '../utils/supabaseClient.js';

export async function getOrCreatePlayHubProfile(displayName?: string | null): Promise<ProfileInfo | null> {
  const { data, error } = await supabase.rpc('playhub_get_or_create_profile', {
    p_display_name: displayName ?? null,
  });

  if (error) {
    console.error('[playhub_get_or_create_profile] failed:', error);
    return null;
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return normalizeProfile(row as any);
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
  const payload = {
    display_name: updates.username,
    avatar_url: updates.avatar_url,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, display_name, avatar_url, is_guest')
    .single();

  if (!error) return normalizeProfile(data);

  console.warn('[updateProfile] display_name update failed, trying legacy username:', error.message);
  const legacy = await supabase
    .from('profiles')
    .update({
      username: updates.username,
      avatar_url: updates.avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, username, avatar_url')
    .single();

  if (legacy.error) {
    console.error('[updateProfile] failed:', legacy.error);
    return null;
  }

  return normalizeProfile(legacy.data);
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
