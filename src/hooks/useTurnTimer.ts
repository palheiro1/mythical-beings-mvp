import { useState, useEffect, useRef } from 'react';

interface UseTurnTimerProps {
  isMyTurn: boolean;
  phase: 'knowledge' | 'action' | 'end' | null; // Include null for initial state
  turnDurationSeconds: number;
  onTimerEnd: () => void;
  gameTurn: number; // Add gameTurn to reset timer on new turn
  currentPlayerIndex: number | null; // Add currentPlayerIndex to reset timer on player change
  paused?: boolean;
}

export function useTurnTimer({
  isMyTurn,
  phase,
  turnDurationSeconds,
  onTimerEnd,
  gameTurn,
  currentPlayerIndex,
  paused = false
}: UseTurnTimerProps): number {
  const [remainingTime, setRemainingTime] = useState(turnDurationSeconds);
  const remainingMs = useRef(turnDurationSeconds * 1000);
  const onTimerEndRef = useRef(onTimerEnd); // Use ref to avoid effect dependency issues
  const contextRef = useRef('');

  // Keep the callback ref up-to-date
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  useEffect(() => {
    const context = `${gameTurn}:${currentPlayerIndex}:${isMyTurn}:${phase}:${turnDurationSeconds}`;
    if (context !== contextRef.current) {
      contextRef.current = context;
      remainingMs.current = turnDurationSeconds * 1000;
      setRemainingTime(turnDurationSeconds);
    }
    if (paused || !isMyTurn || phase !== 'action') return;

    const deadline = performance.now() + remainingMs.current;
    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      const left = Math.max(0, Math.ceil(deadline - performance.now()));
      setRemainingTime(Math.ceil(left / 1000));
      if (left === 0) onTimerEndRef.current();
      else timeout = setTimeout(tick, left % 1000 || 1000);
    }
    tick();
    return () => {
      clearTimeout(timeout);
      remainingMs.current = Math.max(0, deadline - performance.now());
    };
  }, [isMyTurn, phase, turnDurationSeconds, gameTurn, currentPlayerIndex, paused]);

  return remainingTime;
}
