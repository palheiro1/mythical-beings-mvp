import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log('[Home] Clerk: User already logged in, redirecting to /lobby');
      navigate('/lobby');
    }
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) {
    return <div className="text-center p-10">Loading authentication state...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <img src="/images/assets/LogoXogoBrancoTransparenteEN.png" alt="Mythical Beings Logo" className="w-1/3 h-auto mb-8" />
      <h1 className="text-4xl font-bold mb-2">Welcome to Mythical Beings</h1>
      <p className="text-lg text-gray-300 mb-8">Please log in or sign up via the navigation bar to join the battle!</p>
    </div>
  );
};

export default Home;
