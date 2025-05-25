// File: src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();
  
  console.log('[ProtectedRoute] Current state - loading:', loading, 'user:', user ? 'exists' : 'null');

  if (loading) {
    // Show a loading spinner while checking authentication status
    return <div className="text-center p-10">Loading authentication status...</div>;
  }

  if (!user) {
    // User not authenticated, redirect to login page
    console.log('[ProtectedRoute] No authenticated user found, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;