import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, CircleDot, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getGameDetails, getGameState, updateGameState } from '../utils/supabase';
import { initializeGame } from '../game/state';
import { ArenaButton, cn, CopyChip, ErrorRecoveryPanel, Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';

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
        
        // 1. Get session details and determine player roles
        const gameDetails = await getGameDetails(gameId);
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

          // Get selected creatures from the card_game_session_state row.
          const player1SelectedIds = gameDetails.player1_selected_creatures;
          const player2SelectedIds = gameDetails.player2_selected_creatures;

          if (!player1SelectedIds || !player2SelectedIds || 
              player1SelectedIds.length !== 3 || player2SelectedIds.length !== 3) {
            throw new Error('Selected creature data is missing or incomplete');
          }
          if (!gameDetails.player1_id || !gameDetails.player2_id) {
            throw new Error('Session participant data is incomplete');
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

  const steps = [
    'Checking game status...',
    'Initializing game state...',
    'Saving game state...',
    'Finalizing match setup...',
  ];

  const statusIndex = (() => {
    if (status.includes('Checking')) return 0;
    if (status.includes('Initializing') || status.includes('Waiting')) return 1;
    if (status.includes('Saving')) return 2;
    if (status.includes('ready') || status.includes('initialized') || status.includes('Launching')) return 3;
    return 0;
  })();

  if (error) {
    return (
      <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <ErrorRecoveryPanel
          title="Initialization Error"
          message={error}
          onBack={() => navigate('/lobby')}
          onRetry={() => window.location.reload()}
          backLabel="Back to Lobby"
        />
      </div>
    );
  }

  return (
    <div className="arena-page relative flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_28%_70%,rgba(139,92,246,0.12),transparent_28%)]" />
      <div className="relative z-10 w-full max-w-xl">
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Lobby
        </button>

        <Panel className="p-6 text-center sm:p-8" glow>
          <SpinnerEmblem />
          <h2 className="mt-5 font-display text-4xl font-black text-slate-50">Preparing Game</h2>
          <p className="mt-2 text-slate-300">Please wait while we set up your match.</p>
          {gameId && <CopyChip label="Game ID" value={gameId} className="mx-auto mt-5 max-w-full" />}

          <div className="mt-8 space-y-3 border-y border-white/10 py-6 text-left">
            {steps.map((step, index) => {
              const isComplete = statusIndex > index || status.includes('Launching');
              const isActive = statusIndex === index && !status.includes('Launching');
              const Icon = isComplete ? CheckCircle2 : isActive ? CircleDot : Circle;
              return (
                <div key={step} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className={cn('h-5 w-5 shrink-0', isComplete ? 'text-emerald-300' : isActive ? 'text-cyan-300' : 'text-slate-500')} aria-hidden />
                    <span className={cn('truncate text-sm', isComplete ? 'text-slate-200' : isActive ? 'text-cyan-100' : 'text-slate-500')}>{step}</span>
                  </div>
                  <StatusBadge tone={isComplete ? 'green' : isActive ? 'violet' : 'muted'}>
                    {isComplete ? 'Complete' : isActive ? 'In Progress' : 'Pending'}
                  </StatusBadge>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
            <ShieldAlert className="h-4 w-4 text-violet-200" aria-hidden />
            <span>Do not close this window. You will be redirected automatically when ready.</span>
          </div>

          <p className="mt-4 text-sm text-cyan-200">{status}</p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ArenaButton type="button" variant="ghost" onClick={() => navigate('/lobby')}>Back to Lobby</ArenaButton>
            <ArenaButton type="button" variant="secondary" onClick={() => window.location.reload()}>Retry</ArenaButton>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default GameInitializing;
