// File: src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { SpinnerEmblem } from './ui/index.js';

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // Show a loading spinner while checking authentication status
    return <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center"><SpinnerEmblem label="Loading authentication status..." /></div>;
  }

  if (!user || user.isGuest) {
    return <Navigate to="/#account" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;
