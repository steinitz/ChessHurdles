# Session Context: AI Throttling & Pre-Deployment

**Date**: 2026-02-04
**Status**: Environment Architecture Refactored & Verified.

## Current State
- **Environment**: Refactored to "Local Wrapper" pattern (`src/lib/env.app.ts`). Upstream `stzUser` is generic.
- **Testing**: `chess-hurdles-pricing.spec.ts` passes (Credit deduction verification).
- **Codebase**: Clean. Verbose comments removed from `GameAnalysis.tsx`.

## Next Objective: Dynamic AI Severity Throttling
**Goal**: Limit AI analysis to the top **N** (default 5) most severe blunders per game to control costs/credits.

### Implementation Draft
1.  **Configuration**: Add `MAX_AI_ANALYSIS_PER_GAME = 5` to `chess-config.ts` (or `env.app.ts`).
2.  **Logic (`GameAnalysis.tsx`)**:
    - Identify ALL moves where `isAiWorthy = true` (WPL > Threshold). // Eligible
    - Sort these candidates by Severity (WPL descending).
    - Take top `MAX` candidates -> Mark `willUseAI = true`. // Throttled
    - Remaining candidates -> Mark `willUseAI = false` (Silent Hurdles).
3.  **UI**:
    - Ideally indicate "Top 5 Blunders Analyzed" to user.
4.  **Testing**:
    - Create a test case (FEN sequence) with > 5 blunders.
    - Verify only 5 deductions occur.

## Action Items for User
- [ ] Commit `reference/Upstream` (`git commit -am "Feat: Extensible Env Architecture"`).
- [ ] Commit `ChessHurdles` (`git commit -am "Refactor: Use Extensible Env Architecture"`).
- [ ] Good luck in the Championship! 🏆
