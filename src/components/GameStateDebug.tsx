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
        .from('games')
        .select('*')
        .eq('id', gameId)
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
        table: 'games',
        filter: `id=eq.${gameId}`
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

  return (
    <div className={`bg-blue-900 text-white p-2 rounded text-xs space-y-1 ${className}`}>
      <div className="font-bold">🐛 Game Debug</div>
      <div>Game ID: {gameState.id}</div>
      <div>Status: {gameState.status}</div>
      <div>Player 1: {gameState.player1_id}</div>
      <div>Player 2: {gameState.player2_id}</div>
      <div>P1 Complete: {state.player1SelectionComplete ? '✅' : '❌'}</div>
      <div>P2 Complete: {state.player2SelectionComplete ? '✅' : '❌'}</div>
      <div>P1 Creatures: {state.player1SelectedCreatures?.length || 0}</div>
      <div>P2 Creatures: {state.player2SelectedCreatures?.length || 0}</div>
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
