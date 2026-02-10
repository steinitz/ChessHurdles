import React, { useCallback, useMemo } from 'react';

interface GameNavigationProps {
  currentMoveIndex: number;
  totalMoves: number;
  goToMove: (moveIndex: number) => void;
  containerHeight?: string;
  analysisSummary?: { moveIndex: number; classification: string; isWhiteMove: boolean }[];
  playerSide?: 'w' | 'b' | null;
}

export default function GameNavigation({
  currentMoveIndex,
  totalMoves,
  goToMove,
  containerHeight = '8vh',
  analysisSummary,
  playerSide
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

  const nextMistakeIndex = useMemo(() => {
    if (!analysisSummary || analysisSummary.length === 0) return null;

    // Find first item with index > current AND classification != 'none'/'good'
    // AND moves made by the player (if playerSide is known)
    const target = analysisSummary.find(item => {
      const isMistake = item.classification !== 'none' && item.classification !== 'good';
      const isPlayerMove = playerSide ? (item.isWhiteMove === (playerSide === 'w')) : true;
      return item.moveIndex > currentMoveIndex && isMistake && isPlayerMove;
    });
    return target ? target.moveIndex : null;
  }, [analysisSummary, currentMoveIndex, playerSide]);

  const goToNextMistake = useCallback(() => {
    if (nextMistakeIndex !== null) {
      goToMove(nextMistakeIndex);
    }
  }, [nextMistakeIndex, goToMove]);

  return (
    <div style={{
      minWidth: '280px',
      flex: '1 1 auto',
      display: 'flex',
      flexDirection: 'column',
      height: containerHeight,
      justifyContent: 'center'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        {/* Start */}
        <button
          onClick={goToStart}
          disabled={currentMoveIndex === 0}
          title="Go to Start"
          style={{ padding: '0.5rem 0.75rem', fontSize: '1.2rem' }}
        >
          ⏮
        </button>

        {/* Prev Move */}
        <button
          onClick={goToPreviousMove}
          disabled={currentMoveIndex === 0}
          style={{ flex: 1, whiteSpace: 'nowrap' }}
        >
          Prev Move
        </button>

        {/* Next Move */}
        <button
          onClick={goToNextMove}
          disabled={currentMoveIndex === totalMoves - 1}
          style={{ flex: 1, whiteSpace: 'nowrap' }}
        >
          Next Move
        </button>

        {/* Next Mistake */}
        <button
          onClick={goToNextMistake}
          disabled={nextMistakeIndex === null}
          style={{
            flex: 1.2,
            whiteSpace: 'nowrap'
          }}
          title={nextMistakeIndex !== null ? "Jump to next mistake/inaccuracy" : "No more mistakes"}
        >
          Next Mistake
        </button>

        {/* End */}
        <button
          onClick={goToEnd}
          disabled={currentMoveIndex === totalMoves - 1}
          title="Go to End"
          style={{ padding: '0.5rem 0.75rem', fontSize: '1.2rem' }}
        >
          ⏭
        </button>
      </div>
    </div>
  );
}