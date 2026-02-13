# Implementation Plan: Pause Clock Until User's First Move

## Problem Summary
When the user plays as Black, their clock starts counting down immediately after the engine makes its first move, even before the user has had a chance to make their reply move. This gives the user less thinking time than expected for their opening move.

## Root Cause
The clock timer in `useGameClock.ts` starts as soon as `game.history().length > 0`, without distinguishing whether the user has made their first move yet. When playing Black, the engine makes the first move, triggering the clock to start on Black's turn before the user has interacted.

## Proposed Solution: Smart Clock Activation Control

Instead of adding state tracking throughout the component, we use a clean separation of concerns:
- **Parent component** (`PlayVsEngine.tsx`) decides when the clock should be active based on game state
- **Clock hook** (`useGameClock`) simply obeys the `isActive` signal without knowing the "why"

This keeps the clock logic simple and moves the game-start logic to where it belongs - the parent component that manages game state.

### Design Principle
The clock is just a timing mechanism. The parent component understands the game context and tells the clock when to run. The clock doesn't need to know about sides, first moves, or game semantics.

## Code Changes

### Change 1: Calculate Clock Active State

**File**: `PlayVsEngine.tsx`

**Location**: Before the `useGameClock` hook call (around line 102-104)

Add calculation:
```tsx
// Determine when clock should be active
// White: Clock starts when they make first move (history.length > 0)
// Black: Clock starts after they make reply move (history.length >= 2)
const isClockActive = userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2;
```

**Justification**: 
- For White: Once they make the first move (`history.length` = 1), their clock should run
- For Black: Engine makes first move (`history.length` = 1), but clock shouldn't start until Black replies (`history.length` = 2)
- This logic is based on game state that already exists, no new state needed

---

### Change 2: Pass `isActive` to Clock Hook

**File**: `PlayVsEngine.tsx`

**Location**: [`PlayVsEngine.tsx:105-121`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L105-L121)

Current hook call:
```tsx
const {
  whiteTime,
  blackTime,
  resetTimers,
  addIncrement,
  setWhiteTime,
  setBlackTime
} = useGameClock(game, {
  whiteInitialTimeMs: whiteConfig.time,
  blackInitialTimeMs: blackConfig.time,
  whiteIncrementMs: whiteConfig.inc,
  blackIncrementMs: blackConfig.inc,
  userSide: userSide || 'w',
  onTimeout: (winner) => {
    setGameResult({ winner, reason: 'Timeout' });
  }
});
```

Modified:
```tsx
const {
  whiteTime,
  blackTime,
  resetTimers,
  addIncrement,
  setWhiteTime,
  setBlackTime
} = useGameClock(game, {
  whiteInitialTimeMs: whiteConfig.time,
  blackInitialTimeMs: blackConfig.time,
  whiteIncrementMs: whiteConfig.inc,
  blackIncrementMs: blackConfig.inc,
  userSide: userSide || 'w',
  isActive: isClockActive, // NEW: Parent decides when clock runs
  onTimeout: (winner) => {
    setGameResult({ winner, reason: 'Timeout' });
  }
});
```

**Justification**: Pass the activation decision to the clock hook.

---

### Change 3: Update Clock Hook Interface

**File**: `useGameClock.ts`

**Location**: [`useGameClock.ts:4-11`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L4-L11)

Current interface:
```tsx
interface UseGameClockOptions {
  whiteInitialTimeMs: number;
  blackInitialTimeMs: number;
  whiteIncrementMs: number;
  blackIncrementMs: number;
  onTimeout: (winner: 'White' | 'Black') => void;
  userSide: 'w' | 'b';
}
```

Modified:
```tsx
interface UseGameClockOptions {
  whiteInitialTimeMs: number;
  blackInitialTimeMs: number;
  whiteIncrementMs: number;
  blackIncrementMs: number;
  onTimeout: (winner: 'White' | 'Black') => void;
  userSide: 'w' | 'b';
  isActive: boolean; // NEW: Whether clock should be running
}
```

**Justification**: Add the new parameter to the interface.

---

### Change 4: Update Hook Signature

**File**: `useGameClock.ts`

**Location**: [`useGameClock.ts:13-16`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L13-L16)

Current:
```tsx
export function useGameClock(
  game: Chess,
  { whiteInitialTimeMs, blackInitialTimeMs, whiteIncrementMs, blackIncrementMs, onTimeout, userSide }: UseGameClockOptions
) {
```

Modified:
```tsx
export function useGameClock(
  game: Chess,
  { whiteInitialTimeMs, blackInitialTimeMs, whiteIncrementMs, blackIncrementMs, onTimeout, userSide, isActive }: UseGameClockOptions
) {
```

**Justification**: Destructure the new parameter.

---

### Change 5: Check `isActive` in Timer Effect

**File**: `useGameClock.ts`

**Location**: [`useGameClock.ts:42-50`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L42-L50)

Current:
```tsx
// Timer Effect
useEffect(() => {
  // Only run timer if game is in progress AND at least one move has been made
  // We assume game.isGameOver() is checked by the parent or effectively stops updates 
  // because onTimeout triggers a game over state in parent.
  if (game.isGameOver() || game.history().length === 0) {
    setLastTick(null);
    return;
  }
```

Modified:
```tsx
// Timer Effect
useEffect(() => {
  // Only run timer if game is in progress AND parent says clock should be active
  // Parent controls when clock starts based on game semantics (e.g., waiting for user's first move)
  if (game.isGameOver() || game.history().length === 0) {
    setLastTick(null);
    return;
  }

  // Parent controls clock activation
  if (!isActive) {
    setLastTick(null);
    return;
  }
```

**Justification**: The clock simply checks the `isActive` flag. It doesn't need to understand the game logic - it just obeys the parent's signal.

---

### Change 6: Update Effect Dependencies

**File**: `useGameClock.ts`

**Location**: [`useGameClock.ts:81`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/useGameClock.ts#L81)

Current:
```tsx
}, [game, game.turn(), game.isGameOver(), lastTick, onTimeout]);
```

Modified:
```tsx
}, [game, game.turn(), game.isGameOver(), lastTick, onTimeout, isActive]);
```

**Justification**: The effect now depends on `isActive`, so it must be in the dependencies array.

---

## Summary of Changes

**Total Lines Changed**: ~10 lines across 2 files

**PlayVsEngine.tsx**:
1. Add `isClockActive` calculation (3 lines)
2. Pass `isActive: isClockActive` to hook (1 line)

**useGameClock.ts**:
1. Add `isActive: boolean` to interface (1 line)
2. Destructure `isActive` in signature (1 word)
3. Check `!isActive` in effect (3 lines)
4. Add `isActive` to dependencies (1 word)

No state variables added, no game reset handlers modified, no complexity added to the component.

## Testing Strategy

### Manual Testing Checklist

#### Scenario 1: User Plays White
- [ ] Start new game, select White
- [ ] Verify both clocks show initial time
- [ ] Make first move (e.g., e4)
- [ ] ✅ **White's clock should start immediately** (`history.length` = 1, condition met)
- [ ] Engine responds
- [ ] ✅ **Black's (engine) clock should start**
- [ ] Make second move
- [ ] ✅ **White's clock should resume**
- [ ] Verify clock continues alternating normally

#### Scenario 2: User Plays Black
- [ ] Start new game, select Black
- [ ] Verify both clocks show initial time
- [ ] Engine makes first move (e.g., e4)
- [ ] ❌ **Black's clock should NOT start** (`history.length` = 1, need >= 2)
- [ ] Think for 5+ seconds while clock remains frozen
- [ ] Make first move (e.g., c5)
- [ ] ✅ **Black's clock should start NOW** (`history.length` = 2, condition met)
- [ ] Engine responds
- [ ] ✅ **White's (engine) clock should start**
- [ ] Make second move
- [ ] ✅ **Black's clock should resume**
- [ ] Verify clock continues alternating normally

#### Scenario 3: Rematch
- [ ] Complete a game as White
- [ ] Click Rematch (now playing Black)
- [ ] Engine makes first move
- [ ] Verify Black's clock doesn't start (`history.length` = 1)
- [ ] Make reply move
- [ ] Verify Black's clock starts (`history.length` = 2)

#### Scenario 4: Side Switching
- [ ] Play as White, make a few moves
- [ ] Abandon game
- [ ] Play as Black
- [ ] Verify clock doesn't start until second move
- [ ] Switch back to White
- [ ] Verify clock starts on first move

### Automated Testing (Optional)

If unit tests exist for `useGameClock`:
```tsx
it('should not start clock for Black player until second move', () => {
  const game = new Chess();
  const { result } = renderHook(() => useGameClock(game, {
    // ... options ...
    userSide: 'b',
    isActive: game.history().length >= 2
  }));
  
  // Initial state: no time should decrement
  const initialTime = result.current.blackTime;
  
  // Engine makes first move
  act(() => {
    game.move('e4');
  });
  
  // Wait a bit
  await waitFor(() => {}, { timeout: 200 });
  
  // Clock should NOT have decremented (isActive = false when history.length = 1)
  expect(result.current.blackTime).toBe(initialTime);
  
  // User makes reply
  act(() => {
    game.move('c5');
  });
  
  // Now clock should decrement (isActive = true when history.length = 2)
  await waitFor(() => {
    expect(result.current.blackTime).toBeLessThan(initialTime);
  });
});
```

## Expected Behavior Changes

### Before Fix
- **White**: Clock starts on first move (history = 1) ✅ correct
- **Black**: Clock starts after engine move (history = 1) ❌ bug

### After Fix  
- **White**: Clock starts on first move (`history.length > 0`) ✅ unchanged
- **Black**: Clock starts after user reply (`history.length >= 2`) ✅ fixed

## Architecture Benefits

This solution demonstrates clean separation of concerns:

1. **Game Logic** (PlayVsEngine): Understands game semantics, decides when clock should run
2. **Timing Mechanism** (useGameClock): Pure timer logic, doesn't need game context
3. **No Hidden State**: The decision is based on observable game state (`history.length`)
4. **No Side Effects**: No reset handlers, no flags to coordinate

The clock can now be reused in other contexts (like game review) by simply passing `isActive: false`.

## Risk Assessment

### Very Low Risk
- Minimal code changes (10 lines)
- No new state variables
- No changes to game reset flows
- Uses existing game state

### Testing Priority
- High: Black player scenario (the bug being fixed)
- Medium: White player scenario (ensure no regression)
- Low: Edge cases (already handled by existing game state management)

## Success Criteria

1. **Primary Fix**: When playing Black, user's clock does NOT start until they make their first move
2. **No Regression**: When playing White, user's clock still starts on their first move  
3. **No State Pollution**: No new state variables or reset logic needed
4. **No Console Errors**: No warnings or errors in browser console
5. **No TypeScript Errors**: All changes are type-safe
6. **Simplicity**: Solution should feel obvious in hindsight

## Documentation Updates

### Code Comments

In `PlayVsEngine.tsx`:
```tsx
// Determine when clock should be active
// White: Clock starts when they make first move (history.length > 0)
// Black: Clock starts after they make reply move (history.length >= 2)
//   This prevents Black's clock from starting during engine's opening move
const isClockActive = userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2;
```

In `useGameClock.ts`:
```tsx
// Parent controls clock activation based on game context
// This allows pausing the clock for scenarios like waiting for user's first move
if (!isActive) {
  setLastTick(null);
  return;
}
```

## Implementation Checklist

- [ ] Add `isClockActive` calculation in `PlayVsEngine.tsx`
- [ ] Pass `isActive` prop to `useGameClock`
- [ ] Add `isActive` to `UseGameClockOptions` interface
- [ ] Destructure `isActive` in hook signature
- [ ] Add `!isActive` check in timer effect
- [ ] Update effect dependencies array
- [ ] Add code comments
- [ ] Manual testing: White player scenario
- [ ] Manual testing: Black player scenario  
- [ ] Manual testing: Rematch scenario
- [ ] TypeScript check
- [ ] Verify no console errors
