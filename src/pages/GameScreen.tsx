import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { useGameActions } from '../hooks/useGameActions';
import { GameState, PlayerState } from '../game/types';
import TopBar from '../components/game/TopBar';
import ActionBar from '../components/game/ActionBar';
import TableArea from '../components/game/TableArea';
import HandsColumn from '../components/game/HandsColumn';
import MarketColumn from '../components/game/MarketColumn';
import { getProfile } from '../utils/supabase';

interface ProfileInfo {
    username: string | null;
    avatar_url: string | null;
}

const initialLoadingState: GameState = {
    gameId: '',
    players: [],
    knowledgeDeck: [],
    market: [],
    discardPile: [],
    currentPlayerIndex: 0,
    turn: 0,
    phase: 'loading',
    actionsTakenThisTurn: 0,
    actionsPerTurn: 3,
    winner: null,
    log: [],
};

const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [currentPlayerId, , , , idLoading] = usePlayerIdentification();
  const [error, setError] = useState<string | null>(null);

  const [gameState, dispatch, gameLoading, gameId] = useGameInitialization(currentPlayerId, setError);

  const currentGameState = gameState ?? initialLoadingState;

  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerProfiles, setPlayerProfiles] = useState<{ [key: string]: ProfileInfo }>({});
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  const { 
      handleRotateCreature,
      handleDrawKnowledge,
      handleHandCardClick, 
      handleCreatureClickForSummon,
      handleEndTurn,
  } = useGameActions(currentGameState, gameId || null, dispatch, currentPlayerId || null, selectedKnowledgeId);

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
            setError('Failed to load player profiles.');
        } finally {
            setProfilesLoading(false);
        }
    };

    const p1Id = currentGameState.players?.[0]?.id;
    const p2Id = currentGameState.players?.[1]?.id;
    const arePlayersValid = p1Id && p2Id;

    if (!gameLoading && arePlayersValid) {
        if (!playerProfiles[p1Id]) {
             console.log('[GameScreen] Game loaded and players valid, initiating profile fetch.');
             fetchProfiles([p1Id, p2Id]);
        } else {
             if (profilesLoading) {
                 console.log('[GameScreen] Profiles already fetched, ensuring profilesLoading is false.');
                 setProfilesLoading(false);
             }
        }
    } else if (!gameLoading && !arePlayersValid) {
        console.warn('[GameScreen] Game loaded but player IDs are invalid.');
        setError('Game state has invalid player data.');
        setProfilesLoading(false);
    } else {
        if (!profilesLoading) setProfilesLoading(true);
    }
  }, [gameLoading, currentGameState.players, playerProfiles]);

  useEffect(() => {
    console.log('[GameScreen] State/PlayerID update check:', { phase: currentGameState.phase, currentPlayerIndex: currentGameState.currentPlayerIndex, currentPlayerId, p1: currentGameState.players[0]?.id, p2: currentGameState.players[1]?.id });
    if (!currentPlayerId || currentGameState.players.length < 2) {
        setIsMyTurn(false);
        console.log('[GameScreen] Setting as spectator/waiting (no user ID or game not fully initialized)');
        return;
    }

    const playerIndex = currentGameState.players[0].id === currentPlayerId ? 0 : (currentGameState.players[1].id === currentPlayerId ? 1 : -1);

    if (playerIndex === -1) {
        setIsMyTurn(false);
        console.log('[GameScreen] Setting as spectator (user ID not in game)');
    } else {
        const turnCheck = currentGameState.currentPlayerIndex === playerIndex && currentGameState.winner === null;
        setIsMyTurn(turnCheck);
        console.log(`[GameScreen] Setting as Player ${playerIndex + 1}. Is my turn: ${turnCheck}`);
    }

    if (isMyTurn && currentGameState.phase === 'action' && currentGameState.actionsTakenThisTurn >= currentGameState.actionsPerTurn && handleEndTurn) {
        console.log('[GameScreen] Actions depleted, automatically ending turn.');
        handleEndTurn();
    }
  }, [currentGameState.currentPlayerIndex, currentGameState.phase, currentGameState.winner, currentGameState.actionsTakenThisTurn, currentGameState.actionsPerTurn, currentPlayerId, currentGameState.players, handleEndTurn, isMyTurn]);

  if (authLoading || idLoading || gameLoading || profilesLoading) {
    console.log(`[Render] Showing Loading Game... (auth: ${authLoading}, id: ${idLoading}, game: ${gameLoading}, profiles: ${profilesLoading})`);
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading Game...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: {error} <button onClick={() => navigate('/lobby')} className="ml-2 underline">Back to Lobby</button></div>;
  }

  if (!gameState || gameState.players.length < 2) {
     console.warn('[Render] Loading flags false, but game state still invalid.', gameState);
     return <div className="flex justify-center items-center h-screen bg-gray-900 text-gray-400">Initializing game state... (Waiting for data)</div>;
  }

  const playerIndex = currentGameState.players[0].id === currentPlayerId ? 0 : (currentGameState.players[1].id === currentPlayerId ? 1 : -1);
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  const player: PlayerState | undefined = playerIndex !== -1 ? currentGameState.players[playerIndex] : undefined;
  const opponent: PlayerState | undefined = currentGameState.players.length > opponentIndex ? currentGameState.players[opponentIndex] : undefined;

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
        player1Mana={currentGameState.players[0]?.power || 0}
        player2Mana={currentGameState.players[1]?.power || 0}
        turn={currentGameState.turn}
        phase={currentGameState.phase}
        onLobbyReturn={() => navigate('/lobby')}
      />

      <div className="flex-grow flex flex-row overflow-hidden p-2 gap-2">
        <div className="w-1/5 h-full">
          {player && opponent && (
            <HandsColumn
              currentPlayerHand={player.hand}
              opponentPlayerHand={opponent.hand}
              isMyTurn={isMyTurn}
              phase={currentGameState.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onHandCardClick={handleHandClick}
            />
          )}
           {(!player || !opponent) && <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for players...</div>}
        </div>

        <div className="w-3/5 h-full">
          {player && opponent && (
            <TableArea
              currentPlayer={player}
              opponentPlayer={opponent}
              isMyTurn={isMyTurn}
              phase={currentGameState.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClick} 
              onRotateCreature={handleCreatureClick}
            />
          )}
          {(!player || !opponent) && <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for players...</div>}
        </div>

        <div className="w-1/5 h-full">
           <MarketColumn
             marketCards={currentGameState.market}
             deckCount={currentGameState.knowledgeDeck.length}
             isMyTurn={isMyTurn}
             phase={currentGameState.phase}
             onDrawKnowledge={handleMarketClick}
           />
        </div>
      </div>

      <ActionBar
        isMyTurn={isMyTurn}
        phase={currentGameState.phase}
        winner={currentGameState.winner}
        actionsTaken={currentGameState.actionsTakenThisTurn}
        onEndTurn={isMyTurn ? handleEndTurn : undefined}
        turnTimer={90}
        actionsPerTurn={currentGameState.actionsPerTurn}
        isSpectator={playerIndex === -1}
      />
    </div>
  );
};

export default GameScreen;
