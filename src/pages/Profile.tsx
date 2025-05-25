// File: src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js';
import NavBar from '../components/NavBar.js'; // Import NavBar
import { useAuth } from '../hooks/useAuth.js';

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  website: string | null;
  games_won: number;
  games_played: number;
}

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const playerId = user?.id;
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    username: null,
    avatar_url: null,
    website: null,
    games_won: 0,
    games_played: 0,
  });
  const [newUsername, setNewUsername] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (playerId) {
        setLoading(true);
        try {
          const { data, error, status } = await supabase
            .from('profiles')
            .select(`username, website, avatar_url, games_won, games_played`)
            .eq('id', playerId)
            .single();

          if (error && status !== 406) {
            throw error;
          }

          if (data) {
            setProfileData({
              username: data.username,
              avatar_url: data.avatar_url,
              website: data.website,
              games_won: data.games_won ?? 0,
              games_played: data.games_played ?? 0,
            });
            setNewUsername(data.username || '');
            setNewWebsite(data.website || '');
          }
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

    setLoading(true);
    try {
      let avatarUrl = profileData.avatar_url; // Keep existing avatar unless a new one is uploaded

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
        if (!avatarUrl) {
          // Error handled in uploadAvatar
          return;
        }
      }

      const updates = {
        id: playerId,
        username: newUsername,
        website: newWebsite,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }

      setProfileData(prev => ({ ...prev, username: newUsername, website: newWebsite, avatar_url: avatarUrl }));
      setNotification('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setNotification(`Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading profile...</div>;
  }

  if (!playerId) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Please connect your wallet to view your profile.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <NavBar /> {/* Add NavBar */}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">
          Your Profile
        </h1>

        {notification && (
          <div className={`fixed top-5 right-5 p-3 rounded-md shadow-lg text-white ${notification.startsWith('Error') ? 'bg-red-600' : 'bg-green-600'} z-50`}>
            {notification}
          </div>
        )}

        <div className="max-w-2xl mx-auto bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-xl">
          <form onSubmit={updateProfile} className="space-y-6">
            {/* Avatar Display and Upload */}
            <div className="flex flex-col items-center space-y-4">
              <img
                src={profileData.avatar_url || `/api/placeholder-avatar?text=${profileData.username?.charAt(0).toUpperCase() || '?'}`}
                alt="Avatar"
                className="h-24 w-24 rounded-full object-cover border-2 border-purple-500"
              />
              <div>
                <label htmlFor="avatar-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200">
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
              </div>
              {avatarFile && <span className="text-xs text-gray-400 mt-1">{avatarFile.name}</span>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                id="username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your public username"
              />
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">Website</label>
              <input
                id="website"
                type="url"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
                className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://your-website.com"
              />
            </div>

            {/* Stats Display */}
            <div className="flex justify-around pt-4 border-t border-gray-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{profileData.games_won}</p>
                <p className="text-sm text-gray-400">Games Won</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-300">{profileData.games_played}</p>
                <p className="text-sm text-gray-400">Games Played</p>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || uploading}
                className={`w-full font-bold py-3 px-6 rounded-md transition duration-200 ease-in-out ${loading || uploading ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {loading || uploading ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;