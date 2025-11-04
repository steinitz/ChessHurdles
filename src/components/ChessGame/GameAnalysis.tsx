import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import EvaluationGraph from '~/components/ChessGame/EvaluationGraph';
import { 
  initializeStockfishWorker, 
  analyzePosition, 
  handleEngineMessage,
  type EngineEvaluation,
  type EngineCallbacks
} from '~/lib/stockfish-engine';
import {Spacer} from '~stzUtils/components/Spacer';

/**
 * REVERSE ANALYSIS INFRASTRUCTURE
 * 
 * This component implements a sophisticated reverse analysis system for chess games.
 * The key insight is that the engine benefits from having "seen the future" when 
 * analyzing a given move - by processing moves in reverse chronological order, 
 * the engine can leverage knowledge of how the game actually unfolded to provide 
 * more contextually aware evaluations.
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * 1. DATA STRUCTURE MAPPING:
 *    - gameMoves[0] = initial position (before any moves)
 *    - gameMoves[1] = position after move 1
 *    - gameMoves[N] = position after move N
 *    - To analyze move N, we need gameMoves[N-1] (position before move N)
 * 
 * 2. REVERSE ANALYSIS ORDER:
 *    - We analyze moves in reverse chronological order (last moves first)
 *    - This allows for progressive display while maintaining analysis efficiency
 *    - Example: For moves 86,87 we analyze move 87 first, then move 86
 * 
 * 3. DISPLAY ORDER TRANSFORMATION:
 *    - Analysis happens in reverse: [move 87, move 86]
 *    - Display shows chronologically: [move 86, move 87]
 *    - Transform: displayIndex = (targetMoveNumbers.length - 1) - analysisIndex
 * 
 * 4. PROGRESSIVE GRAPH UPDATES:
 *    - Initialize evaluation array with nulls: [null, null]
 *    - As analysis completes, fill positions: [evaluation86, null] → [evaluation86, evaluation87]
 *    - Filter nulls before passing to EvaluationGraph component
 * 
 * 5. CONFIGURABLE ANALYSIS SCOPE:
 *    - maxMovesToAnalyze prop allows testing with fewer moves (default: 2)
 *    - Useful for development, testing, and performance optimization
 */

// Analysis depth constants - exported for testing
export const MIN_ANALYSIS_DEPTH = 1;
export const MAX_ANALYSIS_DEPTH = 21;
export const DEFAULT_ANALYSIS_DEPTH = 4;

interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  isPlaceholder?: boolean;
}

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
}

interface GameAnalysisProps {
  gameMoves: GameMove[];
  analysisWorkerRef: React.MutableRefObject<Worker | null>;
  goToMove: (index: number) => void;
  maxMovesToAnalyze?: number; // Optional prop for testing and development
}

export default function GameAnalysis({ 
  gameMoves, 
  analysisWorkerRef,
  goToMove,
  maxMovesToAnalyze 
}: GameAnalysisProps) {
  // Moved state from ChessGame
  const [moveAnalysisDepth, setMoveAnalysisDepth] = useState(DEFAULT_ANALYSIS_DEPTH);
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');
  const [currentEvaluations, setCurrentEvaluations] = useState<EvaluationData[]>([]);

  // Moved refs from ChessGame
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');
  const targetMovesRef = useRef<string[]>([]);
  const targetPositionsRef = useRef<Chess[]>([]);
  const targetMoveNumbersRef = useRef<number[]>([]);
  const analysisResultsRef = useRef<EngineEvaluation[]>([]);
  const currentAnalysisIndexRef = useRef<number>(0);
  // Use a ref for depth so engine callbacks always see latest value
  const moveAnalysisDepthRef = useRef<number>(DEFAULT_ANALYSIS_DEPTH);

  useEffect(() => {
    moveAnalysisDepthRef.current = moveAnalysisDepth;
  }, [moveAnalysisDepth]);

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

    // Analyze last two moves in reverse order (for debugging)
    const allMoves = gameMoves.slice(1).map(gameMove => gameMove.move!);
    
    // For each move, we need the position BEFORE the move was played
    // gameMoves[0] = initial position, gameMoves[1] = after move 1, etc.
    // So to analyze move N, we need gameMoves[N-1] (position before move N)
    const allPositionsBeforeMoves = gameMoves.slice(0, -1).map(gameMove => gameMove.position); // All positions except the last one
    
    // Determine how many moves to analyze (default to 2 for backward compatibility)
    const movesToAnalyze = maxMovesToAnalyze || 2;
    
    // Take only the specified number of moves from the end and reverse the order
    const targetMoves = allMoves.slice(-movesToAnalyze).reverse();
    const targetPositions = allPositionsBeforeMoves.slice(-movesToAnalyze).reverse();
    
    // Calculate the actual move numbers (specified number of moves from end, in reverse order)
    const totalMoves = allMoves.length;
    const targetMoveNumbers = Array.from(
      { length: Math.min(movesToAnalyze, totalMoves) }, 
      (_, i) => totalMoves - i
    );

    // Log what moves we captured for analysis
    console.log(`📋 Total moves in game: ${allMoves.length}`);
    console.log(`🎯 Moves selected for analysis (last ${movesToAnalyze}, reversed):`, targetMoves);
    console.log(`🔢 Move numbers:`, targetMoveNumbers);
    console.log(`📊 Analysis depth: ${moveAnalysisDepth}`);

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    targetMoveNumbersRef.current = targetMoveNumbers;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;

    // Initialize currentEvaluations with zero-value placeholders for progressive updates
    const placeholderEvaluations = targetMoveNumbers.map((moveNumber) => ({
      moveNumber,
      evaluation: 0,
      isMate: false,
      isPlaceholder: true
    }));
    setCurrentEvaluations(placeholderEvaluations);

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

              // Update the graph progressively - create evaluation data for this position
              const currentMoveIndex = currentAnalysisIndexRef.current;
              const actualMoveNumber = targetMoveNumbersRef.current[currentMoveIndex];
              const newEvaluationData: EvaluationData = {
                moveNumber: actualMoveNumber,
                evaluation: evaluation.evaluation,
                isMate: isMateScore(evaluation.evaluation),
                mateIn: isMateScore(evaluation.evaluation) ? getMateDistance(evaluation.evaluation) : undefined,
                isPlaceholder: false
              };

              // Update the current evaluations state to show this position on the graph
              // We analyze in reverse order but want to display in chronological order
              setCurrentEvaluations(prev => {
                const updated = [...prev];
                
                // For backwards analysis: analysis index 0 = move 44, index 1 = move 43
                // We want chronological display: index 0 = move 43, index 1 = move 44
                // So: displayIndex = (targetMoveNumbers.length - 1) - currentMoveIndex
                const displayIndex = (targetMoveNumbers.length - 1) - currentMoveIndex;
                updated[displayIndex] = newEvaluationData;
                
                return updated;
              });

              // Move to next position
              currentAnalysisIndexRef.current++;

              if (currentAnalysisIndexRef.current < targetPositionsRef.current.length) {
                // Analyze next position
                const nextPosition = targetPositionsRef.current[currentAnalysisIndexRef.current];
                const nextMove = targetMovesRef.current[currentAnalysisIndexRef.current];
                
                console.log(`🔍 Starting analysis of move ${currentAnalysisIndexRef.current + 1}/2: "${nextMove}"`);
                console.log(`📍 Position FEN: ${nextPosition.fen()}`);
                
                if (nextPosition) {
                  analyzePosition(
                    analysisWorkerRef.current,
                    nextPosition.fen(),
                    moveAnalysisDepthRef.current,
                    isAnalyzingMoves, // Use the actual React state
                    setIsAnalyzingMoves, // Use the state setter
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
            moveAnalysisDepthRef.current,
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
      const firstMove = targetMoves[0];
      console.log(`🔍 Starting analysis of move 1/2: "${firstMove}"`);
      console.log(`📍 Position FEN: ${targetPositions[0].fen()}`);
      
      setTimeout(() => {
        analyzePosition(
          analysisWorkerRef.current,
          targetPositions[0].fen(),
          moveAnalysisDepthRef.current, // depth
          isAnalyzingMoves, // Use the actual React state
          setIsAnalyzingMoves, // Use the state setter
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
    
    // Since we only analyze entire games now, this is always a full game analysis
    const analysisType = 'Entire Game';
    const startMoveNumber = 1;
    
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
    <div style={{ width: '100%' }}>
      <h3>Game Analysis</h3>

      <div >
        <label>
          <div>Analysis Depth: {moveAnalysisDepth}</div>
          <div style={{
            display: 'flex', 
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            fontWeight: 'normal',
            }}
          >
            <span>{MIN_ANALYSIS_DEPTH} (Fast)</span>&nbsp;
            <Spacer orientation="horizontal" />
            <span>{MAX_ANALYSIS_DEPTH} (Deep)</span>
          </div>
        </label>
        <input
          type="range"
          min={MIN_ANALYSIS_DEPTH}
          max={MAX_ANALYSIS_DEPTH}
          value={moveAnalysisDepth}
          onChange={(e) => setMoveAnalysisDepth(Number(e.target.value))}
          disabled={isAnalyzingMoves}
          style={{width: '99%'}}
        />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleAnalyzeEntireGame}
          disabled={isAnalyzingMoves || gameMoves.length <= 1}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isAnalyzingMoves ? 'Analyzing...' : 'Analyze Entire Game'}
        </button>
      </div>

      <div style={{ width: '100%' }}>
        <EvaluationGraph
          evaluations={currentEvaluations}
          onMoveClick={goToMove}
          height={200}
        />
      </div>

      {moveAnalysisResults && (
        <div className="mb-4">
          <h4 className="text-md font-medium mb-2">Analysis Results</h4>
          <pre className="bg-white p-3 rounded border text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {moveAnalysisResults}
          </pre>
        </div>
      )}
    </div>
  );
}