import { describe, it, expect } from 'vitest';
import { calculateNewElo, getWinProbability, eloToStockfishLevel, stockfishLevelToElo } from './elo-utils';

describe('Elo Utils', () => {
  describe('getWinProbability', () => {
    it('should return 0.5 for equal ratings', () => {
      expect(getWinProbability(1200, 1200)).toBe(0.5);
    });

    it('should return > 0.5 for higher rating', () => {
      expect(getWinProbability(1300, 1200)).toBeGreaterThan(0.5);
    });

    it('should return < 0.5 for lower rating', () => {
      expect(getWinProbability(1100, 1200)).toBeLessThan(0.5);
    });

    it('should return approx 0.76 for +200 rating diff', () => {
      expect(getWinProbability(1400, 1200)).toBeCloseTo(0.759, 2);
    });
  });

  describe('calculateNewElo', () => {
    it('should not change rating on draw with equal ratings', () => {
      expect(calculateNewElo(1200, 1200, 0.5)).toBe(1200);
    });

    it('should increase rating on win with equal ratings', () => {
      // Expected = 0.5. Actual = 1.0. Delta = 0.5 * 40 = 20. New = 1220.
      expect(calculateNewElo(1200, 1200, 1)).toBe(1220);
    });

    it('should decrease rating on loss with equal ratings', () => {
      // Expected = 0.5. Actual = 0.0. Delta = -0.5 * 40 = -20. New = 1180.
      expect(calculateNewElo(1200, 1200, 0)).toBe(1180);
    });

    it('should increase less for winning against lower rated opponent', () => {
      const winEqual = calculateNewElo(1200, 1200, 1);
      const winLower = calculateNewElo(1200, 1000, 1);
      expect(winLower - 1200).toBeLessThan(winEqual - 1200);
    });
  });

  describe('Stockfish Level Mapping', () => {
    it('should map 800 Elo to Level 0', () => {
      expect(eloToStockfishLevel(800)).toBe(0);
    });

    it('should map 3000 Elo to Level 20', () => {
      expect(eloToStockfishLevel(3000)).toBe(20);
    });

    it('should clamp values below 800', () => {
      expect(eloToStockfishLevel(600)).toBe(0);
    });

    it('should round trip reasonably well', () => {
      const level = 10;
      const elo = stockfishLevelToElo(level); // 1900
      const mappedLevel = eloToStockfishLevel(elo);
      expect(mappedLevel).toBe(level);
    });
  });
});
