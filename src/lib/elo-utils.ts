/**
 * Elo Calculation and Stockfish Skill Level Mapping
 */

/**
 * Calculates the new Elo rating for a player after a game.
 * Uses standard FIDE Elo formula with K-factor of 40 (provisional/rapid).
 * 
 * @param currentElo Player's current rating
 * @param opponentElo Opponent's rating
 * @param score 1 for win, 0.5 for draw, 0 for loss
 * @param kFactor K-factor (default 40)
 * @returns New rating (rounded)
 */
export function calculateNewElo(
  currentElo: number,
  opponentElo: number,
  score: 0 | 0.5 | 1,
  kFactor: number = 40
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - currentElo) / 400));
  const newElo = currentElo + kFactor * (score - expectedScore);
  return Math.round(newElo);
}

/**
 * Maps a human Elo rating to Stockfish "Skill Level" (0-20).
 * This is an approximation.
 * 
 * Approximate mapping logic:
 * Skill 0  ≈ 800 Elo
 * Skill 5  ≈ 1200 Elo
 * Skill 10 ≈ 1800 Elo
 * Skill 15 ≈ 2400 Elo
 * Skill 20 ≈ 3000+ Elo
 */
export function eloToStockfishLevel(elo: number): number {
  if (elo < 800) return 0;
  if (elo > 3000) return 20;

  // Linear interpolation between 800 (Level 0) and 3000 (Level 20)
  // Slope = 20 / (3000 - 800) = 20 / 2200 ≈ 0.009
  // Level = (Elo - 800) * 0.009

  const level = Math.round((elo - 800) * (20 / 2200));
  return Math.max(0, Math.min(20, level));
}

/**
 * Maps Stockfish "Skill Level" back to an approximate Elo.
 * Useful for displaying the "opponent's rating".
 */
export function stockfishLevelToElo(level: number): number {
  // Inverse of above: Elo = (Level * 110) + 800
  return 800 + (level * 110);
}
