import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../utils/supabase.js';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

interface UseRealtimeGameUpdatesOptions {
  gameId: string;
  onGameUpdate?: (game: any) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
  maxRetries?: number;
}

export const useRealtimeGameUpdates = ({
  gameId,
  onGameUpdate,
  onConnectionChange,
  onError,
  autoConnect = false,
  maxRetries = 3
}: UseRealtimeGameUpdatesOptions) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateConnectionState = useCallback((newState: ConnectionState) => {
    setConnectionState(newState);
    if (onConnectionChange) {
      onConnectionChange(newState);
    }
  }, [onConnectionChange]);

  const handleError = useCallback((error: string) => {
    updateConnectionState('error');
    if (onError) {
      onError(error);
    }
  }, [onError, updateConnectionState]);

  const pollGameState = useCallback(async () => {
    try {
      const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        throw error;
      }

      if (game && onGameUpdate) {
        onGameUpdate(game);
      }
    } catch (error) {
      handleError(`Polling failed: ${error}`);
    }
  }, [gameId, onGameUpdate, handleError]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(pollGameState, 2000);
    updateConnectionState('connected');
  }, [pollGameState, updateConnectionState]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const setupRealtimeSubscription = useCallback(async () => {
    try {
      updateConnectionState('connecting');
      
      subscriptionRef.current = supabase
        .channel(`game-${gameId}`)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'games',
            filter: `id=eq.${gameId}`
          },
          (payload: any) => {
            console.log('Real-time update received:', payload);
            updateConnectionState('connected');
            setRetryCount(0);
            
            if (payload.new && onGameUpdate) {
              onGameUpdate(payload.new);
            }
          }
        )
        .subscribe((status: any) => {
          console.log('Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            updateConnectionState('connected');
            stopPolling();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            handleError('Real-time subscription failed');
          }
        });

    } catch (error) {
      console.error('Failed to setup real-time subscription:', error);
      handleError(`Connection failed: ${error}`);
    }
  }, [gameId, onGameUpdate, stopPolling, updateConnectionState, handleError]);

  const connect = useCallback(() => {
    if (connectionState === 'connecting' || connectionState === 'connected') {
      return;
    }
    
    setRetryCount(0);
    setupRealtimeSubscription();
  }, [connectionState, setupRealtimeSubscription]);

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    
    stopPolling();
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    updateConnectionState('disconnected');
    setRetryCount(0);
  }, [stopPolling, updateConnectionState]);

  const retry = useCallback(() => {
    if (retryCount >= maxRetries) {
      updateConnectionState('error');
      return;
    }

    setRetryCount(current => current + 1);
    updateConnectionState('reconnecting');
    
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    retryTimeoutRef.current = setTimeout(() => {
      setupRealtimeSubscription();
    }, retryDelay);
  }, [retryCount, maxRetries, setupRealtimeSubscription, updateConnectionState]);

  const forceReconnect = useCallback(() => {
    setRetryCount(0);
    connect();
  }, [connect]);

  // Auto connect effect
  useEffect(() => {
    if (autoConnect && gameId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, gameId, connect, disconnect]);

  return {
    connectionState,
    retryCount,
    connect,
    disconnect,
    retry,
    forceReconnect,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'reconnecting',
    hasError: connectionState === 'error'
  };
};
