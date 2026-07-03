// File: src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { SpinnerEmblem } from './ui/index.js';

const ProtectedRoute: React.FC = () => {
  const { user, polygonWallet, loading } = useAuth();
  
  console.log('[ProtectedRoute] Current state - loading:', loading, 'user:', user ? 'exists' : 'null', 'polygon:', polygonWallet ? 'linked' : 'missing');

  if (loading) {
    // Show a loading spinner while checking authentication status
    return <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center"><SpinnerEmblem label="Loading authentication status..." /></div>;
  }

  if (!user || !polygonWallet) {
    console.log('[ProtectedRoute] Missing Play Hub session or Polygon wallet, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;
