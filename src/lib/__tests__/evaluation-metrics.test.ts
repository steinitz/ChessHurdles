import { describe, it, expect } from 'vitest';
import { computeCentipawnChange, classifyCpLoss, classifyWPL, WPL_THRESHOLDS } from '../evaluation-metrics';
import { CP_LOSS_THRESHOLDS } from '../chess-constants';

describe('evaluation-metrics', () => {
  describe('computeCentipawnChange', () => {
    it('computes loss for White moves (drop in White eval)', () => {
      // White had +250, after move eval is +80 → loss 170
      expect(computeCentipawnChange(250, 80, true)).toBe(170);
      // No loss when White improves
      expect(computeCentipawnChange(80, 250, true)).toBe(0);
    });

    it('computes loss for Black moves (increase in White eval)', () => {
      // Before Black move White eval +50, after +420 → Black lost 370
      expect(computeCentipawnChange(50, 420, false)).toBe(370);
      // No loss when White eval decreases on Black move
      expect(computeCentipawnChange(300, 100, false)).toBe(0);
    });
  });

  describe('classifyCpLoss', () => {
    it('returns none for small changes', () => {
      expect(classifyCpLoss(0)).toBe('none');
      expect(classifyCpLoss(CP_LOSS_THRESHOLDS.inaccuracy - 1)).toBe('none');
    });

    it('classifies inaccuracy, mistake, blunder at thresholds', () => {
      expect(classifyCpLoss(CP_LOSS_THRESHOLDS.inaccuracy)).toBe('inaccuracy');
      expect(classifyCpLoss(CP_LOSS_THRESHOLDS.mistake)).toBe('mistake');
      expect(classifyCpLoss(CP_LOSS_THRESHOLDS.blunder)).toBe('blunder');
    });

    it('classifies values in ranges correctly', () => {
      expect(classifyCpLoss(100)).toBe('inaccuracy');
      expect(classifyCpLoss(200)).toBe('mistake');
      expect(classifyCpLoss(500)).toBe('blunder');
    });
  });

  describe('classifyWPL (New Lichess Thresholds)', () => {
    it('returns none for small WPL', () => {
      expect(classifyWPL(0)).toBe('none');
      expect(classifyWPL(0.05)).toBe('none'); // Below 0.09
      expect(classifyWPL(WPL_THRESHOLDS.inaccuracy - 0.001)).toBe('none');
    });

    it('classifies inaccuracy (> 0.09)', () => {
      expect(classifyWPL(WPL_THRESHOLDS.inaccuracy)).toBe('inaccuracy');
      expect(classifyWPL(0.10)).toBe('inaccuracy');
    });

    it('classifies mistake (> 0.18)', () => {
      expect(classifyWPL(WPL_THRESHOLDS.mistake)).toBe('mistake');
      expect(classifyWPL(0.20)).toBe('mistake');
    });

    it('classifies blunder (> 0.45)', () => {
      expect(classifyWPL(WPL_THRESHOLDS.blunder)).toBe('blunder');
      expect(classifyWPL(0.50)).toBe('blunder');
    });
  });
});