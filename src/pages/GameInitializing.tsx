import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, getGameState, updateGameState } from '../utils/supabase';
import { initializeGame } from '../game/state';

const GameInitializing: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('Checking game status...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !user?.id) {
      setError('Missing game ID or user authentication');
      return;
    }

    const initializeGameFlow = async () => {
      try {
        console.log('[GameInitializing] Starting initialization flow for game:', gameId);
        
        // 1. Get game details and determine player roles
        const { data: gameDetails, error: detailsError } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_selected_creatures, player2_selected_creatures, state')
          .eq('id', gameId)
          .single();

        if (detailsError) throw detailsError;
        if (!gameDetails) throw new Error('Game not found');

        const isPlayer1 = gameDetails.player1_id === user.id;
        const isPlayer2 = gameDetails.player2_id === user.id;

        if (!isPlayer1 && !isPlayer2) {
          throw new Error('You are not part of this game');
        }

        console.log('[GameInitializing] Player role determined:', { isPlayer1, isPlayer2 });

        // 2. Check if game is already initialized
        const existingGameState = await getGameState(gameId);
        if (existingGameState && existingGameState.phase && existingGameState.players) {
          console.log('[GameInitializing] ✅ Game already initialized, proceeding to game');
          navigate(`/game/${gameId}`);
          return;
        }

        if (isPlayer1) {
          // Player 1: Initialize the game
          setStatus('Initializing game state...');
          console.log('[GameInitializing] Player 1 initializing game state');

          // Get selected creatures
          let player1SelectedIds = gameDetails.player1_selected_creatures;
          let player2SelectedIds = gameDetails.player2_selected_creatures;
          
          if ((!player1SelectedIds || !player2SelectedIds) && gameDetails.state) {
            const state = gameDetails.state as any;
            player1SelectedIds = player1SelectedIds || state.player1SelectedCreatures;
            player2SelectedIds = player2SelectedIds || state.player2SelectedCreatures;
          }

          if (!player1SelectedIds || !player2SelectedIds || 
              player1SelectedIds.length !== 3 || player2SelectedIds.length !== 3) {
            throw new Error('Selected creature data is missing or incomplete');
          }

          // Initialize the full game state
          const gameState = initializeGame({
            gameId,
            player1Id: gameDetails.player1_id,
            player2Id: gameDetails.player2_id,
            player1SelectedIds,
            player2SelectedIds
          });

          console.log('[GameInitializing] Game state created, saving to database...');
          setStatus('Saving game state...');

          // Save to database
          const updateSuccess = await updateGameState(gameId, gameState);
          if (!updateSuccess) {
            throw new Error('Failed to save game state to database');
          }

          console.log('[GameInitializing] ✅ Game state saved successfully');
          setStatus('Game initialized! Launching game...');

          // Small delay then navigate
          setTimeout(() => {
            navigate(`/game/${gameId}`);
          }, 1000);

        } else {
          // Player 2: Wait for Player 1 to initialize
          setStatus('Waiting for game initialization...');
          console.log('[GameInitializing] Player 2 waiting for initialization');

          const maxWaitTime = 30000; // 30 seconds
          const checkInterval = 1500; // Check every 1.5 seconds
          let elapsedTime = 0;

          const waitForInitialization = async () => {
            try {
              const gameState = await getGameState(gameId);
              
              if (gameState && gameState.phase && gameState.players && gameState.players.length === 2) {
                console.log('[GameInitializing] ✅ Game initialization detected by Player 2');
                setStatus('Game ready! Launching game...');
                
                setTimeout(() => {
                  navigate(`/game/${gameId}`);
                }, 500);
                return;
              }

              elapsedTime += checkInterval;
              
              if (elapsedTime >= maxWaitTime) {
                throw new Error('Game initialization timed out. Please refresh and try again.');
              }

              // Continue waiting
              setTimeout(waitForInitialization, checkInterval);

            } catch (error: any) {
              console.error('[GameInitializing] Error checking initialization:', error);
              setError(error.message);
            }
          };

          waitForInitialization();
        }

      } catch (error: any) {
        console.error('[GameInitializing] Error:', error);
        setError(error.message);
      }
    };

    initializeGameFlow();
  }, [gameId, user?.id, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-800 border border-red-600 rounded-lg p-6 max-w-md">
          <h2 className="text-red-200 text-xl font-bold mb-2">Initialization Error</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/lobby')}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
            >
              Back to Lobby
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-700 text-red-200 rounded hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 max-w-md text-center">
        <div className="mb-6">
          {/* Animated spinner */}
          <div className="mx-auto w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <h2 className="text-blue-200 text-2xl font-bold mb-4">Preparing Game</h2>
        <p className="text-gray-300 text-lg mb-2">{status}</p>
        <p className="text-gray-400 text-sm">This should only take a few seconds...</p>
        
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-gray-500 text-xs">Game ID: {gameId}</p>
        </div>
      </div>
    </div>
  );
};

export default GameInitializing;
