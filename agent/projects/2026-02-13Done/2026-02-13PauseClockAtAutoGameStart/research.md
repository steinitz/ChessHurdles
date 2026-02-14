# Clock Auto-Start Issue - Research Findings

## Problem Description
When the user plays as Black and a new game starts, the user's clock begins counting down immediately, even before the user makes their first move. 

**Expected Behavior**: The user's clock should only start counting down after they make their reply move to the engine's opening move.

## Scenario
1. User selects to play as Black (or game auto-alternates to Black after previous game)
2. New game starts with empty board
3. Engine makes its first move (e4, for example) - takes 0-2 seconds with book delay
4. **BUG**: User's (Black's) clock starts counting down immediately
5. User thinks about their reply move
6. User makes their move
7. Engine's clock properly starts counting down on engine's turn

## Code Analysis

### Clock Logic - `useGameClock.ts`

Location: [`useGameClock.ts:42-81`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L42-L81)

**Key Logic**: The clock timer runs based on:
```tsx
if (game.isGameOver() || game.history().length === 0) {
  setLastTick(null);
  return;
}
```

**Finding**: The clock starts as soon as `game.history().length > 0`, which happens immediately after the engine makes its first move.

The timer decrements whoever's turn it is:
```tsx
if (game.turn() === 'w') {
  setWhiteTime(prev => { /* decrement */ });
} else {
  setBlackTime(prev => { /* decrement */ });
}
```

### Turn Detection

Location: [`useGameClock.ts:38-40`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L38-L40)

```tsx
// Reset lastTick on turn change to separate move times accurately
useEffect(() => {
  setLastTick(Date.now());
}, [game.turn()]);
```

**Finding**: Every time the turn changes, `lastTick` is reset to the current time. This is used to calculate the delta for decrementing the clock.

### Current Behavior Flow (User plays Black)

1. **Game starts**: `game.history().length === 0`, clock paused
2. **Engine makes first move (e4)**: 
   - `game.history().length` becomes 1
   - `game.turn()` changes to `'b'` (Black's turn)
   - Turn change effect sets `lastTick = Date.now()`
   - Timer effect now runs (history > 0)
   - Timer starts decrementing Black's time
3. **User makes reply move**:
   - Black's clock has already been counting down during thinking time
   - After move, `game.turn()` becomes `'w'`
   - White's (engine's) clock starts

### Root Cause

The clock starts counting down based solely on:
- Game has at least one move: `game.history().length > 0`
- Whose turn it is: `game.turn()`

There's **no tracking of whether the user has made their first move yet**. The clock starts immediately after the engine's first move, even though the user hasn't had a chance to move.

## Expected Behavior Analysis

In standard chess clock usage:
- **Physical chess clocks**: The clock for a side starts when their opponent completes a move and presses the clock
- **In our app for White**: User makes first move, clock pauses, engine responds, engine "presses clock", user's clock resumes
- **In our app for Black**: Engine makes first move, but since user hasn't started their clock yet, it shouldn't start until they make their first move

### The Issue with Current Implementation

The problem is that the clock doesn't distinguish between:
1. The very first move of the game (when user hasn't touched the clock yet)
2. All subsequent moves (when user has already started playing)

For a user playing Black:
- Their FIRST move should START their clock
- Their SUBSEQUENT moves should have already-running clock

For a user playing White:
- Their FIRST move starts their clock immediately (correct - they're making the opening move)
- Their SUBSEQUENT moves have already-running clock

## Visual Clock Indicators

Location: [`PlayVsEngine.tsx:477, 638`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L477)

```tsx
// Engine's clock (top)
isActive={game.turn() === (userSide === 'w' ? 'b' : 'w') && !gameResult}

// User's clock (bottom)
isActive={game.turn() === userSide && !gameResult}
```

The visual indicators (border highlighting, pulse animation) correctly show whose turn it is, but this is separate from the actual timer logic.

## Potential Solutions

### Option 1: Track User's First Move
Add state to track whether the user has made their first move:
- `hasUserMoved: boolean` state
- Set to `true` after user's first move
- Clock logic: Only start timer if `game.history().length > 0 AND (hasUserMoved OR userSide === 'w')`

**Pros**: Minimal invasive change, clear intent
**Cons**: Adds another piece of state to track

### Option 2: Modified History Check for Black
Check if user has made at least one move:
- For White: Clock starts when `game.history().length > 0`
- For Black: Clock starts when `game.history().length >= 2` (engine made 1st move, user made reply)

**Pros**: No additional state needed
**Cons**: Hardcoded logic based on side, less flexible for future variations

### Option 3: Track Last Move Source
Use the engine's move tracking to determine if the last move was by the user:
- Already have `lastMoveSource` from `useStockfishEngine`
- Clock logic: Only run timer if last move was by user OR it's user's turn after user has moved

**Pros**: Leverages existing state
**Cons**: Tightly couples clock logic to engine logic

## Edge Cases to Consider

1. **User plays White**: Clock should start immediately on first move (current behavior is correct)
2. **Rematch after game**: `hasUserMoved` flag must reset
3. **New game from Close button**: `hasUserMoved` flag must reset
4. **User switches sides mid-preparation**: Flag should reset
5. **Loading saved game for review**: This component is only for live play, not review

## Comparison with Aborted/Close Flows

When starting a new game via:
- **Aborted OK button**: `setGame(new Chess())` - fresh start
- **Close button**: `setGame(new Chess())` - fresh start  
- **Rematch button**: Calls `startNewGame()` which does `setGame(new Chess())`
- **New Game button**: Calls `startNewGame()`

All paths go through `startNewGame()` or directly set a new Chess instance, so resetting a flag would need to happen in those paths.

## Recommendation

**Option 1** is the cleanest approach:
1. Add `hasUserMoved` state
2. Initialize to `false`
3. Set to `true` in the `onMove` callback (user's move handler)
4. Reset to `false` in `startNewGame()` and the Close/Aborted handlers
5. Modify `useGameClock` timer condition to check this flag

This clearly captures the intent: "Has the user actively engaged with this game yet?"
