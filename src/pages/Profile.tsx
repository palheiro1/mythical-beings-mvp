// File: src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase'; // Assuming supabase client is exported from here

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[300px] bg-white shadow-lg rounded-lg overflow-visible">
        <div className="flex flex-col items-center px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-500 text-center space-y-4">
          {/* Small avatar like TopBar */}
          <img
            src={avatarUrl || `/api/placeholder-avatar?text=${username.charAt(0).toUpperCase()}`}
            alt="Avatar"
            width={100}
            height={100}
            className="rounded-full border-2 border-white object-cover mx-auto"
          />
          <div>
            <h2 className="text-xl font-semibold text-white truncate">{username || 'Unnamed User'}</h2>
            <p className="text-sm text-purple-200 truncate">{user.email}</p>
          </div>
        </div>
        <div className="px-6 py-4 flex flex-col items-start">
          {message && <div className="mb-4 text-center text-red-500">{message}</div>}
          <form onSubmit={handleUpdateProfile} className="space-y-4 flex flex-col items-start">
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700">Avatar</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="mt-1 block w-full text-sm text-gray-500 file:py-2 file:px-4 file:border file:border-gray-300 file:rounded-md file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
              />
            </div>
            <div className="flex justify-start space-x-4">
              <button
                type="submit"
                disabled={loading || uploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <br />
              <button
                type="button"
                onClick={signOut}
                className="text-red-600 hover:text-red-800 font-medium"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;