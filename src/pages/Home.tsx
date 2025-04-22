import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      console.log('[Home] User already logged in, redirecting to /lobby');
      navigate('/lobby');
    }
  }, [session, loading, navigate]);

  if (loading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <img src="/images/assets/LogoXogoBrancoTransparenteEN.png" alt="Mythical Beings Logo" className="w-1/3 h-auto mb-8" />
      <h1 className="text-4xl font-bold mb-2">Welcome to Mythical Beings</h1>
      <p className="text-lg text-gray-300 mb-8">Log in or Sign up to join the battle!</p>

      <div className="w-full max-w-sm bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center">
        <Auth
          supabaseClient={supabase}
          appearance={{
        theme: ThemeSupa,
        style: {
          input: { width: '16rem' }, // Adjust input width
          button: { width: '16rem' }, // Adjust button width
        },
          }}
          providers={[]}
          theme="dark"
          redirectTo={`${window.location.origin}/lobby`}
        />
      </div>
    </div>
  );
};

export default Home;
