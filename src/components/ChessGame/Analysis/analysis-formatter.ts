
import { type EngineEvaluation } from '~/lib/stockfish-engine';
import { clientEnv } from '~/lib/env.app';
import { processGameAnalysis } from '~/lib/game-analysis-logic';
import { MAX_AI_ANALYSIS_PER_GAME } from '~/lib/chess-constants';
import { WPL_THRESHOLDS } from '~/lib/evaluation-metrics';

export interface FormattedAnalysisResult {
  analysisText: string;
  missingDescriptions: MissingDescription[];
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

export function formatAnalysisText(
  displayMoves: string[],
  displayResults: EngineEvaluation[],
  displayMoveNumbers: number[],
  analysisDepth: number,
  aiDescriptions: Record<number, string>
): FormattedAnalysisResult {
  const analysisType = 'Entire Game';
  let analysisText = `Game Analysis Results (${analysisType}) - Depth ${analysisDepth}:\n\n`;

  // --- Pass 1: Identification & Throttling ---
  // Note: displayMoveNumbers[0] corresponds to the FIRST move in the display list.
  // displayMoves, displayResults, displayMoveNumbers are all REVERSED (chronological order).
  const gameAnalysisItems = processGameAnalysis(displayMoves, displayResults, clientEnv.AI_WORTHY_THRESHOLD, MAX_AI_ANALYSIS_PER_GAME, displayMoveNumbers[0]);

  // --- Pass 2: Display & Queuing ---
  const missingDescriptions: MissingDescription[] = [];

  displayMoves.forEach((move, index) => {
    const item = gameAnalysisItems[index];
    const { moveNumber, isWhiteMove } = item;
    const result = displayResults[index]; // Use original result for time/pv if needed

    const playerColor = isWhiteMove ? 'White' : 'Black';
    const fullMoveNum = Math.ceil(moveNumber / 2);
    const moveLabel = `${fullMoveNum}${isWhiteMove ? '.' : '...'}`;

    analysisText += `Move ${moveLabel} ${playerColor} ${move}\n`;

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

        // AI Analysis Status
        if (aiDescriptions[moveNumber]) {
          analysisText += `  🤖 AI Analysis: ${aiDescriptions[moveNumber]}\n`;
        } else {
          if (item.willUseAI) {
            // Approved for AI
            missingDescriptions.push({
              index,
              moveNumber,
              data: {
                // FEN is not passed in here, we need to construct the data object in component or pass FENs
                // Wait, the component accesses `targetPositionsRef` for FEN.
                // We should probably just return the essential data and let the component fill in FEN/context.
                // Reducing complexity: The component has valid scopes.
                // Let's simplify: return "items to process" and let component build the data payload?
                // Or pass the FEN in? `displayMoves` logic in component accessed `targetPositionsRef`.

                // To make this pure, we need FENs.
                // Let's assume we can pass fens or just return indices and let component handle the heavy lifting of data construction.
                // But `displayTextualAnalysisResults` constructs `missingDescriptions` with `data`.
                // Let's update arguments to include `MoveContext` or similar? 
                // Or: Just return the "instructions" to fetch AI.

                // Compromise: Return enough info for component to build the payload.
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
          } else if (item.isAiWorthy) {
            // Eligible but Throttled
            analysisText += `  🔒 AI Analysis Throttled (Top ${MAX_AI_ANALYSIS_PER_GAME} Priority)\n`;

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
      }

      // Mate detection
      if (isMateScore(result.evaluation)) {
        const mateDistance = getMateDistance(result.evaluation);
        if (mateDistance <= 5) {
          const mateSign = result.evaluation > 0 ? '+' : '-';
          analysisText += `  🎯 MATE≤5 DETECTED: ${mateSign}M${mateDistance}\n`;
        }
      }
    } else {
      analysisText += `  Analysis: Failed\n`;
    }
    analysisText += '\n';
  });

  analysisText += 'Analysis complete!';

  // Add "Fetching..." footnote
  const approvedCount = missingDescriptions.filter(d => d.data.willUseAI).length;
  if (approvedCount > 0) {
    analysisText += `\n\nFetching AI descriptions for ${approvedCount} priority hurdles...`;
  }

  return { analysisText, missingDescriptions };
}
