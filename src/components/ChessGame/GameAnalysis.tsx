import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import EvaluationGraph from '~/components/ChessGame/EvaluationGraph';
import {
  initializeStockfishWorker,
  analyzePosition,
  handleEngineMessage,
  stopAnalysis,
  calibrateDepth,
  type EngineEvaluation,
  type EngineCallbacks
} from '~/lib/stockfish-engine';
import { Spacer } from '~stzUtils/components/Spacer';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserAnalysisDepth, setUserAnalysisDepth, getAIDescription } from '~/lib/chess-server';
import { saveGame } from '~/lib/server/games';
import { saveHurdle } from '~/lib/server/hurdles';
import {
  CP_LOSS_THRESHOLDS,
  CALIBRATION_TARGET_MS,
  CALIBRATION_TEST_FEN,
  MIN_ANALYSIS_DEPTH,
  MAX_ANALYSIS_DEPTH,
  DEFAULT_ANALYSIS_DEPTH,
  ENGINE_DEFAULT_OPTIONS,
  ANALYSIS_CACHE_FULL_MOVES_LIMIT
} from '~/lib/chess-constants';
export { MIN_ANALYSIS_DEPTH, MAX_ANALYSIS_DEPTH, DEFAULT_ANALYSIS_DEPTH } from '~/lib/chess-constants';
import { computeCentipawnChange, classifyCpLoss } from '~/lib/evaluation-metrics';
import { makeKey, getCachedEval, setCachedEval, clearPersistentCache } from '~/lib/analysis-cache';
import { processGameAnalysis } from '~/lib/game-analysis-logic';

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
 * 5. CACHING STRATEGY:
 *    - We cache evaluations for the first 13 full moves (26 plies) to speed up analysis of common openings.
 *    - The cache key combines the engine fingerprint (options) and the FEN string.
 *    - Cache hits allow us to skip the engine run for that position.
 *    - The limit is defined by ANALYSIS_CACHE_FULL_MOVES_LIMIT in chess-constants.ts.
 * 
 * 6. CONFIGURABLE ANALYSIS SCOPE:
 *    - maxMovesToAnalyze prop allows testing with fewer moves (default: 4)
 *    - Useful for development, testing, and performance optimization
 */

// Analysis depth constants moved to ~/lib/chess-constants for shared usage

interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  isPlaceholder?: boolean;
  isCached?: boolean;
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
  autoAnalyze?: boolean;
  onHurdleSaved?: () => void;
}

export default function GameAnalysis({
  gameMoves,
  analysisWorkerRef,
  goToMove,
  maxMovesToAnalyze,
  autoAnalyze,
  onHurdleSaved
}: GameAnalysisProps) {
  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (analysisWorkerRef.current) {
        console.log('Terminating Stockfish worker on unmount');
        analysisWorkerRef.current.terminate();
        analysisWorkerRef.current = null;
      }
    };
  }, []);

  // Moved state from ChessGame
  const [moveAnalysisDepth, setMoveAnalysisDepth] = useState(DEFAULT_ANALYSIS_DEPTH);
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');
  const [currentEvaluations, setCurrentEvaluations] = useState<EvaluationData[]>([]);
  const [aiDescriptions, setAiDescriptions] = useState<Record<number, string>>({});
  const { data: session } = useSession();

  // Moved refs from ChessGame
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');
  const targetMovesRef = useRef<string[]>([]);
  const targetPositionsRef = useRef<Chess[]>([]);
  const targetMoveNumbersRef = useRef<number[]>([]);
  // Track full move numbers and side-to-move for accurate cache gating
  const targetFullMoveNumbersRef = useRef<number[]>([]);
  const analysisResultsRef = useRef<EngineEvaluation[]>([]);
  const currentAnalysisIndexRef = useRef<number>(0);
  // Capture the index of the position currently being analyzed to avoid race conditions
  const activeAnalysisIndexRef = useRef<number>(0);
  // Use a ref for depth so engine callbacks always see latest value
  const moveAnalysisDepthRef = useRef<number>(DEFAULT_ANALYSIS_DEPTH);
  // Cancellation ref to halt sequencing
  const analysisCancelledRef = useRef<boolean>(false);
  // Guard to avoid persisting default before restore runs
  const hasAttemptedRestoreRef = useRef<boolean>(false);
  // Track if we should auto-calibrate on first load when no stored preference
  const needsCalibrationRef = useRef<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  // Track hurdles currently being processed to avoid duplicates
  const processingHurdlesRef = useRef<Set<number>>(new Set());
  // Cache gating: use full move number (first two full moves / four plies)

  useEffect(() => {
    moveAnalysisDepthRef.current = moveAnalysisDepth;
  }, [moveAnalysisDepth]);

  const handleClearCacheClick = useCallback(() => {
    const removed = clearPersistentCache();
    console.info(`[analysis-cache] manual clear invoked; removed=${removed}`);
  }, []);

  // Helpers for local storage persistence
  const LS_KEY = 'chesshurdles.analysisDepth';
  const readDepthFromLocalStorage = (): number | null => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? Number(raw) : null;
      return typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const writeDepthToLocalStorage = (depth: number) => {
    try {
      localStorage.setItem(LS_KEY, String(depth));
    } catch {
      // ignore
    }
  };

  // On mount/session change, restore depth from DB or local storage
  useEffect(() => {
    let cancelled = false;
    const restoreDepth = async () => {
      let foundStored = false;
      // If authenticated, try server first
      try {
        if (session?.user?.id) {
          const result = await getUserAnalysisDepth();
          const depth = result?.depth;
          if (typeof depth === 'number' && depth >= MIN_ANALYSIS_DEPTH && depth <= MAX_ANALYSIS_DEPTH) {
            if (!cancelled) setMoveAnalysisDepth(depth);
            // sync local storage as well for faster next load
            writeDepthToLocalStorage(depth);
            hasAttemptedRestoreRef.current = true;
            foundStored = true;
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load user analysis depth from server; falling back to local storage', e);
      }

      // Fallback to local storage
      const lsDepth = readDepthFromLocalStorage();
      if (typeof lsDepth === 'number' && lsDepth >= MIN_ANALYSIS_DEPTH && lsDepth <= MAX_ANALYSIS_DEPTH) {
        if (!cancelled) setMoveAnalysisDepth(lsDepth);
        foundStored = true;
      }
      hasAttemptedRestoreRef.current = true;
      if (!foundStored) {
        needsCalibrationRef.current = true;
      }
    };
    restoreDepth();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Manual calibration handler to find a depth close to ~5 seconds
  const handleCalibrateDepth = useCallback(async () => {
    if (isAnalyzingMoves || isCalibrating) return;
    setIsCalibrating(true);
    try {
      // Clear previous Analysis Results to avoid clutter across repeated calibrations
      setMoveAnalysisResults(`Calibrating engine depth (~${Math.round(CALIBRATION_TARGET_MS / 1000)}s target)...`);
      if (!analysisWorkerRef.current) {
        analysisWorkerRef.current = initializeStockfishWorker(
          (event: MessageEvent) => {
            // No-op for calibration-specific runs
          },
          (error: string) => {
            console.error('Engine error during calibration:', error);
          },
          ENGINE_DEFAULT_OPTIONS
        );
      }
      const recommended = await calibrateDepth({
        worker: analysisWorkerRef.current,
        fen: CALIBRATION_TEST_FEN,
        targetMs: CALIBRATION_TARGET_MS,
        minDepth: MIN_ANALYSIS_DEPTH,
        maxDepth: MAX_ANALYSIS_DEPTH,
        timeoutPerRunMs: 20000,
        onProgress: (depth, ms) => {
          setMoveAnalysisResults(prev => prev + `\nDepth ${depth}: ${ms}ms`);
        },
      });
      setMoveAnalysisDepth(recommended);
      setMoveAnalysisResults(prev => prev + `\nCalibration complete: set default depth to ${recommended}.`);
    } catch (e: any) {
      console.warn('Calibration failed:', e);
      setMoveAnalysisResults(prev => prev + '\nCalibration failed; please try again.');
    } finally {
      setIsCalibrating(false);
    }
  }, [isAnalyzingMoves, isCalibrating]);

  // Auto-calibrate on first load when no stored preference
  useEffect(() => {
    const runAutoCalibration = async () => {
      if (isAnalyzingMoves || isCalibrating) return;
      if (!hasAttemptedRestoreRef.current || !needsCalibrationRef.current) return;
      setIsCalibrating(true);
      try {
        setMoveAnalysisResults(prev => (prev ? prev + "\n\n" : '') + `No stored depth found. Calibrating engine (~${Math.round(CALIBRATION_TARGET_MS / 1000)}s target)...`);
        if (!analysisWorkerRef.current) {
          analysisWorkerRef.current = initializeStockfishWorker(
            (event: MessageEvent) => { },
            (error: string) => {
              console.error('Engine error during auto-calibration:', error);
            },
            ENGINE_DEFAULT_OPTIONS
          );
        }
        const recommended = await calibrateDepth({
          worker: analysisWorkerRef.current,
          fen: CALIBRATION_TEST_FEN,
          targetMs: CALIBRATION_TARGET_MS,
          minDepth: MIN_ANALYSIS_DEPTH,
          maxDepth: MAX_ANALYSIS_DEPTH,
          timeoutPerRunMs: 20000,
          onProgress: (depth, ms) => {
            setMoveAnalysisResults(prev => prev + `\nDepth ${depth}: ${ms}ms`);
          },
        });
        setMoveAnalysisDepth(recommended);
        setMoveAnalysisResults(prev => prev + `\nAuto-calibration complete: default depth set to ${recommended}.`);
      } catch (e: any) {
        console.warn('Auto-calibration failed:', e);
        setMoveAnalysisResults(prev => prev + '\nAuto-calibration failed; you can calibrate manually.');
      } finally {
        setIsCalibrating(false);
        needsCalibrationRef.current = false;
      }
    };
    runAutoCalibration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAttemptedRestoreRef.current]);

  // Persist depth on change to DB (if auth) or local storage
  useEffect(() => {
    const persist = async () => {
      // Skip initial persist until we've attempted restore to avoid overwriting
      if (!hasAttemptedRestoreRef.current) return;
      const depth = moveAnalysisDepth;
      writeDepthToLocalStorage(depth);
      if (session?.user?.id) {
        try {
          await setUserAnalysisDepth({ data: depth });
        } catch (e) {
          console.warn('Failed to save analysis depth to server; value kept in local storage', e);
        }
      }
    };
    persist();
  }, [moveAnalysisDepth, session?.user?.id]);

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

    // Determine how many moves to analyze (default to 4 for expanded caching)
    const movesToAnalyze = maxMovesToAnalyze || 4;

    // Take only the specified number of moves from the end and reverse the order
    const targetMoves = allMoves.slice(-movesToAnalyze).reverse();
    const targetPositions = allPositionsBeforeMoves.slice(-movesToAnalyze).reverse();

    // Calculate the actual ply numbers (specified number of moves from end, in reverse order)
    const totalMoves = allMoves.length;
    const targetMoveNumbers = Array.from(
      { length: Math.min(movesToAnalyze, totalMoves) },
      (_, i) => totalMoves - i
    );

    // Also capture full move numbers and color for precise cache gating
    const allMoveNumbers = gameMoves.slice(1).map((gm, idx) => gm.moveNumber ?? Math.floor(idx / 2) + 1);
    const targetFullMoveNumbers = allMoveNumbers.slice(-movesToAnalyze).reverse();

    // Log what moves we captured for analysis
    console.log(`📋 Total moves in game: ${allMoves.length}`);
    console.log(`🎯 Moves selected for analysis (last ${movesToAnalyze}, reversed):`, targetMoves);
    console.log(`🔢 Ply numbers (for display index calc):`, targetMoveNumbers);
    console.log(`🔢 Full move numbers (for cache gating):`, targetFullMoveNumbers);
    console.log(`📊 Analysis depth: ${moveAnalysisDepth}`);

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    targetMoveNumbersRef.current = targetMoveNumbers;
    targetFullMoveNumbersRef.current = targetFullMoveNumbers;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;
    analysisCancelledRef.current = false;
    setAiDescriptions({}); // Clear previous descriptions

    // Initialize currentEvaluations with zero-value placeholders for progressive updates
    const placeholderEvaluations = targetFullMoveNumbers.map((fullMoveNumber) => ({
      moveNumber: fullMoveNumber,
      evaluation: 0,
      isMate: false,
      isPlaceholder: true
    }));
    setCurrentEvaluations(placeholderEvaluations);

    setIsAnalyzingMoves(true);
    setMoveAnalysisResults('Starting analysis of entire game...\n\nInitializing Stockfish engine...');

    // Helper to process the next position in the sequence
    const processNextPosition = (index: number) => {
      // Check if we're done
      if (index >= targetPositionsRef.current.length) {
        displayTextualAnalysisResults();
        return;
      }

      // Check if cancelled
      if (analysisCancelledRef.current) {
        setIsAnalyzingMoves(false);
        return;
      }

      currentAnalysisIndexRef.current = index;
      const nextPosition = targetPositionsRef.current[index];
      const nextMove = targetMovesRef.current[index];

      console.log(`🔍 Starting analysis of move ${index + 1}/${targetPositionsRef.current.length}: "${nextMove}"`);

      const fingerprint = `Hash=${ENGINE_DEFAULT_OPTIONS.Hash}|MultiPV=${ENGINE_DEFAULT_OPTIONS.MultiPV}`;
      const key = makeKey(nextPosition.fen(), fingerprint);
      const nextActualFullMoveNumber = targetFullMoveNumbersRef.current[index];

      // Only serve from cache for FULL moves ≤ limit
      if (nextActualFullMoveNumber <= ANALYSIS_CACHE_FULL_MOVES_LIMIT) {
        const cached = getCachedEval(key);

        if (cached && cached.depth >= moveAnalysisDepthRef.current) {
          console.log(`⚡ Cache hit: depth=${cached.depth}, key="${key}" (full move ${nextActualFullMoveNumber} ≤ ${ANALYSIS_CACHE_FULL_MOVES_LIMIT})`);

          // Serve cached evaluation and advance
          const actualFullMoveNumber = targetFullMoveNumbersRef.current[index];
          const newEvaluation: EngineEvaluation = {
            evaluation: cached.cp,
            bestMove: cached.bestMove || '',
            principalVariation: '',
            depth: cached.depth,
            calculationTime: 0,
          };
          analysisResultsRef.current[index] = newEvaluation;
          const newEvaluationData: EvaluationData = {
            moveNumber: actualFullMoveNumber,
            evaluation: newEvaluation.evaluation,
            isMate: isMateScore(newEvaluation.evaluation),
            mateIn: isMateScore(newEvaluation.evaluation) ? getMateDistance(newEvaluation.evaluation) : undefined,
            isPlaceholder: false,
            isCached: true,
          };
          setCurrentEvaluations((prev) => {
            const updated = [...prev];
            const displayIndex = (targetMoveNumbersRef.current.length - 1) - index;
            updated[displayIndex] = newEvaluationData;
            return updated;
          });

          // Advance to next position immediately (recursive/loop)
          // Use setTimeout to avoid stack overflow on large cached sequences and allow UI updates
          setTimeout(() => {
            processNextPosition(index + 1);
          }, 50);
        } else {
          // Cache miss: run engine
          // Capture active index for this engine run
          activeAnalysisIndexRef.current = index;
          analyzePosition(
            analysisWorkerRef.current,
            nextPosition.fen(),
            moveAnalysisDepthRef.current,
            false,
            setIsAnalyzingMoves,
            () => { },
            startTimeRef,
            analyzingFenRef
          );
        }
      } else {
        // Policy: Do not use cache beyond limit
        console.log(`⏭️ Skipping cache (full move ${nextActualFullMoveNumber} > ${ANALYSIS_CACHE_FULL_MOVES_LIMIT})`);
        // Capture active index for this engine run
        activeAnalysisIndexRef.current = index;
        analyzePosition(
          analysisWorkerRef.current,
          nextPosition.fen(),
          moveAnalysisDepthRef.current,
          false,
          setIsAnalyzingMoves,
          () => { },
          startTimeRef,
          analyzingFenRef
        );
      }
    };

    // Initialize Stockfish worker if not already done
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              // Store the result for the actively analyzed position (avoid index races)
              const currentMoveIndex = activeAnalysisIndexRef.current;
              analysisResultsRef.current[currentMoveIndex] = evaluation;

              // Persist to cache using minimal normalized FEN key
              try {
                const fingerprint = `Hash=${ENGINE_DEFAULT_OPTIONS.Hash}|MultiPV=${ENGINE_DEFAULT_OPTIONS.MultiPV}`;
                // Use the target position FEN for the current index to align with read path
                const currentFen = targetPositionsRef.current[currentMoveIndex]?.fen();
                const key = makeKey(currentFen!, fingerprint);
                const actualFullMoveNumber = targetFullMoveNumbersRef.current[currentMoveIndex];
                // Policy (debug): cache the first N full moves
                if (actualFullMoveNumber <= ANALYSIS_CACHE_FULL_MOVES_LIMIT) {
                  setCachedEval(key, {
                    cp: evaluation.evaluation,
                    depth: evaluation.depth,
                    bestMove: evaluation.bestMove,
                    ts: Date.now()
                  });
                  console.log(`💾 Saved eval to cache: depth=${evaluation.depth}, key="${key}" (full move ${actualFullMoveNumber} ≤ ${ANALYSIS_CACHE_FULL_MOVES_LIMIT})`);
                }
              } catch { }

              // Update the graph progressively - create evaluation data for this position
              // Use the same index captured above
              const actualFullMoveNumber = targetFullMoveNumbersRef.current[currentMoveIndex];
              const newEvaluationData: EvaluationData = {
                moveNumber: actualFullMoveNumber,
                evaluation: evaluation.evaluation,
                isMate: isMateScore(evaluation.evaluation),
                mateIn: isMateScore(evaluation.evaluation) ? getMateDistance(evaluation.evaluation) : undefined,
                isPlaceholder: false,
                isCached: false
              };

              // Update the current evaluations state to show this position on the graph
              // We analyze in reverse order but want to display in chronological order
              setCurrentEvaluations(prev => {
                const updated = [...prev];
                const displayIndex = (targetMoveNumbers.length - 1) - currentMoveIndex;
                updated[displayIndex] = newEvaluationData;
                return updated;
              });
            },
            setIsAnalyzing: (analyzing: boolean) => {
              // When engine signals completion, start next position or finish
              if (!analyzing) {
                // If cancelled, stop
                if (analysisCancelledRef.current) {
                  setIsAnalyzingMoves(false);
                  return;
                }

                // Advance to next position using the helper
                processNextPosition(currentAnalysisIndexRef.current + 1);
              }
            },
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
        },
        ENGINE_DEFAULT_OPTIONS
      );
    }

    // Start analyzing the first position
    if (targetPositions.length > 0) {
      processNextPosition(0);
    }
  }, [gameMoves, isAnalyzingMoves, moveAnalysisDepth, analysisWorkerRef]);

  const handleCancelAnalysis = useCallback(() => {
    analysisCancelledRef.current = true;
    stopAnalysis(analysisWorkerRef.current, isAnalyzingMoves, setIsAnalyzingMoves);
    setMoveAnalysisResults('Analysis cancelled.');
  }, [analysisWorkerRef, isAnalyzingMoves]);

  const displayTextualAnalysisResults = useCallback(() => {
    // Create chronological copies for display
    const displayMoves = [...targetMovesRef.current].reverse();
    const displayResults = [...analysisResultsRef.current].reverse();
    const displayMoveNumbers = [...targetMoveNumbersRef.current].reverse();

    // Since we only analyze entire games now, this is always a full game analysis
    const analysisType = 'Entire Game';

    // Use the depth from the user's slider setting
    const analysisDepth = moveAnalysisDepth;

    let analysisText = `Game Analysis Results (${analysisType}) - Depth ${analysisDepth}:\n\n`;

    // Identify mistakes that need descriptions
    const missingDescriptions: { index: number; moveNumber: number; data: any }[] = [];

    displayMoves.forEach((move, index) => {
      const moveNumber = displayMoveNumbers[index];
      const result = displayResults[index];
      // Calculate isWhiteMove based on the actual move number
      // Move 1 (White), Move 2 (Black), Move 3 (White)...
      // In ply count (1-based): Odd is White, Even is Black.
      // But moveNumber here is likely ply number based on how it was generated in handleAnalyzeEntireGame
      // Let's verify: targetMoveNumbers = totalMoves - i.
      // If totalMoves=7 (Qxh8). targetMoveNumbers=[7, 6, 5, 4, 3, 2, 1].
      // Reversed: [1, 2, 3, 4, 5, 6, 7].
      // Ply 1 = White. Ply 2 = Black.
      const isWhiteMove = (moveNumber % 2) === 1;
      const playerColor = isWhiteMove ? 'White' : 'Black';
      // Format move number: Math.ceil(moveNumber / 2) + (isWhiteMove ? '.' : '...')
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

        // Calculate centipawnLoss by comparing with the NEXT position's evaluation
        // We need Eval_before_move (result) and Eval_after_move (displayResults[index + 1])
        if (index < displayResults.length - 1) {
          const nextResult = displayResults[index + 1];
          if (nextResult) {
            // Compute centipawn loss
            // If White moved: Loss = Eval_before - Eval_after
            // If Black moved: Loss = Eval_after - Eval_before
            // computeCentipawnChange handles this if we pass (before, after, isWhite)
            // Wait, computeCentipawnChange(pre, post, isWhite)
            // If White: max(0, pre - post). Correct.
            // If Black: max(0, post - pre). Correct.
            const centipawnChange = computeCentipawnChange(result.evaluation, nextResult.evaluation, isWhiteMove);

            // Classify and annotate significant loss
            const cls = classifyCpLoss(centipawnChange);

            if (cls === 'mistake' || cls === 'blunder') {
              const threshold = cls === 'blunder' ? CP_LOSS_THRESHOLDS.blunder : CP_LOSS_THRESHOLDS.mistake;
              analysisText += `  centipawnChange: ${centipawnChange}\n`;
              analysisText += `  ⚠️  ${cls.toUpperCase()} (centipawnChange ≥${threshold})\n`;

              // Only show PV when a significant mistake/blunder is identified
              if (result.principalVariation) {
                analysisText += `  Principal Variation: ${result.principalVariation}\n`;
              }

              // Show AI Description if available, otherwise queue for fetch
              if (aiDescriptions[moveNumber]) {
                analysisText += `  🤖 AI Analysis: ${aiDescriptions[moveNumber]}\n`;
              } else {
                // Queue for fetching if not already present
                missingDescriptions.push({
                  index,
                  moveNumber,
                  data: {
                    fen: targetPositionsRef.current[targetPositionsRef.current.length - 1 - index].fen(), // Need correct FEN from reversed original array?
                    // targetPositionsRef is reversed relative to game.
                    // displayMoves[index] corresponds to targetMoves[len - 1 - index]
                    // targetPositions[len - 1 - index] is position BEFORE the move.
                    move,
                    evaluation: result.evaluation,
                    bestMove: result.bestMove,
                    pv: result.principalVariation,
                    centipawnLoss: centipawnChange
                  }
                });
              }
            } else {
              // Show cp change for info even if not a mistake, if desired?
              // For now, keep it clean.
              analysisText += `  centipawnChange: ${centipawnChange}\n`;
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

    // If we have missing descriptions, append a loading message
    if (missingDescriptions.length > 0) {
      analysisText += `\n\nFetching AI descriptions for ${missingDescriptions.length} mistakes...`;
    }

    setMoveAnalysisResults(analysisText);
    setIsAnalyzingMoves(false);

    // Trigger fetches for missing descriptions
    if (missingDescriptions.length > 0) {
      const processingSet = processingHurdlesRef.current;
      // Filter out hurdles that are already being processed or saved
      const newItems = missingDescriptions.filter(item => !processingSet.has(item.moveNumber));

      if (newItems.length > 0) {
        // Mark as processing immediately
        newItems.forEach(item => processingSet.add(item.moveNumber));

        const fetchDescriptions = async () => {
          for (const item of newItems) {
            try {
              const response = await getAIDescription({ data: item.data });
              if (response?.description) {
                setAiDescriptions(prev => ({
                  ...prev,
                  [item.moveNumber]: response.description
                }));

                // Auto-save hurdle if user is logged in
                if (session?.user) {
                  try {
                    await saveHurdle({
                      data: {
                        fen: item.data.fen,
                        title: `Mistake: ${Math.ceil(item.moveNumber / 2)}${item.moveNumber % 2 !== 0 ? '.' : '...'} ${item.data.move}`,
                        moveNumber: item.moveNumber,
                        evaluation: item.data.evaluation,
                        bestMove: item.data.bestMove,
                        playedMove: item.data.move,
                        centipawnLoss: item.data.centipawnLoss,
                        aiDescription: response.description,
                        depth: moveAnalysisDepth,
                        difficultyLevel: 3 // Default
                      }
                    });
                    console.log(`💾 Auto-saved hurdle at move ${item.moveNumber}`);
                    // Notify parent to refresh hurdles list
                    onHurdleSaved?.();
                  } catch (e) {
                    console.error('Failed to auto-save hurdle:', e);
                    // On failure, maybe remove from processing set to retry?
                    // For now, let's keep it to avoid infinite retry loops on persistent errors
                  }
                }
              }
            } catch (e) {
              console.error('Failed to fetch AI description', e);
            }
          }
        };
        fetchDescriptions();
      }
    }
  }, [gameMoves.length, moveAnalysisDepth, aiDescriptions, onHurdleSaved]);
  // Auto-start analysis if requested and moves are available
  useEffect(() => {
    if (autoAnalyze && gameMoves.length > 1 && !isAnalyzingMoves && analysisResultsRef.current.length === 0) {
      handleAnalyzeEntireGame();
    }
  }, [autoAnalyze, gameMoves.length, handleAnalyzeEntireGame]);




  // Re-generate analysis text when AI descriptions are updated
  useEffect(() => {
    if (!isAnalyzingMoves && analysisResultsRef.current.length > 0) {
      displayTextualAnalysisResults();
    }
  }, [aiDescriptions, isAnalyzingMoves, displayTextualAnalysisResults]);

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
            justifyContent: 'space-between',
            fontWeight: 'normal',
          }}
          >
            <span>{MIN_ANALYSIS_DEPTH} (Fast)</span>
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
          style={{ width: '99%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          onClick={handleAnalyzeEntireGame}
          disabled={isAnalyzingMoves || gameMoves.length <= 1}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isAnalyzingMoves ? 'Analyzing...' : 'Analyze Entire Game'}
        </button>
        <Spacer orientation="horizontal" />
        <button
          onClick={handleCancelAnalysis}
          disabled={!isAnalyzingMoves}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <Spacer orientation="horizontal" />
        <button
          onClick={handleCalibrateDepth}
          disabled={isAnalyzingMoves || isCalibrating}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isCalibrating
            ? 'Calibrating...'
            : `Calibrate (~${Math.round(CALIBRATION_TARGET_MS / 1000)}s)`}
        </button>
        <Spacer orientation="horizontal" />
        <button
          onClick={handleClearCacheClick}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          title="Clear analysis cache now"
        >
          Clear Cache
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