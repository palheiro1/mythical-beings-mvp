import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useGameInitialization } from '../hooks/useGameInitialization.js';
import { useGameActions } from '../hooks/useGameActions.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js'; // Import the timer hook
import { PlayerState } from '../game/types.js';
import TopBar from '../components/game/TopBar.js';
import ActionBar from '../components/game/ActionBar.js';
import TableArea from '../components/game/TableArea.js';
import HandsColumn from '../components/game/HandsColumn.js';
import MarketColumn from '../components/game/MarketColumn.js';
import Logs from '../components/game/Logs.js'; // Import the Logs component
import { getProfile } from '../utils/supabase.js';
import GameAnnouncer from '../components/game/GameAnnouncer.js';
import CardMoveLayer from '../components/game/CardMoveLayer.js';
import CombatFloaters from '../components/game/CombatFloaters.js';
import { useCardRegistry } from '../context/CardRegistry.js';

interface ProfileInfo {
  username: string | null;
  avatar_url: string | null;
}

const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentPlayerId = user?.id;
  const idLoading = authLoading;
  const [error, setError] = useState<string | null>(null);

  const [gameState, dispatch, gameLoading, gameId] = useGameInitialization(currentPlayerId || null, setError);

  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerProfiles, setPlayerProfiles] = useState<{ [key: string]: ProfileInfo }>({});
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  const {
    handleRotateCreature,
    handleDrawKnowledge,
    handleHandCardClick,
    handleCreatureClickForSummon,
    handleEndTurn, // Get handleEndTurn from useGameActions
  } = useGameActions(gameState, gameId || null, dispatch, currentPlayerId || null, selectedKnowledgeId);

  // Animation overlay state
  const [moveEvent, setMoveEvent] = useState<import('../types/vfx.js').MoveEvent | null>(null);
  const [damageEvent, setDamageEvent] = useState<{ x: number; y: number; damage?: number; blocked?: number; crit?: boolean; bypass?: boolean } | null>(null);
  const registry = useCardRegistry();
  const prevPowersRef = React.useRef<{ p0: number; p1: number } | null>(null);
  const prevFieldRef = React.useRef<{ my: string[]; opp: string[]; idToCard: Record<string, { image: string }> } | null>(null);

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
    isMyTurn,
    phase: mapPhaseForTimer(gameState?.phase),
    turnDurationSeconds: TURN_DURATION_SECONDS,
    onTimerEnd: handleEndTurn, // Call handleEndTurn when timer ends
    gameTurn: gameState?.turn ?? 0,
    currentPlayerIndex: gameState?.currentPlayerIndex ?? null,
  });
  // --- End Turn Timer ---

  useEffect(() => {
    const fetchProfiles = async (playerIds: [string, string]) => {
      console.log('[GameScreen] Starting profile fetch for:', playerIds);
      setProfilesLoading(true);
      const fetchedProfiles: { [key: string]: ProfileInfo } = {};
      try {
        await Promise.all(playerIds.map(async (playerId) => {
          if (!playerId) return;
          const profile = await getProfile(playerId);
          fetchedProfiles[playerId] = {
            username: profile?.username || `Player (${playerId.substring(0, 6)})`,
            avatar_url: profile?.avatar_url || null,
          };
        }));
        setPlayerProfiles(fetchedProfiles);
        console.log('[GameScreen] Fetched player profiles:', fetchedProfiles);
      } catch (profileError) {
        console.error("Error fetching player profiles:", profileError);
        playerIds.forEach(playerId => {
          if (playerId && !fetchedProfiles[playerId]) {
            fetchedProfiles[playerId] = { username: `Player (${playerId.substring(0, 6)})`, avatar_url: null };
          }
        });
        setPlayerProfiles(fetchedProfiles);
      } finally {
        setProfilesLoading(false);
      }
    };

    const p1Id = gameState?.players?.[0]?.id;
    const p2Id = gameState?.players?.[1]?.id;
    const arePlayersValid = p1Id && p2Id;

    if (!gameLoading && gameState && arePlayersValid) {
      if (!playerProfiles[p1Id] || !playerProfiles[p2Id]) {
        console.log('[GameScreen] Game loaded and players valid, initiating profile fetch.');
        fetchProfiles([p1Id, p2Id]);
      } else {
        if (profilesLoading) {
          console.log('[GameScreen] Profiles already fetched, ensuring profilesLoading is false.');
          setProfilesLoading(false);
        }
      }
    } else if (!gameLoading && gameState && !arePlayersValid) {
      console.warn('[GameScreen] Game loaded but player IDs in state are invalid.');
      setProfilesLoading(false);
    } else if (!gameLoading && !gameState) {
      console.warn('[GameScreen] Game sync finished, but gameState is null.');
      setProfilesLoading(false);
    } else if (gameLoading && !profilesLoading) {
      setProfilesLoading(true);
    }
  }, [gameLoading, gameState, playerProfiles]);

  useEffect(() => {
    console.log('[GameScreen] State/PlayerID update check:', { phase: gameState?.phase, currentPlayerIndex: gameState?.currentPlayerIndex, currentPlayerId, p1: gameState?.players?.[0]?.id, p2: gameState?.players?.[1]?.id });
    if (!currentPlayerId || !gameState || gameState.players.length < 2) {
      setIsMyTurn(false);
      console.log('[GameScreen] Setting as spectator/waiting (no user ID or game not fully initialized/loaded)');
      return;
    }

    const playerIndex = gameState.players[0].id === currentPlayerId ? 0 : (gameState.players[1].id === currentPlayerId ? 1 : -1);

    if (playerIndex === -1) {
      setIsMyTurn(false);
      console.log('[GameScreen] Setting as spectator (user ID not in game)');
    } else {
      const turnCheck = gameState.currentPlayerIndex === playerIndex && gameState.winner === null;
      setIsMyTurn(turnCheck);
      console.log(`[GameScreen] Setting as Player ${playerIndex + 1}. Is my turn: ${turnCheck}`);
    }
  }, [gameState?.currentPlayerIndex, gameState?.phase, gameState?.winner, gameState?.actionsTakenThisTurn, gameState?.actionsPerTurn, currentPlayerId, gameState?.players, isMyTurn]);

  // Compute player/opponent indices and objects early so all hooks can safely run before any early returns
  const playerIndex = gameState?.players?.[0]?.id === currentPlayerId ? 0 : (gameState?.players?.[1]?.id === currentPlayerId ? 1 : -1);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const player: PlayerState | undefined = playerIndex !== -1 && gameState ? gameState.players[playerIndex] : undefined;
  const opponent: PlayerState | undefined = gameState ? gameState.players[opponentIndex] : undefined;

  // Helper: parse defense info from latest logs for a target player
  const parseDefenseFromLogs = (targetId: string): { blocked?: number; bypass?: boolean } => {
    const logs = gameState?.log || [];
    for (let i = logs.length - 1; i >= Math.max(0, logs.length - 10); i--) {
      const line = logs[i];
      if (!line) continue;
      if (line.includes('deals') && line.includes(targetId)) {
        const defMatch = line.match(/Defense:\s*(\d+)/i);
        const bypass = /bypass(ed)?/i.test(line);
        const blocked = defMatch ? parseInt(defMatch[1], 10) : undefined;
        return { blocked, bypass };
      }
    }
    return {};
  };

  // Damage floater: watch power changes (must run every render to keep hook order stable)
  useEffect(() => {
    if (!gameState) return;
    const p0 = gameState.players[0]?.power ?? 0;
    const p1 = gameState.players[1]?.power ?? 0;
    const prev = prevPowersRef.current;
    if (prev) {
      const deltas: Array<{ idx: 0 | 1; delta: number }> = [];
      if (p0 < prev.p0) deltas.push({ idx: 0, delta: prev.p0 - p0 });
      if (p1 < prev.p1) deltas.push({ idx: 1, delta: prev.p1 - p1 });
      if (deltas.length > 0) {
        const first = deltas[0];
        const rect = registry.getRect(`power:${first.idx}`);
        if (rect) {
          const targetId = gameState.players[first.idx]?.id || '';
          const { blocked, bypass } = parseDefenseFromLogs(targetId);
          setDamageEvent({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, damage: first.delta, blocked, bypass });
        }
      }
    }
    prevPowersRef.current = { p0, p1 };
  }, [gameState?.players?.[0]?.power, gameState?.players?.[1]?.power]);

  // Discard animation: detect knowledge leaving field (must run every render to keep hook order stable)
  useEffect(() => {
    if (!gameState) return;
    const me = playerIndex !== -1 ? gameState.players[playerIndex] : null;
    const opp = opponent;
    const currentMy = me ? me.field.map(s => s.knowledge?.instanceId).filter(Boolean) as string[] : [];
    const currentOpp = opp ? opp.field.map(s => s.knowledge?.instanceId).filter(Boolean) as string[] : [];

    const idToCard: Record<string, { image: string }> = {};
    gameState.players.forEach(pl => pl.field.forEach(s => { if (s.knowledge?.instanceId) idToCard[s.knowledge.instanceId] = { image: s.knowledge.image }; }));

    const prev = prevFieldRef.current;
    if (prev) {
      const removed: string[] = [];
      prev.my.forEach(id => { if (!currentMy.includes(id)) removed.push(id); });
      prev.opp.forEach(id => { if (!currentOpp.includes(id)) removed.push(id); });
      if (removed.length > 0) {
        const id = removed[0];
        const fromId = `table:${id}`;
        const toId = `discard:anchor`;
        if (registry.has(fromId) && registry.has(toId)) {
          const image = prev.idToCard[id]?.image || idToCard[id]?.image || '/images/spells/back.jpg';
          setMoveEvent({ id, fromId, toId, image });
        }
      }
    }

    prevFieldRef.current = { my: currentMy, opp: currentOpp, idToCard };
  }, [gameState?.players]);

  // Knowledge-phase damage floater: react to new log lines mentioning deals <n> damage
  const lastLogIndexRef = React.useRef<number>(-1);
  useEffect(() => {
    if (!gameState) return;
    const logs = gameState.log || [];
    const lastSeen = lastLogIndexRef.current;
    if (logs.length === 0 || logs.length - 1 === lastSeen) return;
    const newIdx = logs.length - 1;
    lastLogIndexRef.current = newIdx;
    const line = logs[newIdx];
    if (!line) return;
    // Try to extract target player id and damage number
    const dmgMatch = line.match(/deals\s+(\d+)\s+damage\s+to\s+([0-9a-f\-]{36})/i);
    if (dmgMatch) {
      const amount = parseInt(dmgMatch[1], 10);
      const targetId = dmgMatch[2];
      // choose the power anchor based on which player id matches
      const idx: 0 | 1 | null = gameState.players[0]?.id === targetId ? 0 : (gameState.players[1]?.id === targetId ? 1 : null);
      if (idx !== null) {
        const rect = registry.getRect(`power:${idx}`);
        if (rect) {
          setDamageEvent({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, damage: amount });
        } else {
          // Fallback to screen center if anchors are missing
          setDamageEvent({ x: window.innerWidth / 2, y: 80, damage: amount });
        }
        // Attempt a quick attack motion from a random player table slot towards the damaged power anchor
        const sourceSlots = idx === 0 ? gameState.players[1].field : gameState.players[0].field; // attacker likely opposite of target
        const src = sourceSlots.find(s => s.knowledge?.instanceId);
        const attackerId = src?.knowledge?.instanceId;
        const targetAnchor = `power:${idx}`;
        if (attackerId && registry.has(`table:${attackerId}`) && registry.has(targetAnchor)) {
          const image = src!.knowledge!.image;
          setMoveEvent({ id: attackerId, fromId: `table:${attackerId}`, toId: targetAnchor, image });
        }
      }
    }
  }, [gameState?.log]);

  if (authLoading || idLoading || gameLoading || profilesLoading) {
    console.log(`[Render] Showing Loading Game... (auth: ${authLoading}, id: ${idLoading}, game: ${gameLoading}, profiles: ${profilesLoading})`);
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading Game...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: {error} <button onClick={() => navigate('/lobby')} className="ml-2 underline">Back to Lobby</button></div>;
  }

  if (!gameState) {
    console.warn('[Render] Loading flags false, but game state is null. Error should be displayed.');
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: Failed to load game state. <button onClick={() => navigate('/lobby')} className="ml-2 underline">Back to Lobby</button></div>;
  }

  if (gameState.players.length < 2) {
    console.warn('[Render] Game state loaded, but players array is invalid.', gameState);
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-gray-400">Error: Invalid game data received. <button onClick={() => navigate('/lobby')} className="ml-2 underline">Back to Lobby</button></div>;
  }

  const playerProfileId = player?.id || '';
  const opponentProfileId = opponent?.id || '';
  const playerProfile = playerProfiles[playerProfileId] || { username: `Player ${playerIndex !== -1 ? playerIndex + 1 : '?'}`, avatar_url: null };
  const opponentProfile = playerProfiles[opponentProfileId] || { username: `Player ${opponentIndex + 1}`, avatar_url: null };

  const handleMarketClick = (knowledgeId: string) => {
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
    if (handleHandCardClick) {
      handleHandCardClick(knowledgeId);
      setSelectedKnowledgeId(prev => prev === knowledgeId ? null : knowledgeId);
    } else {
      setSelectedKnowledgeId(prev => prev === knowledgeId ? null : knowledgeId);
      console.log(`[Action] Selected/Deselected hand knowledge (local): ${knowledgeId}`);
    }
  };

  const handleCreatureClick = (creatureId: string) => {
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


  console.log('[Render] Rendering main game screen.');
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white overflow-hidden">
  {/* Overlay layers for animations */}
  <CardMoveLayer event={moveEvent} onDone={() => setMoveEvent(null)} />
  <CombatFloaters event={damageEvent ? { key: Math.random().toString(36).slice(2), x: damageEvent.x, y: damageEvent.y, damage: damageEvent.damage, blocked: damageEvent.blocked, bypass: damageEvent.bypass } : null} onDone={() => setDamageEvent(null)} />
      {/* Announcer overlay */}
      <GameAnnouncer
        turn={gameState.turn}
        phase={mapPhaseForTableArea(gameState.phase)}
        isMyTurn={isMyTurn}
        playerName={playerProfile.username || undefined}
        opponentName={opponentProfile.username || undefined}
      />
  <TopBar
        player1Profile={playerIndex === 0 ? { ...playerProfile, username: 'You' } : opponentProfile}
        player2Profile={playerIndex === 1 ? { ...playerProfile, username: 'You' } : opponentProfile}
        player1Mana={gameState.players[0]?.power || 0}
        player2Mana={gameState.players[1]?.power || 0}
        turn={gameState.turn}
        phase={gameState.phase}
  currentPlayerId={currentPlayerId || undefined}
  gameState={gameState}
      />

    {/* Main Content Area - Now 4 columns */}
    <div className="flex-grow min-h-0 flex flex-row overflow-hidden p-2 gap-2">
        {/* Hands Column - Adjusted width */}
  <div className="w-1/6 h-full min-h-0" id={`hand-anchor-${currentPlayerId || 'unknown'}`} ref={(el) => { if (el && currentPlayerId) registry.register(`hand:${currentPlayerId}`, el); }}>
          {player && opponent ? (
            <HandsColumn
              currentPlayerHand={player.hand}
              opponentPlayerHand={opponent.hand}
              isMyTurn={isMyTurn}
              phase={mapPhaseForTableArea(gameState.phase)}
              selectedKnowledgeId={selectedKnowledgeId}
              onHandCardClick={handleHandClick}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

    {/* Table Area - Adjusted width */}
  <div className="w-3/6 h-full min-h-0"> {/* Adjusted from 3/5 */}
          {player && opponent ? (
            <TableArea
              currentPlayer={player}
              opponentPlayer={opponent}
              isMyTurn={isMyTurn}
              phase={mapPhaseForTableArea(gameState.phase)}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClick}
              onRotateCreature={handleCreatureClick}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

    {/* Market Column - Adjusted width */}
  <div className="w-1/6 h-full min-h-0" ref={(el) => { if (el) registry.register('market:anchor', el); }}> {/* Adjusted from 1/5 */}
          <MarketColumn
            marketCards={gameState.market}
            deckCount={gameState.knowledgeDeck.length}
            isMyTurn={isMyTurn}
            phase={mapPhaseForTableArea(gameState.phase)}
            onDrawKnowledge={handleMarketClick}
          />
        </div>

    {/* Logs Column - New dedicated column */}
  <div className="w-1/6 h-full min-h-0" ref={(el) => { if (el) registry.register('discard:anchor', el); }}> {/* New column for logs and discard anchor */}
     <Logs logs={gameState.log} />
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar
        isMyTurn={isMyTurn}
        phase={gameState.phase}
        winner={gameState.winner}
        actionsTaken={gameState.actionsTakenThisTurn}
        turnTimer={remainingTime} // Pass remainingTime to ActionBar
        actionsPerTurn={gameState.actionsPerTurn}
        isSpectator={playerIndex === -1}
        onEndTurnClick={handleEndTurn} // Pass handleEndTurn for the button
      />
    </div>
  );
};

export default GameScreen;
