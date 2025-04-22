import React, { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { useGameActions } from '../hooks/useGameActions';
import { GameState, PlayerState } from '../game/types';
import { gameReducer } from '../game/state';
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

const defaultGameState: GameState = {
    gameId: '',
    players: [
        { id: 'p1_placeholder', power: 0, creatures: [], hand: [], field: [], selectedCreatures: [] },
        { id: 'p2_placeholder', power: 0, creatures: [], hand: [], field: [], selectedCreatures: [] }
    ],
    knowledgeDeck: [],
    market: [],
    discardPile: [],
    currentPlayerIndex: 0,
    turn: 0,
    phase: 'knowledge',
    actionsTakenThisTurn: 0,
    actionsPerTurn: 3,
    winner: null,
    log: [],
};

const GameScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [currentPlayerId, , , , idLoading] = usePlayerIdentification();
  const [localState, dispatch] = useReducer(gameReducer, defaultGameState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerProfiles, setPlayerProfiles] = useState<{ [key: string]: ProfileInfo }>({});
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  useGameInitialization(gameId || null, setError);

  const { 
      handleRotateCreature,
      handleDrawKnowledge,
      handleHandCardClick, 
      handleCreatureClickForSummon,
      handleEndTurn,
  } = useGameActions(localState, gameId || null, dispatch, currentPlayerId || null, selectedKnowledgeId);

  useEffect(() => {
    const fetchProfiles = async (playerIds: [string, string]) => {
        console.log('[GameScreen] Starting profile fetch for:', playerIds);
        const fetchedProfiles: { [key: string]: ProfileInfo } = {};
        try {
            await Promise.all(playerIds.map(async (playerId) => {
                if (!playerId) return; // Should not happen if check below is correct
                const profile = await getProfile(playerId);
                fetchedProfiles[playerId] = {
                    username: profile?.username || `Player (${playerId.substring(0, 6)})`,
                    avatar_url: profile?.avatar_url || null,
                };
            }));
            setPlayerProfiles(fetchedProfiles);
            console.log('[GameScreen] Fetched player profiles:', fetchedProfiles);
            setLoading(false); // Set loading false *after* successful fetch
        } catch (profileError) {
            console.error("Error fetching player profiles:", profileError);
            // Set default profiles even on error
            playerIds.forEach(playerId => {
                 if (playerId && !fetchedProfiles[playerId]) {
                     fetchedProfiles[playerId] = { username: `Player (${playerId.substring(0, 6)})`, avatar_url: null };
                 }
            });
            setPlayerProfiles(fetchedProfiles);
            setError('Failed to load player profiles.');
            setLoading(false); // Set loading false *after* fetch error
        }
    };

    // Check if player data is valid and not placeholders
    const p1Id = localState.players?.[0]?.id;
    const p2Id = localState.players?.[1]?.id;
    const arePlayersValid = p1Id && p2Id && p1Id !== 'p1_placeholder' && p2Id !== 'p2_placeholder';

    if (arePlayersValid) {
        // Only fetch if profiles haven't been fetched yet for these players
        // (Simple check: assume if p1 profile exists, both were fetched)
        if (!playerProfiles[p1Id]) {
             console.log('[GameScreen] Player IDs are valid, initiating profile fetch.');
             // Ensure loading is true if it wasn't already (e.g., if initial state load was fast)
             if (!loading) setLoading(true);
             fetchProfiles([p1Id, p2Id]);
        } else {
             // Profiles already fetched, ensure loading is false if it wasn't already
             if (loading) {
                 console.log('[GameScreen] Profiles already fetched, ensuring loading is false.');
                 setLoading(false);
             }
        }
    } else {
        // Players are not valid yet, ensure loading is true
        if (!loading) {
             console.log('[GameScreen] Player IDs not valid yet, ensuring loading is true.');
             setLoading(true);
        }
    }
    // Only depend on player IDs changing
  }, [localState.players]);

  useEffect(() => {
    console.log('[GameScreen] State/PlayerID update:', { phase: localState.phase, currentPlayerIndex: localState.currentPlayerIndex, currentPlayerId, p1: localState.players[0]?.id, p2: localState.players[1]?.id });
    if (!currentPlayerId || localState.players.length < 2 || localState.players[0].id === 'p1_placeholder') {
        setIsMyTurn(false);
        console.log('[GameScreen] Setting as spectator/waiting (no user ID or game not fully initialized)');
        return;
    }

    const playerIndex = localState.players[0].id === currentPlayerId ? 0 : (localState.players[1].id === currentPlayerId ? 1 : -1);

    if (playerIndex === -1) {
        setIsMyTurn(false);
        console.log('[GameScreen] Setting as spectator (user ID not in game)');
    } else {
        const turnCheck = localState.currentPlayerIndex === playerIndex && localState.winner === null;
        setIsMyTurn(turnCheck);
        console.log(`[GameScreen] Setting as Player ${playerIndex + 1}. Is my turn: ${turnCheck}`);
    }

    if (selectedKnowledgeId) {
        setSelectedKnowledgeId(null);
    }

    if (isMyTurn && localState.phase === 'action' && localState.actionsTakenThisTurn >= localState.actionsPerTurn && handleEndTurn) {
        console.log('[GameScreen] Actions depleted, automatically ending turn.');
        handleEndTurn();
    }
  }, [localState.currentPlayerIndex, localState.phase, localState.winner, localState.actionsTakenThisTurn, localState.actionsPerTurn, currentPlayerId, localState.players, handleEndTurn, selectedKnowledgeId]);

  if (authLoading || idLoading || loading) {
    console.log('[Render] Showing Loading Game...');
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading Game...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: {error} <button onClick={() => navigate('/lobby')} className="ml-2 underline">Back to Lobby</button></div>;
  }

  if (localState.players.length < 2 || localState.players[0].id === 'p1_placeholder') {
     return <div className="flex justify-center items-center h-screen bg-gray-900 text-gray-400">Initializing game state...</div>;
  }

  const playerIndex = localState.players[0].id === currentPlayerId ? 0 : (localState.players[1].id === currentPlayerId ? 1 : -1);
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  const player: PlayerState | undefined = playerIndex !== -1 ? localState.players[playerIndex] : undefined;
  const opponent: PlayerState | undefined = localState.players.length > opponentIndex ? localState.players[opponentIndex] : undefined;

  const playerProfile = playerProfiles[localState.players[playerIndex !== -1 ? playerIndex : 0]?.id || ''] || { username: `Player ${playerIndex !== -1 ? playerIndex + 1 : '?'}`, avatar_url: null };
  const opponentProfile = playerProfiles[localState.players[opponentIndex]?.id || ''] || { username: `Player ${opponentIndex + 1}`, avatar_url: null };

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
        player1Mana={localState.players[0]?.power || 0}
        player2Mana={localState.players[1]?.power || 0}
        turn={localState.turn}
        phase={localState.phase}
        onLobbyReturn={() => navigate('/lobby')}
      />

      <div className="flex-grow flex flex-row overflow-hidden p-2 gap-2">
        <div className="w-1/5 h-full">
          {player && opponent && (
            <HandsColumn
              currentPlayerHand={player.hand}
              opponentPlayerHand={opponent.hand}
              isMyTurn={isMyTurn}
              phase={localState.phase}
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
              phase={localState.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClick} 
              onRotateCreature={handleCreatureClick}
            />
          )}
          {(!player || !opponent) && <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for players...</div>}
        </div>

        <div className="w-1/5 h-full">
           <MarketColumn
             marketCards={localState.market}
             deckCount={localState.knowledgeDeck.length}
             isMyTurn={isMyTurn}
             phase={localState.phase}
             onDrawKnowledge={handleMarketClick}
           />
        </div>
      </div>

      <ActionBar
        isMyTurn={isMyTurn}
        phase={localState.phase}
        winner={localState.winner}
        actionsTaken={localState.actionsTakenThisTurn}
        onEndTurn={isMyTurn ? handleEndTurn : undefined}
        turnTimer={90}
        actionsPerTurn={localState.actionsPerTurn}
        isSpectator={playerIndex === -1}
      />
    </div>
  );
};

export default GameScreen;
