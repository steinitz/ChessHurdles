
import { type EngineEvaluation } from '~/lib/stockfish-engine';
import { clientEnv } from '~/lib/env.app';
import { processGameAnalysis } from '~/lib/game-analysis-logic';
import { MAX_AI_ANALYSIS_PER_GAME } from '~/lib/chess-constants';
import { WPL_THRESHOLDS } from '~/lib/evaluation-metrics';

export interface FormattedAnalysisResult {
  analysisText: string;
  missingDescriptions: MissingDescription[];
  structuredAnalysis: AnalysisDisplayItem[];
}

export interface MissingDescription {
  index: number;
  moveNumber: number;
  data: any;
}

// Helper functions (duplicated for now to avoid circular dependencies if moved to utils)
const isMateScore = (evaluation: number): boolean => {
  return Math.abs(evaluation) > 5000;
};

const getMateDistance = (evaluation: number): number => {
  return Math.abs(evaluation) - 5000;
};

export interface AnalysisDisplayItem {
  index: number;
  moveNumber: number;
  moveLabel: string;
  playerColor: 'White' | 'Black';
  absoluteMoveIndex: number; // 0-based ply index in full game
  moveSan: string;
  evaluation: number; // Pre-Move Eval
  postMoveEvaluation?: number; // Post-Move Eval (Result of the move)
  bestMove: string;
  classification?: 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'none';
  wpl?: number;
  centipawnChange?: number;
  aiDescription?: string;
  isAiThrottled?: boolean;
  mateIn?: number;
  calculationTime: number;
  isWhiteMove: boolean;
  pv?: string;
}

export function formatAnalysisText(
  displayMoves: string[],
  displayResults: EngineEvaluation[],
  displayMoveNumbers: number[],
  analysisDepth: number,
  aiDescriptions: Record<number, string>,
  startWithWhite: boolean = true,
  bookMoveIndices: Set<number> = new Set(),
  startAbsoluteIndex: number = 0
): FormattedAnalysisResult {
  const analysisType = 'Entire Game';
  let analysisText = `Game Analysis Results (${analysisType}) - Depth ${analysisDepth}:\n\n`;

  // --- Pass 1: Identification & Throttling ---
  // Note: displayMoveNumbers[0] corresponds to the FIRST move in the display list.
  // displayMoves, displayResults, displayMoveNumbers are all REVERSED (chronological order).
  const gameAnalysisItems = processGameAnalysis(
    displayMoves,
    displayResults,
    clientEnv.AI_WORTHY_THRESHOLD,
    MAX_AI_ANALYSIS_PER_GAME,
    displayMoveNumbers[0],
    startWithWhite,
    bookMoveIndices,
    startAbsoluteIndex
  );

  // --- Pass 2: Display & Queuing ---
  const missingDescriptions: MissingDescription[] = [];
  const structuredAnalysis: AnalysisDisplayItem[] = [];

  displayMoves.forEach((move, index) => {
    const item = gameAnalysisItems[index];
    const { moveNumber, isWhiteMove } = item;
    const result = displayResults[index]; // Use original result for time/pv if needed

    // const isWhiteMove = item.isWhiteMove; // processGameAnalysis now calculates isWhiteMove accurately.
    const fullMoveNum = moveNumber; // Already full move number
    const moveLabel = `${fullMoveNum}${isWhiteMove ? '.' : '...'}`;
    const playerColor = isWhiteMove ? 'White' : 'Black';

    // Text formatting (keeping for backward compat or copy-paste)
    analysisText += `Move ${moveLabel} ${playerColor} ${move}\n`;

    const displayItem: AnalysisDisplayItem = {
      index,
      moveNumber: fullMoveNum,
      moveLabel,
      playerColor,
      absoluteMoveIndex: item.absoluteMoveIndex,
      moveSan: item.move,
      evaluation: item.evaluation,
      postMoveEvaluation: item.postMoveEvaluation,
      bestMove: item.bestMove,
      classification: item.classification || 'none',
      wpl: item.wpl,
      centipawnChange: item.centipawnChange,
      aiDescription: aiDescriptions[moveNumber] || undefined,
      isAiThrottled: item.isAiWorthy && !aiDescriptions[moveNumber] && !item.willUseAI, // Simple heuristic for now
      mateIn: item.mateDistance,
      calculationTime: result?.calculationTime ?? 0,
      isWhiteMove,
      pv: result?.principalVariation
    };

    if (result) {
      const evalStr = Math.abs(result.evaluation) > 5000
        ? `#${Math.sign(result.evaluation) * (Math.abs(result.evaluation) - 5000)}`
        : (result.evaluation / 100).toFixed(2);
      analysisText += `  Evaluation: ${evalStr}\n`;
      analysisText += `  Best Move: ${result.bestMove}\n`;
      analysisText += `  Time: ${result.calculationTime}ms\n`;
      if (result.calculationTime === 0) {
        analysisText += `  Source: Cached\n`;
      }

      if (item.classification && item.classification !== 'none' && item.wpl !== undefined && item.centipawnChange !== undefined) {
        const label = item.classification.charAt(0).toUpperCase() + item.classification.slice(1);
        // Show WPL
        analysisText += `  Change: -${(item.centipawnChange / 100).toFixed(2)} (WPL ${(item.wpl * 100).toFixed(1)}%)\n`;
        analysisText += `  ⚠️  ${label} (WPL >= ${WPL_THRESHOLDS[item.classification as keyof typeof WPL_THRESHOLDS]})\n`;

        if (result.principalVariation) {
          analysisText += `  Principal Variation: ${result.principalVariation}\n`;
        }

        // Populate Structured Data Details
        displayItem.classification = item.classification;
        displayItem.wpl = item.wpl;
        displayItem.centipawnChange = item.centipawnChange;

        // AI Analysis Status
        if (aiDescriptions[moveNumber]) {
          analysisText += `  🤖 AI Analysis: ${aiDescriptions[moveNumber]}\n`;
          displayItem.aiDescription = aiDescriptions[moveNumber];
        } else {
          if (item.willUseAI) {
            // Approved for AI
            missingDescriptions.push({
              index,
              moveNumber,
              data: {
                move,
                evaluation: result.evaluation,
                bestMove: result.bestMove,
                pv: result.principalVariation,
                centipawnLoss: item.centipawnChange,
                wpl: item.wpl,
                isWorthy: true,
                willUseAI: true
              }
            });
            // Mark as throttled if it WAS worthy but we just haven't fetched it yet?
            // Actually `willUseAI` means it IS approved.
          } else if (item.isAiWorthy) {
            // Eligible but Throttled
            analysisText += `  🔒 AI Analysis Throttled (Top ${MAX_AI_ANALYSIS_PER_GAME} Priority)\n`;
            displayItem.isAiThrottled = true;

            // Still save as Silent Hurdle
            missingDescriptions.push({
              index,
              moveNumber,
              data: {
                move,
                evaluation: result.evaluation,
                bestMove: result.bestMove,
                pv: result.principalVariation,
                centipawnLoss: item.centipawnChange,
                wpl: item.wpl,
                isWorthy: true,
                willUseAI: false
              }
            });
          } else {
            // Generic Silent Hurdle
            missingDescriptions.push({
              index,
              moveNumber,
              data: {
                move,
                evaluation: result.evaluation,
                bestMove: result.bestMove,
                pv: result.principalVariation,
                centipawnLoss: item.centipawnChange,
                wpl: item.wpl,
                isWorthy: false,
                willUseAI: false
              }
            });
          }
        }
      } else {
        // Not a hurdle
        analysisText += `  centipawnChange: ${item.centipawnChange}\n`;
        displayItem.centipawnChange = item.centipawnChange;
      }

      // Mate detection
      if (isMateScore(result.evaluation)) {
        const mateDistance = getMateDistance(result.evaluation);
        displayItem.mateIn = Math.sign(result.evaluation) * mateDistance;

        if (mateDistance <= 5) {
          const mateSign = result.evaluation > 0 ? '+' : '-';
          analysisText += `  🎯 MATE≤5 DETECTED: ${mateSign}M${mateDistance}\n`;
        }
      }
    } else {
      analysisText += `  Analysis: Failed\n`;
    }
    analysisText += '\n';

    structuredAnalysis.push(displayItem);
  });

  analysisText += 'Analysis complete!';

  // Add "Fetching..." footnote
  const approvedCount = missingDescriptions.filter(d => d.data.willUseAI).length;
  if (approvedCount > 0) {
    analysisText += `\n\nFetching AI descriptions for ${approvedCount} priority hurdles...`;
  }

  return { analysisText, missingDescriptions, structuredAnalysis };
}
