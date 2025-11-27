import { describe, it, expect } from 'vitest';
import { processGameAnalysis } from './game-analysis-logic';
import { EngineEvaluation } from './stockfish-engine';

describe('processGameAnalysis', () => {
  it('should correctly identify a blunder', () => {
    // Test case from the "hanging rook" game
    // 1. e4 e5
    // 2. Qh5 g6 (Blunder!)
    // 3. Qxe5+ ...

    const moves = ['e4', 'e5', 'Qh5', 'g6', 'Qxe5+'];

    // Mock evaluations (White-normalized centipawns)
    // Sequence: Start -> e4 -> e5 -> Qh5 -> g6 (Blunder) -> Qxe5+
    // g6 Blunder: Eval swings from -39 (Black slight adv) to +807 (White winning)
    // Centipawn loss: 807 - (-39) = 846
    const evaluations: EngineEvaluation[] = [
      { evaluation: 30, bestMove: 'e4', principalVariation: '', depth: 10, calculationTime: 0 }, // Before e4
      { evaluation: 97, bestMove: 'Nf3', principalVariation: '', depth: 10, calculationTime: 0 }, // Before e5 (After e4)
      { evaluation: 21, bestMove: 'Nc6', principalVariation: '', depth: 10, calculationTime: 0 }, // Before Qh5 (After e5)
      { evaluation: -39, bestMove: 'Nf6', principalVariation: '', depth: 10, calculationTime: 0 }, // Before g6 (After Qh5)
      { evaluation: 807, bestMove: 'Qxe5+', principalVariation: '', depth: 10, calculationTime: 0 }, // Before Qxe5+ (After g6)
    ];

    const results = processGameAnalysis(moves, evaluations);

    // Check Move 3 (g6) - Index 3
    // Move 1: e4
    // Move 2: e5
    // Move 3: Qh5
    // Move 4: g6

    const blunderMove = results[3];
    expect(blunderMove.move).toBe('g6');
    expect(blunderMove.isWhiteMove).toBe(false);
    expect(blunderMove.centipawnChange).toBeCloseTo(846, -1); // 8.07 - (-0.39) = 8.46 -> 846 cp
    expect(blunderMove.classification).toBe('blunder');
  });
});
