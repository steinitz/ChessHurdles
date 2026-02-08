import { describe, it, expect } from 'vitest';
import { processGameAnalysis } from '../game-analysis-logic';
import { EngineEvaluation } from '../stockfish-engine';

describe('processGameAnalysis', () => {
  // Helper to create mock evaluations
  const mockEval = (score: number): EngineEvaluation => ({
    evaluation: score,
    bestMove: 'e2e4',
    principalVariation: 'e2e4 e7e5',
    depth: 20,
    calculationTime: 100
  });

  it('correctly attributes change to the move played', () => {
    // Timeline:
    // Start: +0.15 (Implicit)
    // Move 1 (White e4): Eval becomes +0.40. (White improved)
    // Move 2 (Black e5): Eval becomes +0.10. (Black equalized / White Advantage dropped)
    //   - For Black: Prev (+0.40) -> Post (+0.10).
    //   - computeCentipawnChange(0.40, 0.10, isWhite=false) -> max(0, 0.10 - 0.40) = 0.
    //     Wait. If Eval +0.40 -> +0.10.
    //     Black is happy. White lost advantage.
    //     If isWhiteMove=false: max(0, Post - Pre) = max(0, 0.1 - 0.4) = 0. Correct.

    // Let's try a mistake.
    // Start: +0.15
    // Move 1 (White f3): Eval becomes -1.0. (Bad move)
    //   - Prev (+0.15) -> Post (-1.0).
    //   - isWhiteMove=true.
    //   - max(0, 0.15 - (-1.0)) = 1.15 loss. Correct.
    // Move 2 (Black e5): Eval becomes -1.2. (Black improves slightly)
    //   - Prev (-1.0) -> Post (-1.2).
    //   - isWhiteMove=false.
    //   - max(0, -1.2 - (-1.0)) = max(0, -0.2) = 0.

    const moves = ['f3', 'e5'];
    const evals = [
      mockEval(-100), // After f3
      mockEval(-120)  // After e5
    ];

    const results = processGameAnalysis(moves, evals);

    expect(results).toHaveLength(2);

    // Item 0: 1. f3
    // Should compare Start(+15cp) vs Post(-100cp).
    // Loss ~115cp.
    const item0 = results[0];
    expect(item0.move).toBe('f3');
    expect(item0.centipawnChange).toBeGreaterThan(100);
    expect(item0.classification).not.toBe('none'); // Should be blunder/mistake

    // Item 1: 1... e5
    // Should compare Prev(-100cp) vs Post(-120cp).
    // isWhiteMove=false. max(0, Post - Pre) = max(0, -120 - (-100)) = 0.
    // Black improved for Black (White eval dropped).
    const item1 = results[1];
    expect(item1.move).toBe('e5');
    expect(item1.centipawnChange).toBe(0);
    expect(item1.classification).toBe('none');
  });

  it('handles Queen\'s Gambit scenario correctly', () => {
    // 1. d4 (+0.2) | 1... d5 (+0.1) | 2. c4 (+0.2)
    // Old bug: 2. c4 was judged by 2... evaluate change.
    // New logic: 2. c4 judged by d5 eval vs c4 eval.

    const moves = ['d4', 'd5', 'c4', 'dxc4'];
    const evals = [
      mockEval(20),  // After d4
      mockEval(10),  // After d5
      mockEval(20),  // After c4 (Back to +0.2)
      mockEval(15)   // After dxc4
    ];

    const results = processGameAnalysis(moves, evals);

    // 2. c4 is at index 2.
    // Prev (+10) -> Post (+20). White improved. Loss 0.
    expect(results[2].move).toBe('c4');
    expect(results[2].centipawnChange).toBe(0);
    expect(results[2].classification).toBe('none');
  });

  it('respects maxAiAnalysis limit with index-based uniqueness', () => {
    // Scenario: 
    // Index 0: White Blunder (-2.0)
    // Index 1: Black Blunder (+3.0)
    // Max AI = 1.
    // Should catch only the worst one (Index 1) and not double-count or mis-assign.

    const moves = ['e4', 'e5'];
    const evals = [
      mockEval(-200), // Index 0
      mockEval(300)   // Index 1
    ];

    // Process with Max=1
    const results = processGameAnalysis(moves, evals, 0.2, 1);

    // Count flagged items
    const aiCount = results.filter(r => r.willUseAI).length;

    // Expect exactly 1 item to be flagged
    expect(aiCount).toBe(1);

    // Expect the worst blunder (Index 1, +5.0 swing vs -2.15 swing) to be flagged
    expect(results[0].willUseAI).toBe(false);
    expect(results[1].willUseAI).toBe(true);
  });
});
