import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCircle2, Clock3, Dices, ShieldCheck } from 'lucide-react';
import Card from '../components/Card.js';
import GameStateDebug from '../components/GameStateDebug.js';
import { Creature } from '../game/types.js';
import { getCardGameSessionState, getGameDetails } from '../utils/supabase.js';
import { useAuth } from '../context/AuthProvider.js';
import { NFTSelectionNavigationManager } from '../utils/NavigationManager.js';
// --- Import the base creature data ---
import creatureData from '../assets/creatures.json' with { type: 'json' };
import { ArenaButton, cn, CopyChip, ErrorRecoveryPanel, Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';
import { clearBotCreatureSelection, writeBotCreatureSelection } from '../utils/botSelection.js';

// --- Define ALL_CREATURES constant ---
const ALL_CREATURES: Creature[] = creatureData as Creature[];

const CARD_ASPECT_RATIO = 2.5 / 3.5;
const CARD_WIDTH_DESKTOP = '160px';
const TRAINING_HAND_SIZE = 5;

type SelectionMode = 'pvp' | 'bot';

interface NFTSelectionSimplifiedProps {
  mode?: SelectionMode;
}

function dealTrainingHand(): Creature[] {
  return [...ALL_CREATURES]
    .sort(() => Math.random() - 0.5)
    .slice(0, TRAINING_HAND_SIZE);
}

const NFTSelectionSimplified: React.FC<NFTSelectionSimplifiedProps> = ({ mode = 'pvp' }) => {
  const isBotMode = mode === 'bot';
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(60);
  const [waiting, setWaiting] = useState(false);
  const [lost, setLost] = useState(false);
  const [isLoadingHand, setIsLoadingHand] = useState(true);
  const [dealtCreatures, setDealtCreatures] = useState<Creature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user, error: authError } = useAuth();
  const currentPlayerId = user?.id;
  
  const navigationManagerRef = useRef<NFTSelectionNavigationManager | null>(null);
  const handPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (lost || waiting) return;
    if (timer <= 0) {
      setLost(true);
      return;
    }
    const intervalId = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer, lost, waiting]);

  // Initialize navigation manager
  useEffect(() => {
    if (isBotMode) return;

    if (!gameId || !currentPlayerId || authError) {
      if (!gameId) setError("Game ID missing from URL.");
      if (!currentPlayerId && !authError) setError("Identifying player...");
      if (authError) setError(`Error identifying player: ${authError}`);
      setIsLoadingHand(false);
      return;
    }

    console.log('[NFTSelection] Initializing navigation manager');

    navigationManagerRef.current = new NFTSelectionNavigationManager({
      gameId,
      currentPlayerId,
      onNavigateToGame: () => {
        console.log('[NFTSelection] 🎯 Navigating to game initialization screen');
        navigate(`/game-initializing/${gameId}`);
      },
      onWaitingStateChange: (isWaiting: boolean) => {
        console.log('[NFTSelection] ⏳ Waiting state changed:', isWaiting);
        setWaiting(isWaiting);
      },
      onError: (errorMessage: string) => {
        console.error('[NFTSelection] Navigation manager error:', errorMessage);
        setError(errorMessage);
      }
    });

    return () => {
      if (navigationManagerRef.current) {
        navigationManagerRef.current.cleanup();
        navigationManagerRef.current = null;
      }
    };
  }, [gameId, currentPlayerId, authError, navigate, isBotMode]);

  // Load hand data
  useEffect(() => {
    if (isBotMode) {
      clearBotCreatureSelection();
      setSelected([]);
      setWaiting(false);
      setLost(false);
      setTimer(60);
      setError(null);
      setDealtCreatures(dealTrainingHand());
      setIsLoadingHand(false);
      return;
    }

    if (!gameId || !currentPlayerId) return;

    const loadHandData = async () => {
      try {
        console.log('[NFTSelection] Loading hand data');
        setIsLoadingHand(true);
        setError(null);

        const [gameData, cardState] = await Promise.all([
          getGameDetails(gameId),
          getCardGameSessionState(gameId),
        ]);

        if (!gameData || !cardState) throw new Error('Session not found');

        const participant = gameData.participants?.find(p => p.player_id === currentPlayerId);
        if (!participant) throw new Error('You are not part of this session');

        const hand = cardState.dealt_hands?.[String(participant.slot)];

        if (hand && hand.length > 0) {
          const creatures = hand.map((id: string) => 
            ALL_CREATURES.find(c => c.id === id)
          ).filter(Boolean) as Creature[];
          
          setDealtCreatures(creatures);
          setIsLoadingHand(false);
          console.log('[NFTSelection] Hand loaded:', creatures.length, 'cards');

          // Check if player already completed selection
          const playerComplete = cardState.selected_creatures?.[String(participant.slot)]?.length === 3;
          if (playerComplete) {
            console.log('[NFTSelection] Player already completed selection');
            setWaiting(true);
          }
        } else {
          console.log('[NFTSelection] No hand data, starting polling');
          startHandPolling(participant.slot);
        }

      } catch (error: any) {
        console.error('[NFTSelection] Error loading hand:', error);
        setError(`Failed to load hand: ${error.message}`);
        setIsLoadingHand(false);
      }
    };

    loadHandData();

    return () => {
      if (handPollIntervalRef.current) {
        clearInterval(handPollIntervalRef.current);
        handPollIntervalRef.current = null;
      }
    };
  }, [gameId, currentPlayerId, isBotMode]);

  const startHandPolling = (slot: number) => {
    if (handPollIntervalRef.current) return;

    console.log('[NFTSelection] Starting hand polling');
    
    handPollIntervalRef.current = setInterval(async () => {
      try {
        if (!gameId) return;
        const cardState = await getCardGameSessionState(gameId);
        const hand = cardState?.dealt_hands?.[String(slot)];
        
        if (hand && hand.length > 0) {
          const creatures = hand.map((id: string) => 
            ALL_CREATURES.find(c => c.id === id)
          ).filter(Boolean) as Creature[];
          
          setDealtCreatures(creatures);
          setIsLoadingHand(false);
          console.log('[NFTSelection] Hand loaded via polling:', creatures.length, 'cards');

          // Stop polling
          if (handPollIntervalRef.current) {
            clearInterval(handPollIntervalRef.current);
            handPollIntervalRef.current = null;
          }
        }
      } catch (error: any) {
        console.error('[NFTSelection] Hand polling error:', error);
      }
    }, 3000);
  };

  const toggleSelect = (id: string) => {
    if (lost || waiting || isConfirming) return;

    setSelected(currentSelected => {
      if (currentSelected.includes(id)) {
        return currentSelected.filter(cardId => cardId !== id);
      } else if (currentSelected.length < 3) {
        return [...currentSelected, id];
      } else {
        return currentSelected;
      }
    });
  };

  const handleConfirm = async () => {
    if (selected.length !== 3 || lost || waiting || isConfirming) {
      console.warn('[NFTSelection] Confirm conditions not met');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      if (isBotMode) {
        writeBotCreatureSelection(selected);
        navigate('/bot-game', { state: { selectedCreatures: selected } });
        return;
      }

      if (!navigationManagerRef.current) {
        throw new Error('Selection manager is not ready');
      }

      console.log('[NFTSelection] Confirming selection:', selected);
      
      // Stop hand polling if still active
      if (handPollIntervalRef.current) {
        clearInterval(handPollIntervalRef.current);
        handPollIntervalRef.current = null;
      }

      await navigationManagerRef.current.updatePlayerSelection(selected);
      console.log('[NFTSelection] Selection confirmed successfully');

  // Add a direct check after a short delay as backup
      setTimeout(async () => {
    if (!gameId || waiting) return;
        
        try {
          console.log('[NFTSelection] Backup check: Verifying both players completed');
          const cardState = await getCardGameSessionState(gameId);
          if (cardState) {
            if (cardState.selected_creatures?.['0']?.length === 3 && cardState.selected_creatures?.['1']?.length === 3) {
      console.log('[NFTSelection] 🎯 BACKUP NAVIGATION: Both players completed, navigating...');
      navigate(`/game-initializing/${gameId}`);
            }
          }
        } catch (err) {
          console.error('[NFTSelection] Backup check error:', err);
        }
      }, 1000);

  // Add a second backup check with longer delay
      setTimeout(async () => {
    if (!gameId || waiting) return;
        
        try {
          console.log('[NFTSelection] Extended backup check: Final verification');
          const cardState = await getCardGameSessionState(gameId);
          if (cardState) {
            if (cardState.selected_creatures?.['0']?.length === 3 && cardState.selected_creatures?.['1']?.length === 3) {
      console.log('[NFTSelection] 🎯 EXTENDED BACKUP NAVIGATION: Both players completed, navigating...');
      navigate(`/game-initializing/${gameId}`);
            }
          }
        } catch (err) {
          console.error('[NFTSelection] Extended backup check error:', err);
        }
      }, 3000);

    } catch (error: any) {
      console.error('[NFTSelection] Error confirming selection:', error);
      setError(`Failed to confirm selection: ${error.message}`);
      setIsConfirming(false);
    }
  };

  const getCardHeight = (width: string) => {
    const widthValue = parseFloat(width);
    return `${widthValue / CARD_ASPECT_RATIO}px`;
  };

  const handleShuffleTrainingHand = () => {
    if (!isBotMode || isConfirming) return;
    clearBotCreatureSelection();
    setSelected([]);
    setLost(false);
    setTimer(60);
    setDealtCreatures(dealTrainingHand());
  };

  // Render loading state
  if (authError) {
    return (
      <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <ErrorRecoveryPanel title="Could not identify player" message={authError} onBack={() => navigate('/lobby')} backLabel="Back to Lobby" />
      </div>
    );
  }

  if (isLoadingHand) {
    return (
      <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <SpinnerEmblem label="Loading your hand... Waiting for cards to be dealt." />
      </div>
    );
  }

  if (error && !lost) {
    return (
      <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <ErrorRecoveryPanel title="Could not load selection" message={error} onBack={() => navigate('/lobby')} onRetry={() => window.location.reload()} backLabel="Back to Lobby" />
      </div>
    );
  }

  if (!lost && dealtCreatures.length === 0) {
    return (
      <div className="arena-page flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <ErrorRecoveryPanel title="No cards available" message="Could not load your hand. Please refresh or return to the lobby." onBack={() => navigate('/lobby')} onRetry={() => window.location.reload()} backLabel="Back to Lobby" />
      </div>
    );
  }

  return (
    <div className="arena-page min-h-[calc(100vh-var(--navbar-height))] px-4 py-8 text-white sm:px-6 lg:px-8">
      {/* Debug Panel — dev only */}
      {import.meta.env.DEV && !isBotMode && <GameStateDebug gameId={gameId || ''} className="fixed top-4 right-4 z-50" />}

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button type="button" onClick={() => navigate('/lobby')} className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {gameId && !isBotMode && <CopyChip label="Game ID" value={gameId} />}
          {isBotMode && (
            <StatusBadge tone="amber">
              <Bot className="h-3.5 w-3.5" aria-hidden />
              Training Setup
            </StatusBadge>
          )}
        </div>

        <Panel className="p-5 sm:p-8" glow>
          <div className="mb-8 grid gap-6 border-b border-white/10 pb-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="text-center lg:text-left">
              <StatusBadge tone={selected.length === 3 ? 'green' : 'violet'} className="mb-4">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {selected.length === 3 ? 'Ready' : 'Choose exactly 3'}
              </StatusBadge>
              <h1 className="font-display text-4xl font-black text-slate-50">
                {isBotMode ? 'Select Your Training Team (Choose 3)' : 'Select Your Team (Choose 3)'}
              </h1>
              <p className="mt-3 text-slate-300">
                {isBotMode
                  ? 'Choose exactly 3 creatures before facing the bot. Practice mode does not change competitive stats.'
                  : 'Choose exactly 3 creatures to enter the arena. You cannot select more than 3.'}
              </p>
              {isBotMode && (
                <ArenaButton
                  type="button"
                  variant="ghost"
                  icon={<Dices className="h-4 w-4" aria-hidden />}
                  onClick={handleShuffleTrainingHand}
                  className="mt-4"
                  disabled={isConfirming}
                >
                  Shuffle Hand
                </ArenaButton>
              )}
            </div>
            <div className={cn('mx-auto grid h-28 w-28 place-items-center rounded-full border-4 bg-cyan-500/10 text-center shadow-[0_0_34px_rgba(34,211,238,0.24)] lg:mx-0', timer <= 10 ? 'border-red-300 text-red-200 animate-pulse' : 'border-cyan-300/50 text-cyan-100')}>
              <div>
                <Clock3 className="mx-auto mb-1 h-5 w-5" aria-hidden />
                <div className="text-4xl font-black leading-none">{timer}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest">sec</div>
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {dealtCreatures.map((card) => {
              const isSelected = selected.includes(card.id);
              return (
                <div
                  key={card.id}
                  style={{ width: CARD_WIDTH_DESKTOP, height: getCardHeight(CARD_WIDTH_DESKTOP) }}
                  className={cn(
                    'card-readable relative m-1 rounded-[14px] transition duration-300',
                    lost || waiting || isConfirming ? 'cursor-not-allowed opacity-65' : 'cursor-pointer hover:-translate-y-1 hover:scale-[1.03]',
                    isSelected && 'shadow-[0_0_28px_rgba(246,184,59,0.45)]',
                  )}
                  onClick={() => toggleSelect(card.id)}
                >
                  <Card
                    card={card}
                    isSelected={isSelected}
                    isDisabled={lost || waiting || isConfirming}
                  />
                  {isSelected && (
                    <div className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-amber-200 bg-amber-400 text-black shadow-lg">
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold text-amber-200">Your Team ({selected.length}/3)</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Click a selected mini card to remove it before {isBotMode ? 'starting training' : 'confirmation'}.
                </p>
                {selected.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {dealtCreatures
                      .filter(card => selected.includes(card.id))
                      .map(card => (
                        <div
                          key={`selected-${card.id}`}
                          style={{ width: '86px', height: getCardHeight('86px') }}
                          className="relative cursor-pointer overflow-hidden rounded-[10px] border-2 border-amber-300 shadow-[0_0_18px_rgba(246,184,59,0.28)] transition hover:border-red-300"
                          onClick={() => toggleSelect(card.id)}
                        >
                          <Card
                            card={card}
                            isSelected={true}
                            isDisabled={lost || waiting || isConfirming}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid h-20 w-20 place-items-center rounded-2xl border border-amber-300/30 bg-amber-500/10 text-center">
                <div>
                  <div className="text-3xl font-black text-amber-200">{selected.length}/3</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Selected</div>
                </div>
              </div>

              <div className="text-center">
                {lost ? (
                  <StatusBadge tone="red">Time Expired - You Lost!</StatusBadge>
                ) : waiting && !isBotMode ? (
                  <StatusBadge tone="green">Waiting for opponent...</StatusBadge>
                ) : (
                  <ArenaButton
                    type="button"
                    onClick={handleConfirm}
                    disabled={selected.length !== 3}
                    loading={isConfirming}
                    size="lg"
                  >
                    {isConfirming ? 'Confirming...' : isBotMode ? `Start Training (${selected.length}/3)` : `Confirm Selection (${selected.length}/3)`}
                  </ArenaButton>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default NFTSelectionSimplified;
