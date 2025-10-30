import { describe, it, expect } from 'vitest';
import { uciToAlgebraic, uciSequenceToAlgebraic, formatPrincipalVariation, formatMoveWithNumber } from './chess-utils';

describe('chess-utils', () => {
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  describe('uciToAlgebraic', () => {
    it('should convert basic pawn moves', () => {
      expect(uciToAlgebraic('e2e4', startingFen)).toBe('e4');
      expect(uciToAlgebraic('d2d4', startingFen)).toBe('d4');
    });

    it('should convert knight moves', () => {
      expect(uciToAlgebraic('g1f3', startingFen)).toBe('Nf3');
      expect(uciToAlgebraic('b1c3', startingFen)).toBe('Nc3');
    });

    it('should convert bishop moves after pawn moves', () => {
      // After e4, bishop can move
      const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(uciToAlgebraic('f1c4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')).toBe('Bc4');
    });

    // Note: Promotion moves can be added later if needed
    // The basic functionality works for standard moves

    it('should return UCI move as fallback for invalid moves', () => {
      // After our recent changes, invalid moves should return the UCI move as fallback
      expect(uciToAlgebraic('e2e5', startingFen)).toBe('e2e5'); // Invalid pawn jump returns UCI
      expect(uciToAlgebraic('b7d7', startingFen)).toBe('b7d7'); // Invalid move returns UCI
      expect(uciToAlgebraic('invalid', startingFen)).toBe('invalid'); // Invalid format returns UCI
      expect(uciToAlgebraic('', startingFen)).toBe(''); // Empty string returns empty
    });

    it('should handle edge cases from engine analysis', () => {
      // Test cases based on the actual errors we encountered
      const testCases = [
        { uci: 'b7d7', fen: startingFen, expected: 'b7d7' }, // Invalid bishop move from starting position
        { uci: 'b2h8', fen: startingFen, expected: 'b2h8' }, // Invalid pawn diagonal move
        { uci: 'a4f4', fen: startingFen, expected: 'a4f4' }, // Invalid move from empty square
        { uci: 'e7e6', fen: startingFen, expected: 'e7e6' }, // Invalid from starting position (white to move)
        { uci: 'e7e5', fen: startingFen, expected: 'e7e5' }, // Invalid from starting position (white to move)
      ];

      testCases.forEach(({ uci, fen, expected }) => {
        const result = uciToAlgebraic(uci, fen);
        // For moves that should be valid in the right context, we expect either algebraic or UCI fallback
        expect(result).toBe(expected);
      });
    });
  });

  describe('uciSequenceToAlgebraic', () => {
    it('should handle the failing sequence from game analysis', () => {
      // This is the exact failing case from the browser console
      const startingFen = '3r3r/Rb3p1p/p4np1/1p1q4/kP6/P1Q2PPB/2P4P/1K6 w - - 2 30';
      const pvSequence = 'c3f6 a8c6 e7f7 c6b7';
      
      // This should not throw an error, but should handle the invalid move gracefully
      const result = uciSequenceToAlgebraic(pvSequence, startingFen);
      
      // The result should be an array containing the first valid move
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe('Qxf6'); // First move should work
    });
  });

  describe('uciSequenceToAlgebraic', () => {
    it('should convert a sequence of moves', () => {
      const uciMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
      const expected = ['e4', 'e5', 'Nf3', 'Nc6'];
      expect(uciSequenceToAlgebraic(uciMoves, startingFen)).toEqual(expected);
    });

    it('should handle space-separated string input', () => {
      const uciString = 'e2e4 e7e5 g1f3 b8c6';
      const expected = ['e4', 'e5', 'Nf3', 'Nc6'];
      expect(uciSequenceToAlgebraic(uciString, startingFen)).toEqual(expected);
    });

    it('should stop at invalid moves and return partial results', () => {
      const uciMoves = ['e2e4', 'invalid', 'g1f3'];
      const expected = ['e4', 'invalid']; // Now includes UCI fallback for invalid moves
      expect(uciSequenceToAlgebraic(uciMoves, startingFen)).toEqual(expected);
    });

    it('should handle sequences with context-dependent invalid moves', () => {
      // Test sequence where moves become invalid due to wrong position context
      const uciMoves = ['e2e4', 'b7d7']; // Second move invalid from starting position
      const result = uciSequenceToAlgebraic(uciMoves, startingFen);
      expect(result).toEqual(['e4', 'b7d7']); // Now includes UCI fallback for invalid moves
    });
  });

  describe('formatMoveWithNumber', () => {
    it('should format white moves with move number', () => {
      expect(formatMoveWithNumber('e4', startingFen)).toBe('1.e4');
    });

    it('should format black moves with ellipsis', () => {
      const blackToMoveFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(formatMoveWithNumber('e5', blackToMoveFen)).toBe('1...e5');
    });

    it('should handle different move numbers', () => {
      const midGameFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
      expect(formatMoveWithNumber('Bb5', midGameFen)).toBe('3.Bb5');
    });
  });

  describe('formatPrincipalVariation', () => {
    it('should format a principal variation string with move numbers', () => {
      const pvString = 'e2e4 e7e5 g1f3 b8c6';
      const expected = '1.e4 e5 2.Nf3 Nc6';
      expect(formatPrincipalVariation(pvString, startingFen)).toBe(expected);
    });

    it('should handle variations starting with black moves', () => {
      const blackToMoveFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const pvString = 'e7e5 g1f3 b8c6';
      const expected = '1...e5 2.Nf3 Nc6';
      expect(formatPrincipalVariation(pvString, blackToMoveFen)).toBe(expected);
    });

    it('should handle empty or invalid principal variations gracefully', () => {
      expect(formatPrincipalVariation('', startingFen)).toBe('');
      expect(formatPrincipalVariation('   ', startingFen)).toBe('');
      // "invalid moves" gets split into ["invalid", "moves"], but only first is processed
      expect(formatPrincipalVariation('invalid moves', startingFen)).toBe('1.invalid');
    });

    it('should handle principal variations with invalid UCI moves', () => {
      // This tests the scenario we encountered where engine returns invalid moves
      const pv = 'e2e4 b7d7 g1f3'; // Contains invalid move
      const result = formatPrincipalVariation(pv, startingFen);
      // Now includes UCI fallback for invalid moves
      expect(result).toBe('1.e4 b7d7');
    });

    it('should handle single moves', () => {
       expect(formatPrincipalVariation('e2e4', startingFen)).toBe('1.e4');
     });
   });

  describe('FEN mismatch scenarios', () => {
    it('should fail to convert UCI move when using wrong FEN', () => {
      // Simulate the Stockfish engine scenario:
      // Stockfish analyzes a position after some moves, but we try to convert
      // the UCI move using the starting position FEN
      
      // Position after 1.e4 e5 - now the white bishop can move to c4
      const actualPosition = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
      
      // A move that's valid in the actual position: bishop to c4
      const validUciMove = 'f1c4'; // Bishop moves to c4
      
      // This should work with the correct FEN
      expect(uciToAlgebraic(validUciMove, actualPosition)).toBe('Bc4');
      
      // But should return UCI fallback with the starting position FEN (the bug scenario)
      expect(uciToAlgebraic(validUciMove, startingFen)).toBe('f1c4');
    });

    it('should demonstrate the b3a5 scenario from our logs', () => {
      // Create a position where b3a5 would be a valid move
      // This requires a knight on b3 that can move to a5
      const positionWithKnightOnB3 = 'rnbqkbnr/pppppppp/8/8/8/1N6/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
      
      // This move should work in the correct position
      expect(uciToAlgebraic('b3a5', positionWithKnightOnB3)).toBe('Na5');
      
      // But return UCI fallback in the starting position (our bug scenario)
      expect(uciToAlgebraic('b3a5', startingFen)).toBe('b3a5');
    });
  });
});