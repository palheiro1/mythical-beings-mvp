import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot as BotIcon, Info } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { GameState } from '../game/types.js';
import { initializeGame } from '../game/state.js';
import TopBar from '../components/game/TopBar.js';
import ActionBar from '../components/game/ActionBar.js';
import TableArea from '../components/game/TableArea.js';
import HandsColumn from '../components/game/HandsColumn.js';
import MarketColumn from '../components/game/MarketColumn.js';
import Logs from '../components/game/Logs.js';
import GameAnnouncer from '../components/game/GameAnnouncer.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js';
import { useLocalGameActions } from '../hooks/useLocalGameActions.js';
import { useCardRegistry } from '../context/CardRegistry.js';
import GameShell from '../components/game/GameShell.js';
import { Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';
import { clearBotCreatureSelection, isValidBotCreatureSelection, readBotCreatureSelection } from '../utils/botSelection.js';
import PendingEffectPanel from '../components/game/PendingEffectPanel.js';
import { getEffectiveCreatureWisdom } from '../game/utils.js';

const BOT_ID = 'bot';
const BOT_NAME = 'Bot';

const BOT_CREATURES = ['adaro', 'lisovik', 'kappa'];

const BotGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const currentPlayerId = user?.id || 'local-user';
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [playerCreatureIds] = useState<string[] | null>(() => {
    const state = location.state as { selectedCreatures?: unknown } | null;
    const selectedCreatures = state?.selectedCreatures;
    return isValidBotCreatureSelection(selectedCreatures)
      ? selectedCreatures
      : readBotCreatureSelection();
  });
  const registry = useCardRegistry();

  // Local actions via reducer with functional setState to avoid stale updates
  const { handleRotateCreature, handleDrawKnowledge, handleCreatureClickForSummon, handleEndTurn, handleAction } = useLocalGameActions(
    gameState,
    setGameState,
    gameState ? gameState.players[gameState.currentPlayerIndex].id : currentPlayerId,
    selectedKnowledgeId
  );

  // Keep a ref of the latest state for the bot to read fresh data between actions
  const latestStateRef = useRef<GameState | null>(null);
  useEffect(() => { latestStateRef.current = gameState; }, [gameState]);

  const handleHandClick = (instanceId: string) => {
    setSelectedKnowledgeId(prev => prev === instanceId ? null : instanceId);
  };

  const handleCreatureClick = (creatureId: string) => {
    if (selectedKnowledgeId) {
      handleCreatureClickForSummon(creatureId);
      setSelectedKnowledgeId(null);
    } else {
      handleRotateCreature(creatureId);
    }
  };

  const handleMarketClick = (knowledgeId: string) => {
    handleDrawKnowledge(knowledgeId);
    setSelectedKnowledgeId(null);
  };

  const handleTrainingEndTurn = () => {
    setSelectedKnowledgeId(null);
    handleEndTurn();
  };

  // Initialize a local game only after the shared creature selection screen has completed.
  useEffect(() => {
    if (authLoading) return;

    if (!playerCreatureIds) {
      navigate('/bot-selection', { replace: true });
      return;
    }

    try {
      const id = `bot-${Date.now()}`;
      const state = initializeGame({
        gameId: id,
        player1Id: currentPlayerId,
        player2Id: BOT_ID,
        player1SelectedIds: playerCreatureIds,
        player2SelectedIds: BOT_CREATURES,
      });
      setGameState(state);
    } catch (error) {
      console.error('[BotGame] Failed to initialize selected training team:', error);
      clearBotCreatureSelection();
      navigate('/bot-selection', { replace: true });
    }
  }, [authLoading, currentPlayerId, navigate, playerCreatureIds]);

  // Bot resolves its own pending choices deterministically.
  const botThinking = useRef(false);
  useEffect(() => {
    if (!gameState || !gameState.pendingEffect) return;
    if (gameState.pendingEffect.playerId !== BOT_ID) return;

    const timeout = window.setTimeout(() => {
      const pending = latestStateRef.current?.pendingEffect;
      if (!pending || pending.playerId !== BOT_ID) return;
      handleAction({
        type: 'RESOLVE_PENDING_EFFECT',
        payload: {
          playerId: BOT_ID,
          resolution: pending.optional
            ? { effectId: pending.id, skip: true }
            : { effectId: pending.id, choice: pending.choices[0] },
        },
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [gameState?.pendingEffect, handleAction]);

  // Simple Bot AI loop: on bot's action phase, try rotate → play → draw, with small delays
  useEffect(() => {
    if (!gameState || gameState.phase !== 'action' || gameState.pendingEffect) return;
    const isBotTurn = gameState.players[gameState.currentPlayerIndex]?.id === BOT_ID;
    if (!isBotTurn || botThinking.current || gameState.winner) return;
    botThinking.current = true;

    const runBot = async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      // Use fresh snapshot each step
      let snap = latestStateRef.current!;
      const bot = snap.players[snap.currentPlayerIndex];

      // 1) Rotate first creature that is not fully rotated (assume up to 270)
      const rotatable = bot.creatures.find(c => (c.rotation ?? 0) < 270);
      if (rotatable) {
        await sleep(350);
        handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: BOT_ID, creatureId: rotatable.id } });
        await sleep(100); // allow reducer to commit
        snap = latestStateRef.current!;
      }

      // 2) Try to play first playable knowledge in hand onto first empty slot creature
      snap = latestStateRef.current!;
      const botNow = snap.players[snap.currentPlayerIndex];
      const playableTarget = botNow.field.flatMap(s => {
        const playable = botNow.hand.find(k => getEffectiveCreatureWisdom(snap, snap.currentPlayerIndex, s.creatureId) >= k.cost);
        return playable ? [{ creatureId: s.creatureId, card: playable }] : [];
      })[0];
      if (playableTarget) {
        await sleep(350);
        handleAction({ type: 'SUMMON_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: playableTarget.card.id, creatureId: playableTarget.creatureId, instanceId: playableTarget.card.instanceId! } });
        await sleep(100);
        snap = latestStateRef.current!;
      } else {
        // 3) Otherwise draw first market card
        const marketTop = snap.market[0];
        if (marketTop) {
          await sleep(350);
          handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: marketTop.id, instanceId: marketTop.instanceId! } });
          await sleep(100);
          snap = latestStateRef.current!;
        }
      }

      // End bot turn
      await sleep(300);
      const finalSnap = latestStateRef.current;
      if (finalSnap && !finalSnap.pendingEffect && finalSnap.players[finalSnap.currentPlayerIndex]?.id === BOT_ID) {
        handleAction({ type: 'END_TURN', payload: { playerId: BOT_ID } });
      }
      botThinking.current = false;
    };

    runBot();
  }, [gameState]);

  // Timer
  const TURN_DURATION_SECONDS = 30;
  const isMyTurn = !!gameState && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId;
  const remainingTime = useTurnTimer({
    isMyTurn: isMyTurn && !gameState?.pendingEffect,
    phase: gameState?.pendingEffect ? null : gameState?.phase === 'action' || gameState?.phase === 'knowledge' || gameState?.phase === 'end' ? gameState.phase : null,
    turnDurationSeconds: TURN_DURATION_SECONDS,
    onTimerEnd: handleTrainingEndTurn,
    gameTurn: gameState?.turn ?? 0,
    currentPlayerIndex: gameState?.currentPlayerIndex ?? null,
  });

  if (authLoading || !gameState) {
    return <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center"><SpinnerEmblem label="Loading bot game..." /></div>;
  }

  const player = gameState.players[0];
  const opponent = gameState.players[1];

  return (
    <GameShell
      overlays={(
        <>
          <GameAnnouncer
            turn={gameState.turn}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
            isMyTurn={isMyTurn && !gameState.pendingEffect}
            playerName={'You'}
            opponentName={BOT_NAME}
          />
          <PendingEffectPanel
            gameState={gameState}
            currentPlayerId={currentPlayerId}
            onResolve={(resolution) => handleAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: currentPlayerId, resolution } })}
          />
        </>
      )}
      topBar={(
        <TopBar
          player1Profile={{ id: '', username: 'You', display_name: null, avatar_url: null }}
          player2Profile={{ id: '', username: BOT_NAME, display_name: null, avatar_url: null }}
          player1Power={player.power}
          player2Power={opponent.power}
          turn={gameState.turn}
          phase={gameState.phase}
          currentPlayerId={player.id}
          gameState={gameState}
        />
      )}
      actionBar={(
        <ActionBar
          isMyTurn={isMyTurn && !gameState.pendingEffect}
          phase={gameState.phase}
          winner={gameState.winner}
          actionsTaken={gameState.actionsTakenThisTurn}
          actionsPerTurn={gameState.actionsPerTurn}
          turnTimer={remainingTime}
          isSpectator={false}
          winnerLabel={gameState.winner === BOT_ID ? BOT_NAME : 'You'}
          currentActorLabel={isMyTurn ? 'You' : BOT_NAME}
          onEndTurnClick={handleTrainingEndTurn}
        />
      )}
    >
      <div className="flex min-h-0 flex-col gap-2 xl:h-full">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusBadge tone="amber">
                <BotIcon className="h-3.5 w-3.5" aria-hidden />
                Training Mode
              </StatusBadge>
              <span className="text-sm text-slate-300">Practice against AI</span>
            </div>
            <div className="hidden items-center gap-2 text-sm text-cyan-200 sm:flex">
              <Info className="h-4 w-4" aria-hidden />
              No competitive rewards are earned.
            </div>
          </Panel>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(170px,0.82fr)_minmax(0,3.6fr)_minmax(170px,0.85fr)_minmax(190px,1fr)] xl:overflow-hidden">
        <div className="order-2 min-h-[280px] xl:order-1 xl:h-full xl:min-h-0">
          <HandsColumn
            currentPlayerHand={player.hand}
            opponentPlayerHand={opponent.hand}
            isMyTurn={isMyTurn && !gameState.pendingEffect}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase as any : 'end'}
            selectedKnowledgeId={selectedKnowledgeId}
            onHandCardClick={handleHandClick}
            currentPlayerLabel="Your Hand"
            opponentPlayerLabel={BOT_NAME}
          />
        </div>
        <div className="order-1 min-h-[460px] xl:order-2 xl:h-full xl:min-h-0" ref={(el) => { if (el) registry.register('table:anchor', el); }}>
          <TableArea
            currentPlayer={player}
            opponentPlayer={opponent}
            isMyTurn={isMyTurn && !gameState.pendingEffect}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
            selectedKnowledgeId={selectedKnowledgeId}
            onCreatureClickForSummon={handleCreatureClick}
            onRotateCreature={handleCreatureClick}
          />
        </div>
        <details className="order-3 min-h-0 xl:contents" open>
          <summary className="mb-2 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold uppercase tracking-normal text-slate-200 xl:hidden">
            Market and game log
          </summary>
          <div className="grid min-h-0 gap-2 md:grid-cols-2 xl:contents">
            <div className="min-h-0 xl:h-full" ref={(el) => { if (el) registry.register('market:anchor', el); }}>
              <MarketColumn
                marketCards={gameState.market}
                deckCount={gameState.knowledgeDeck.length}
                isMyTurn={isMyTurn && !gameState.pendingEffect}
                phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
                onDrawKnowledge={handleMarketClick}
              />
            </div>
            <div className="min-h-0 xl:h-full" ref={(el) => { if (el) registry.register('discard:anchor', el); }}>
              <Logs logs={gameState.log} />
            </div>
          </div>
        </details>
        </div>
      </div>
    </GameShell>
  );
};

export default BotGame;
