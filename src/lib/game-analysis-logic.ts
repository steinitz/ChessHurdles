import { computeCentipawnChange, classifyCpLoss } from './evaluation-metrics';
import { CP_LOSS_THRESHOLDS } from './chess-constants';
import { EngineEvaluation } from './stockfish-engine';

export interface AnalysisResultItem {
  moveNumber: number;
  move: string;
  isWhiteMove: boolean;
  evaluation: number;
  bestMove: string;
  calculationTime: number;
  principalVariation: string;
  centipawnChange?: number;
  classification?: 'blunder' | 'mistake' | 'inaccuracy' | 'none';
  isMate?: boolean;
  mateDistance?: number;
}

export function processGameAnalysis(
  moves: string[],
  evaluations: EngineEvaluation[],
  startMoveNumber: number = 1
): AnalysisResultItem[] {
  // Ensure inputs are aligned and in chronological order
  // Note: The caller is responsible for passing chronological arrays.

  const results: AnalysisResultItem[] = [];

  moves.forEach((move, index) => {
    const moveNumber = startMoveNumber + Math.floor(index / 2);
    const isWhiteMove = (index % 2) === 0;
    const result = evaluations[index];

    if (!result) return;

    const item: AnalysisResultItem = {
      moveNumber,
      move,
      isWhiteMove,
      evaluation: result.evaluation,
      bestMove: result.bestMove,
      calculationTime: result.calculationTime,
      principalVariation: result.principalVariation,
      isMate: Math.abs(result.evaluation) > 5000,
      mateDistance: Math.abs(result.evaluation) > 5000 ? Math.abs(result.evaluation) - 5000 : undefined
    };

    // Calculate centipawn change
    // We compare current evaluation with the NEXT evaluation to determine the quality of the CURRENT move.
    // Why? Because 'result' is the evaluation of the position BEFORE the move.
    // Wait, let's re-verify the data structure from GameAnalysis.tsx.
    // targetPositionsRef[index] is the position BEFORE targetMovesRef[index].
    // analysisResultsRef[index] is the eval of targetPositionsRef[index].
    // So result.evaluation is the eval BEFORE the move.
    // nextResult.evaluation is the eval AFTER the move (which is the eval of the next position).

    if (index < evaluations.length - 1) {
      const nextResult = evaluations[index + 1];
      if (nextResult) {
        const cpChange = computeCentipawnChange(result.evaluation, nextResult.evaluation, isWhiteMove);
        item.centipawnChange = cpChange;
        item.classification = classifyCpLoss(cpChange);
      }
    }

    results.push(item);
  });

  return results;
}
