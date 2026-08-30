import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useGameInitialization } from '../hooks/useGameInitialization.js';
import { useGameActions } from '../hooks/useGameActions.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js'; // Import the timer hook
import { PlayerState } from '../game/types.js';
import TopBar from '../components/game/TopBar.js';
import ActionBar from '../components/game/ActionBar.js';
import TableArea from '../components/game/TableArea.js';
import HandsColumn from '../components/game/HandsColumn.js';
import {
  COMPETITION_SETTLEMENT_EVENT,
  getPendingCompetitionSettlement,
  retryCompetitionSettlement,
} from '../utils/supabase.js';
import type { CompetitionSettlementNotice, ProfileInfo } from '../utils/supabase.js';
import GameAnnouncer from '../components/game/GameAnnouncer.js';
import CardMoveLayer from '../components/game/CardMoveLayer.js';
import CombatFloaters from '../components/game/CombatFloaters.js';
import { useCardRegistry } from '../hooks/useCardRegistry.js';
import GameShell from '../components/game/GameShell.js';
import GameAuxPanels from '../components/game/GameAuxPanels.js';
import { ArenaButton, ErrorRecoveryPanel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';
import PendingEffectPanel from '../components/game/PendingEffectPanel.js';
import { getPlayerDisplayName } from '../utils/format.js';
import { usePlayerProfiles } from '../hooks/usePlayerProfiles.js';
import {
  createFieldKnowledgeSnapshot,
  detectPowerDamage,
  findAttackMoveSource,
  findRemovedFieldKnowledge,
  getViewerPlayerIndex,
  isViewerTurn,
  type FieldKnowledgeSnapshot,
} from '../game/viewer.js';

const fallbackProfile = (id: string, label: string): ProfileInfo => ({
  id,
  username: label,
  display_name: null,
  avatar_url: null,
});

const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentPlayerId = user?.id;
  const idLoading = authLoading;
  const [error, setError] = useState<string | null>(null);

  const [gameState, dispatch, gameLoading, gameId] = useGameInitialization(currentPlayerId || null, setError);

  const playerIndex = getViewerPlayerIndex(gameState, currentPlayerId);
  const isMyTurn = isViewerTurn(gameState, currentPlayerId);
  const profilePlayerOneId = gameState?.players?.[0]?.id;
  const profilePlayerTwoId = gameState?.players?.[1]?.id;
  const { profiles: playerProfiles, loading: profilesLoading } = usePlayerProfiles({
    playerIds: [profilePlayerOneId, profilePlayerTwoId],
    upstreamLoading: gameLoading,
  });
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [settlementRetry, setSettlementRetry] = useState<CompetitionSettlementNotice | null>(null);
  const [settlementRetrying, setSettlementRetrying] = useState(false);

  const {
    handleRotateCreature,
    handleDrawKnowledge,
    handleHandCardClick,
    handleCreatureClickForSummon,
    handleEndTurn, // Get handleEndTurn from useGameActions
    handleResolvePendingEffect,
  } = useGameActions(gameState, gameId || null, dispatch, currentPlayerId || null, selectedKnowledgeId);

  // Animation overlay state
  const [moveEvent, setMoveEvent] = useState<import('../types/vfx.js').MoveEvent | null>(null);
  const [damageEvent, setDamageEvent] = useState<import('../components/game/CombatFloaters.js').DamageEvent | null>(null);
  const registry = useCardRegistry();
  const damageEventSequenceRef = React.useRef(0);
  const prevPowersRef = React.useRef<{ p0: number; p1: number } | null>(null);
  const previousDamageGameIdRef = React.useRef<string | null>(null);
  const prevFieldRef = React.useRef<FieldKnowledgeSnapshot | null>(null);
  const previousFieldGameIdRef = React.useRef<string | null>(null);
  const lastLogIndexRef = React.useRef<number>(-1);
  const previousLogGameIdRef = React.useRef<string | null>(null);
  const clearDamageEvent = useCallback(() => setDamageEvent(null), []);

  useEffect(() => {
    if (!gameId) return;

    setSettlementRetry(getPendingCompetitionSettlement(gameId));

    const handleSettlementNotice = (event: Event) => {
      const notice = (event as CustomEvent<CompetitionSettlementNotice>).detail;
      if (!notice || notice.sessionId !== gameId) return;
      setSettlementRetry(notice.status === 'failed' ? notice : null);
    };

    window.addEventListener(COMPETITION_SETTLEMENT_EVENT, handleSettlementNotice);

    return () => {
      window.removeEventListener(COMPETITION_SETTLEMENT_EVENT, handleSettlementNotice);
    };
  }, [gameId]);

  // --- Turn Timer --- 
  const TURN_DURATION_SECONDS = 30;
  
  // Map broader GameState phase types to narrower component phase types
  const mapPhaseForTimer = (phase: string | undefined): 'knowledge' | 'action' | 'end' | null => {
    if (!phase) return null;
    switch (phase) {
      case 'knowledge':
      case 'action':
      case 'end':
        return phase;
      case 'gameOver':
      case 'setup':
      default:
        return null; // For non-timer phases, return null to disable timer
    }
  };

  const mapPhaseForTableArea = (phase: string | undefined): 'knowledge' | 'action' | 'end' => {
    if (!phase) return 'end';
    switch (phase) {
      case 'knowledge':
      case 'action':
      case 'end':
        return phase;
      case 'gameOver':
      case 'setup':
      default:
        return 'end'; // Default to 'end' for invalid phases
    }
  };
  
  const remainingTime = useTurnTimer({
    isMyTurn: isMyTurn && !gameState?.pendingEffect,
    phase: gameState?.pendingEffect ? null : mapPhaseForTimer(gameState?.phase),
    turnDurationSeconds: TURN_DURATION_SECONDS,
    onTimerEnd: handleEndTurn, // Call handleEndTurn when timer ends
    gameTurn: gameState?.turn ?? 0,
    currentPlayerIndex: gameState?.currentPlayerIndex ?? null,
  });
  // --- End Turn Timer ---

  // Compute player/opponent indices and objects early so all hooks can safely run before any early returns
  const isSpectator = playerIndex === -1;
  const viewerPlayerIndex = isSpectator ? 0 : playerIndex;
  const viewerOpponentIndex = viewerPlayerIndex === 0 ? 1 : 0;
  const player: PlayerState | undefined = gameState ? gameState.players[viewerPlayerIndex] : undefined;
  const opponent: PlayerState | undefined = gameState ? gameState.players[viewerOpponentIndex] : undefined;
  const damageGameId = gameState?.gameId ?? null;
  const playerOnePower = gameState?.players[0]?.power ?? 0;
  const playerTwoPower = gameState?.players[1]?.power ?? 0;
  const playerOneId = gameState?.players[0]?.id;
  const playerTwoId = gameState?.players[1]?.id;
  const gameLog = gameState?.log;
  const fieldPlayers = gameState?.players;

  // Damage floater: watch power changes (must run every render to keep hook order stable)
  useEffect(() => {
    if (!damageGameId) return;
    const current = { p0: playerOnePower, p1: playerTwoPower };
    if (previousDamageGameIdRef.current !== damageGameId) {
      previousDamageGameIdRef.current = damageGameId;
      prevPowersRef.current = current;
      return;
    }
    const detected = detectPowerDamage(
      prevPowersRef.current,
      current,
      [playerOneId, playerTwoId],
      gameLog ?? [],
    );
    if (detected) {
      const rect = registry.getRect(`power:${detected.playerIndex}`);
      if (rect) {
        damageEventSequenceRef.current += 1;
        setDamageEvent({
          key: `damage-${damageEventSequenceRef.current}`,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          damage: detected.damage,
          blocked: detected.blocked,
          bypass: detected.bypass,
        });
      }
    }
    prevPowersRef.current = current;
  }, [
    damageGameId,
    gameLog,
    playerOneId,
    playerOnePower,
    playerTwoId,
    playerTwoPower,
    registry,
  ]);

  // Discard animation: detect knowledge leaving field (must run every render to keep hook order stable)
  useEffect(() => {
    if (!damageGameId || !fieldPlayers) return;
    const current = createFieldKnowledgeSnapshot(fieldPlayers, viewerPlayerIndex);
    if (previousFieldGameIdRef.current !== damageGameId) {
      previousFieldGameIdRef.current = damageGameId;
      prevFieldRef.current = current;
      return;
    }
    const removed = findRemovedFieldKnowledge(prevFieldRef.current, current);
    if (removed) {
      const fromId = `table:${removed.instanceId}`;
      const toId = 'discard:anchor';
      if (registry.has(fromId) && registry.has(toId)) {
        setMoveEvent({
          id: removed.instanceId,
          fromId,
          toId,
          image: removed.image ?? '/images/spells/back.webp',
        });
      }
    }
    prevFieldRef.current = current;
  }, [damageGameId, fieldPlayers, registry, viewerPlayerIndex]);

  // Knowledge-phase attack movement: damage floaters come only from observed power deltas.
  useEffect(() => {
    if (!damageGameId || !fieldPlayers || !gameLog) return;
    const newIdx = gameLog.length - 1;
    if (previousLogGameIdRef.current !== damageGameId) {
      previousLogGameIdRef.current = damageGameId;
      lastLogIndexRef.current = newIdx;
      return;
    }
    if (newIdx < 0 || newIdx === lastLogIndexRef.current) return;
    lastLogIndexRef.current = newIdx;
    const attack = findAttackMoveSource(gameLog[newIdx], fieldPlayers);
    if (!attack) return;
    const fromId = `table:${attack.attackerInstanceId}`;
    const targetAnchor = `power:${attack.targetPlayerIndex}`;
    if (registry.has(fromId) && registry.has(targetAnchor)) {
      setMoveEvent({
        id: attack.attackerInstanceId,
        fromId,
        toId: targetAnchor,
        image: attack.image,
      });
    }
  }, [damageGameId, fieldPlayers, gameLog, registry]);

  if (authLoading || idLoading || gameLoading || profilesLoading) {
    console.log(`[Render] Showing Loading Game... (auth: ${authLoading}, id: ${idLoading}, game: ${gameLoading}, profiles: ${profilesLoading})`);
    return <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center"><SpinnerEmblem label="Loading game..." /></div>;
  }

  if (error) {
    return <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4"><ErrorRecoveryPanel message={error} onBack={() => navigate('/lobby')} backLabel="Back to Lobby" /></div>;
  }

  if (!gameState) {
    console.warn('[Render] Loading flags false, but game state is null. Error should be displayed.');
    return <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4"><ErrorRecoveryPanel message="Failed to load game state." onBack={() => navigate('/lobby')} backLabel="Back to Lobby" /></div>;
  }

  if (gameState.players.length < 2) {
    console.warn('[Render] Game state loaded, but players array is invalid.', gameState);
    return <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4"><ErrorRecoveryPanel message="Invalid game data received." onBack={() => navigate('/lobby')} backLabel="Back to Lobby" /></div>;
  }

  const player1ProfileId = gameState.players[0]?.id || 'player-1';
  const player2ProfileId = gameState.players[1]?.id || 'player-2';
  const player1Profile = playerProfiles[player1ProfileId] || fallbackProfile(player1ProfileId, 'Player 1');
  const player2Profile = playerProfiles[player2ProfileId] || fallbackProfile(player2ProfileId, 'Player 2');
  const player1Label = getPlayerDisplayName({ name: player1Profile.display_name || player1Profile.username, fallback: 'Player 1' });
  const player2Label = getPlayerDisplayName({ name: player2Profile.display_name || player2Profile.username, fallback: 'Player 2' });
  const playerProfileLabel = viewerPlayerIndex === 0 ? player1Label : player2Label;
  const opponentProfileLabel = viewerOpponentIndex === 0 ? player1Label : player2Label;
  const playerLabelsById: Record<string, string> = {
    [player1ProfileId]: player1Label,
    [player2ProfileId]: player2Label,
  };
  const winnerLabel = gameState.winner ? playerLabelsById[gameState.winner] || getPlayerDisplayName({ id: gameState.winner, fallback: 'Player' }) : null;
  const currentActorId = gameState.players[gameState.currentPlayerIndex]?.id;
  const currentActorLabel = currentActorId ? playerLabelsById[currentActorId] || null : null;
  const topBarPlayer1Profile = !isSpectator && playerIndex === 0 ? { ...player1Profile, username: 'You' } : player1Profile;
  const topBarPlayer2Profile = !isSpectator && playerIndex === 1 ? { ...player2Profile, username: 'You' } : player2Profile;

  const handleMarketClick = (knowledgeId: string) => {
    if (isSpectator) return;
    if (handleDrawKnowledge) {
      // Try to build a move event from market to player's hand area
      const src = gameState?.market.find(k => k.id === knowledgeId);
      const instanceId = src?.instanceId;
      if (instanceId) {
        setTimeout(() => {
          let fromId = `market:${instanceId}`;
          // Prefer the dedicated player-hand anchor at the bottom
          let toId = `hand:player`;
          if (!registry.has(fromId)) fromId = 'market:anchor';
          if (!registry.has(toId)) {
            // Fallback to per-user hand anchor if available
            toId = currentPlayerId ? `hand:${currentPlayerId}` : 'hand:player';
          }
          if (registry.has(fromId) && registry.has(toId)) setMoveEvent({ id: instanceId, fromId, toId, image: src!.image });
        }, 0);
      }
      handleDrawKnowledge(knowledgeId);
    } else {
      console.error("handleDrawKnowledge function not available from useGameActions");
    }
    setSelectedKnowledgeId(null);
  };

  const handleHandClick = (knowledgeId: string) => {
    if (isSpectator) return;
    if (handleHandCardClick) {
      handleHandCardClick(knowledgeId);
      setSelectedKnowledgeId(prev => prev === knowledgeId ? null : knowledgeId);
    } else {
      setSelectedKnowledgeId(prev => prev === knowledgeId ? null : knowledgeId);
      console.log(`[Action] Selected/Deselected hand knowledge (local): ${knowledgeId}`);
    }
  };

  const handleCreatureClick = (creatureId: string) => {
    if (isSpectator) return;
    if (selectedKnowledgeId && handleCreatureClickForSummon) {
      // Build move event from hand:selected to table:creatureId
      const handCard = gameState?.players.find(p => p.id === currentPlayerId)?.hand.find(k => k.instanceId === selectedKnowledgeId);
      if (handCard?.instanceId) {
        const fromId = `hand:${handCard.instanceId}`;
  let toId = `tableSlot:${creatureId}`;
  if (!registry.has(toId)) toId = `table:${creatureId}`;
  if (registry.has(fromId) && registry.has(toId)) setMoveEvent({ id: handCard.instanceId, fromId, toId, image: handCard.image });
      }
      handleCreatureClickForSummon(creatureId);
      setSelectedKnowledgeId(null);
    } else if (!selectedKnowledgeId && handleRotateCreature) {
      handleRotateCreature(creatureId);
    } else {
      console.log("[Action] Cannot perform creature action (conditions not met or handlers missing)");
    }
  };

  const handleRetrySettlement = async () => {
    if (!gameId) return;
    setSettlementRetrying(true);

    try {
      await retryCompetitionSettlement(gameId);
      setSettlementRetry(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Competitive GEM settlement failed.';
      setSettlementRetry({
        sessionId: gameId,
        status: 'failed',
        error: message,
        updatedAt: Date.now(),
      });
    } finally {
      setSettlementRetrying(false);
    }
  };


  console.log('[Render] Rendering main game screen.');
  return (
    <GameShell
      overlays={(
        <>
          <CardMoveLayer event={moveEvent} onDone={() => setMoveEvent(null)} />
          <CombatFloaters event={damageEvent} onDone={clearDamageEvent} />
          <GameAnnouncer
            turn={gameState.turn}
            phase={mapPhaseForTableArea(gameState.phase)}
            isMyTurn={isMyTurn}
            playerName={playerProfileLabel}
            opponentName={opponentProfileLabel}
          />
          {!isSpectator && (
            <PendingEffectPanel
              gameState={gameState}
              currentPlayerId={currentPlayerId}
              onResolve={handleResolvePendingEffect}
            />
          )}
        </>
      )}
      topBar={(
        <TopBar
        player1Profile={topBarPlayer1Profile}
        player2Profile={topBarPlayer2Profile}
        player1Power={gameState.players[0]?.power || 0}
        player2Power={gameState.players[1]?.power || 0}
        turn={gameState.turn}
        phase={gameState.phase}
  currentPlayerId={currentPlayerId || undefined}
  gameState={gameState}
  isSpectator={isSpectator}
      />
      )}
      actionBar={(
        <ActionBar
          isMyTurn={isMyTurn && !gameState.pendingEffect}
          phase={gameState.phase}
          winner={gameState.winner}
          actionsTaken={gameState.actionsTakenThisTurn}
          turnTimer={remainingTime}
          actionsPerTurn={gameState.actionsPerTurn}
          isSpectator={isSpectator}
          winnerLabel={winnerLabel}
          currentActorLabel={currentActorLabel}
          onEndTurnClick={handleEndTurn}
        />
      )}
    >

    <div className="flex min-h-0 flex-col gap-2 xl:h-full">
      {settlementRetry && !isSpectator && (
        <div className="state-relic flex shrink-0 flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <StatusBadge tone="amber">Settlement pending</StatusBadge>
            <p className="mt-2 text-slate-200">
              Competitive GEM settlement was not submitted. Retry from this browser to release escrow funds.
            </p>
            {settlementRetry.error && <p className="mt-1 truncate text-xs text-amber-100/75">{settlementRetry.error}</p>}
          </div>
          <ArenaButton
            type="button"
            variant="secondary"
            size="sm"
            loading={settlementRetrying}
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            onClick={() => void handleRetrySettlement()}
          >
            Retry settlement
          </ArenaButton>
        </div>
      )}

    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(260px,0.92fr)_minmax(540px,2.45fr)_minmax(300px,0.95fr)] xl:overflow-hidden">
        {/* Hands Column - Adjusted width */}
  <div className="order-2 min-h-[280px] xl:order-1 xl:h-full xl:min-h-0" id={`hand-anchor-${currentPlayerId || 'unknown'}`} ref={(el) => { if (el && currentPlayerId) registry.register(`hand:${currentPlayerId}`, el); }}>
          {player && opponent ? (
            <HandsColumn
              currentPlayerHand={player.hand}
              opponentPlayerHand={opponent.hand}
              isMyTurn={isMyTurn && !gameState.pendingEffect}
              phase={mapPhaseForTableArea(gameState.phase)}
              selectedKnowledgeId={selectedKnowledgeId}
              onHandCardClick={handleHandClick}
              isSpectator={isSpectator}
              currentPlayerLabel={isSpectator ? `${playerProfileLabel} Hand` : 'Your Hand'}
              opponentPlayerLabel={isSpectator ? `${opponentProfileLabel} Hand` : 'Opponent'}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

    {/* Table Area - Adjusted width */}
  <div className="order-1 min-h-[360px] sm:min-h-[460px] xl:order-2 xl:h-full xl:min-h-0">
          {player && opponent ? (
            <TableArea
              currentPlayer={player}
              opponentPlayer={opponent}
              isMyTurn={isMyTurn && !gameState.pendingEffect}
              phase={mapPhaseForTableArea(gameState.phase)}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClick}
              onRotateCreature={handleCreatureClick}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

    <GameAuxPanels
      marketCards={gameState.market}
      deckCount={gameState.knowledgeDeck.length}
      isMyTurn={isMyTurn && !gameState.pendingEffect}
      phase={mapPhaseForTableArea(gameState.phase)}
      logs={gameState.log}
      playerLabels={playerLabelsById}
      onDrawKnowledge={handleMarketClick}
    />
      </div>
      </div>
    </GameShell>
  );
};

export default GameScreen;
