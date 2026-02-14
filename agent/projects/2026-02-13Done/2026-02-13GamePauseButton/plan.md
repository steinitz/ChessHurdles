# Implementation Plan: Game Pause Button

## Goal

Add a pause button that allows users to freeze the game clock during play. The pause feature includes smart behavior:
- Pausing during engine's turn waits for engine to complete its move, then pauses on user's turn
- User can resume by clicking Resume button OR by making a move (implicit unpause)
- Zen mode button text simplified to just "Zen"

## User Review Required

> [!IMPORTANT]
> **Scope Clarification**: This pause feature only works while staying on the page. Leaving the page abandons the game (no persistence). Future game save/resume would be a separate feature.

## Proposed Changes

### PlayVsEngine.tsx

All changes in one file: [`PlayVsEngine.tsx`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx)

---

#### Change 1: Add Pause State Variables

**Location**: After existing state declarations (around line 93)

**Add**:
```tsx
const [isPaused, setIsPaused] = useState(false);
const [pauseAfterEngineMove, setPauseAfterEngineMove] = useState(false);
```

**Rationale**: 
- `isPaused`: Current pause state
- `pauseAfterEngineMove`: Flag set when user clicks Pause during engine's turn

---

#### Change 2: Update Clock Active Calculation

**Location**: [`PlayVsEngine.tsx:104-111`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L104-L111)

**Current**:
```tsx
const isClockActive = userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2;
```

**Modified**:
```tsx
const isClockActive = !isPaused && (userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2);
```

**Rationale**: Add `!isPaused` condition to freeze clock when paused.

---

#### Change 3: Add Pause Handler

**Location**: After other handlers (around line 286, after `saveTimeConfig`)

**Add**:
```tsx
const handlePause = useCallback(() => {
  if (game.turn() !== userSide) {
    // Engine's turn - wait for engine to complete its move, then pause
    setPauseAfterEngineMove(true);
  } else {
    // User's turn - pause immediately
    setIsPaused(true);
  }
}, [game, userSide]);

const handleResume = useCallback(() => {
  setIsPaused(false);
  setPauseAfterEngineMove(false); // Cancel any pending pause
}, []);
```

**Rationale**: Smart pause logic - delays pause until user's turn if clicked during engine's turn.

---

#### Change 4: Update Engine Move Callback

**Location**: [`PlayVsEngine.tsx:166-188`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L166-L188)

**Current** (simplified):
```tsx
const onEngineMove: OnMoveCallback = useCallback((san) => {
  const next = cloneGame(game);
  if (next.move(san)) {
    setGame(next);
    if (userSide === 'w') addIncrement('b');
    else addIncrement('w');
  }
}, [game, userSide, addIncrement]);
```

**Modified**:
```tsx
const onEngineMove: OnMoveCallback = useCallback((san) => {
  const next = cloneGame(game);
  if (next.move(san)) {
    setGame(next);
    // Add increment to engine's side (opposite of user's side)
    addIncrement(userSide === 'w' ? 'b' : 'w');
    
    // Check if pause was requested during engine's turn
    if (pauseAfterEngineMove) {
      setIsPaused(true);
      setPauseAfterEngineMove(false);
    }
  }
}, [game, userSide, addIncrement, pauseAfterEngineMove]);
```

**Rationale**: After engine moves, check if pause was requested and execute it (lands on user's turn).

---

#### Change 5: Update User Move Callback for Implicit Unpause

**Location**: [`PlayVsEngine.tsx:398-410`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L398-L410)

**Current**:
```tsx
const onMove = useCallback((moveSan: string) => {
  if (game.turn() !== userSide || gameResult) return;
  try {
    const next = cloneGame(game);
    if (next.move(moveSan)) {
      setGame(next);
      setHasUserMoved(true);
      if (userSide === 'w') addIncrement('w');
      else addIncrement('b');
    }
  } catch (e) {
    console.error('Failed to apply move:', moveSan, e);
  }
}, [game, gameResult, userSide, addIncrement]);
```

**Modified**:
```tsx
const onMove = useCallback((moveSan: string) => {
  if (game.turn() !== userSide || gameResult) return;
  
  // Auto-unpause when user makes a move
  if (isPaused) {
    setIsPaused(false);
  }
  // Cancel any pending pause if user moves before engine completes
  if (pauseAfterEngineMove) {
    setPauseAfterEngineMove(false);
  }
  
  try {
    const next = cloneGame(game);
    if (next.move(moveSan)) {
      setGame(next);
      setHasUserMoved(true);
      addIncrement(userSide);
    }
  } catch (e) {
    console.error('Failed to apply move:', moveSan, e);
  }
}, [game, gameResult, userSide, addIncrement, isPaused, pauseAfterEngineMove]);
```

**Rationale**: 
- Making a move auto-unpauses (intuitive UX)
- Cancels pending pause if user moves quickly after clicking pause

---

#### Change 6: Update Zen Mode Button Text

**Location**: [`PlayVsEngine.tsx:635-642`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L635-L642)

**Current**:
```tsx
<button
  onClick={toggleZenMode}
  title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
  style={{ padding: '0.4rem 0.8rem' }}
>
  {zenMode ? <i className="fas fa-compress" /> : <i className="fas fa-expand" />}
  {zenMode ? " Exit Zen" : " Zen Mode"}
</button>
```

**Modified**:
```tsx
<button
  onClick={toggleZenMode}
  title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
  style={{ padding: '0.4rem 0.8rem' }}
>
  {zenMode ? <i className="fas fa-compress" /> : <i className="fas fa-expand" />}
  {" Zen"}
</button>
```

**Rationale**: Simplify to just "Zen", icon conveys the state.

---

#### Change 7: Shorten Flip Board Button Text

**Location**: [`PlayVsEngine.tsx:606-612`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L606-L612)

**Current**:
```tsx
<button
  onClick={() => {
    // ... flip logic ...
  }}
  style={{ padding: '0.4rem 0.8rem' }}
  title="Flip Board"
>
  <i className="fas fa-sync-alt" /> Flip Board
</button>
```

**Modified**:
```tsx
<button
  onClick={() => {
    // ... flip logic ...
  }}
  style={{ padding: '0.4rem 0.8rem' }}
  title="Flip Board"
>
  <i className="fas fa-sync-alt" /> Flip
</button>
```

**Rationale**: Shorten text to "Flip" to make room for new Pause button. Icon clearly conveys the flip/rotate action.

---

#### Change 8: Add Pause Button

**Location**: Insert between Resign button and Zen button (after line 633)

**Insert after Resign button**:
```tsx
<button
  onClick={isPaused ? handleResume : handlePause}
  disabled={!!gameResult || !isGameActive}
  title={isPaused ? "Resume Game" : "Pause Game"}
  style={{ padding: '0.4rem 0.8rem' }}
>
  {isPaused ? <i className="fas fa-play" /> : <i className="fas fa-pause" />}
  {isPaused ? " Resume" : " Pause"}
</button>
```

**Rationale**: 
- Shows between Resign and Zen (logical grouping)
- Icon and text change based on state
- Disabled when game not active or game over

---

## Final Button Layout

After changes, button order will be:
1. **Flip** - `fa-sync-alt` (shortened from "Flip Board")
2. **Abandon/New Game** - `fa-times-circle` / `fa-redo`
3. **Resign** - `fa-flag`
4. **Pause/Resume** - `fa-pause` / `fa-play` ← NEW
5. **Zen** - `fa-expand` / `fa-compress` (simplified from "Zen Mode"/"Exit Zen")

---

## Verification Plan

### Manual Testing Checklist

#### Core Functionality

- [ ] **Pause on user's turn**
  - Make moves until it's user's turn
  - Click Pause - clock stops, button shows "Resume"
  - Wait 5+ seconds, verify clock stays frozen
  - Click Resume - clock resumes, button shows "Pause"

- [ ] **Pause during engine's turn**
  - Make a move, engine starts thinking
  - Click Pause while engine's clock is running
  - Engine completes its move
  - Game pauses on user's turn (user's clock stopped)
  - Button shows "Resume"

- [ ] **Implicit unpause by making move**
  - Pause game on user's turn
  - Make a move
  - Game auto-unpauses, engine's clock starts
  - Button shows "Pause" again

#### Button States

- [ ] Pause button disabled before game starts
- [ ] Pause button enabled during active game
- [ ] Pause button disabled after game ends
- [ ] Button text: "Pause" when playing, "Resume" when paused
- [ ] Button icon: `fa-pause` when playing, `fa-play` when paused

#### Zen Mode Integration

- [ ] Zen button shows just "Zen" (not "Zen Mode" or "Exit Zen")
- [ ] Zen icon toggles: `fa-expand` ↔ `fa-compress`
- [ ] Pause works normally in Zen mode
- [ ] Exiting Zen preserves pause state

#### Edge Cases

- [ ] Pause → Rematch → new game starts unpaused
- [ ] Pause → Complete game → Close → new game starts unpaused
- [ ] Pause → Abandon → OK → new game starts unpaused
- [ ] Click Pause during engine turn → User makes move before engine finishes → Pending pause cancels

### Expected Behaviors

**Before Fix**: No pause functionality

**After Fix**:
- Can pause game to freeze clock
- Pause always lands on user's turn (waits for engine if needed)
- Resume via button or by making a move
- Zen button simplified to "Zen"

---

## Implementation Checklist

### Code Changes
- [ ] Add `isPaused` state
- [ ] Add `pauseAfterEngineMove` state
- [ ] Update `isClockActive` calculation (`!isPaused &&`)
- [ ] Add `handlePause` function
- [ ] Add `handleResume` function
- [ ] Update `onEngineMove` to check pause flag
- [ ] Update `onMove` to auto-unpause
- [ ] Update `onMove` dependencies array
- [ ] Update Zen button text to "Zen"
- [ ] Update Flip Board button text to "Flip"
- [ ] Add Pause button between Resign and Zen

### Verification
- [ ] TypeScript check passes
- [ ] All manual test scenarios pass
- [ ] No console errors
- [ ] Button styling consistent with other buttons

---

## Success Criteria

1. **Pause works on user's turn**: Clock freezes immediately
2. **Smart pause during engine's turn**: Waits for engine, then pauses
3. **Implicit unpause**: Making a move unpauses automatically
4. **Explicit unpause**: Resume button works
5. **Button states**: Disabled/enabled correctly, text/icon changes appropriately
6. **Zen mode**: Text simplified, pause integration works
7. **No regressions**: Game reset flows work normally
8. **Clean code**: No TypeScript errors, consistent styling

---

## Notes

- **Scope**: Pause only works while staying on page (transient state)
- **No persistence**: Leaving page abandons game
- **Clock safety**: Clock cannot tick when component unmounted
- **Future enhancement**: Full game save/resume would require database persistence

---

## Complexity Assessment

**Medium complexity**: ~35 lines of code across 7 changes in one file

**Benefits**:
- Much better UX than simple pause
- Leverages existing `isActive` clock infrastructure
- No awkward "paused during engine's turn" state
- Intuitive implicit unpause behavior
