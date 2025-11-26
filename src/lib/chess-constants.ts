// Centralized thresholds for centipawn loss classification
// Keep these values in one place to ensure consistency across UI and tests.

export const CP_LOSS_THRESHOLDS = {
  inaccuracy: 50,
  mistake: 150,
  blunder: 300,
} as const;

// Calibration settings for choosing a sensible default analysis depth
// Target number of seconds for a mid-complexity position.
export const CALIBRATION_TARGET_MS = 3 * 1000;
export const CALIBRATION_TIMEOUT_MS = 21 * 1000; // safety timeout per depth run
// A stable, middlegame test position (moderate branching factor)
// Source: a typical middlegame structure used for benchmarking
export const CALIBRATION_TEST_FEN =
  'r2q1rk1/1bpp1ppp/p1n1pn2/8/3P4/2P2N2/PP3PPP/R1BQ1RK1 w - - 0 10';

// Shared analysis depth defaults (used by GameAnalysis and tests)
export const MIN_ANALYSIS_DEPTH = 1;
export const MAX_ANALYSIS_DEPTH = 34;
export const DEFAULT_ANALYSIS_DEPTH = 8;

// Number of full moves (from the end of the game) to cache evaluations for.
// 13 full moves = 26 plies (Deep opening coverage).
export const ANALYSIS_CACHE_FULL_MOVES_LIMIT = 13;

// Centralized engine performance defaults for Stockfish UCI options
// Adjust these values to experiment with speed and stability.
// Note: Multi-threading requires a pthreads build and cross-origin isolation.
export const ENGINE_DEFAULT_OPTIONS = {
  // Threads: 1,
  Hash: 64,
  MultiPV: 1,
  SyzygyPath: ''
} as const;
