// File: src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification.js';

const ProtectedRoute: React.FC = () => {
  const [playerId, user, loading] = usePlayerIdentification();

  if (loading) {
    // Show a loading spinner while checking authentication status
    return <div className="text-center p-10">Loading authentication status...</div>;
  }

  if (!playerId || !user) {
    // User not authenticated, redirect to login page
    console.log('[ProtectedRoute] No authenticated user found, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;