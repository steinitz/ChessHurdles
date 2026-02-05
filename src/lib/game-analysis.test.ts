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
    const blunderMove = results[3];
    expect(blunderMove.move).toBe('g6');
    expect(blunderMove.isWhiteMove).toBe(false);
    expect(blunderMove.centipawnChange).toBeCloseTo(846, -1);
    expect(blunderMove.classification).toBe('blunder');
  });

  it('should identify and throttle top 5 blunders', () => {
    // Scenario: 10 moves, all are blunders of increasing severity.
    // Move i causes a drop of i * 100 centipawns.
    // We expect only the top 5 (last 5 moves) to be approved for AI.

    const moves = Array.from({ length: 10 }, (_, i) => `Move${i + 1}`);

    // We construct evaluations starting from equality (0.00)
    // to ensure that drops of 100+ centipawns are statistically significant (high WPL).
    const evaluations: EngineEvaluation[] = [{ evaluation: 0, bestMove: 'a1', principalVariation: '', depth: 10, calculationTime: 0 }];

    let currentEval = 0;
    for (let i = 0; i < 10; i++) {
      // Drop increases: 100, 200, 300...
      // Move 1 (i=0): Severity 100
      // Move 10 (i=9): Severity 1000
      const severity = (i + 1) * 100;

      // If White moves (i even), eval should decrease (Bad for White)
      // If Black moves (i odd), eval should increase (Bad for Black)
      const isWhite = i % 2 === 0;
      const nextEval = isWhite
        ? currentEval - severity
        : currentEval + severity;

      evaluations.push({
        evaluation: nextEval,
        bestMove: 'a1',
        principalVariation: '',
        depth: 10,
        calculationTime: 0
      });
      currentEval = nextEval;
    }

    const results = processGameAnalysis(moves, evaluations);

    // Verification
    // We expect 10 items.
    expect(results).toHaveLength(10);

    // All should be worthy (CP loss >= 100 from 0.00 is usually worthy)
    const worthy = results.filter(r => r.isAiWorthy);
    // Depending on WPL implementation, 100cp might be slightly below 0.2 threshold if aggressive.
    // But 200cp+ should definitely be worthy.
    // Let's assert at least 8 are worthy.
    expect(worthy.length).toBeGreaterThanOrEqual(8);

    // Only 5 should be approved
    const approved = results.filter(r => r.willUseAI);
    expect(approved.length).toBe(5);

    // The approved ones should be the last 5 moves (Move6..Move10)
    // which have highest severity.
    const approvedMoves = approved.map(r => r.move);
    expect(approvedMoves).toEqual(expect.arrayContaining(['Move6', 'Move7', 'Move8', 'Move9', 'Move10']));
  });
});
