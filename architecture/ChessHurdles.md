# ChessHurdles — Analysis plan and milestones

## Current Status (Post-Christmas 2026)
- [x] **Architecture**: Classification logic implemented in `evaluation-metrics.ts` and used in `GameAnalysis.tsx`.
- [x] **Database**: `HurdleTable` schema updated with `played_move`, `centipawn_loss`, `ai_description`, and `depth`.
- [x] **Workflow**: 
    - Full game analysis implemented with reverse sequencing for efficiency.
    - Mistakes/blunders automatically identified and annotated.
    - AI descriptions fetched via Gemini integration.
    - Hurdles automatically saved to database for logged-in users.
- [x] **UI/UX Refinements**:
    - Progress bars and status updates for analysis.
    - Cancellation support for analysis loops.
    - Persistent analysis depth preference (DB + LocalStorage).
    - Evaluation graph shows the whole game.

## Session Plan — Next working block
- **UX**: Replace `window.confirm` for resignation with a custom modal positioned over the chess board.
- **Verification**: Confirm depth is correctly saved to DB and restored specifically when signed in (verify edge cases).
- **Deployment/Maintenance**: Update project packages and resolve dependency warnings.
- **Performance**: Investigate Cross-Origin Isolation (COI) and SharedArrayBuffer (SAB) to enable multi-threaded Stockfish (currently limited to single-threaded).

### Your PGNs (for calibration)
- Place files under `reference/pgns/` (new folder) or `src/lib/__tests__/fixtures/pgns/` for test-driven work.
- Prefer clear names like `tactics_misses_01.pgn`.

### Verification
- Run `pnpm test` to validate unit coverage.
- Manual flow checks in browser.

## Guiding principles (current scope)
- **Depth-only**: run engine at a fixed depth.
- **Mate threshold**: focus on short forced mates — mateMaxN = 5.
- **Focus Side**: Auto-detect user color from PGN tags (`[White "User"]` or `[Black "User"]`). Default to "Both" or UI toggle if unknown.
- **No duplicate analysis**: Annotate outputs from the existing pipeline.
- **Synchronous processing**: Use specific logic functions (e.g., `EvaluationMetrics`) called from the main loop.

## Thresholds and tags (initial defaults)
- CP-loss classification: Inaccuracy ≥ 50, Mistake ≥ 150, Blunder ≥ 300.
- Missed tactic cues: centipawnLoss ≥ 250 or mate ≤ 5 in best PV.

## Engine and integration points
- Analysis + PVs: `stockfish-engine.ts`
- Classification Logic: `evaluation-metrics.ts`
- Persistence: `chess-database.ts`

## Baby steps and milestones (Archive)
1. [x] **Schema Update**: Add `played_move`, `centipawn_loss`, `ai_description`, `depth` to `HurdleTable`. Create migration.
2. [x] **Classification Logic**: Ensure `evaluation-metrics.ts` has robust `classifyCpLoss` and mate detection.
3. [x] **Integration**: Wire up `GameAnalysis.tsx` (or server function) to:
    - Detect mistakes.
    - Call `getAIDescription`.
    - Call `saveHurdle`.
4. [x] **Verification**: Verify end-to-end flow with a real game.

## Footnote — centipawnLoss and mate handling
- `centipawn_loss` is computed from the mover’s perspective.
- Mate scores are handled separately (short forced mates drive classification).

## Agent Credentials
- **Email**: antigravity@stzdev.com
- **Password**: gemini-antigravity

## Development Guidelines
> [!IMPORTANT]
> **Do NOT modify files in `stzUser/` or `stzUtils/` directly.** These are upstream folders. Any necessary changes or overrides should be handled via environment variables, wrappers, or by contributing to the upstream projects.