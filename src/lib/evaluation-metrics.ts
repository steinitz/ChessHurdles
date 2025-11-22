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

export type CpLossClass = 'none' | 'inaccuracy' | 'mistake' | 'blunder';

/** Classify centipawn loss against shared thresholds. */
export function classifyCpLoss(cpLoss: number): CpLossClass {
  if (cpLoss >= CP_LOSS_THRESHOLDS.blunder) return 'blunder';
  if (cpLoss >= CP_LOSS_THRESHOLDS.mistake) return 'mistake';
  if (cpLoss >= CP_LOSS_THRESHOLDS.inaccuracy) return 'inaccuracy';
  return 'none';
}