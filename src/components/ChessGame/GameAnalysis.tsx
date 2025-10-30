import React, { useState, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import EvaluationGraph from '~/components/EvaluationGraph';
import { 
  initializeStockfishWorker, 
  analyzePosition, 
  handleEngineMessage,
  type EngineEvaluation,
  type EngineCallbacks
} from '~/lib/stockfish-engine';

interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
}

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
}

interface GameAnalysisProps {
  gameMoves: GameMove[];
  containerWidth: number;
  analysisWorkerRef: React.MutableRefObject<Worker | null>;
  goToMove: (index: number) => void;
}

export default function GameAnalysis({ 
  gameMoves, 
  containerWidth, 
  analysisWorkerRef,
  goToMove 
}: GameAnalysisProps) {
  // Moved state from ChessGame
  const [moveAnalysisDepth, setMoveAnalysisDepth] = useState(13);
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');

  // Moved refs from ChessGame
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');
  const targetMovesRef = useRef<string[]>([]);
  const targetPositionsRef = useRef<Chess[]>([]);
  const analysisResultsRef = useRef<EngineEvaluation[]>([]);
  const currentAnalysisIndexRef = useRef<number>(0);
  const isAnalyzingPositionRef = useRef<boolean>(false);

  // Helper functions (moved from ChessGame)
  const isMateScore = (evaluation: number): boolean => {
    return Math.abs(evaluation) > 5000;
  };

  const getMateDistance = (evaluation: number): number => {
    return Math.abs(evaluation) - 5000;
  };

  const normalizeEvaluation = (evaluation: number, isWhiteToMove: boolean): number => {
    return isWhiteToMove ? evaluation : -evaluation;
  };

  // Moved handlers from ChessGame
  const handleAnalyzeEntireGame = useCallback(() => {
    if (gameMoves.length <= 1) { // Only initial position
      setMoveAnalysisResults('No moves in the game to analyze.');
      return;
    }

    if (isAnalyzingMoves) {
      setMoveAnalysisResults('Analysis already in progress...');
      return;
    }

    // Analyze all moves in the game (skip initial position)
    const targetMoves = gameMoves.slice(1).map(gameMove => gameMove.move!);
    const targetPositions = gameMoves.slice(1).map(gameMove => gameMove.position);

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;

    setIsAnalyzingMoves(true);
    setMoveAnalysisResults('Starting analysis of entire game...\n\nInitializing Stockfish engine...');

    // Initialize Stockfish worker if not already done
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              // Store the result for this position
              analysisResultsRef.current[currentAnalysisIndexRef.current] = evaluation;

              // Move to next position
              currentAnalysisIndexRef.current++;

              if (currentAnalysisIndexRef.current < targetPositionsRef.current.length) {
                // Analyze next position
                const nextPosition = targetPositionsRef.current[currentAnalysisIndexRef.current];
                if (nextPosition) {
                  analyzePosition(
                    analysisWorkerRef.current,
                    nextPosition.fen(),
                    moveAnalysisDepth,
                    isAnalyzingPositionRef.current,
                    (analyzing: boolean) => { isAnalyzingPositionRef.current = analyzing; },
                    () => {}, // setError
                    startTimeRef,
                    analyzingFenRef
                  );
                }
              } else {
                // Analysis complete
                displayAnalysisResults();
              }
            },
            setIsAnalyzing: () => {}, // We manage this ourselves
          };

          handleEngineMessage(
            event.data,
            moveAnalysisDepth,
            startTimeRef.current,
            analyzingFenRef.current,
            callbacks
          );
        },
        (errorMsg: string) => {
          setMoveAnalysisResults(`Error initializing Stockfish: ${errorMsg}`);
          setIsAnalyzingMoves(false);
        }
      );
    }

    // Start analyzing the first position
    if (targetPositions.length > 0 && targetPositions[0]) {
      setTimeout(() => {
        analyzePosition(
          analysisWorkerRef.current,
          targetPositions[0].fen(),
          moveAnalysisDepth, // depth
          isAnalyzingPositionRef.current,
          (analyzing: boolean) => { isAnalyzingPositionRef.current = analyzing; },
          () => {}, // setError
          startTimeRef,
          analyzingFenRef
        );
      }, 1000); // Give Stockfish time to initialize
    }
  }, [gameMoves, isAnalyzingMoves, moveAnalysisDepth, analysisWorkerRef]);

  const handleAnalyzeMoves15to20 = useCallback(() => {
    if (gameMoves.length < 21) { // Need at least 21 positions (initial + 20 moves)
      setMoveAnalysisResults('Not enough moves in the game. Need at least 20 moves to analyze moves 15-20.');
      return;
    }

    if (isAnalyzingMoves) {
      setMoveAnalysisResults('Analysis already in progress...');
      return;
    }

    // Extract moves 15-20 (gameMoves indices 15-20, since index 0 is initial position)
    const targetMoves = gameMoves.slice(15, 21).map(gameMove => gameMove.move!);
    const targetPositions = gameMoves.slice(15, 21).map(gameMove => gameMove.position);

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;

    setIsAnalyzingMoves(true);
    setMoveAnalysisResults('Starting analysis of moves 15-20...\n\nInitializing Stockfish engine...');

    // Initialize Stockfish worker if not already done
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              // Store the result for this position
              analysisResultsRef.current[currentAnalysisIndexRef.current] = evaluation;

              // Move to next position
              currentAnalysisIndexRef.current++;

              if (currentAnalysisIndexRef.current < targetPositionsRef.current.length) {
                // Analyze next position
                const nextPosition = targetPositionsRef.current[currentAnalysisIndexRef.current];
                if (nextPosition) {
                  analyzePosition(
                    analysisWorkerRef.current,
                    nextPosition.fen(),
                    moveAnalysisDepth,
                    isAnalyzingPositionRef.current,
                    (analyzing: boolean) => { isAnalyzingPositionRef.current = analyzing; },
                    () => {}, // setError
                    startTimeRef,
                    analyzingFenRef
                  );
                }
              } else {
                // Analysis complete
                displayAnalysisResults();
              }
            },
            setIsAnalyzing: () => {}, // We manage this ourselves
          };

          handleEngineMessage(
            event.data,
            moveAnalysisDepth, // Use actual depth setting
            startTimeRef.current,
            analyzingFenRef.current,
            callbacks
          );
        },
        (error: string) => {
          setMoveAnalysisResults(`Error initializing Stockfish: ${error}`);
          setIsAnalyzingMoves(false);
        }
      );
    }

    // Start analyzing the first position
    if (targetPositions.length > 0 && targetPositions[0]) {
      setTimeout(() => {
        analyzePosition(
          analysisWorkerRef.current,
          targetPositions[0].fen(),
          moveAnalysisDepth, // depth
          false,
          () => {}, // setIsAnalyzing - we manage this ourselves
          () => {}, // setError
          startTimeRef,
          analyzingFenRef
        );
      }, 1000); // Give Stockfish time to initialize
    }
  }, [gameMoves, isAnalyzingMoves, moveAnalysisDepth, analysisWorkerRef]);

  const displayAnalysisResults = useCallback(() => {
    const targetMoves = targetMovesRef.current;
    const results = analysisResultsRef.current;
    
    // Determine what was analyzed based on the moves
    const isFullGame = targetMoves.length === gameMoves.length - 1; // -1 because gameMoves includes initial position
    const startMoveNumber = isFullGame ? 1 : 15;
    const analysisType = isFullGame ? 'Entire Game' : 'Moves 15-20';
    
    // Use the depth from the user's slider setting
    const analysisDepth = moveAnalysisDepth;
    
    let analysisText = `Game Analysis Results (${analysisType}) - Depth ${analysisDepth}:\n\n`;
    
    targetMoves.forEach((move, index) => {
      const moveNumber = startMoveNumber + index;
      const result = results[index];
      const isWhiteMove = (moveNumber % 2) === 1;
      
      analysisText += `Move ${moveNumber}: ${move}\n`;
      
      if (result) {
        const evalStr = Math.abs(result.evaluation) > 5000 
          ? `#${Math.sign(result.evaluation) * (Math.abs(result.evaluation) - 5000)}`
          : (result.evaluation / 100).toFixed(2);
        analysisText += `  Evaluation: ${evalStr}\n`;
        analysisText += `  Best Move: ${result.bestMove}\n`;
        analysisText += `  Time: ${result.calculationTime}ms\n`;
        
        // Calculate centipawnLoss if we have a previous result
        if (index > 0) {
          const prevResult = results[index - 1];
          if (prevResult) {
            // Get evaluations from mover's perspective
            const preCp = normalizeEvaluation(prevResult.evaluation, isWhiteMove);
            const postCp = normalizeEvaluation(result.evaluation, !isWhiteMove); // Opponent's perspective, so flip

            // Calculate centipawnChange: max(0, preCp + postCp) - measures evaluation swing from White's perspective
            const centipawnChange = Math.max(0, preCp + postCp);

            analysisText += `  centipawnChange: ${centipawnChange}\n`;

            // Highlight significant centipawnChange (≥150 = mistake/blunder threshold)
            if (centipawnChange >= 150) {
              if (centipawnChange >= 300) {
                analysisText += `  ⚠️  BLUNDER (centipawnChange ≥300)\n`;
              } else {
                analysisText += `  ⚠️  MISTAKE (centipawnChange ≥150)\n`;
              }
            }
          }
        }
        
        // Check for mate≤5 detection
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
    setMoveAnalysisResults(analysisText);
    setIsAnalyzingMoves(false);
  }, [gameMoves.length, moveAnalysisDepth]);

  // Transform EngineEvaluation to EvaluationData for the graph
  const transformToEvaluationData = (analysisResults: EngineEvaluation[]): EvaluationData[] => {
    return analysisResults.map((result, index) => ({
      moveNumber: index + 1,
      evaluation: result.evaluation,
      isMate: isMateScore(result.evaluation),
      mateIn: isMateScore(result.evaluation) ? getMateDistance(result.evaluation) : undefined
    }));
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Game Analysis</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Analysis Depth: {moveAnalysisDepth}
        </label>
        <input
          type="range"
          min="5"
          max="20"
          value={moveAnalysisDepth}
          onChange={(e) => setMoveAnalysisDepth(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isAnalyzingMoves}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5 (Fast)</span>
          <span>20 (Deep)</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleAnalyzeEntireGame}
          disabled={isAnalyzingMoves || gameMoves.length <= 1}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isAnalyzingMoves ? 'Analyzing...' : 'Analyze Entire Game'}
        </button>
        
        <button
          onClick={handleAnalyzeMoves15to20}
          disabled={isAnalyzingMoves || gameMoves.length < 21}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Analyze Moves 15-20
        </button>
      </div>

      {moveAnalysisResults && (
        <div className="mb-4">
          <h4 className="text-md font-medium mb-2">Analysis Results</h4>
          <pre className="bg-white p-3 rounded border text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {moveAnalysisResults}
          </pre>
        </div>
      )}

      <EvaluationGraph
          evaluations={transformToEvaluationData(analysisResultsRef.current)}
          onMoveClick={goToMove}
          width={containerWidth}
          height={200}
        />
    </div>
  );
}