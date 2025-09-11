import { Chess } from 'chess.js';

/**
 * Converts UCI notation to Standard Algebraic Notation (SAN)
 * @param uciMove - Move in UCI format (e.g., 'e2e4', 'g1f3')
 * @param fen - Current position in FEN notation
 * @returns Move in algebraic notation (e.g., 'e4', 'Nf3') or null if invalid
 */
export function uciToAlgebraic(uciMove: string, fen: string): string | null {
  try {
    const game = new Chess(fen);
    
    // Parse UCI move format (e.g., 'e2e4', 'e7e8q')
    if (uciMove.length < 4) return null;
    
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotionPiece = uciMove.length > 4 ? uciMove.slice(4) : undefined;
    
    // Check if the move is legal before attempting it
    const legalMoves = game.moves({ verbose: true });
    const isLegalMove = legalMoves.some(move => 
      move.from === from && move.to === to && 
      (!promotionPiece || move.promotion === promotionPiece)
    );
    
    if (!isLegalMove) {
      // Silently return null for illegal moves - this is expected during analysis
      return null;
    }
    
    // Make the move and get the SAN notation
    const moveOptions: any = { from, to };
    if (promotionPiece) {
      moveOptions.promotion = promotionPiece;
    }
    
    const move = game.move(moveOptions);
    
    return move ? move.san : null;
  } catch (error) {
    // Silently handle conversion errors - this is expected during analysis
    return null;
  }
}

/**
 * Converts a sequence of UCI moves to algebraic notation
 * @param uciMoves - Array of UCI moves or space-separated string
 * @param startingFen - Starting position (defaults to initial position)
 * @returns Array of algebraic moves
 */
export function uciSequenceToAlgebraic(
  uciMoves: string[] | string, 
  startingFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
): string[] {
  const moves = Array.isArray(uciMoves) ? uciMoves : uciMoves.split(' ').filter(Boolean);
  const game = new Chess(startingFen);
  const algebraicMoves: string[] = [];
  
  for (const uciMove of moves) {
    const algebraic = uciToAlgebraic(uciMove, game.fen());
    if (algebraic) {
      algebraicMoves.push(algebraic);
      // Make the move to update the position for the next conversion
      try {
        game.move(algebraic);
      } catch (error) {
        console.warn('Failed to make move during sequence conversion:', algebraic);
        break;
      }
    } else {
      console.warn('Failed to convert UCI move in sequence:', uciMove);
      break;
    }
  }
  
  return algebraicMoves;
}

/**
 * Formats a principal variation (PV) from UCI to algebraic notation
 * @param pvString - Space-separated UCI moves
 * @param fen - Current position
 * @returns Formatted algebraic notation string
 */
export function formatPrincipalVariation(pvString: string, fen: string): string {
  if (!pvString.trim()) return '';
  
  const algebraicMoves = uciSequenceToAlgebraic(pvString, fen);
  return algebraicMoves.join(' ');
}