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
    }
  }, [activeHurdle]);

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

      <div className="mb-4 p-4 rounded bg-blue-50 text-center min-w-[300px]">
        <p className={`text-lg font-bold ${isSolved ? 'text-green-600' : 'text-blue-800'}`}>
          {message}
        </p>
      </div>

      <ChessBoard
        game={game}
        onMove={onMove}
        boardSize="60vh"
      />
    </div>
  );
}
