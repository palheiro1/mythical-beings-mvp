// File: src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react'; // Changed to use Clerk's useAuth

const ProtectedRoute: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth(); // Use Clerk's auth state

  if (!isLoaded) {
    // Show a loading spinner or a blank page while Clerk is loading session information
    return <div className="text-center p-10">Loading authentication status...</div>;
  }

  if (!isSignedIn) {
    // User not authenticated, redirect to login page (or home page where SignInButton is)
    console.log('[ProtectedRoute] Clerk: No session found, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;