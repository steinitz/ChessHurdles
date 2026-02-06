import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { initializeStockfishWorker } from '~/lib/stockfish-engine';
import { getOpeningMove, getBookMoveDelay } from '~/lib/opening-book';

interface UseStockfishEngineOptions {
  userSide: 'w' | 'b';
  engineLevel: number;
  initialTimeMs: number;
  incrementMs: number;
  onMove: (move: { from: string; to: string; promotion?: string }) => void;
  game: Chess; // Need game instance for FEN and turn checking
  isGameActive: boolean;
}

export function useStockfishEngine({
  userSide,
  engineLevel,
  initialTimeMs,
  incrementMs,
  onMove,
  game,
  isGameActive
}: UseStockfishEngineOptions) {
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [isOutOfBook, setIsOutOfBook] = useState(false);
  const [lastMoveSource, setLastMoveSource] = useState<'Book' | 'Engine' | null>(null);

  const engineWorkerRef = useRef<Worker | null>(null);

  // Initialize Engine
  useEffect(() => {
    if (!engineWorkerRef.current) {
      engineWorkerRef.current = initializeStockfishWorker(
        (event) => {
          const msg = event.data;
          // Parse bestmove
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            const moves = msg.split(' ');
            const bestMove = moves[1];
            if (bestMove) {
              console.log('Engine played:', bestMove);
              const from = bestMove.substring(0, 2);
              const to = bestMove.substring(2, 4);
              const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;

              onMove({ from, to, promotion });
              setIsEngineThinking(false);
            }
          }
        },
        (err) => console.error('Engine error:', err),
        {
          "Skill Level": engineLevel,
          "Use NNUE": "true"
        }
      );
    }

    return () => {
      if (engineWorkerRef.current) {
        engineWorkerRef.current.terminate();
        engineWorkerRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update Skill Level when it changes
  useEffect(() => {
    if (engineWorkerRef.current) {
      engineWorkerRef.current.postMessage(`setoption name Skill Level value ${engineLevel}`);
    }
  }, [engineLevel]);

  // Trigger Engine / Book Logic
  useEffect(() => {
    let isCurrent = true;

    // Condition: NOT user's turn, game active, not already thinking, worker exists
    if (game.turn() !== userSide && isGameActive && !isEngineThinking && engineWorkerRef.current) {
      setIsEngineThinking(true);

      const makeEngineMove = () => {
        if (!isCurrent) return;
        setLastMoveSource('Engine');
        engineWorkerRef.current?.postMessage(`position fen ${game.fen()}`);
        engineWorkerRef.current?.postMessage('go movetime 1000');
      };

      const tryBookMove = async () => {
        let delay = getBookMoveDelay(initialTimeMs, incrementMs);

        // Cap delay for the first move to 2 seconds
        if (game.history().length === 0) {
          delay = Math.min(delay, 2000);
        }

        // Wait first
        await new Promise(resolve => setTimeout(resolve, delay));
        if (!isCurrent) return;

        // Verify turn hasn't changed during delay
        if (game.turn() === userSide || !isGameActive) {
          setIsEngineThinking(false);
          return;
        }

        const bookMoveUci = await getOpeningMove(game.fen());
        if (!isCurrent) return;

        if (bookMoveUci) {
          console.log('Playing Book Move:', bookMoveUci);
          setLastMoveSource('Book');

          const from = bookMoveUci.substring(0, 2);
          const to = bookMoveUci.substring(2, 4);
          const promotion = bookMoveUci.length > 4 ? bookMoveUci.substring(4, 5) : undefined;

          // We don't catch errors here, we expect the parent onMove to handle it or it's a valid book move
          try {
            onMove({ from, to, promotion });
            setIsEngineThinking(false);
          } catch (e) {
            console.error('Failed to apply book move:', bookMoveUci);
            makeEngineMove(); // Fallback
          }
        } else {
          console.log('Out of Book');
          setIsOutOfBook(true);
          makeEngineMove();
        }
      };

      if (!isOutOfBook) {
        tryBookMove();
      } else {
        // Engine Move w/ small delay for realism
        setTimeout(() => {
          if (isCurrent) makeEngineMove();
        }, 500);
      }
    }

    return () => {
      isCurrent = false;
    };
  }, [game, isOutOfBook, userSide, isGameActive]); // Removed isEngineThinking to avoid cancellation cycles

  const resetEngineState = useCallback(() => {
    setIsOutOfBook(false);
    setLastMoveSource(null);
    setIsEngineThinking(false);
  }, []);

  return {
    isEngineThinking,
    isOutOfBook,
    lastMoveSource,
    resetEngineState
  };
}
