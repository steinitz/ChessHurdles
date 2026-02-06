import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';

interface UseGameClockOptions {
  initialTimeMs: number;
  incrementMs: number;
  onTimeout: (winner: 'White' | 'Black') => void;
}

export function useGameClock(
  game: Chess,
  { initialTimeMs, incrementMs, onTimeout }: UseGameClockOptions
) {
  const [whiteTime, setWhiteTime] = useState(initialTimeMs);
  const [blackTime, setBlackTime] = useState(initialTimeMs);
  const [lastTick, setLastTick] = useState<number | null>(null);

  // Manual reset helper
  const resetTimers = useCallback(() => {
    setWhiteTime(initialTimeMs);
    setBlackTime(initialTimeMs);
    setLastTick(null);
  }, [initialTimeMs]);

  // Add increment helper
  const addIncrement = useCallback((side: 'w' | 'b') => {
    if (side === 'w') {
      setWhiteTime((t) => t + incrementMs);
    } else {
      setBlackTime((t) => t + incrementMs);
    }
  }, [incrementMs]);

  // Reset lastTick on turn change to separate move times accurately
  useEffect(() => {
    setLastTick(Date.now());
  }, [game.turn()]);

  // Timer Effect
  useEffect(() => {
    // Only run timer if game is in progress AND at least one move has been made
    // We assume game.isGameOver() is checked by the parent or effectively stops updates 
    // because onTimeout triggers a game over state in parent.
    if (game.isGameOver() || game.history().length === 0) {
      setLastTick(null);
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const delta = lastTick ? now - lastTick : 0;
      setLastTick(now);

      if (delta > 0) {
        if (game.turn() === 'w') {
          setWhiteTime(prev => {
            const next = prev - delta;
            if (next <= 0) {
              onTimeout('Black');
              return 0;
            }
            return next;
          });
        } else {
          setBlackTime(prev => {
            const next = prev - delta;
            if (next <= 0) {
              onTimeout('White');
              return 0;
            }
            return next;
          });
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [game, game.turn(), game.isGameOver(), lastTick, onTimeout]);

  return {
    whiteTime,
    blackTime,
    resetTimers,
    addIncrement,
    setWhiteTime, // Expose for manual adjustment
    setBlackTime  // Expose for manual adjustment
  };
}
