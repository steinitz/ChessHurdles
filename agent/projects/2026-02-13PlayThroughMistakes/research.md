# Interactive Engine Lines - Research Findings

## Feature Goal

Add ability to step through engine-suggested variations (PV lines from inaccuracies) separately from the actual game moves on the `/analysis` page.

**Terminology Note**: "Inaccuracies" is used as the umbrella term for inaccuracies/mistakes/blunders, mirroring chess vernacular (e.g., "accuracy rating").

## Current Architecture

### Navigation System

**Core Function**: `goToMove(moveIndex: number)`
- Defined in [`ChessGame.tsx`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/ChessGame/ChessGame.tsx#L250)
- Used by all navigation components
- Updates board position to specific move in the actual game

**Navigation Buttons** ([`GameNavigation.tsx`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/ChessGame/GameNavigation.tsx)):
- ⏮ Start
- Prev Move
- Next Move
- Next Mistake
- ⏭ End
- Hurdle + (save position)

### Move Display Components

**Game Moves** ([`GameMoves.tsx`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/ChessGame/GameMoves.tsx)):
- Shows PGN in inline format
- Example: `1. e4 e5 2. Nf3 Nc6 3. Bb5`
- Each move is clickable, calls `goToMove(index)`
- Current move highlighted with background color

**Analysis Cards** ([`AnalysisCard.tsx`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/ChessGame/Analysis/AnalysisCard.tsx)):
- Displays each move with classification (blunder/mistake/inaccuracy)
- Shows evaluation (before → after)
- Shows `pv` (principal variation) or `bestMove`
- Example display: `Blunder [Best: e4 e5 Nf3]`
- Clicking card calls `goToMove()` to jump to that move in actual game

### Data Structure

**AnalysisDisplayItem** ([`analysis-formatter.ts`](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/ChessGame/Analysis/analysis-formatter.ts#L29-L48)):
```typescript
{
  index: number;
  moveNumber: number;
  moveSan: string;           // The actual move played (e.g., "Nxe5")
  bestMove: string;          // Engine's best move (e.g., "Nf3")
  pv?: string;              // Principal variation (e.g., "e4 e5 Nf3 Nc6")
  classification: 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'none';
  evaluation: number;        // Pre-move eval
  postMoveEvaluation?: number; // Post-move eval
  // ... other fields
}
```

## User Request Interpretation

> "add a shared text thingy to show either one line of game pgn or the recently clicked inaccuracy/mistake/blunder engine line"

### Key Design Decisions

#### 1. **"Shared text thingy"** - Display Location ✓ DECIDED

**Decision**: **Option A** - Dedicated display area above/below the navigation buttons
- Shows currently active line (game PGN vs. engine variation)
- Example: `[Game] 1. e4 e5 2. Nf3` or `[Variation] 1... Nf6 2. e5 Ne4 3. d4`
- Makes it explicitly clear what mode you're in
- "Make it look easy like a great musician does"

~~**Option B**: Replace/enhance existing GameMoves component~~
~~**Option C**: Separate panel/section~~

**Display Interactivity**: Non-clickable (read-only)
- GameMoves component remains visible and clickable in both modes
- Clicking GameMoves in variation mode auto-exits to that game position (natural escape)
- Display serves as "where am I now?" indicator, not navigation tool
- GameMoves serves as "full game reference" and clickable navigation
- Decision: Not worth implementation effort when GameMoves already provides this

**Implementation Challenge**: Need to integrate this cleanly without cluttering the UI. The display should feel natural and obvious.

#### 2. **"One line of game pgn"** - Format? ✓ DECIDED

**Decision**: Simple PGN fragment as a single line
- Game mode: Show actual game PGN (as much as fits)
- Variation mode: Show engine line for the mistake (most or all of it)
- Format: Standard PGN notation (e.g., `5... Nf6 6. e5 Ne4 7. d4`)
- Truncate if too long (horizontal scrolling to keep current move visible is future enhancement)

**Example displays**:
- `[Game] 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4`
- `[Variation] 5... Nf6 6. e5 Ne4 7. d4 Nc5 8. Be3`

**Technical Note**: "Mistake" used as umbrella term for mistakes + blunders (not including inaccuracies in this context).

#### 3. **Starting Position** - Context vs. Direct Entry ✓ FINAL DECISION

**Decision**: **Unified behavior** - Always show mistake first (both entry methods)

**Both "Next Mistake" button AND clicking inaccuracy card**:

1. Board shows the mistake move (what you actually played)
2. Display shows: `[Mistake] 5... Nxe5?? → Press Next to see engine line`
3. Active inaccuracy card highlights
4. User presses "Next Move" button
5. Board shows first engine variation move
6. Display updates: `[Variation] 5... Nf6 6. e5 Ne4 7. d4`
7. Continue pressing "Next Move" to step through variation

**Rationale**: 
- **Consistent**: No different behaviors to learn
- **Context**: Always see what you did wrong before exploring alternatives
- **Discoverable**: Display text guides the user through states
- **Simple**: One code path, easier to implement and test
- **Solves "lost context" problem**: User clicking card won't lose sight of their mistake

**Implementation**:
- Parse `pv` string into array of moves
- Track variation state: `{ pvMoves, currentIndex, sourceCardIndex, originalGameMove }`
- Index -1 = showing mistake, 0+ = in variation
- No `showMistakeFirst` flag needed (it's always true)

**Optional Polish - Subtle Pulse Animation**:
- When in "Showing Mistake" state, Next button gently pulses/glows
- Helps non-readers (especially late at night) understand expected action
- **Future enhancement**: Track usage count, disable after 3-5 uses (onboarding pattern)
- Implementation: CSS animation on Next button when `variationIndex === -1`
- Priority: Low (add if users seem confused during testing)

#### 4. **"Navigation buttons will step through"** - Dual-Mode Behavior ✓ CLARIFIED

**Current**: All buttons navigate through actual game moves

**Proposed Dual-Mode**:

**Mode 1: Game Mode** (default)
- Prev Move / Next Move → step through actual game
- Next Mistake → jump to next inaccuracy in game
- Display shows game PGN

**Mode 2: Variation Mode** (after clicking an inaccuracy card OR Next Mistake)
- Prev Move / Next Move → step through engine's suggested line
- **Next Mistake** → exit variation AND jump to next inaccuracy in game
  - Elegant dual purpose: always means "show me the next thing I did wrong"
  - User: "I'm bored with this engine line, let's see my next mistake"
- Display shows variation PGN
- Need "X" or "Escape" button to return to Game Mode

**Triggers for Variation Mode**:
1. Clicking an inaccuracy card
2. Using Next Mistake button (from either mode)

**Question**: Should "Start" / "End" buttons go to start/end of variation or be disabled?

**Decision**: Research difficulty first, then decide
- If easy: Make them go to start/end of variation (low utility but consistent)
- If moderate/hard: Disable them in variation mode

**Analysis**: Likely **easy** to implement
- Start: Reset variation index to 0 (or -1 if showing mistake first)
- End: Set variation index to `variationMoves.length - 1`
- Same `goToMove` routing logic, different bounds checking

**Recommendation**: Implement them. Consistency is good, and some users might use them.

#### 5. **"X or something to escape from the mistake"** - UI Design ✓ DECIDED

**Decision**: Multiple escape mechanisms ("don't feel we have to limit")

Since launching into a mode is "kinda rude", provide generous escape routes:

**Implement all of these** (unless difficult):
1. **ESC key** - Standard keyboard escape
2. **Close button (X)** next to variation display - Visual, discoverable
3. **Click active card again** - Toggle off the variation
4. **"Next Mistake" button** - Already discussed, exits to next mistake

**Don't implement** (hair-trigger concerns):
- Click anywhere outside (too easy to trigger accidentally)
- Automatic timeout

**Visual Feedback**:
- Active inaccuracy card should have distinct styling
- Variation display should be visually distinct from game display
- Close button should be obvious

#### 6. **Scope** - Which Engine Lines? ✓ DECIDED

**Decision**: Treat all lines the same

**Rationale**:
- Not aware of single-move-only lines in practice
- Significant inaccuracies always have `pv` data
- Single `bestMove` is just a fallback display
- Simpler implementation: no special cases

**Implementation**:
- All inaccuracy cards with PV data are clickable
- If only `bestMove` exists (edge case), treat it as a 1-move variation
- No classification filtering - inaccuracies, mistakes, and blunders all work the same

## Technical Considerations

### State Management

Need new state in `ChessGame.tsx`:
```typescript
const [navigationMode, setNavigationMode] = useState<'game' | 'variation'>('game');
const [activeVariation, setActiveVariation] = useState<{
  startMoveIndex: number;  // Where in the game this variation branches
  moves: string[];         // Parsed PV moves
  currentIndex: number;    // Current position in variation (0-based)
} | null>(null);
```

### Chess Logic

**Applying Variation Moves**:
1. Clone game position from before the mistake
2. Apply variation moves sequentially
3. Show resulting position on board
4. Track which move in variation we're at

**Challenge**: The board displays a `Chess` instance. We need to:
- Keep the actual game instance intact
- Create temporary game states for variations
- Switch between them based on mode

### UI Updates Needed

**GameNavigation.tsx**:
- Update Prev/Next handlers to check mode
- Show/hide or disable certain buttons in variation mode
- Add escape button if needed

**AnalysisCard.tsx**:
- Add click handler for variation mode
- Visual indication when a variation is active
- Filter cards with `pv` field

**GameMoves.tsx** or new component:
- Display current PGN of active line
- Differentiate game vs. variation visually
- Highlight current move in respective mode

### Edge Cases

1. **Switching variations**: Click different mistake card while in variation mode
   - Should immediately switch to new variation?
   - Or require exiting first?

2. **Board arrows/highlights**: How should last move highlighting work?
   - Show the variation move or the original game move?

3. **Manual position changes**: What if user clicks on GameMoves while in variation mode?
   - Auto-exit variation?
   - Prevent clicks?

4. **Analysis running**: Can user enter variation mode while analysis is running?
   - Probably yes, should be independent

## Proposed Implementation Approach

### Phase 1: Core Mechanics
1. Add variation state to `ChessGame`
2. Parse PV strings into move arrays
3. Create variation game instances
4. Update `goToMove` to check mode and route accordingly

### Phase 2: Navigation
1. Update `GameNavigation` to handle dual modes
2. Add escape mechanism
3. Disable inappropriate buttons in variation mode

### Phase 3: Display
1. Add variation PGN display (or enhance `GameMoves`)
2. Visual mode indicator
3. Update `AnalysisCard` for variation activation

### Phase 4: Polish
1. Handle edge cases
2. Add keyboard shortcuts (ESC to exit)
3. Visual feedback on active variation card
4. Testing

## Questions for Approval

Before creating an implementation plan, please clarify:

1. **Where should the PGN/variation text display appear?** (new section, replace GameMoves, other?)
2. **What format for the variation text?** (examples above)
3. **Should we start at the position before the mistake or at the first variation move?**
4. **Which navigation buttons should work in variation mode?** (disable Start/End/Next Mistake?)
5. **Preferred escape mechanism?** (button, ESC key, click card again?)
6. **Scope**: Only PV lines or also single-move bestMove suggestions?

## Feasibility Assessment

**Verdict**: Definitely feasible!

**Complexity**: Medium
- Core mechanics are straightforward (parse PV, apply moves)
- Main challenge is clean state management and UI clarity
- Estimated ~150-200 lines of new code + modifications

**Benefits**:
- Users can explore "what if" scenarios
- Better understanding of why a move was a mistake
- Interactive learning tool

**Risks**:
- UI could feel cluttered without careful design
- Mode switching needs to be very clear or users will be confused
- Need good visual differentiation between game and variation states

## Design Critique & Recommendations

### What Works Really Well

**1. Context-Aware Entry (Q3)**
The distinction between "Next Mistake" (shows mistake first) vs. direct card click (jumps to variation) is brilliant:
- Pedagogically sound: see what you did before seeing what you should have done
- Respects user intent: button = learning, click = exploring
- Minimal implementation cost for significant UX improvement

**2. Dual-Purpose "Next Mistake" Button (Q4)**
Using Next Mistake to exit variations is elegant:
- Semantic consistency: "Show me next thing I did wrong" works in both modes
- Reduces UI clutter (no separate "Exit Variation" button needed)
- Natural workflow: done analyzing this mistake, move to next one

**3. Multiple Escape Routes (Q5)**
Generous escape mechanisms reduce mode-switching anxiety:
- Users won't feel trapped
- Different users have different preferences (keyboard vs. mouse)
- Low implementation cost

### Potential Challenges

**1. Visual Clarity is Critical**
The biggest risk is users not realizing they're in variation mode. Mitigations:
- Make variation display visually VERY distinct (different background color?)
- Active card should be unmistakably highlighted
- Consider mode indicator beyond just the text label

**2. "Showing Mistake" Intermediate State**
The `[Showing Mistake] 5... Nxe5??` state when using Next Mistake adds complexity:
- Need to track 3 states: game mode, showing mistake, in variation
- Worth it for the pedagogical benefit
- Display text should make it crystal clear this isn't the variation yet

**3. Start/End in Variation Mode**
While easy to implement, these buttons have low utility:
- Start of variation: just exit and re-enter
- End of variation: PV lines are usually short (3-5 moves)
- Recommendation: Implement for consistency, but don't prioritize testing edge cases

### Technical Recommendations

**1. State Structure**
Suggest enhanced variation state:
```typescript
type VariationState = {
  sourceCardIndex: number;     // Which inaccuracy card is active
  pvMoves: string[];           // Parsed variation moves
  currentIndex: number;        // Position in variation (-1 = showing mistake)
  showMistakeFirst: boolean;   // Entry method flag
  originalGameMove: string;    // The actual mistake move (for display)
};
```

**2. Display Component**
Create dedicated `MoveLineDisplay` component:
- Clear visual separation from GameMoves
- Props: `mode`, `text`, `onClose`
- Styled distinctly for game vs. variation modes
- Position: between navigation and board (most visible)

**3. Progressive Enhancement**
Phased approach makes sense:
1. MVP: Basic variation stepping, simple display, ESC key only
2. Polish: Multiple escape mechanisms, visual refinements
3. Future: Horizontal scrolling, move highlighting in PGN

### Edge Case Decisions

**Switching Variations** (from research): Recommend immediate switch
- More intuitive than requiring exit first
- Just update `activeVariation` state
- Previous variation's visual state clears automatically

**GameMoves Clicks During Variation**: Recommend auto-exit
- User is clearly trying to navigate the real game
- Respect that intent
- Could show brief toast: "Exited variation"

**Analysis Running**: No conflict, allow variation mode
- They're independent features
- Analysis affects data, variation affects display only

## Summary

All design decisions are sound and well-reasoned. The Q3 distinction (context-aware entry) is the most sophisticated element and will require careful implementation, but it's absolutely worth it.

**Estimated Complexity**: Medium (as stated)
**Estimated LOC**: 180-220 (slightly higher due to Q3 sophistication)
**Estimated Development Time**: 4-6 hours for MVP, 2-3 hours for polish

**Ready to proceed to implementation plan.**
