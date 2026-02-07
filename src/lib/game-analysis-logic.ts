import { computeCentipawnChange, classifyCpLoss, calculateWPL, classifyWPL } from './evaluation-metrics';
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
  wpl?: number;
  classification?: 'blunder' | 'mistake' | 'inaccuracy' | 'none';
  isAiWorthy: boolean;
  willUseAI: boolean;
  isMate?: boolean;
  mateDistance?: number;
}

export function processGameAnalysis(
  moves: string[],
  evaluations: EngineEvaluation[],
  aiWorthyThreshold: number = 0.2,
  maxAiAnalysis: number = 5,
  startMoveNumber: number = 1
): AnalysisResultItem[] {
  // Ensure inputs are aligned and in chronological order
  // Note: The caller is responsible for passing chronological arrays.

  const results: AnalysisResultItem[] = [];
  const candidates: AnalysisResultItem[] = [];

  moves.forEach((move, index) => {
    // ply 0 = move 1 white, ply 1 = move 1 black
    // If startMoveNumber is in "full moves" (e.g. 1):
    // index 0 -> 1. e4
    // index 1 -> 1... e5
    const moveNumber = startMoveNumber + Math.floor(index / 2);
    const isWhiteMove = (index % 2) === 0;
    const result = evaluations[index];

    if (!result) return;

    const item: AnalysisResultItem = {
      moveNumber, // This is full move number
      move,
      isWhiteMove,
      evaluation: result.evaluation,
      bestMove: result.bestMove,
      calculationTime: result.calculationTime,
      principalVariation: result.principalVariation,
      isMate: Math.abs(result.evaluation) > 5000,
      mateDistance: Math.abs(result.evaluation) > 5000 ? Math.abs(result.evaluation) - 5000 : undefined,
      isAiWorthy: false,
      willUseAI: false
    };

    // Calculate centipawn change
    if (index < evaluations.length - 1) {
      const nextResult = evaluations[index + 1];
      if (nextResult) {
        const cpChange = computeCentipawnChange(result.evaluation, nextResult.evaluation, isWhiteMove);
        const wpl = calculateWPL(result.evaluation, nextResult.evaluation, isWhiteMove);



        item.centipawnChange = cpChange;
        item.wpl = wpl;

        // We can use either classification. For now, let's use WPL classification if available, or CP loss fallback
        item.classification = classifyWPL(wpl);

        // Eligibility Check
        if (item.classification !== 'none') {
          item.isAiWorthy = wpl >= aiWorthyThreshold;
          if (item.isAiWorthy) {
            candidates.push(item);
          }
        }
      }
    }

    results.push(item);
  });

  // Sort candidates by Severity (WPL descending)
  candidates.sort((a, b) => (b.wpl || 0) - (a.wpl || 0));

  // Mark Top N as "willUseAI"
  const approvedCandidates = candidates.slice(0, maxAiAnalysis);
  const approvedSet = new Set(approvedCandidates.map(c => c.moveNumber)); // Use moveNumber as unique ID

  console.log(`[Analysis] Candidates: ${candidates.length}, Approved: ${approvedCandidates.length} (Max: ${maxAiAnalysis})`);

  results.forEach(item => {
    // If it's in the approved set, mark it
    if (approvedSet.has(item.moveNumber) && item.classification !== 'none') {
      item.willUseAI = true;
      item.isAiWorthy = true; // Ensure it's marked worthy if it was a candidate
    } else {
      // If it *was* a candidate (had classification/wpl) but didn't make the cut
      // maintain isAiWorthy = true (so we show "Throttled")
      // effectively: isAiWorthy = (has classification & wpl > threshold), which we set earlier.
      // So we don't need to change anything else.
    }
  });

  return results;
}
