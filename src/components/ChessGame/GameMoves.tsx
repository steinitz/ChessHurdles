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

export function GameMoves({ gameMoves, currentMoveIndex, goToMove }: GameMovesProps) {
  return (
    <details open>
      <summary>Moves</summary>
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
  );
}

export default GameMoves;