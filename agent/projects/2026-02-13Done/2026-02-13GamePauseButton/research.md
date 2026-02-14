# Game Pause Button - Research Findings

## User Requirements

1. **Rename Zen Mode buttons**: Change "Zen Mode" / "Exit Zen" to just "Zen", showing only icon changes
2. **Add Pause button**: Place between Resign and Zen buttons
3. **Pause functionality**: Pause the game clocks
4. **Pause indicator**: Question - do we need one? Will button change to "Resume"?

## Current Button Layout

Location: [`PlayVsEngine.tsx:610-642`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L610-L642)

Current button order in the control panel:
1. **Flip Board** - `fa-sync-alt` icon
2. **Abandon/New Game** - `fa-times-circle` / `fa-redo` icons (conditional)
3. **Resign** - `fa-flag` icon
4. **Zen Mode** - `fa-compress` / `fa-expand` icons (conditional)

All buttons are in a flex div with proper spacing.

## Zen Mode Implementation

**State**: [`PlayVsEngine.tsx:37-48`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L37-L48)
```tsx
// -- Zen Mode (Persisted) --
const [zenMode, zenModeActions] = usePersistedState<boolean>(
  'zenMode',
  false,
  storageNamespace
);
const toggleZenMode = () => {
  zenModeActions.setState(!zenMode);
};
```

**Button Implementation**: Lines 635-642
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

**Icons**:
- Enter Zen: `fa-expand` (expand icon)
- Exit Zen: `fa-compress` (compress icon)

**Text labels**:
- Enter: " Zen Mode"
- Exit: " Exit Zen"

### Zen Mode Effects

Location: Lines 431-436

```tsx
// Zen Mode Styles
const zenStyles = zenMode ? {
  display: 'none'
} : {};
```

Applied to various UI elements to hide them in Zen mode (move list, analysis panel, etc.).

## Clock Pause Mechanism

We just implemented clock activation control via the `isActive` prop:

**Current Implementation**: [`PlayVsEngine.tsx:104-111`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx#L104-L111)

```tsx
// Determine when clock should be active
const isClockActive = userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2;
```

This is passed to `useGameClock` as `isActive: isClockActive`.

**Perfect foundation for pause**: We can simply add `&& !isPaused` to this calculation.

## Proposed Implementation

### 1. Add Pause State

```tsx
const [isPaused, setIsPaused] = useState(false);
```

### 2. Modify Clock Active Calculation

```tsx
const isClockActive = !isPaused && (userSide === 'w' 
  ? game.history().length > 0
  : game.history().length >= 2);
```

### 3. Update Zen Mode Button

Change from:
```tsx
{zenMode ? " Exit Zen" : " Zen Mode"}
```

To:
```tsx
{" Zen"}
```

Keep the icon toggle but remove text variation.

### 4. Add Pause Button

Insert between Resign and Zen:

```tsx
<button
  onClick={() => setIsPaused(!isPaused)}
  disabled={!!gameResult || !isGameActive}
  title={isPaused ? "Resume Game" : "Pause Game"}
  style={{ padding: '0.4rem 0.8rem' }}
>
  {isPaused ? <i className="fas fa-play" /> : <i className="fas fa-pause" />}
  {isPaused ? " Resume" : " Pause"}
</button>
```

**Icons**:
- Pause state: `fa-play` (resume/play icon)
- Playing state: `fa-pause` (pause icon)

**Button states**:
- Disabled when `gameResult` is set (game over)
- Disabled when `!isGameActive` (no game in progress)

## Design Questions & Answers

### Q1: Do we need a paused indicator?

**Answer**: Button text change should be sufficient. The button itself becoming "Resume" is a clear indicator. Additional overlay might be confusing since the board remains interactive.

### Q2: What is Zen mode and how does it relate to pause?

**Zen Mode Functionality**: Zen mode is a fullscreen, distraction-free view. It:
- Goes fullscreen (`position: fixed`, full viewport)
- Centers the board
- Hides surrounding UI elements via `display: none` styles
- Does NOT prevent moves or interaction

Zen mode and pause are orthogonal features - you can be in Zen mode while paused, and pause works the same whether in Zen or normal mode.

### Q3: Should pause prevent user moves?

**Better Design**: No, but with smart behavior:

**When user clicks Pause**:
1. If it's the engine's turn, wait for engine to complete its current move
2. Then pause on the user's turn
3. User can take their time thinking

**When paused**:
- Clock is frozen
- User can make a move at any time
- **Making a move implicitly resumes the game** (unpauses automatically)
- OR user can click Resume button to unpause before moving

This provides the best UX:
- Pause always leaves you on your turn (natural stopping point)
- Can resume by playing (intuitive) or by button click (explicit)
- No confusing "paused but can't move" state

### Q4: How to handle "pause during engine's turn"?

**Implementation**:
```tsx
const handlePause = () => {
  if (game.turn() !== userSide) {
    // Engine's turn - wait for engine to finish, then auto-pause
    // Set a flag: setPauseAfterEngineMove(true)
  } else {
    // User's turn - pause immediately
    setIsPaused(true);
  }
};
```

Then in the engine move callback:
```tsx
const onEngineMove = useCallback((san) => {
  // ... apply move ...
  if (pauseAfterEngineMove) {
    setIsPaused(true);
    setPauseAfterEngineMove(false);
  }
}, [pauseAfterEngineMove]);
```

### Q5: How to handle implicit unpause on user move?

Add to the user's `onMove` callback:
```tsx
const onMove = useCallback((moveSan: string) => {
  if (game.turn() !== userSide || gameResult) return;
  
  // Auto-unpause when user makes a move
  if (isPaused) {
    setIsPaused(false);
  }
  
  // ... rest of move logic ...
}, [isPaused, game, gameResult, userSide]);
```

### Q6: Should pause state reset on game end?

**Answer**: Yes. When `gameResult` is set, automatically unpause. Add to the game-over effects.

### Q7: Should pause persist across page reload?

**Answer**: No. Pause is transient (`useState`), not a preference like Zen mode. It's a momentary "I need a break" action.

**Why this works**:
- The clock only ticks while the `PlayVsEngine` component is mounted and rendering
- When you navigate away or close the browser:
  - Component unmounts
  - All `useEffect` cleanups run → clock intervals are cleared
  - **Time cannot elapse while the component is unmounted**
- Currently, there's no game persistence - leaving the page effectively abandons the game
- When you return, you start a fresh game

**Pause use cases** (while staying on the page):
- "Dinner's ready" - pause, step away from desk, come back
- "Phone call" - pause, handle call, resume
- "Need to look something up" - pause, switch tabs briefly, come back

**What pause does NOT do**:
- Save your game for later sessions
- Prevent time loss if you close the browser (component unmounts = clock stops anyway)

If you wanted pause to persist across sessions, you'd need to implement full game save/resume functionality (save position, clock times, pause status to database). That's a much larger feature. For now, pause is just "freeze the clock while I'm viewing this page."

## Edge Cases to Consider

1. **Pause during engine thinking**: 
   - Engine completes its move
   - Game pauses on user's turn
   - User sees "PAUSED" state with their position to think about

2. **User makes move while "pause pending"** (clicked pause during engine turn):
   - If user quickly makes a move before engine finishes, cancel the pending pause
   - Game continues normally

3. **Resume by making a move**:
   - User is paused
   - User makes a move
   - Game automatically unpauses
   - Engine's clock starts

4. **Resume by clicking Resume button**:
   - User is paused
   - User clicks Resume
   - Clock starts immediately (user's turn)
   - User can then make their move

5. **Resign while paused**: Works normally - resignation doesn't depend on clock state

6. **Abandon while paused**: Works normally

7. **Rematch while paused**: New game starts unpaused (state resets)

8. **New game from Close button**: New game starts unpaused

9. **Zen mode while paused**: Both can be active simultaneously - Zen just changes layout

## Code Changes Required

### Files to Modify

1. **PlayVsEngine.tsx**
   - Add `isPaused` state
   - Add `pauseAfterEngineMove` state (for smart pause on engine turn)
   - Modify `isClockActive` calculation to include `&& !isPaused`
   - Update Zen button text to just "Zen"
   - Add Pause button between Resign and Zen
   - Update `onEngineMove` to check `pauseAfterEngineMove` flag
   - Update user's `onMove` to auto-unpause when making a move
   - Add pause handler with engine-turn logic

### No Changes Needed

- `useGameClock.ts` - Already accepts `isActive` prop
- `ChessClockDisplay.tsx` - No changes needed
- Game logic - Pause only affects clocks, not moves

## Testing Plan

### Manual Testing Scenarios

1. **Basic Pause/Resume on User's Turn**
   - Start a game
   - Make a few moves until it's user's turn
   - Click Pause - verify clock stops, button shows "Resume"
   - Wait 5+ seconds
   - Click Resume - verify clock resumes, button shows "Pause"

2. **Pause During Engine's Turn**
   - Make a move, engine is thinking
   - Click Pause while engine's clock is running
   - Engine completes its move
   - Verify game pauses on user's turn (user's clock stopped)
   - Button shows "Resume"

3. **Implicit Unpause by Making Move**
   - Pause game on user's turn
   - Wait a few seconds (verify clock stays frozen)
   - Make a move
   - Verify game automatically unpauses
   - Engine's clock should start
   - Button should show "Pause" again

4. **Explicit Resume Button**
   - Pause game on user's turn
   - Click Resume button
   - Verify user's clock starts
   - Button shows "Pause"
   - Make a move normally

5. **Rapid Pause Click During Engine Turn**
   - User makes move
   - Quickly click Pause while engine is thinking
   - User changes mind and makes another adjustment/move (if possible)
   - Should cancel pending pause or handle gracefully

6. **Button States**
   - Pause button disabled before game starts
   - Pause button enabled during game
   - Pause button disabled after game ends
   - Button text shows "Pause" when playing
   - Button text shows "Resume" when paused
   - Button icon changes: `fa-pause` ↔ `fa-play`

7. **Zen Mode + Pause**
   - Enable Zen mode - verify fullscreen layout
   - Pause game - should work normally
   - Zen button should show just "Zen" (not "Zen Mode" or "Exit Zen")
   - Icons toggle correctly (`fa-expand` ↔ `fa-compress`)
   - Exit Zen - pause state should persist

8. **Game Reset Flows**
   - Pause game, click Rematch - new game should be unpaused
   - Pause game, complete game and click Close - new game should be unpaused
   - Pause game, Abandon and click OK - new game should be unpaused

## Implementation Complexity

**Medium complexity** - More sophisticated than initially planned:
- 2 new state variables (`isPaused`, `pauseAfterEngineMove`)
- 1 line change to clock activation logic  
- 1 text change for Zen button
- 1 new button component (~12 lines)
- Logic in `onEngineMove` to handle pause-after-move (~5 lines)
- Logic in user's `onMove` to auto-unpause (~3 lines)
- Pause handler with engine-turn detection (~8 lines)

Total: ~30-35 lines of code.

The additional complexity buys us much better UX:
- Pause always lands on user's turn
- Implicit unpause when making a move
- No awkward "paused during engine's turn" state

## Benefits of This Approach

1. **Leverages existing infrastructure**: The `isActive` prop we just added makes this trivial
2. **Clean separation**: Pause state is independent of game state
3. **No side effects**: Doesn't interfere with game logic, move history, etc.
4. **User-friendly**: Clear visual feedback via button text/icon change
5. **Flexible**: Easy to extend later (e.g., auto-pause on window blur)

## Potential Future Enhancements

1. **Auto-pause on window blur**: Pause when user switches tabs (optional setting)
2. **Pause indicator overlay**: If user feedback suggests button change isn't clear enough
3. **Prevent moves while paused**: Add a guard in `onMove` to check `!isPaused`
4. **Pause in Zen mode**: Show a minimal "PAUSED" badge even in Zen mode
