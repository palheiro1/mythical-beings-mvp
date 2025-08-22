import React, { useRef, useEffect } from 'react';
import { GameState } from '../../game/types.js';
import { updateGameState, recordGameOutcomeAndUpdateStats } from '../../utils/supabase.js';
import { useCardRegistry } from '../../context/CardRegistry.js';

// Define ProfileInfo type again or import
interface ProfileInfo {
    username: string | null;
    avatar_url: string | null;
}

interface TopBarProps {
  player1Profile: ProfileInfo;
  player2Profile: ProfileInfo;
  player1Mana: number;
  player2Mana: number;
  turn: number;
  phase: string;
  onLobbyReturn?: () => void; // Deprecated
  // New props to enable resign action
  currentPlayerId?: string;
  gameState?: GameState;
}

const TopBar: React.FC<TopBarProps> = ({
  player1Profile,
  player2Profile,
  player1Mana,
  player2Mana,
  turn,
  phase,
  currentPlayerId,
  gameState
}) => {
  const registry = useCardRegistry();
  const p1Ref = useRef<HTMLSpanElement | null>(null);
  const p2Ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (p1Ref.current) registry.register('power:0', p1Ref.current);
    if (p2Ref.current) registry.register('power:1', p2Ref.current);
    return () => {
      registry.register('power:0', null as unknown as HTMLElement | null);
      registry.register('power:1', null as unknown as HTMLElement | null);
    };
  }, [registry]);

  const handleResign = async () => {
    try {
      if (!gameState || !currentPlayerId) return;
      const p1 = gameState.players[0]?.id;
      const p2 = gameState.players[1]?.id;
      if (!p1 || !p2) return;
      const winner = currentPlayerId === p1 ? p2 : p1;
      const next: GameState = { ...gameState, winner, phase: 'end', log: [...gameState.log, `[Game] ${currentPlayerId} resigns. ${winner} wins!`] };
      await updateGameState(gameState.gameId, next);
      await recordGameOutcomeAndUpdateStats(gameState.gameId, winner, p1, p2);
    } catch (e) {
      console.error('[TopBar] Resign failed', e);
    }
  };

  return (
    <div className="relative z-20 h-16 px-4 py-2 bg-gradient-to-r from-gray-950/95 via-gray-900/90 to-gray-950/95 backdrop-blur-xl text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.7)] border-b border-white/10 flex items-center">
      {/* Left: Player 1 */}
      <div className="flex items-center gap-3 min-w-0">
        {player1Profile.avatar_url ? (
          <img
            src={player1Profile.avatar_url}
            alt=""
            width={36}
            height={36}
            className="rounded-full object-cover ring-2 ring-white/10 shadow"
          />
        ) : null}
        <div className="flex flex-col min-w-0">
          <span className="text-xs uppercase tracking-wide text-white/60">Player 1</span>
          <span className="font-bold text-sm truncate max-w-[160px]">{player1Profile.username || 'Player 1'}</span>
          <span ref={p1Ref} className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-blue-300">
              <path d="M12 2L4 12c0 4.418 3.582 8 8 8s8-3.582 8-8L12 2z" />
            </svg>
            Mana: {player1Mana}
          </span>
        </div>
      </div>

      {/* Center: Game Info */}
      <div className="mx-auto text-center pointer-events-none select-none">
        <div className="text-[18px] leading-5 font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
          Turn {turn}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-yellow-300/90 px-2 py-0.5 rounded bg-yellow-900/30 inline-block tracking-widest">
          {phase.toUpperCase()} PHASE
        </div>
      </div>

      {/* Right: Player 2 + Resign */}
      <div className="flex items-center gap-3 min-w-0 ml-auto">
        <div className="flex flex-col items-end text-right min-w-0">
          <span className="text-xs uppercase tracking-wide text-white/60">Player 2</span>
          <span className="font-bold text-sm truncate max-w-[160px]">{player2Profile.username || 'Player 2'}</span>
          <span ref={p2Ref} className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-900/30 px-2 py-0.5 rounded">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-300">
              <path d="M12 2L4 12c0 4.418 3.582 8 8 8s8-3.582 8-8L12 2z" />
            </svg>
            Mana: {player2Mana}
          </span>
        </div>
        {player2Profile.avatar_url ? (
          <img
            src={player2Profile.avatar_url}
            alt=""
            width={36}
            height={36}
            className="rounded-full object-cover ring-2 ring-white/10 shadow"
          />
        ) : null}
        <button
          onClick={handleResign}
          className="ml-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-semibold py-1.5 px-3 rounded-md transition-all duration-200 shadow-sm hover:shadow-red-500/20"
          title="Resign and concede the match"
        >
          Resign
        </button>
      </div>
    </div>
  );
};

export default TopBar;