/**
 * Opening Book Service
 * 
 * Uses Lichess Masters Explorer API to find opening moves.
 * Implements "Fail-Open" strategy and Weighted Random selection.
 */

const LICHESS_API_URL = 'https://explorer.lichess.ovh/masters';

interface LichessMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

interface LichessResponse {
  white: number;
  draws: number;
  black: number;
  moves: LichessMove[];
}

/**
 * Get a weighted random opening move from the book.
 * Returns null if no moves found, error, or out of book.
 */
export async function getOpeningMove(fen: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s max timeout

    const response = await fetch(`${LICHESS_API_URL}?fen=${encodeURIComponent(fen)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null; // 429 or other error -> Fail Open

    const data: LichessResponse = await response.json();

    if (!data.moves || data.moves.length === 0) return null;

    // Weighted Random Selection based on total games count for each move
    // This allows popular moves to be played more often, but rare moves occasionally.

    // Filter out very rare moves? Optional, but let's keep it raw for now.

    const weightedMoves = data.moves.map(m => ({
      uci: m.uci,
      weight: m.white + m.draws + m.black
    }));

    const totalWeight = weightedMoves.reduce((acc, m) => acc + m.weight, 0);

    if (totalWeight === 0) return null;

    let random = Math.floor(Math.random() * totalWeight);

    for (const move of weightedMoves) {
      random -= move.weight;
      if (random < 0) return move.uci;
    }

    return weightedMoves[0].uci; // Fallback
  } catch (e) {
    // Fail Open silently
    return null;
  }
}

/**
 * Check if a specific move is present in the Lichess opening book for a given position.
 */
export async function isBookMove(fen: string, moveUci: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for check

    const response = await fetch(`${LICHESS_API_URL}?fen=${encodeURIComponent(fen)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);
    if (!response.ok) return false;

    const data: LichessResponse = await response.json();
    if (!data.moves || data.moves.length === 0) return false;

    // Check if the move (UCI) is in the list of moves from the opening book
    return data.moves.some(m => m.uci === moveUci);
  } catch (e) {
    return false;
  }
}

/**
 * Calculate "Human-Like" delay before playing a book move.
 * Uses Fibonacci sequence (1, 2, 3, 5, 8, 13, 21...) for natural spacing.
 * 
 * Algorithm:
 * Base = (TotalMinutes / 13) + (IncrementSeconds / 21)
 * Noise = Random(0, 5)
 * Result = Clamp(2s, 13s, Base + Noise)
 * 
 * Example (30+20): 30/13 (2.3) + 20/21 (0.95) = 3.25s + Noise -> ~3-8s
 * 
 * @param initialTimeMs Total initial time for one side (e.g., 30 * 60 * 1000)
 * @param incrementMs Increment in ms (e.g., 20 * 1000)
 * @returns Delay in milliseconds
 */
export function getBookMoveDelay(initialTimeMs: number, incrementMs: number): number {
  const minutes = initialTimeMs / 60000;
  const incSeconds = incrementMs / 1000;

  // Use higher Fibonacci divisors to shorten the delay
  const base = (minutes / 13) + (incSeconds / 21);

  // Variance
  const noise = Math.random() * 5;

  const totalSeconds = base + noise;

  // Clamp between Fib(3)=2 and Fib(7)=13
  const finalSeconds = Math.min(13, Math.max(2, totalSeconds));

  return Math.round(finalSeconds * 1000);
}
