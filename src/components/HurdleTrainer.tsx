import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { HurdleTable } from '~/lib/chess-database';
import { getUserHurdles } from '~/lib/server/hurdles';
import { CHESSBOARD_WIDTH } from '~/constants';

interface HurdleTrainerProps {
  hurdle?: HurdleTable;
  game: Chess;
  message: string;
  isSolved: boolean;
  setCustomSquareStyles: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onHurdleChange: (hurdle: HurdleTable) => void;
}

export function HurdleTrainer({
  hurdle: activeHurdle,
  game,
  message,
  isSolved,
  setCustomSquareStyles,
  onHurdleChange
}: HurdleTrainerProps) {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [currentHurdleIndex, setCurrentHurdleIndex] = useState(0);
  const [loading, setLoading] = useState(!activeHurdle);
  const [showHint, setShowHint] = useState(false);

  // Load hurdles if not provided
  useEffect(() => {
    getUserHurdles().then(fetchedHurdles => {
      setHurdles(fetchedHurdles);
      setLoading(false);
      // If we don't have an active hurdle yet, pick the first one
      if (!activeHurdle && fetchedHurdles.length > 0) {
        onHurdleChange(fetchedHurdles[0]);
        setCurrentHurdleIndex(0);
      } else if (activeHurdle) {
        const idx = fetchedHurdles.findIndex(h => h.id === activeHurdle.id);
        if (idx !== -1) setCurrentHurdleIndex(idx);
      }
    });
  }, []);

  // Sync index when activeHurdle changes from parent
  useEffect(() => {
    if (activeHurdle && hurdles.length > 0) {
      const idx = hurdles.findIndex(h => h.id === activeHurdle.id);
      if (idx !== -1) {
        setCurrentHurdleIndex(idx);
        setShowHint(false);
      }
    }
  }, [activeHurdle, hurdles]);

  // Calculate and apply hint styles to parent
  useEffect(() => {
    if (!showHint || !activeHurdle?.best_move) {
      setCustomSquareStyles({});
      return;
    }

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

    if (sourceSquare) {
      setCustomSquareStyles({
        [sourceSquare]: {
          backgroundColor: 'rgba(255, 170, 0, 0.4)',
          boxShadow: 'inset 0 0 0 4px rgba(255, 170, 0, 0.8)',
          borderRadius: '50%'
        }
      });
    }
  }, [showHint, activeHurdle, setCustomSquareStyles]);

  const handleNext = () => {
    if (hurdles.length === 0) return;
    const nextIndex = (currentHurdleIndex + 1) % hurdles.length;
    setCurrentHurdleIndex(nextIndex);
    onHurdleChange(hurdles[nextIndex]);
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
        backgroundColor: 'transparent'
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
          color: isSolved ? 'var(--color-success, #166534)' : 'var(--color-link, #1e40af)',
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
                color: 'var(--color-link, #2563eb)',
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
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-link)',
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
