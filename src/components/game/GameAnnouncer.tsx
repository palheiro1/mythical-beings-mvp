import React, { useEffect, useMemo, useRef, useState } from 'react';

type Phase = 'knowledge' | 'action' | 'end' | 'gameOver' | 'setup';

interface GameAnnouncerProps {
  turn: number;
  phase: Phase;
  isMyTurn: boolean;
  playerName?: string;
  opponentName?: string;
  showDuring?: number; // ms
}

const DEFAULT_DURATION = 1800;

const GameAnnouncer: React.FC<GameAnnouncerProps> = ({
  turn,
  phase,
  isMyTurn,
  playerName,
  opponentName,
  showDuring = DEFAULT_DURATION,
}) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const lastKeyRef = useRef<string>('');

  const key = useMemo(() => `${turn}:${phase}:${isMyTurn ? 'me' : 'opp'}`, [turn, phase, isMyTurn]);

  useEffect(() => {
    if (phase !== 'knowledge' && phase !== 'action') return;
    if (key === lastKeyRef.current) return;

    lastKeyRef.current = key;

    const who = isMyTurn ? (playerName || 'You') : (opponentName || 'Opponent');
    const phaseText = phase === 'knowledge' ? 'Knowledge Phase' : 'Action Phase';
    const ownerText = isMyTurn && who === 'You' ? 'Your Turn' : `${who}'s Turn`;
    const msg = `${ownerText} - ${phaseText}`;

    setMessage(msg);
    setVisible(true);

    const t = setTimeout(() => setVisible(false), showDuring);
    return () => clearTimeout(t);
  }, [key, phase, isMyTurn, playerName, opponentName, showDuring]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center">
      <div className="mt-16 px-6 py-4 rounded-2xl bg-black/75 text-white shadow-2xl backdrop-blur-sm border border-violet-300/25
                      transform transition-all duration-700 ease-out animate-[fadeIn_200ms_ease-out]
                     ">
        <div className="text-sm opacity-80 text-center">Turn {turn}</div>
        <div className="text-2xl font-semibold tracking-wide text-center">
          {message}
        </div>
      </div>
    </div>
  );
};

export default GameAnnouncer;
