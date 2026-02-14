# Inaccuracy Detection Fixes - Implementation Plan

## Current Status Summary

- **[VERIFIED]** 1. Filter Identical Moves - Implemented and tested (robust regex).
- **[IMPLEMENTED]** 2. Optimize Book Checks - Code complete, pending verification.
- **[PENDING]** 3. Minimum Centipawn Threshold - Optional improvement.
- **[DONE]** 4. Cleanup Diagnostic Logging - Completed.

---

## Priority Fixes

### 1. [VERIFIED] Filter Identical Moves (High Priority)

**Problem**: Moves like "d4 best d4" and "O-O best O-O" are flagged as inaccuracies due to evaluation noise between analyses.

**Solution**: Added logic to skip classification when played move matches best move.

**Location**: `src/lib/game-analysis-logic.ts`

**Implementation Details**:
Strips leading move numbers (e.g., "1.", "1...") using regex `^\d+\.+` before comparison to allow matching "d4" against "1.d4".

---

### 2. [IMPLEMENTED] Optimize Book Checks (Medium Priority)

**Problem**: Currently checking both sides' moves against book (wasteful API calls).

**Solution**: 
- Check first 21 user plies only (not engine moves)
- Passed `playerSide` to `GameAnalysis` component
- Filtered book checks by player side

**Status**: Implemented in `GameAnalysis.tsx` and `ChessGame.tsx`. Awaiting verification.

---

## Optional Improvements

### 3. [PENDING] Minimum Centipawn Threshold (Low Priority)

**Problem**: Tiny evaluation fluctuations (10-20cp) can trigger inaccuracies if WPL crosses threshold.

**Solution**: Require minimum centipawn loss (e.g., 20-30cp) for inaccuracies.

---

## Cleanup

### 4. [DONE] Remove Diagnostic Logging

**Action**: Removed all diagnostic `console.log` statements from:
- `game-analysis-logic.ts`
- `analysis-formatter.ts`
- `GameAnalysis.tsx`

---

## Verification Plan

1. **Fix #1**: Verified with PGN from research.md - "c3 best c3" is no longer flagged.
2. **Fix #2**: Need to verify that engine moves are not triggering book check API calls and that user moves are still overridden up to ply 21.
3. **Manual Check**: Check browser console for stray logs.
