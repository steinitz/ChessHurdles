import React, { useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

interface ChessBoardProps {
  game: Chess;
  onMove?: (move: string) => void;
  boardSize?: string;
  showCoordinates?: boolean;
  customSquareStyles?: Record<string, any>;
  boardOrientation?: 'white' | 'black';
}

export function ChessBoard({
  game,
  onMove,
  boardSize = '60vh',
  showCoordinates = true,
  customSquareStyles = {},
  boardOrientation = 'white'
}: ChessBoardProps & { boardOrientation?: 'white' | 'black' }) {
  const [moveFrom, setMoveFrom] = useState<string>('');
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});

  // Highlight last move
  const history = game.history({ verbose: true });
  const lastMove = history.length > 0 ? history[history.length - 1] : null;
  const lastMoveStyles = lastMove ? {
    [lastMove.from]: { backgroundColor: 'var(--color-move-highlight)' },
    [lastMove.to]: { backgroundColor: 'var(--color-move-highlight)' }
  } : {};

  const getMoveOptions = useCallback((square: string) => {
    const moves = game.moves({
      square: square as any,
      verbose: true,
    }) as any[];
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, any> = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };
    setOptionSquares(newSquares);
    return true;
  }, [game]);

  const makeAMove = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      try {
        const gameCopy = new Chess(game.fen());
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q', // Always promote to queen for simplicity
        });

        if (move) {
          onMove?.(move.san);
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    },
    [game, onMove]
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      setOptionSquares({});

      // If no piece is selected, try to select this square
      if (!moveFrom) {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
        return;
      }

      // If clicking on the same square, deselect
      if (moveFrom === square) {
        setMoveFrom('');
        return;
      }

      // Try to make a move
      const moveSuccessful = makeAMove(moveFrom, square);
      if (moveSuccessful) {
        setMoveFrom('');
      } else {
        // If move failed, try to select the new square
        const hasMoveOptions = getMoveOptions(square);
        setMoveFrom(hasMoveOptions ? square : '');
      }
    },
    [moveFrom, getMoveOptions, makeAMove]
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare) return false;
      const moveSuccessful = makeAMove(sourceSquare, targetSquare);
      // Wait for React to process the move before clearing UI state
      if (moveSuccessful) {
        setMoveFrom('');
        setOptionSquares({});
        return true;
      }
      return false;
    },
    [makeAMove]
  );

  return (
    <div
      className="chess-board-container"
      style={{
        width: boardSize,
        height: boardSize,
        maxWidth: '100%',
        maxHeight: '80vh'
      }}
    >
      <Chessboard
        options={{
          position: game.fen(),
          onPieceDrop: onPieceDrop,
          onSquareClick: onSquareClick,
          onPieceClick: ({ square }: any) => {
            if (square) onSquareClick({ square });
          },
          boardOrientation: boardOrientation,
          squareStyles: { ...lastMoveStyles, ...optionSquares, ...customSquareStyles }
        }}
      />
    </div>
  );
}

export default ChessBoard;