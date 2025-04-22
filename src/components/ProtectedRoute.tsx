// File: src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    // Optional: Show a loading spinner while checking auth state
    return <div className="text-center p-10">Checking authentication...</div>;
  }

  if (!session) {
    // User not authenticated, redirect to login page
    console.log('[ProtectedRoute] No session found, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;