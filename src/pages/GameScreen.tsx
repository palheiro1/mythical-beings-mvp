import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification.js';
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

interface ProfileInfo {
  username: string | null;
  avatar_url: string | null;
}

const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [currentPlayerId, , , , idLoading] = usePlayerIdentification();
  const [error, setError] = useState<string | null>(null);

  const [gameState, dispatch, gameLoading, gameId] = useGameInitialization(currentPlayerId, setError);

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

  // --- Turn Timer --- 
  const TURN_DURATION_SECONDS = 30;
  const remainingTime = useTurnTimer({
    isMyTurn,
    phase: gameState?.phase ?? null,
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

  const playerIndex = gameState.players[0].id === currentPlayerId ? 0 : (gameState.players[1].id === currentPlayerId ? 1 : -1);
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  const player: PlayerState | undefined = playerIndex !== -1 ? gameState.players[playerIndex] : undefined;
  const opponent: PlayerState | undefined = gameState.players[opponentIndex];

  const playerProfileId = player?.id || '';
  const opponentProfileId = opponent?.id || '';
  const playerProfile = playerProfiles[playerProfileId] || { username: `Player ${playerIndex !== -1 ? playerIndex + 1 : '?'}`, avatar_url: null };
  const opponentProfile = playerProfiles[opponentProfileId] || { username: `Player ${opponentIndex + 1}`, avatar_url: null };

  const handleMarketClick = (knowledgeId: string) => {
    if (handleDrawKnowledge) {
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white overflow-hidden">
      <TopBar
        player1Profile={playerIndex === 0 ? playerProfile : opponentProfile}
        player2Profile={playerIndex === 1 ? playerProfile : opponentProfile}
        player1Mana={gameState.players[0]?.power || 0}
        player2Mana={gameState.players[1]?.power || 0}
        turn={gameState.turn}
        phase={gameState.phase}
        onLobbyReturn={() => navigate('/lobby')}
      />

      {/* Main Content Area - Now 4 columns */}
      <div className="flex-grow flex flex-row overflow-hidden p-2 gap-2">
        {/* Hands Column - Adjusted width */}
        <div className="w-1/6 h-full">
          {player && opponent ? (
            <HandsColumn
              currentPlayerHand={player.hand}
              opponentPlayerHand={opponent.hand}
              isMyTurn={isMyTurn}
              phase={gameState.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onHandCardClick={handleHandClick}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

        {/* Table Area - Adjusted width */}
        <div className="w-3/6 h-full"> {/* Adjusted from 3/5 */}
          {player && opponent ? (
            <TableArea
              currentPlayer={player}
              opponentPlayer={opponent}
              isMyTurn={isMyTurn}
              phase={gameState.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClick}
              onRotateCreature={handleCreatureClick}
            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>
          )}
        </div>

        {/* Market Column - Adjusted width */}
        <div className="w-1/6 h-full"> {/* Adjusted from 1/5 */}
          <MarketColumn
            marketCards={gameState.market}
            deckCount={gameState.knowledgeDeck.length}
            isMyTurn={isMyTurn}
            phase={gameState.phase}
            onDrawKnowledge={handleMarketClick}
          />
        </div>

        {/* Logs Column - New dedicated column */}
        <div className="w-1/6 h-full"> {/* New column for logs */}
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
