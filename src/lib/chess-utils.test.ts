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

    it('should return null for invalid moves', () => {
      expect(uciToAlgebraic('e2e5', startingFen)).toBe(null); // Invalid pawn jump
      expect(uciToAlgebraic('invalid', startingFen)).toBe(null);
      expect(uciToAlgebraic('', startingFen)).toBe(null);
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

    it('should stop at invalid moves', () => {
      const uciMoves = ['e2e4', 'invalid', 'g1f3'];
      const expected = ['e4']; // Should stop at invalid move
      expect(uciSequenceToAlgebraic(uciMoves, startingFen)).toEqual(expected);
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

    it('should handle empty strings', () => {
      expect(formatPrincipalVariation('', startingFen)).toBe('');
      expect(formatPrincipalVariation('   ', startingFen)).toBe('');
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
      
      // But should fail with the starting position FEN (the bug scenario)
      expect(uciToAlgebraic(validUciMove, startingFen)).toBe(null);
    });

    it('should demonstrate the b3a5 scenario from our logs', () => {
      // Create a position where b3a5 would be a valid move
      // This requires a knight on b3 that can move to a5
      const positionWithKnightOnB3 = 'rnbqkbnr/pppppppp/8/8/8/1N6/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
      
      // This move should work in the correct position
      expect(uciToAlgebraic('b3a5', positionWithKnightOnB3)).toBe('Na5');
      
      // But fail in the starting position (our bug scenario)
      expect(uciToAlgebraic('b3a5', startingFen)).toBe(null);
    });
  });
});