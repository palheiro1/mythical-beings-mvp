// AuthDebug Component - Temporary debug component for authentication issues
// This component helps diagnose authentication state issues across different browsers

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider.js';
import { supabase } from '../utils/supabase.js';

export function AuthDebug() {
  const { user, session, loading, error } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const gatherDebugInfo = async () => {
      try {
        // Get browser info
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.includes('Chrome');
        const isFirefox = userAgent.includes('Firefox');
        const isPrivateMode = await isPrivateBrowsing();
        
        // Get Supabase client info
        const { data: clientSession } = await supabase.auth.getSession();
        
        // Get localStorage availability
        const localStorageWorks = checkLocalStorage();
        
        setDebugInfo({
          browser: {
            userAgent: userAgent.substring(0, 100) + '...',
            isChrome,
            isFirefox,
            isPrivateMode
          },
          storage: {
            localStorageWorks,
            sessionStorageWorks: checkSessionStorage()
          },
          supabase: {
            hasClientSession: !!clientSession?.session,
            clientUserId: clientSession?.session?.user?.id,
            url: supabase.supabaseUrl
          },
          auth: {
            hasUser: !!user,
            hasSession: !!session,
            loading,
            error,
            userId: user?.id
          },
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error gathering debug info:', err);
        setDebugInfo({ error: err.message });
      }
    };

    gatherDebugInfo();
    
    // Update every 5 seconds
    const interval = setInterval(gatherDebugInfo, 5000);
    return () => clearInterval(interval);
  }, [user, session, loading, error]);

  // Check if we're in private browsing mode
  const isPrivateBrowsing = async (): Promise<boolean> => {
    try {
      // Chrome/Safari private mode detection
      const storage = window.sessionStorage;
      storage.setItem('test', '1');
      storage.removeItem('test');
      
      // Additional check for Chrome incognito
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.quota! < 120000000; // Less than ~120MB usually indicates private mode
      }
      
      return false;
    } catch {
      return true; // If we can't access storage, likely private mode
    }
  };

  const checkLocalStorage = (): boolean => {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  };

  const checkSessionStorage = (): boolean => {
    try {
      const test = 'test';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Auth Debug</h3>
      <pre style={{ margin: 0, fontSize: '10px', overflow: 'auto', maxHeight: '400px' }}>
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
}
