import { describe, it, expect } from 'vitest';
import { processGameAnalysis } from './game-analysis-logic';
import { EngineEvaluation } from './stockfish-engine';

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
        // Sequence: Start (15) -> f3 (-100) -> e5 (-120)
        const moves = ['f3', 'e5'];
        const evals = [
            mockEval(15),   // Before f3 (Start)
            mockEval(-100), // After f3 / Before e5
            mockEval(-120)  // After e5
        ];

        const results = processGameAnalysis(moves, evals);

        expect(results).toHaveLength(2);

        // Item 0: 1. f3
        // isWhiteMove=true. Prev(15) -> Post(-100). Loss = 15 - (-100) = 115.
        const item0 = results[0];
        expect(item0.move).toBe('f3');
        expect(item0.centipawnChange).toBe(115);
        expect(item0.classification).not.toBe('none');

        // Item 1: 1... e5
        // isWhiteMove=false. Prev(-100) -> Post(-120). 
        // White eval dropped from -1.0 to -1.2. Black improved. Loss = max(0, -120 - (-100)) = 0.
        const item1 = results[1];
        expect(item1.move).toBe('e5');
        expect(item1.centipawnChange).toBe(0);
        expect(item1.classification).toBe('none');
    });

    it('handles Queen\'s Gambit scenario correctly', () => {
        // 1. d4 (+0.2) | 1... d5 (+0.1) | 2. c4 (+0.2)
        const moves = ['d4', 'd5', 'c4', 'dxc4'];
        const evals = [
            mockEval(15),  // Start
            mockEval(20),  // After d4
            mockEval(10),  // After d5 / Before c4
            mockEval(20),  // After c4
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
        // Scenario: 2 blunders. Limit to 1.
        const moves = ['e4', 'e5'];
        const evals = [
            mockEval(15),   // Start
            mockEval(-200), // After e4 (Severe blunder by White)
            mockEval(300)   // After e5 (Severe blunder by Black)
        ];

        // e4 loss = 15 - (-200) = 215.
        // e5 loss = 300 - (-200) = 500. (More severe)

        const results = processGameAnalysis(moves, evals, 0.2, 1);
        const aiCount = results.filter(r => r.willUseAI).length;

        expect(aiCount).toBe(1);
        expect(results[0].willUseAI).toBe(false);
        expect(results[1].willUseAI).toBe(true);
    });

    it('overrides classification for opening book moves', () => {
        const moves = ['d4'];
        const evals = [
            mockEval(15),  // Start
            mockEval(-200), // Severe blunder mock
        ];

        // Without book override
        const resultsNoBook = processGameAnalysis(moves, evals);
        expect(['blunder', 'mistake', 'inaccuracy']).toContain(resultsNoBook[0].classification);

        // With book override
        const bookIndices = new Set([0]);
        const resultsWithBook = processGameAnalysis(moves, evals, 0.2, 5, 1, true, bookIndices);

        expect(resultsWithBook[0].classification).toBe('none');
        expect(resultsWithBook[0].isBookMove).toBe(true);
    });

    it('correctly calculates absoluteMoveIndex', () => {
        const moves = ['Nf3', 'd5'];
        const evals = [
            mockEval(15),
            mockEval(25), // After Nf3
            mockEval(20), // After d5
        ];

        // If we are analyzing starting from move 3 (ply index 4)
        const results = processGameAnalysis(moves, evals, 0.2, 5, 3, true, new Set(), 4);

        expect(results[0].absoluteMoveIndex).toBe(4);
        expect(results[1].absoluteMoveIndex).toBe(5);
    });

    it('identifies and throttles top blunders (from legacy test)', () => {
        const moves = Array.from({ length: 10 }, (_, i) => `Move${i + 1}`);
        const evaluations: EngineEvaluation[] = [mockEval(0)];

        let currentEval = 0;
        for (let i = 0; i < 10; i++) {
            const severity = (i + 1) * 100;
            const isWhite = i % 2 === 0;
            const nextEval = isWhite ? currentEval - severity : currentEval + severity;

            evaluations.push(mockEval(nextEval));
            currentEval = nextEval;
        }

        const results = processGameAnalysis(moves, evaluations);
        expect(results).toHaveLength(10);

        // Only 5 should be approved
        const approved = results.filter(r => r.willUseAI);
        expect(approved.length).toBe(5);

        // The approved ones should be the last 5 moves
        const approvedMoves = approved.map(r => r.move);
        expect(approvedMoves).toEqual(expect.arrayContaining(['Move6', 'Move7', 'Move8', 'Move9', 'Move10']));
    });
});
