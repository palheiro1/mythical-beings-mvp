import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot as BotIcon, GraduationCap, Info } from 'lucide-react';
import { GameState } from '../game/types.js';
import { initializeGame } from '../game/state.js';
import TopBar from '../components/game/TopBar.js';
import ActionBar from '../components/game/ActionBar.js';
import TableArea from '../components/game/TableArea.js';
import HandsColumn from '../components/game/HandsColumn.js';
import GameAnnouncer from '../components/game/GameAnnouncer.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js';
import { useLocalGameActions } from '../hooks/useLocalGameActions.js';
import { useCardRegistry } from '../hooks/useCardRegistry.js';
import GameShell from '../components/game/GameShell.js';
import GameAuxPanels from '../components/game/GameAuxPanels.js';
import { ArenaButton, Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';
import { clearBotCreatureSelection, isValidBotCreatureSelection, readBotCreatureSelection } from '../utils/botSelection.js';
import PendingEffectPanel from '../components/game/PendingEffectPanel.js';
import TrainingTutorial from '../components/game/TrainingTutorial.js';
import { getEffectiveCreatureWisdom } from '../game/utils.js';
import {
  CHAMPIONSHIP_MESSAGE,
  TRAINING_PREVIEW_ENABLED,
  TRAINING_PREVIEW_LABEL,
} from '../config/release.js';

const BOT_ID = 'bot';
const BOT_NAME = 'Bot';
const LOCAL_PLAYER_ID = 'local-player';

const BOT_CREATURES = ['adaro', 'lisovik', 'kappa'];
const BOT_PLAYER_LABELS = { [LOCAL_PLAYER_ID]: 'You', [BOT_ID]: BOT_NAME };
const TRAINING_TUTORIAL_STORAGE_KEY = 'wisdom-duel-training-tutorial-v1';

const BotGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPlayerId = LOCAL_PLAYER_ID;
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(TRAINING_TUTORIAL_STORAGE_KEY) !== 'seen';
    } catch {
      return true;
    }
  });
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

  const handleTutorialClose = () => {
    setTutorialOpen(false);
    try {
      window.localStorage.setItem(TRAINING_TUTORIAL_STORAGE_KEY, 'seen');
    } catch {
      // The guide still closes when storage is unavailable or blocked.
    }
  };

  // Initialize a local game only after the shared creature selection screen has completed.
  useEffect(() => {
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
  }, [currentPlayerId, navigate, playerCreatureIds]);

  // Bot resolves its own pending choices deterministically.
  const botThinking = useRef(false);
  const pendingEffect = gameState?.pendingEffect;
  useEffect(() => {
    if (!pendingEffect || pendingEffect.playerId !== BOT_ID) return;

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
  }, [pendingEffect, handleAction]);

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
  }, [gameState, handleAction]);

  // Timer
  const TURN_DURATION_SECONDS = 30;
  const isMyTurn = !!gameState && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId;
  const remainingTime = useTurnTimer({
    isMyTurn: isMyTurn && !gameState?.pendingEffect && !tutorialOpen,
    phase: gameState?.pendingEffect ? null : gameState?.phase === 'action' || gameState?.phase === 'knowledge' || gameState?.phase === 'end' ? gameState.phase : null,
    turnDurationSeconds: TURN_DURATION_SECONDS,
    onTimerEnd: handleTrainingEndTurn,
    gameTurn: gameState?.turn ?? 0,
    currentPlayerIndex: gameState?.currentPlayerIndex ?? null,
  });

  if (!gameState) {
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
          <TrainingTutorial open={tutorialOpen} onClose={handleTutorialClose} />
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
        <div ref={(element) => registry.register('action:anchor', element)}>
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
        </div>
      )}
    >
      <div className="flex min-h-0 flex-col gap-2 xl:h-full">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <StatusBadge tone="amber">
                <BotIcon className="h-3.5 w-3.5" aria-hidden />
                {TRAINING_PREVIEW_ENABLED ? TRAINING_PREVIEW_LABEL : 'Training Mode'}
              </StatusBadge>
              <span className="text-sm text-slate-300">Practice against the bot</span>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div className="hidden items-center gap-2 text-sm text-cyan-200 md:flex">
                <Info className="h-4 w-4" aria-hidden />
                {TRAINING_PREVIEW_ENABLED ? CHAMPIONSHIP_MESSAGE : 'No competitive rewards are earned.'}
              </div>
              <ArenaButton
                type="button"
                variant="ghost"
                size="sm"
                icon={<GraduationCap className="h-4 w-4" aria-hidden />}
                onClick={() => setTutorialOpen(true)}
              >
                Show tutorial
              </ArenaButton>
            </div>
          </Panel>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(260px,0.92fr)_minmax(540px,2.45fr)_minmax(300px,0.95fr)] xl:overflow-hidden">
        <div
          className="order-2 min-h-[280px] xl:order-1 xl:h-full xl:min-h-0"
          ref={(element) => registry.register('hand:anchor', element)}
        >
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
        <div className="order-1 min-h-[360px] sm:min-h-[460px] xl:order-2 xl:h-full xl:min-h-0" ref={(el) => { if (el) registry.register('table:anchor', el); }}>
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
        <GameAuxPanels
          marketCards={gameState.market}
          deckCount={gameState.knowledgeDeck.length}
          isMyTurn={isMyTurn && !gameState.pendingEffect}
          phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
          logs={gameState.log}
          playerLabels={BOT_PLAYER_LABELS}
          onDrawKnowledge={handleMarketClick}
        />
        </div>
      </div>
    </GameShell>
  );
};

export default BotGame;
