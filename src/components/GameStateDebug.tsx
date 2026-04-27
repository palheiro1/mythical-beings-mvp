import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js';

interface GameStateDebugProps {
  gameId: string;
  className?: string;
}

export const GameStateDebug: React.FC<GameStateDebugProps> = ({ gameId, className = '' }) => {
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchGameState = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('card_game_session_state')
        .select('*')
        .eq('session_id', gameId)
        .single();

      if (error) {
        console.error('Debug: Error fetching game state:', error);
        return;
      }

      setGameState(data);
      console.log('Debug: Current game state:', data);
    } catch (err) {
      console.error('Debug: Exception fetching game state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameState();
    
    // Set up realtime subscription for debugging
    const channel = supabase.channel(`debug-${gameId}`);
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'card_game_session_state',
        filter: `session_id=eq.${gameId}`
      }, (payload) => {
        console.log('Debug: Realtime update:', payload);
        setGameState(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  if (!gameState) {
    return (
      <div className={`bg-blue-900 text-white p-2 rounded text-xs ${className}`}>
        {loading ? 'Loading debug info...' : 'No game state'}
      </div>
    );
  }

  const state = gameState.state || {};
  const selected = gameState.selected_creatures || {};

  return (
    <div className={`bg-blue-900 text-white p-2 rounded text-xs space-y-1 ${className}`}>
      <div className="font-bold">🐛 Game Debug</div>
      <div>Session ID: {gameState.session_id}</div>
      <div>State phase: {state.phase || 'selection'}</div>
      <div>P1 Complete: {selected['0']?.length === 3 ? 'yes' : 'no'}</div>
      <div>P2 Complete: {selected['1']?.length === 3 ? 'yes' : 'no'}</div>
      <div>P1 Creatures: {selected['0']?.length || 0}</div>
      <div>P2 Creatures: {selected['1']?.length || 0}</div>
      <button 
        onClick={fetchGameState}
        className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs mt-1"
        disabled={loading}
      >
        {loading ? '...' : 'Refresh'}
      </button>
    </div>
  );
};

export default GameStateDebug;
