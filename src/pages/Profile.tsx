// File: src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase'; // Assuming supabase client is exported from here

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && !authLoading) {
        setLoading(true);
        setMessage(null);
        try {
          const { data, error, status } = await supabase
            .from('profiles')
            .select(`id, username, avatar_url, updated_at`)
            .eq('id', user.id)
            .single();

          if (error && status !== 406) { // 406 == No rows found
            throw error;
          }

          if (data) {
            setProfile(data);
            setUsername(data.username || '');
            setAvatarUrl(data.avatar_url);
            console.log('[ProfilePage] Profile fetched:', data);
          } else {
             console.log('[ProfilePage] No profile found for user, might be newly created.');
             // Optionally set a default username based on email if profile is null
             setUsername(user.email?.split('@')[0] || '');
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setMessage(`Error fetching profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setLoading(false);
        }
      } else if (!authLoading) {
         // User not logged in
         setLoading(false);
         setMessage("Please log in to view your profile.");
      }
    };

    fetchProfile();
  }, [user, authLoading]);

  const handleUpdateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);
    const updates = {
      id: user.id,
      username,
      updated_at: new Date().toISOString(),
      // avatar_url is updated separately after upload
    };

    try {
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      setMessage('Profile updated successfully!');
      // Re-fetch profile to show updated data (or update local state directly)
      setProfile(prev => prev ? { ...prev, username, updated_at: updates.updated_at } : null);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage(`Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     if (!user) return;
     if (!event.target.files || event.target.files.length === 0) {
       setMessage('Please select an image to upload.');
       return;
     }

     const file = event.target.files[0];
     const fileExt = file.name.split('.').pop();
     const filePath = `${user.id}/${Math.random()}.${fileExt}`; // Simple unique path

     setUploading(true);
     setMessage(null);

     try {
       const { error: uploadError } = await supabase.storage
         .from('avatars')
         .upload(filePath, file);

       if (uploadError) throw uploadError;

       // Get public URL (assuming bucket is public)
       const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
       const newAvatarUrl = urlData.publicUrl;

       // Update profile table
       const { error: updateError } = await supabase
         .from('profiles')
         .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
         .eq('id', user.id);

       if (updateError) throw updateError;

       setAvatarUrl(newAvatarUrl); // Update local state
       setMessage('Avatar updated successfully!');
     } catch (error) {
       console.error('Error uploading avatar:', error);
       setMessage(`Error uploading avatar: ${error instanceof Error ? error.message : 'Unknown error'}`);
     } finally {
       setUploading(false);
     }
   };


  if (authLoading || (loading && user)) {
    return <div className="text-center p-10">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-center p-10">Please log in to manage your profile.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Your Profile</h1>

      {message && <div className="mb-4 text-center text-yellow-300">{message}</div>}

      <div className="max-w-md mx-auto bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <img
            src={avatarUrl || `https://via.placeholder.com/150?text=${username?.charAt(0)?.toUpperCase() || '?'}`}
            alt="Avatar"
            className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-purple-500 object-cover"
          />
          <label htmlFor="avatar-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200">
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>

        <form onSubmit={handleUpdateProfile}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              id="email"
              type="text"
              value={user.email || ''}
              disabled
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-300 cursor-not-allowed"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || uploading}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-colors duration-200 ${loading || uploading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {loading ? 'Saving...' : 'Update Profile'}
          </button>
        </form>

        <button
            onClick={signOut}
            className="w-full mt-6 py-2 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
          >
            Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;