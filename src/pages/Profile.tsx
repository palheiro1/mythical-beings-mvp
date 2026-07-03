// File: src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { Gem, Trophy, Upload, UserCircle, Zap } from 'lucide-react';
import { getProfile, PLAYHUB_GAME_ID, supabase, updateProfile as saveProfile } from '../utils/supabase.js';
import { useAuth } from '../hooks/useAuth.js';
import { ArenaButton, Input, PageShell, Panel, Skeleton, StatCard, StatusBadge, Toast } from '../components/ui/index.js';

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  games_won: number;
  games_played: number;
  season_points: number;
  rewards_earned: number;
  gem_balance: number;
}

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const playerId = user?.id;
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    username: null,
    avatar_url: null,
    games_won: 0,
    games_played: 0,
    season_points: 0,
    rewards_earned: 0,
    gem_balance: 0,
  });
  const [newUsername, setNewUsername] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (playerId) {
        setLoading(true);
        try {
          const [profile, statsResult, balanceResult] = await Promise.all([
            getProfile(playerId),
            supabase
              .from('player_game_profiles')
              .select('games_won, games_played, season_points, rewards_earned')
              .eq('player_id', playerId)
              .eq('game_id', PLAYHUB_GAME_ID)
              .maybeSingle(),
            supabase
              .from('player_balances')
              .select('balance')
              .eq('player_id', playerId)
              .eq('currency_id', 'GEM')
              .maybeSingle(),
          ]);

          const stats = statsResult.data as any;
          const balance = balanceResult.data as any;
          setProfileData({
            username: profile?.username ?? null,
            avatar_url: profile?.avatar_url ?? null,
            games_won: stats?.games_won ?? 0,
            games_played: stats?.games_played ?? 0,
            season_points: stats?.season_points ?? 0,
            rewards_earned: stats?.rewards_earned ?? 0,
            gem_balance: balance?.balance ?? 0,
          });
          setNewUsername(profile?.username || '');
        } catch (error) {
          console.error('Error fetching profile:', error);
          setNotification('Could not fetch profile data.');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false); // No user, not loading
      }
    };

    if (!authLoading) {
      fetchProfile();
    }
  }, [playerId, authLoading]);

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!playerId) return;

    setSaving(true);
    try {
      let avatarUrl = profileData.avatar_url; // Keep existing avatar unless a new one is uploaded

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
        if (!avatarUrl) {
          // Error handled in uploadAvatar
          return;
        }
      }

      const updated = await saveProfile(playerId, {
        username: newUsername,
        avatar_url: avatarUrl ?? undefined,
      });

      if (!updated) throw new Error('Profile update failed');

      setProfileData(prev => ({ ...prev, username: newUsername, avatar_url: avatarUrl }));
      setNotification('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setNotification(`Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
      setAvatarFile(null); // Clear file input state after attempt
      setTimeout(() => setNotification(null), 3000); // Clear notification
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setAvatarFile(event.target.files[0]);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!playerId) return null;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${playerId}-${Math.random()}.${fileExt}`;
      // Create folder structure for EVM address
      const filePath = `${playerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error("Could not get public URL for uploaded avatar.");
      }

      setNotification('Avatar uploaded successfully!');
      return data.publicUrl;

    } catch (error) {
      console.error('Error uploading avatar:', error);
      setNotification(`Error uploading avatar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PageShell contentClassName="max-w-5xl space-y-5">
        <Skeleton className="h-72" />
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </PageShell>
    );
  }

  if (!playerId) {
    return (
      <PageShell contentClassName="flex min-h-[calc(100vh-var(--navbar-height)-64px)] items-center justify-center">
        <Panel className="max-w-md p-6 text-center">
          <UserCircle className="mx-auto h-12 w-12 text-violet-200" aria-hidden />
          <h1 className="mt-4 font-display text-3xl text-slate-50">Profile unavailable</h1>
          <p className="mt-2 text-slate-300">Please sign in with Play Hub and link a Polygon wallet to view your profile.</p>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell contentClassName="max-w-6xl space-y-6 pb-24">
      <Panel className="arena-banner p-6 sm:p-8" glow>
        <StatusBadge tone="violet" className="mb-4">Player Identity</StatusBadge>
        <h1 className="font-display text-4xl font-black text-slate-50">Profile</h1>
        <p className="mt-2 text-slate-300">Update your public name and avatar. Stats are read-only.</p>
      </Panel>

      <form onSubmit={updateProfile} className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {profileData.avatar_url ? (
                <img
                  src={profileData.avatar_url}
                  alt="Avatar"
                  className="h-36 w-36 rounded-full border-4 border-violet-300/35 object-cover shadow-[0_0_44px_rgba(139,92,246,0.28)]"
                />
              ) : (
                <div className="grid h-36 w-36 place-items-center rounded-full border-4 border-violet-300/35 bg-violet-500/15 text-5xl font-black text-violet-100 shadow-[0_0_44px_rgba(139,92,246,0.28)]">
                  {profileData.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              {uploading && <div className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-sm text-cyan-100">Uploading...</div>}
            </div>

            <label htmlFor="avatar-upload" className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/15">
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? 'Uploading...' : 'Upload New Avatar'}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={uploading}
              className="hidden"
            />
            <p className="mt-3 text-xs text-slate-500">JPG, PNG or WEBP. Square images work best.</p>
            {avatarFile && <span className="mt-2 max-w-full truncate text-xs text-cyan-200">{avatarFile.name}</span>}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Username</label>
              <Input
                id="username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Your public username"
              />
              <p className="mt-2 text-xs text-slate-500">This is your public name displayed to other players.</p>
            </div>

            <ArenaButton type="submit" loading={saving || uploading} fullWidth>
              {saving || uploading ? 'Saving...' : 'Update Profile'}
            </ArenaButton>
          </div>
        </Panel>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Games Won" value={profileData.games_won} tone="amber" icon={<Trophy className="h-5 w-5 text-amber-200" aria-hidden />} />
        <StatCard label="Games Played" value={profileData.games_played} tone="blue" icon={<UserCircle className="h-5 w-5 text-cyan-200" aria-hidden />} />
        <StatCard label="Season Points" value={profileData.season_points} tone="violet" icon={<Zap className="h-5 w-5 text-violet-200" aria-hidden />} />
        <StatCard label="GEM" value={profileData.gem_balance} tone="green" icon={<Gem className="h-5 w-5 text-emerald-200" aria-hidden />} />
      </div>

      <Toast message={notification} tone={notification?.startsWith('Error') ? 'red' : 'green'} className="bottom-auto left-auto right-5 top-20 translate-x-0" />
    </PageShell>
  );
};

export default ProfilePage;
