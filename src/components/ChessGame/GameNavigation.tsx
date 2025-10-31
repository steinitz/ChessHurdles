import React, { useCallback } from 'react';

interface GameNavigationProps {
  currentMoveIndex: number;
  totalMoves: number;
  goToMove: (moveIndex: number) => void;
  containerHeight?: string;
}

export default function GameNavigation({ 
  currentMoveIndex, 
  totalMoves, 
  goToMove,
  containerHeight = '8vh'
}: GameNavigationProps) {
  
  const goToPreviousMove = useCallback(() => {
    if (currentMoveIndex > 0) {
      goToMove(currentMoveIndex - 1);
    }
  }, [currentMoveIndex, goToMove]);

  const goToNextMove = useCallback(() => {
    if (currentMoveIndex < totalMoves - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, totalMoves, goToMove]);

  const goToStart = useCallback(() => {
    goToMove(0);
  }, [goToMove]);

  const goToEnd = useCallback(() => {
    goToMove(totalMoves - 1);
  }, [totalMoves, goToMove]);

  return (
    <div style={{
      minWidth: '280px',
      flex: '1 1 auto',
      display: 'flex',
      flexDirection: 'column',
      height: containerHeight
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <button
          onClick={goToStart}
          disabled={currentMoveIndex === 0}
        >
          ⏮ Start
        </button>
        <button
          onClick={goToPreviousMove}
          disabled={currentMoveIndex === 0}
        >
          ◀ Prev
        </button>
        <button
          onClick={goToNextMove}
          disabled={currentMoveIndex === totalMoves - 1}
        >
          Next ▶
        </button>
        <button
          onClick={goToEnd}
          disabled={currentMoveIndex === totalMoves - 1}
        >
          &nbsp;&nbsp;End ⏭
        </button>
      </div>
    </div>
  );
}