import { describe, it, expect } from 'vitest';
import { uciToAlgebraic, uciSequenceToAlgebraic, formatPrincipalVariation } from './chess-utils';

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

  describe('formatPrincipalVariation', () => {
    it('should format a principal variation string', () => {
      const pvString = 'e2e4 e7e5 g1f3 b8c6';
      const expected = 'e4 e5 Nf3 Nc6';
      expect(formatPrincipalVariation(pvString, startingFen)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(formatPrincipalVariation('', startingFen)).toBe('');
      expect(formatPrincipalVariation('   ', startingFen)).toBe('');
    });

    it('should handle single moves', () => {
      expect(formatPrincipalVariation('e2e4', startingFen)).toBe('e4');
    });
  });
});