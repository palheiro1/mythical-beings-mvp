// Simplified Authentication Hook for Supabase-Only Architecture
// This now uses the global AuthProvider context to prevent React StrictMode conflicts

export { useAuth } from '../context/AuthProvider.js';
