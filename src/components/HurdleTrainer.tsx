import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { HurdleTable } from '~/lib/chess-database';
import { Spacer } from '~stzUtils/components/Spacer';
import { getUserHurdles } from '~/lib/server/hurdles';

interface HurdleTrainerProps {
  hurdle?: HurdleTable;
  onBack?: () => void;
}

export function HurdleTrainer({ hurdle: initialHurdle, onBack }: HurdleTrainerProps) {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [currentHurdleIndex, setCurrentHurdleIndex] = useState(0);
  const [game, setGame] = useState(() => new Chess());
  const [message, setMessage] = useState<string>('Find the best move');
  const [isSolved, setIsSolved] = useState(false);
  const [loading, setLoading] = useState(!initialHurdle);
  const [showHint, setShowHint] = useState(false);

  // Load hurdles if not provided
  useEffect(() => {
    if (!initialHurdle) {
      getUserHurdles().then(fetchedHurdles => {
        setHurdles(fetchedHurdles);
        setLoading(false);
      });
    } else {
      setHurdles([initialHurdle]);
      setLoading(false);
    }
  }, [initialHurdle]);

  const activeHurdle = hurdles[currentHurdleIndex];

  // Reset game when active hurdle changes
  useEffect(() => {
    if (activeHurdle) {
      setGame(new Chess(activeHurdle.fen));
      setMessage('Find the best move');
      setIsSolved(false);
      setShowHint(false);
    }
  }, [activeHurdle]);

  // Calculate hint styles
  const hintStyles = React.useMemo(() => {
    if (!showHint || !activeHurdle?.best_move) return {};

    // Best move could be SAN (e.g. "Nf3") or UCI (e.g. "g1f3")
    // We need the source square.
    let sourceSquare = '';

    // Try to parse as UCI first (4 chars, e.g. "e2e4")
    if (activeHurdle.best_move.match(/^[a-h][1-8][a-h][1-8][qrbn]?$/)) {
      sourceSquare = activeHurdle.best_move.substring(0, 2);
    } else {
      // Parse SAN using chess.js
      try {
        // Clean the move string: remove move numbers (e.g. "2...", "1.") and whitespace
        const cleanMove = activeHurdle.best_move.replace(/^\d+\.+/, '').trim();
        console.log(`💡 Parsing best move for hint: "${activeHurdle.best_move}" -> "${cleanMove}"`);

        // We need a temp game to parse the SAN relative to the position
        const tempGame = new Chess(activeHurdle.fen);
        const move = tempGame.move(cleanMove);
        if (move) {
          sourceSquare = move.from;
        }
      } catch (e) {
        console.error('Failed to parse best move for hint:', e, activeHurdle.best_move);
      }
    }

    if (!sourceSquare) return {};

    return {
      [sourceSquare]: {
        backgroundColor: 'rgba(255, 170, 0, 0.4)',
        boxShadow: 'inset 0 0 0 4px rgba(255, 170, 0, 0.8)',
        borderRadius: '50%'
      }
    };
  }, [showHint, activeHurdle]);

  const onMove = useCallback((moveSan: string) => {
    if (isSolved || !activeHurdle) return;

    setGame(prevGame => {
      const newGame = new Chess(prevGame.fen());
      try {
        const moveResult = newGame.move(moveSan);

        if (moveResult) {
          const playedMoveUci = moveResult.from + moveResult.to + (moveResult.promotion || '');
          const isBestMove =
            moveSan === activeHurdle.best_move ||
            playedMoveUci === activeHurdle.best_move;

          if (isBestMove) {
            setMessage('Correct. Well done');
            setIsSolved(true);
            // TODO: Update mastery level
          } else {
            setMessage('Incorrect. Try again');
            setTimeout(() => {
              setGame(new Chess(activeHurdle.fen));
              setMessage('Try again...');
            }, 1000);
            return prevGame;
          }
        }
        return newGame;
      } catch (e) {
        return prevGame;
      }
    });

  }, [activeHurdle, isSolved]);

  const handleNext = () => {
    if (currentHurdleIndex < hurdles.length - 1) {
      setCurrentHurdleIndex(prev => prev + 1);
    } else {
      // Loop back or show finished? Loop for now.
      setCurrentHurdleIndex(0);
    }
  };

  if (loading) return <div>Loading training...</div>;
  if (!activeHurdle) return <div>No hurdles found for training. Go analyze some games!</div>;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl mb-4 flex justify-between items-center">
        {onBack ? (
          <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            ← Back to Game
          </button>
        ) : (
          <div className="w-[100px]"></div>
        )}
        <h2 className="text-xl font-bold">Hurdle Training</h2>
        <div className="w-[100px] flex justify-end">
          {/* Only show Next button if we have multiple hurdles and in standalone mode (no onBack) or just always? */}
          {hurdles.length > 1 && (
            <button onClick={handleNext} className="px-3 py-1 bg-blue-100 rounded hover:bg-blue-200 text-sm">
              Next
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 text-center">
        <p className="text-lg">{activeHurdle.title}</p>
        <p className="text-gray-600 italic">{activeHurdle.ai_description}</p>
      </div>

      <div className="mb-4 p-4 rounded bg-blue-50 text-center min-w-[300px] flex flex-col items-center gap-2">
        <p className={`text-lg font-bold ${isSolved ? 'text-green-600' : 'text-blue-800'}`}>
          {message}
        </p>
        {!isSolved && (
          <button
            onClick={() => setShowHint(true)}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            title="Show hint"
          >
            💡 Hint
          </button>
        )}
      </div>

      <ChessBoard
        game={game}
        onMove={onMove}
        boardSize="60vh"
        customSquareStyles={hintStyles}
      />
    </div>
  );
}
