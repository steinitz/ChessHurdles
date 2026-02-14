import { computeCentipawnChange, classifyCpLoss, calculateWPL, classifyWPL } from './evaluation-metrics';
import { CP_LOSS_THRESHOLDS } from './chess-constants';
import { EngineEvaluation } from './stockfish-engine';

export interface AnalysisResultItem {
  index: number; // Unique ply index
  moveNumber: number;
  move: string;
  isWhiteMove: boolean;
  absoluteMoveIndex: number; // 0-based ply index in full game
  evaluation: number;
  bestMove: string;
  calculationTime: number;
  principalVariation: string;
  postMoveEvaluation?: number;
  centipawnChange?: number;
  wpl?: number;
  classification?: 'blunder' | 'mistake' | 'inaccuracy' | 'none';
  isAiWorthy: boolean;
  willUseAI: boolean;
  isMate?: boolean;
  mateDistance?: number;
  isBookMove?: boolean;
}

export function processGameAnalysis(
  moves: string[],
  evaluations: EngineEvaluation[],
  aiWorthyThreshold: number = 0.2,
  maxAiAnalysis: number = 5,
  startMoveNumber: number = 1,
  startWithWhite: boolean = true,
  bookMoveIndices: Set<number> = new Set(),
  startAbsoluteIndex: number = 0
): AnalysisResultItem[] {
  // Ensure inputs are aligned and in chronological order
  // Note: The caller is responsible for passing chronological arrays.

  const results: AnalysisResultItem[] = [];
  const candidates: AnalysisResultItem[] = [];

  const START_POS_EVAL = 15; // +0.15 default advantage for White
  // If we start analysis mid-game, assuming START_POS_EVAL for "prevEval" of the first move is dangerous
  // if the position is already -3.0.
  // Ideally, we should pass the "eval before the first move" if known.
  // For now, let's keep it but ideally GameAnalysis should provide context.

  moves.forEach((move, index) => {
    // ply 0 = move 1 white, ply 1 = move 1 black (if startWithWhite=true)
    // if startWithWhite=false: ply 0 = move 1 black.
    // index 0, startWhite=T -> White (0%2==0)
    // index 0, startWhite=F -> Black 
    // index 1, startWhite=T -> Black (1%2!=0)
    // index 1, startWhite=F -> White
    // So: follows standard chess ply coloring logic.

    const isWhiteMove = startWithWhite ? (index % 2 === 0) : (index % 2 !== 0);
    const moveNumber = startMoveNumber + Math.floor((index + (startWithWhite ? 0 : 1)) / 2);
    const absoluteMoveIndex = startAbsoluteIndex + index;

    const result = evaluations[index]; // Pre-Move Analysis (Evaluation BEFORE move is played)
    const postMoveResult = evaluations[index + 1]; // Post-Move Analysis (Evaluation AFTER move is played)

    if (!result) return;

    const isBook = bookMoveIndices.has(index);

    const item: AnalysisResultItem = {
      index, // Unique ID
      moveNumber, // This is full move number
      move,
      isWhiteMove,
      absoluteMoveIndex,
      evaluation: result.evaluation, // Pre-Move Evaluation (Best possible play from current position)
      postMoveEvaluation: postMoveResult?.evaluation, // Post-Move Evaluation (Value of the position achieved)
      bestMove: result.bestMove, // Best Move Suggested by Engine
      calculationTime: result.calculationTime,
      principalVariation: result.principalVariation,
      isMate: Math.abs(result.evaluation) > 5000,
      mateDistance: Math.abs(result.evaluation) > 5000 ? Math.abs(result.evaluation) - 5000 : undefined,
      isAiWorthy: false,
      willUseAI: false,
      isBookMove: isBook
    };

    // Calculate centipawn change
    // Compare Pre-Move Evaluation (Best possible) vs Post-Move Evaluation (Actual outcome)
    // We only compute change if we have the Post-Move evaluation.
    // The last move in the list might not have a Post-Move evaluation available unless we analyzed N+1 positions.

    if (postMoveResult) {
      const prevEval = result.evaluation;
      const currentEval = postMoveResult.evaluation;

      const cpChange = computeCentipawnChange(prevEval, currentEval, isWhiteMove);
      const wpl = calculateWPL(prevEval, currentEval, isWhiteMove);

      item.centipawnChange = cpChange;
      item.wpl = wpl;

      // IDENTICAL MOVE FILTER: Skip classification if played move matches best move
      // This prevents evaluation noise between analyses from flagging the best move as an inaccuracy
      // (e.g., "1.d4 best d4" or "7...O-O best O-O" caused by slight eval differences at different depths/times)
      const playedMoveSan = move.trim().toLowerCase();
      // CLEANUP: Search tree results often include move numbers (e.g., "1.d4", "2...Nf6")
      // We must strip ONLY the leading number and dots, preserving rank digits in the move (e.g. "c3")
      const bestMoveSan = result.bestMove.replace(/^\d+\.+/, '').trim().toLowerCase();

      if (playedMoveSan === bestMoveSan) {
        // Player chose the best move - any CP change is just eval noise, not a real inaccuracy
        item.classification = 'none';
      } else {
        // Different move played - proceed with normal WPL classification
        item.classification = classifyWPL(wpl);
      }

      // --- OVERRIDE IF BOOK MOVE ---
      if (isBook && (item.classification === 'inaccuracy' || item.classification === 'mistake')) {
        console.log(`[Analysis] Overriding ${item.classification} for book move: ${moveNumber}${isWhiteMove ? '.' : '...'} ${move}`);
        item.classification = 'none';
      }

      // Eligibility Check
      if (item.classification !== 'none') {
        item.isAiWorthy = wpl >= aiWorthyThreshold;
        if (item.isAiWorthy) {
          candidates.push(item);
        }
      }
    } else {
      // Last move logic or missing data
      item.classification = 'none';
    }

    results.push(item);
  });

  // Sort candidates by Severity (WPL descending)
  candidates.sort((a, b) => (b.wpl || 0) - (a.wpl || 0));

  // Mark Top N as "willUseAI"
  const approvedCandidates = candidates.slice(0, maxAiAnalysis);
  const approvedSet = new Set(approvedCandidates.map(c => c.index)); // Use unique index

  console.log(`[Analysis] Candidates: ${candidates.length}, Approved: ${approvedCandidates.length} (Max: ${maxAiAnalysis})`);

  results.forEach(item => {
    // If it's in the approved set, mark it
    if (approvedSet.has(item.index) && item.classification !== 'none') {
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
