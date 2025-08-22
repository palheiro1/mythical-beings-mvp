import { useEffect, useRef, useCallback, useState } from 'react';

interface UseGameTimerOptions {
  initialTime?: number;
  onTimeUpdate?: (timeLeft: number) => void;
  onTimeExpired?: () => void;
  autoStart?: boolean;
}

export const useGameTimer = ({ 
  initialTime = 30, 
  onTimeUpdate, 
  onTimeExpired,
  autoStart = false
}: UseGameTimerOptions = {}) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isActive, setIsActive] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiredRef = useRef(false);

  const start = useCallback(() => {
    setIsActive(true);
  }, []);

  const pause = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback((newTime?: number) => {
    setIsActive(false);
    expiredRef.current = false;
    const resetTime = newTime !== undefined ? newTime : initialTime;
    const clamped = Math.max(0, resetTime);
    setTimeLeft(clamped);
    if (onTimeUpdate) onTimeUpdate(clamped);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [initialTime, onTimeUpdate]);

  const addTime = useCallback((seconds: number) => {
    setTimeLeft(current => Math.max(0, current + seconds));
  }, []);

  // Timer effect
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(current => {
          const newTime = Math.max(0, current - 1);
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          }
          if (newTime === 0 && !expiredRef.current) {
            expiredRef.current = true;
            setIsActive(false);
            if (onTimeExpired) {
              onTimeExpired();
            }
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, timeLeft, onTimeUpdate, onTimeExpired]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setTime = useCallback((seconds: number) => {
    const clamped = Math.max(0, seconds);
    setTimeLeft(clamped);
    if (onTimeUpdate) onTimeUpdate(clamped);
    if (clamped === 0 && !expiredRef.current) {
      expiredRef.current = true;
      setIsActive(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (onTimeExpired) onTimeExpired();
    } else if (clamped > 0) {
      expiredRef.current = false;
    }
  }, [onTimeUpdate, onTimeExpired]);

  return {
    timeLeft,
    isActive,
    start,
    pause,
    reset,
    addTime,
    stop,
    setTime,
    isExpired: timeLeft <= 0,
    formattedTime: `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
  };
};
