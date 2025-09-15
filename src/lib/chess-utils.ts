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
    
    // Chess.js can handle UCI moves directly
    const move = game.move(uciMove);
    
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
        game.move(uciMove);
      } catch (error) {
        console.warn('Failed to make move during sequence conversion:', uciMove);
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
 * Formats a single move with proper chess notation numbering
 * @param move - Move in algebraic notation (e.g., 'e4', 'Nf3')
 * @param fen - Current position to determine move number and turn
 * @returns Formatted move with number (e.g., '1.e4', '1...e5')
 */
export function formatMoveWithNumber(move: string, fen: string): string {
  const fenParts = fen.split(' ');
  const isWhiteToMove = fenParts[1] === 'w';
  const fullMoveNumber = parseInt(fenParts[5]) || 1;
  
  if (isWhiteToMove) {
    return `${fullMoveNumber}.${move}`;
  } else {
    return `${fullMoveNumber}...${move}`;
  }
}

/**
 * Formats a principal variation (PV) from UCI to algebraic notation with proper move numbering
 * @param pvString - Space-separated UCI moves
 * @param fen - Current position
 * @returns Formatted algebraic notation string with move numbers
 */
export function formatPrincipalVariation(pvString: string, fen: string): string {
  if (!pvString.trim()) return '';
  
  const algebraicMoves = uciSequenceToAlgebraic(pvString, fen);
  if (algebraicMoves.length === 0) return '';
  
  // Parse the FEN to get the current move number and whose turn it is
  const fenParts = fen.split(' ');
  const isWhiteToMove = fenParts[1] === 'w';
  const fullMoveNumber = parseInt(fenParts[5]) || 1;
  
  const formattedMoves: string[] = [];
  let currentMoveNumber = fullMoveNumber;
  let isWhiteTurn = isWhiteToMove;
  
  for (let i = 0; i < algebraicMoves.length; i++) {
    const move = algebraicMoves[i];
    
    if (isWhiteTurn) {
      // White's move: show move number
      formattedMoves.push(`${currentMoveNumber}.${move}`);
    } else {
      // Black's move
      if (i === 0) {
        // First move is black's move, use ellipsis notation
        formattedMoves.push(`${currentMoveNumber}...${move}`);
      } else {
        // Subsequent black moves
        formattedMoves.push(move);
      }
      currentMoveNumber++;
    }
    
    isWhiteTurn = !isWhiteTurn;
  }
  
  return formattedMoves.join(' ');
}