import React from 'react';

interface GameMove {
  position: any;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
}

interface GameMovesProps {
  gameMoves: GameMove[];
  currentMoveIndex: number;
  goToMove: (moveIndex: number) => void;
}

import { QuickAnalysisModal } from './Analysis/QuickAnalysisModal';
import { useState } from 'react';

export function GameMoves({ gameMoves, currentMoveIndex, goToMove }: GameMovesProps) {
  const [quickAnalysisData, setQuickAnalysisData] = useState<{ fen: string; move: string } | null>(null);

  const handleQuickAnalyze = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // gameMoves[0] is start. gameMoves[i] is position AFTER move i.
    // currentMoveIndex corresponds to the index in gameMoves we are viewing.
    const currentMove = gameMoves[currentMoveIndex];
    if (currentMove?.position) {
      setQuickAnalysisData({
        fen: currentMove.position.fen(),
        move: currentMove.move || 'Current'
      });
    }
  };

  return (
    <>
      <details open>
        <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Moves</span>
          <button
            onClick={handleQuickAnalyze}
            title="Analyze current position"
            style={{
              padding: '2px 8px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              marginLeft: 'auto'
            }}
          >
            Analyze Move
          </button>
        </summary>
        <div style={{
          padding: '0.5rem',
          border: '1px solid var(--color-accent)',
          borderRadius: '4px',
          width: '100%',
          wordWrap: 'break-word'
        }}>
          {gameMoves.slice(1).map((gameMove, index) => {
            const moveNumber = Math.floor(index / 2) + 1;
            const isWhiteMove = index % 2 === 0;
            const isCurrentMove = index + 1 === currentMoveIndex;

            return (
              <span
                key={index}
                style={{
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  backgroundColor: isCurrentMove ? 'var(--color-accent)' : 'transparent',
                  color: isCurrentMove ? 'white' : 'inherit'
                }}
                onClick={() => goToMove(index + 1)}
              >
                {isWhiteMove && `${moveNumber}. `}{gameMove.move}{' '}
              </span>
            );
          })}
        </div>
      </details>

      {quickAnalysisData && (
        <QuickAnalysisModal
          isOpen={true}
          onClose={() => setQuickAnalysisData(null)}
          fen={quickAnalysisData.fen}
          move={quickAnalysisData.move}
        />
      )}
    </>
  );
}

export default GameMoves;