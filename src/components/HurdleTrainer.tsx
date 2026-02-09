import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { HurdleTable } from '~/lib/chess-database';
import { getUserHurdles } from '~/lib/server/hurdles';
import { CHESSBOARD_WIDTH } from '~/constants';

interface HurdleTrainerProps {
  hurdle?: HurdleTable;
}

export function HurdleTrainer({ hurdle: initialHurdle }: HurdleTrainerProps) {
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

    let sourceSquare = '';

    // Try to parse as UCI first (4 chars, e.g. "e2e4")
    if (activeHurdle.best_move.match(/^[a-h][1-8][a-h][1-8][qrbn]?$/)) {
      sourceSquare = activeHurdle.best_move.substring(0, 2);
    } else {
      // Parse SAN using chess.js
      try {
        const cleanMove = activeHurdle.best_move.replace(/^\d+\.+/, '').trim();
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
          if (!activeHurdle.best_move) return prevGame;
          const cleanBestMove = activeHurdle.best_move.replace(/^\d+\.+/, '').trim();

          const isBestMove =
            moveSan === cleanBestMove ||
            playedMoveUci === cleanBestMove;

          if (isBestMove) {
            setMessage('Correct. Well done');
            setIsSolved(true);
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
      setCurrentHurdleIndex(0);
    }
  };

  if (loading) return <div>Loading training...</div>;
  if (!activeHurdle) return <div>No hurdles found. Go analyze some games!</div>;

  const toMoveText = game.turn() === 'w' ? 'White to move' : 'Black to move';

  const boardWidth = CHESSBOARD_WIDTH;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%'
    }}>

      {/* Status Bar - Matched to board width */}
      <div style={{
        width: boardWidth,
        maxWidth: '100%',
        marginBottom: '0.25rem',
        padding: '0.25rem',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '40px',
        backgroundColor: 'transparent' // Explicitly transparent
      }}>
        {/* Left: To Move */}
        <div style={{
          flex: 1,
          fontWeight: 600,
          color: 'var(--color-text)',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingLeft: '0.25rem',
          paddingRight: '0.25rem'
        }}>
          {toMoveText}
        </div>

        {/* Center: Message */}
        <div style={{
          flex: 1,
          fontWeight: 700,
          textAlign: 'center',
          color: isSolved ? 'var(--color-success, #166534)' : 'var(--color-link, #1e40af)', // Use CSS var
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingLeft: '8px',
          paddingRight: '8px'
        }}>
          {message === 'Find the best move' ? '' : message}
        </div>

        {/* Right: Hint */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          paddingLeft: '8px',
          overflow: 'hidden'
        }}>
          {!isSolved && (
            <button
              onClick={() => setShowHint(true)}
              title="Show hint highlight"
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-link, #2563eb)', // Use CSS var
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <span>💡</span>
              <span>Hint</span>
            </button>
          )}
        </div>
      </div>

      <ChessBoard
        game={game}
        onMove={onMove}
        boardSize={boardWidth}
        customSquareStyles={hintStyles}
      />

      {/* Next Button Below Board */}
      <div style={{
        width: boardWidth,
        maxWidth: '100%',
        marginTop: '1rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        {hurdles.length > 1 && (
          <button
            onClick={handleNext}
            title="Skip to next hurdle"
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: 'var(--color-bg-secondary)', // Use CSS var
              color: 'var(--color-link)', // Use CSS var
              borderRadius: '0.5rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              transition: 'background-color 0.2s'
            }}
          >
            Next Hurdle →
          </button>
        )}
      </div>
    </div>
  );
}
