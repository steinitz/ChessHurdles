# Engine Move Failure Bug - Research

## Problem Statement

Game freezes mid-play when engine attempts to make a move. Error occurs consistently across multiple games on iPad Safari connecting to dev server.

## Error Trail (Three Iterations)

### Error #1: Initial Report
```
Engine played: a8d8
Failed to apply engine move: a8 d8 Error {  }
```
- User confirmed `a8d8` (Rad8) was **legal** - intended move to open d-file
- Pointed to state desynchronization issue

### Error #2: After Initial Defensive Fix
```
Playing Book Move: e8h8
❌ Exception applying engine move: e8 h8 Error {  }
Current FEN: r1bqk2r/pp1pppbp/2n2np1/2p5/4PP2/3P1N2/PPP1B1PP/RNBQ1RK1 b kq - 3 6
```
- Castling failed! 
- `e8h8` is UCI notation (king-to-rook)
- chess.js expects `e8g8` (king-to-destination)

### Error #3: After Castling Fix
```
Playing Book Move: d7d6
Out of Book
Engine played: d6d5
❌ Exception applying engine move: d6 d5 Error {  }
Current FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
Current turn: w
Move history: Array []
```
- **Smoking gun**: FEN shows starting position when game is mid-progress
- Definitive proof of stale closure bug

## Root Cause Analysis

### Bug #1: UCI Castling Notation Mismatch

**Opening book** uses UCI standard (king-to-rook):
- `e8h8` (Black kingside), `e8a8` (Black queenside)
- `e1h1` (White kingside), `e1a1` (White queenside)

**chess.js** expects human notation (king-to-destination):
- `e8g8` (Black kingside), `e8c8` (Black queenside)
- `e1g1` (White kingside), `e1c1` (White queenside)

**Why UCI uses king-to-rook**: Universal, unambiguous, used by all major engines. chess.js is the outlier.

**Verification** (Node.js test):
```javascript
game.move({ from: 'e8', to: 'h8' });  // ❌ "Invalid move"
game.move({ from: 'e8', to: 'g8' });  // ✓ Success
```

### Bug #2: Stale Closure in onEngineMove

**The Problem**:
1. `onEngineMove` callback included `game` in dependency array
2. Book moves update `game` state rapidly
3. React batches updates → callback recreation lags behind
4. Engine fires with stale `game` instance from several moves ago
5. Legal move fails because applied to wrong board state

**Evidence**: Error log shows starting position FEN when game is 6+ moves in.

**Why it manifested**:
- Book moves worked by timing luck
- Castling or out-of-book moves triggered race condition
- Rapid sequences exposed the stale closure

## Implemented Solution

### Fix #1: Castling Notation Converter (`useStockfishEngine.ts`)

```typescript
let from = bookMoveUci.substring(0, 2);
let to = bookMoveUci.substring(2, 4);

// Convert UCI → chess.js for castling
if (from === 'e8' && to === 'h8') to = 'g8';      // Black kingside
else if (from === 'e8' && to === 'a8') to = 'c8'; // Black queenside
else if (from === 'e1' && to === 'h1') to = 'g1'; // White kingside  
else if (from === 'e1' && to === 'a1') to = 'c1'; // White queenside

onMove({ from, to, promotion });
```

### Fix #2: Game State Ref (`PlayVsEngine.tsx`)

```typescript
// Always access latest state via ref
const gameRef = useRef(game);
useEffect(() => {
  gameRef.current = game;
}, [game]);

const onEngineMove = useCallback(({ from, to, promotion }) => {
  // Use gameRef.current, NOT closure 'game'
  const next = cloneGame(gameRef.current);
  const moveResult = next.move({ from, to, ...(promotion && { promotion }) });
  
  if (!moveResult) {
    console.error('❌ Engine move rejected');
    console.error('FEN:', gameRef.current.fen());
    console.error('Legal:', gameRef.current.moves());
    return; // Graceful exit
  }
  
  setGame(next);
}, [userSide, addIncrement, gameResult, pauseAfterEngineMove]); // 'game' removed!
```

**Key changes**:
1. `gameRef.current` always has latest state
2. Removed `game` from dependency array
3. Safe error logging with try-catch wrappers

## Testing Results

✓ **Success**: Full game completed without freezes
- Castling executed correctly
- Rapid book sequences handled
- State stayed synchronized
- User lost on time, but game ran smoothly!

## Lessons Learned

**Technical**:
1. UCI is universal standard - opening books, engines, databases all use it
2. React closures are subtle - useCallback can capture stale state during rapid updates
3. Refs solve closure issues - useRef + useEffect keeps callbacks fresh
4. Defensive logging is crucial - wrap diagnostics in try-catch

**Debugging**:
- Comprehensive logging revealed stale state
- Node.js testing isolated castling notation
- Iterative fixes uncovered second bug
- Each error provided more clues
