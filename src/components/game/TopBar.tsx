import React, { useRef, useEffect } from 'react';
import { Flag, HeartPulse, Swords } from 'lucide-react';
import { GameState } from '../../game/types.js';
import { updateGameState, recordGameOutcomeAndUpdateStats, ProfileInfo } from '../../utils/supabase.js';
import { useCardRegistry } from '../../context/CardRegistry.js';
import { cn, StatusBadge } from '../ui/index.js';

interface TopBarProps {
  player1Profile: ProfileInfo;
  player2Profile: ProfileInfo;
  player1Power: number;
  player2Power: number;
  turn: number;
  phase: string;
  onLobbyReturn?: () => void; // Deprecated
  // New props to enable resign action
  currentPlayerId?: string;
  gameState?: GameState;
  isSpectator?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  player1Profile,
  player2Profile,
  player1Power,
  player2Power,
  turn,
  phase,
  currentPlayerId,
  gameState,
  isSpectator = false
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
      if (!gameState || !currentPlayerId || isSpectator) return;
      const p1 = gameState.players[0]?.id;
      const p2 = gameState.players[1]?.id;
      if (!p1 || !p2) return;
      if (currentPlayerId !== p1 && currentPlayerId !== p2) return;
      const winner = currentPlayerId === p1 ? p2 : p1;
      const next: GameState = { ...gameState, winner, phase: 'gameOver', log: [...gameState.log, `[Game] ${currentPlayerId} resigns. ${winner} wins!`] };
      await updateGameState(gameState.gameId, next);
      await recordGameOutcomeAndUpdateStats(gameState.gameId, winner, p1, p2, next);
    } catch (e) {
      console.error('[TopBar] Resign failed', e);
    }
  };

  const playerBlockClass = 'flex items-center gap-3 min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2';

  return (
  <div className="relative z-20 px-2 py-2 text-white sm:px-3">
    <div className="surface-obsidian grid h-full grid-cols-1 items-center gap-2 rounded-xl border px-2 py-2 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3 md:px-3">
      {/* Left: Player 1 */}
      <div className={cn(playerBlockClass, 'order-2 md:order-1')}>
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
          <span className="text-xs uppercase tracking-normal text-white/60">Player 1</span>
          <span className="max-w-[52vw] truncate text-sm font-bold sm:max-w-[160px]">{player1Profile.username || 'Player 1'}</span>
          <span ref={p1Ref} className="mt-1 inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-bold text-cyan-200">
            <HeartPulse className="h-3.5 w-3.5" aria-hidden />
            Power: {player1Power}
          </span>
        </div>
      </div>

      {/* Center: Game Info */}
      <div className="pointer-events-none order-1 mx-auto min-w-0 select-none text-center md:order-2 md:min-w-[220px]">
        <div className="flex items-center justify-center gap-2">
          <Swords className="h-4 w-4 text-amber-200" aria-hidden />
          <div className="font-display text-xl font-black uppercase tracking-normal text-slate-50">
            Turn {turn}
          </div>
        </div>
        <StatusBadge tone={phase === 'action' ? 'violet' : phase === 'knowledge' ? 'blue' : phase === 'gameOver' ? 'red' : 'amber'} className="mt-1">
          {phase.toUpperCase()} PHASE
        </StatusBadge>
        <div className="mt-1 hidden justify-center sm:flex">
          <img src="/logos/logo-header-dark.png" alt="Wisdom Duel" className="h-5 w-auto opacity-70" />
        </div>
      </div>

      {/* Right: Player 2 + Resign */}
      <div className={cn(playerBlockClass, 'order-3 justify-end md:ml-auto')}>
        <div className="flex flex-col items-end text-right min-w-0">
          <span className="text-xs uppercase tracking-normal text-white/60">Player 2</span>
          <span className="max-w-[52vw] truncate text-sm font-bold sm:max-w-[160px]">{player2Profile.username || 'Player 2'}</span>
          <span ref={p2Ref} className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-200">
            <HeartPulse className="h-3.5 w-3.5" aria-hidden />
            Power: {player2Power}
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
        {!isSpectator && gameState?.phase !== 'gameOver' && (
          <button
            onClick={handleResign}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-red-300/35 bg-red-500/15 px-2 py-2 text-xs font-bold uppercase tracking-normal text-red-100 transition hover:bg-red-500/25 active:scale-[0.98] sm:px-3"
            title="Resign and concede the match"
            aria-label="Resign and concede the match"
          >
            <Flag className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Resign</span>
          </button>
        )}
      </div>
    </div>
    </div>
  );
};

export default TopBar;
