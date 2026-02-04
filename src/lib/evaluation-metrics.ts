import { CP_LOSS_THRESHOLDS } from './chess-constants';

/**
 * Compute centipawn change from White's perspective given White-normalized evaluations.
 * - If White moves: loss is max(0, preWhiteEval - postWhiteEval)
 * - If Black moves: loss is max(0, postWhiteEval - preWhiteEval)
 */
export function computeCentipawnChange(
  preWhiteEval: number,
  postWhiteEval: number,
  isWhiteMove: boolean
): number {
  if (isWhiteMove) {
    return Math.max(0, preWhiteEval - postWhiteEval);
  } else {
    return Math.max(0, postWhiteEval - preWhiteEval);
  }
}

/**
 * Calculate Win Probability from Centipawns.
 * Using formula: WP = 1 / (1 + 10^(-cp/400))
 * Ref: https://lichess.org/page/accuracy
 * Corrected Formula for range [-1, 1]: 2 / (1 + exp(-0.00368208 * cp)) - 1
 */
export function calculateWinProbability(cp: number): number {
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/**
 * Compute Win Probability Loss (WPL).
 * WPL is the difference between the win probability before and after the move.
 * Always positive.
 */
export function calculateWPL(
  preCp: number,
  postCp: number,
  isWhiteMove: boolean
): number {
  const preWP = calculateWinProbability(preCp);
  const postWP = calculateWinProbability(postCp);

  // Win probability is always calculated from White's perspective in the formula above relative to raw cp.
  // If eval drops from +1.0 to +0.5:
  // White Move: WP drops (Bad for White). WPL = Pre - Post.
  // Black Move: WP drops (Good for Black, Bad for White). Wait.
  // We need "Win Chance for the Moving Side".

  // Actually, standardizing on White Centipawns:
  // If White moves: We want (WP_White_Pre - WP_White_Post).
  // If Black moves: We want (WP_Black_Pre - WP_Black_Post).
  // Note: WP_Black = -WP_White (in our [-1, 1] range scaling? No, Prob is [0, 1] usually, but our formula returns [-1, 1] range?
  // Let's check the formula: 2 / (1 + exp(-k * 0)) - 1 = 2/2 - 1 = 0.
  // 2 / (1 + exp(-k * inf)) - 1 = 2/1 - 1 = 1.
  // 2 / (1 + exp(-k * -inf)) - 1 = 2/inf - 1 = -1.
  // So the formula returns a "Winning Advantage" score from -1 to 1.
  // Let's call it "Winning Chances" (WC).

  // If White moves: Loss = WC_White_Pre - WC_White_Post
  // If Black moves: Loss = WC_Black_Pre - WC_Black_Post
  // Since WC_Black = -WC_White:
  // Loss_Black = (-WC_White_Pre) - (-WC_White_Post) = WC_White_Post - WC_White_Pre

  const wcWhitePre = calculateWinProbability(preCp);
  const wcWhitePost = calculateWinProbability(postCp);

  let loss = 0;
  if (isWhiteMove) {
    loss = wcWhitePre - wcWhitePost;
  } else {
    loss = wcWhitePost - wcWhitePre;
  }

  return Math.max(0, loss);
}


export type WplClass = 'none' | 'inaccuracy' | 'mistake' | 'blunder';

// WPL Thresholds
export const WPL_THRESHOLDS = {
  inaccuracy: 0.05,
  mistake: 0.10,
  blunder: 0.20
};

/** Classify move based on Win Probability Loss. */
export function classifyWPL(wpl: number): WplClass {
  if (wpl >= WPL_THRESHOLDS.blunder) return 'blunder';
  if (wpl >= WPL_THRESHOLDS.mistake) return 'mistake';
  if (wpl >= WPL_THRESHOLDS.inaccuracy) return 'inaccuracy';
  return 'none';
}

export type CpLossClass = 'none' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * @deprecated Use classifyWPL instead. Keeping for backward compatibility if needed.
 */
export function classifyCpLoss(cpLoss: number): CpLossClass {
  if (cpLoss >= CP_LOSS_THRESHOLDS.blunder) return 'blunder';
  if (cpLoss >= CP_LOSS_THRESHOLDS.mistake) return 'mistake';
  if (cpLoss >= CP_LOSS_THRESHOLDS.inaccuracy) return 'inaccuracy';
  return 'none';
}