# Inaccuracy Detection Issues Research

## Issues Identified

### 1. Spurious Inaccuracies: Identical Moves ("d4 best d4")

**Root Cause**: There is NO filter to check if the played move matches the best move.

**Location**: `game-analysis-logic.ts`, lines 91-116

The current logic:
1. Calculates WPL (Win Probability Loss) by comparing pre-move evaluation to post-move evaluation
2. Classifies based solely on WPL thresholds (≥0.09 for inaccuracy)
3. Only overrides for book moves

**Problem**: If a player plays the best move (e.g., `d4`) but the evaluation changes slightly due to depth/timing differences between analyses, it can trigger a false positive. For example:
- Pre-move: Best is `d4`, eval = +75 centipawns
- Player plays `d4`
- Post-move: eval = +16 centipawns (analyzed at different depth/time)
- WPL calculated = 0.09+, classified as inaccuracy
- Display shows: "d4 best d4" with 0.75→0.16 eval change

**Why This Happens**: The re-analysis of the same position after playing `d4` might return a slightly different evaluation due to:
- Different search depth
- Time constraints
- Hash table state
- Search tree variations

**Update (2026-02-14)**:
The initial fix failed because `bestMove` strings from the engine often include move numbers (e.g., "1.d4" or "2...Nf6"), while the played move is just the SAN string ("d4", "Nf6"). Direct string equality failed (`"d4" !== "1.d4"`). The fix requires stripping move numbers and dots before comparison.

### 2. Spurious Inaccuracies: Opposite Moves ("e4 best Nf3")

**Root Cause**: Same as above - no validation that the move actually worsened the position relative to alternatives.

**Location**: Same - `game-analysis-logic.ts`, classification logic

The current logic treats ANY centipawn change/WPL above threshold as an inaccuracy, even when:
- The played move is perfectly reasonable
- The "best move" is only marginally better
- Both moves maintain a similar evaluation

**Example Scenario**:
- Position eval before move: +0.75 (best move is Nf3)
- Player plays e4
- Position eval after e4: +0.16
- WPL = 0.09+, flagged as inaccuracy
- But: Both moves might be perfectly fine, and the eval difference might be noise

### 3. Analysis Stopping After Move 14 - RESOLVED

**Test Case PGN**:
```
1. e4 c5 2. Be2 Nc6 3. d3 Nf6 4. f4 d6 5. Nf3 g6 6. O-O Bg7 7. c3 O-O 
8. Qe1 c4 9. e5 Nh5 10. d4 dxe5 11. fxe5 Qd5 12. Nbd2 Bg4 13. Bxc4 Qd8 
14. Qh4 Bf5 15. g4 b5 16. Bxb5 Nxe5 17. gxf5 Nxf3+ 18. Nxf3 Qd5 19. Bd3 
Rac8 20. fxg6 hxg6 21. Be4 Qd6 22. Be3 e6 23. Rae1 Qb6 24. Qf2 f5
```

**Resolution**: This was NOT a bug. Through diagnostic logging we confirmed:
- All 48 plies (24 full moves) were analyzed ✓
- All 48 display items were generated ✓
- All 48 items were rendered to the UI ✓
- Only 11 moves had classifications other than 'none' ✓
- All 11 flagged moves genuinely occurred in moves 1-14

**Why no inaccuracies after move 14?**

Likely due to the position being heavily one-sided after White's advantage reached +6.54 at move 14...Bf5. 

**Empirical Data from Console Analysis**:
```
Highest centipawn losses in moves 15-24:
- 15...b5: 112cp loss, WPL=0.063 (below 0.09 threshold)
- 24.Qf2: 103cp loss, WPL=0.038 (below 0.09 threshold)
- 23...Qb6: 85cp loss, WPL=0.031 (below 0.09 threshold)

All other moves: 6-79cp losses with WPL < 0.04
```

**Root Cause**: WPL (Win Probability Loss) doesn't work well in heavily imbalanced positions. When the evaluation is already +6.54 (win probability ≈100%), a 100cp loss barely changes win probability, resulting in low WPL that doesn't trigger the 0.09 threshold.

**Possible explanations**:

1. **WPL limitation in one-sided games** - The main issue (confirmed by data)
2. **Moves were genuinely good** - Relative to the losing position, playing optimally
3. **Dead Lost Threshold** - Hurdle saving logic (lines 267-292 in GameAnalysis.tsx) skips positions with eval < -5.0 (not applicable here, as White was winning)

**Recommendation**: Consider adding position-based threshold adjustment or hybrid CP+WPL thresholds for heavily imbalanced positions (eval > ±4.0).

1. **Last Move Issue** (line 117-120 in `game-analysis-logic.ts`):
   ```typescript
   if (postMoveResult) {
     // ... classification logic
   } else {
     // Last move logic or missing data
     item.classification = 'none';
   }
   ```
   The last move in the analyzed sequence won't have a post-move evaluation, so it gets `classification = 'none'`.

2. **Display Filtering** (line 450-453 in `GameAnalysis.tsx`):
   ```typescript
   const filteredCount = structuredAnalysis.filter(item => {
     if (item.classification === 'none' || item.classification === 'good') return false;
     return true;
   }).length;
   ```
   Only moves with classifications other than 'none' or 'good' are counted/displayed.

3. **Possible Analysis Scope Issues**:
   - Check `maxMovesToAnalyze` prop
   - Check if there's an implicit cutoff in the analysis engine
   - Verify the game actually has moves after move 14

## Recommended Fixes

### Fix #1: Filter Identical Moves

Add a check in `game-analysis-logic.ts` (around line 100) to skip classification when the played move matches the best move:

```typescript
// Before classification
if (move.toLowerCase() === result.bestMove.toLowerCase()) {
  item.classification = 'none';
  continue; // or skip the classification logic
}
```

**Caveat**: Need to ensure move formats are comparable (SAN vs UCI vs algebraic).

### Fix #2: Minimum Evaluation Threshold

Only flag inaccuracies when:
1. WPL >= threshold, AND
2. The position is not already heavily losing/winning (to avoid noise)

Example logic:
```typescript
// Skip if position is already heavily winning/losing (eval magnitude > 3.0)
const NOISE_THRESHOLD = 300; // 3.0 pawns
if (Math.abs(prevEval) > NOISE_THRESHOLD) {
  // Position is already decided, small changes don't matter
  item.classification = 'none';
}
```

**Note**: This already exists partially via "Dead Lost Threshold" in `GameAnalysis.tsx` lines 267-292, but it only applies to hurdle saving, not classification.

### Fix #3: Minimum Centipawn Loss for Inaccuracies

Add an absolute threshold for inaccuracies (not just WPL). For example:
- Inaccuracy: WPL >= 0.09 AND centipawn loss >= 20
- Mistake: WPL >= 0.18 AND centipawn loss >= 50
- Blunder: WPL >= 0.45 (always flag)

This prevents flagging tiny evaluation fluctuations as inaccuracies.

### Fix #4: Investigate Move 14 Cutoff

**Next Steps**:
1. Check the actual game history to see if there are moves after 14
2. Add logging to see how many positions are being analyzed
3. Verify `maxMovesToAnalyze` is not artificially limiting the analysis
4. Check if there's an issue with the analysis engine stopping early

## Files to Modify

1. **`src/lib/game-analysis-logic.ts`** - Core classification logic
2. **`src/lib/evaluation-metrics.ts`** - May need to adjust WPL thresholds or add combined thresholds
3. **`src/lib/chess-constants.ts`** - Add new threshold constants
4. **Tests**: `src/lib/game-analysis-logic.test.ts` - Add test cases for edge cases

## Book Move Filtering Analysis

### Current Implementation

The book move filtering logic is in two places:

1. **`GameAnalysis.tsx` (lines 189-211)**: Checks moves against opening book service
2. **`game-analysis-logic.ts` (lines 104-108)**: Overrides classification to 'none' for book moves

### How It Works

Despite the "backwards analysis" (analyzing latest moves first for cache efficiency), the book check correctly identifies opening moves:

1. Analysis runs backwards: `targetMoves = allMoves.slice(-selectionSize).reverse()`
2. **Results reversed to chronological**: `displayMoves = [...displayMovesRef.current].reverse()` (line 179)
3. Book check on chronological moves: `displayMoves.slice(0, limit)` (line 195)

So `limit = 12` correctly checks the first 12 moves of the actual game, not the last 12 analyzed.

### Current Limitations

1. **Only 12 moves checked** - Comment says "to keep API calls reasonable"
2. **Only overrides 'inaccuracy' and 'mistake'** - Blunders still flagged even if book
3. **Async timing** - Brief moment where inaccuracies show before override applies

### Recommendation: Increase to 21 Moves (User Only)

**Current Behavior**: Checks both user AND engine moves against book (wasteful)

**Proposed Change**: 
- Check first 21 **user moves only** (not engine moves)
- Pass `playerSide` prop to `GameAnalysis` component
- Filter book checks: `if (isWhiteMove === (playerSide === 'w'))`

**Rationale**:
- Modern opening theory extends 15-20 moves in popular lines
- User moves are what matter for learning/training
- Engine move false positives are noise (nobody cares if Stockfish's e4 is "flagged")
- Checking user's plies only: 21 API calls (vs 42 if checking both sides)
- Catches more legitimate user book moves that would otherwise be spuriously flagged
- Reduces false positives in sharp theoretical lines

**Trade-off**: Engine book moves might get spuriously flagged, but this doesn't impact the user experience.

## Next Steps

1. Confirm these findings with Steve
2. Create implementation plan for fixes
3. Add unit tests for edge cases (identical moves, noise, etc.)
4. Test fixes against real game data
