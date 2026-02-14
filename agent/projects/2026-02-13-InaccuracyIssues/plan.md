# Inaccuracy Detection Fixes - Implementation Plan

## Priority Fixes

### 1. Filter Identical Moves (High Priority)

**Problem**: Moves like "d4 best d4" and "O-O best O-O" are flagged as inaccuracies due to evaluation noise between analyses.

**Solution**: Add logic to skip classification when played move matches best move.

**Location**: `src/lib/game-analysis-logic.ts`, lines 91-116

**Changes**:
```typescript
// After calculating WPL, before classification
if (postMoveResult) {
  const prevEval = result.evaluation;
  const currentEval = postMoveResult.evaluation;
  
  const cpChange = computeCentipawnChange(prevEval, currentEval, isWhiteMove);
  const wpl = calculateWPL(prevEval, currentEval, isWhiteMove);
  
  item.centipawnChange = cpChange;
  item.wpl = wpl;
  
  // NEW: Skip classification if played move matches best move
  // Note: 'bestMove' may include move numbers (e.g., "1.d4"), so we must strip them
  const playedMoveSan = move.trim().toLowerCase();
  // Strip move numbers (1., 2...), ellipses (...), and whitespace
  const bestMoveSan = result.bestMove.replace(/[\d\.]+/g, '').trim().toLowerCase();
  
  if (playedMoveSan === bestMoveSan) {
    // Identical move - evaluation noise, not a real inaccuracy
    item.classification = 'none';
  } else {
    // Existing classification logic
    item.classification = classifyWPL(wpl);
  }
  
  // Book move override continues as before...
```

**Testing**: Verify that "d4 best d4" and "O-O best O-O" no longer get flagged.

---

### 2. Optimize Book Checks (Medium Priority)

**Problem**: Currently checking both sides' moves against book (wasteful API calls).

**Solution**: 
- Check first 21 user plies only (not engine moves)
- Pass `playerSide` to `GameAnalysis` component
- Filter book checks by player side

**Locations**:
1. `src/components/ChessGame/ChessGame.tsx` - Pass `playerSide` prop
2. `src/components/ChessGame/Analysis/GameAnalysis.tsx` - Accept and use `playerSide`

**Changes**:

#### ChessGame.tsx (line ~404):
```typescript
<GameAnalysis
  gameMoves={gameMoves}
  goToMove={goToMove}
  onHurdleSaved={handleHurdleSaved}
  currentMoveIndex={currentMoveIndex}
  onAnalysisUpdate={handleAnalysisUpdate}
  playerSide={playerSide}  // NEW
/>
```

#### GameAnalysis.tsx Interface (line ~44):
```typescript
interface GameAnalysisProps {
  gameMoves: GameMove[];
  goToMove: (index: number) => void;
  maxMovesToAnalyze?: number;
  autoAnalyze?: boolean;
  onHurdleSaved?: () => void;
  currentMoveIndex?: number;
  onAnalysisUpdate?: (analysis: { moveIndex: number; classification: string }[]) => void;
  playerSide?: 'w' | 'b' | null;  // NEW
}
```

#### GameAnalysis.tsx Book Check Logic (lines 189-211):
```typescript
const bookIndices = new Set<number>();
// Check first 21 USER plies only (not engine moves)
const limit = Math.min(displayMoves.length, 21);

const checks = displayMoves.slice(0, limit)
  .map(async (moveSan, i) => {
    const position = displayPositions[i];
    if (!position) return;
    
    // NEW: Filter to only check user's moves
    const isWhiteMove = startWithWhite ? (i % 2 === 0) : (i % 2 !== 0);
    const isUserMove = playerSide ? (isWhiteMove === (playerSide === 'w')) : true;
    
    if (!isUserMove) return; // Skip engine moves
    
    // Rest of book check logic unchanged...
```

**Benefits**: Reduces API calls by ~50%, focuses on user-facing false positives.

---

## Optional Improvements

### 3. Minimum Centipawn Threshold (Low Priority)

**Problem**: Tiny evaluation fluctuations (10-20cp) can trigger inaccuracies if WPL crosses threshold.

**Solution**: Require minimum centipawn loss (e.g., 30cp) for inaccuracies.

**Location**: `src/lib/game-analysis-logic.ts`, classification logic

**Example**:
```typescript
// Hybrid threshold: WPL AND centipawn minimum
if (playedMoveSan !== bestMoveSan) {
  const baseClassification = classifyWPL(wpl);
  
  // Require minimum centipawn loss for inaccuracy/mistake
  if (baseClassification === 'inaccuracy' && cpChange < 30) {
    item.classification = 'none';
  } else if (baseClassification === 'mistake' && cpChange < 50) {
    item.classification = 'inaccuracy'; // Downgrade to inaccuracy
  } else {
    item.classification = baseClassification;
  }
}
```

**Trade-off**: May miss some genuine inaccuracies in quiet positions.

---

### 4. Remove Diagnostic Logging (Cleanup)

**Files with diagnostic console.log statements added during debugging**:
- `src/lib/game-analysis-logic.ts` (lines 147-161)
- `src/components/ChessGame/Analysis/analysis-formatter.ts` (lines 237-246)
- `src/components/ChessGame/Analysis/GameAnalysis.tsx` (lines 82-93, 229, 454-457)

**Action**: Remove or comment out these logs after fixes are verified.

---

## Testing Strategy

1. **Unit Tests**: Add test cases to `src/lib/game-analysis-logic.test.ts`
   - Identical move scenarios
   - Book move filtering with playerSide
   - Minimum centipawn threshold behavior

2. **Integration Test**: Use the PGN from research.md
   - Verify "c3 best c3" and "O-O best O-O" are no longer flagged
   - Verify book moves e4, c5, d3, Nf6, f4, d6, Bg7 are overridden

3. **Manual Verification**: Run analysis on a fresh game and confirm cleaner inaccuracy list

---

## Implementation Order

1. ✅ Fix #1 (Identical moves) - Highest impact, simplest fix
2. ✅ Fix #2 (Book optimization) - Good UX improvement, moderate complexity
3. ⚠️ Optional #3 (CP threshold) - Evaluate based on Fix #1 results
4. 🧹 Cleanup diagnostic logging
