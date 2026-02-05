
import { useRef, useEffect, useCallback } from 'react';
import type { Chess } from 'chess.js';
import {
  initializeStockfishWorker,
  analyzePosition,
  handleEngineMessage,
  stopAnalysis,
  calibrateDepth,
  cleanupWorker,
  type EngineEvaluation,
  type EngineCallbacks
} from '~/lib/stockfish-engine';
import {
  makeKey,
  getCachedEval,
  setCachedEval,
  clearPersistentCache
} from '~/lib/analysis-cache';
import {
  ENGINE_DEFAULT_OPTIONS,
  ANALYSIS_CACHE_FULL_MOVES_LIMIT,
  CALIBRATION_TARGET_MS,
  CALIBRATION_TEST_FEN,
  MIN_ANALYSIS_DEPTH,
  MAX_ANALYSIS_DEPTH
} from '~/lib/chess-constants';

export interface AnalysisHooks {
  onProgress: (message: string) => void;
  onEvaluation: (index: number, result: EngineEvaluation, isCached: boolean, cacheKey: string) => void;
  onComplete: (results: EngineEvaluation[]) => void;
  onAnalysisStatusChange: (isAnalyzing: boolean) => void;
}

export function useAnalysisEngine(callbacks: AnalysisHooks) {
  const analysisWorkerRef = useRef<Worker | null>(null);

  // State refs for the analysis loop
  const targetMovesRef = useRef<string[]>([]);
  const targetPositionsRef = useRef<Chess[]>([]);
  const targetFullMoveNumbersRef = useRef<number[]>([]);
  const analysisResultsRef = useRef<EngineEvaluation[]>([]);
  const currentAnalysisIndexRef = useRef<number>(0);
  const activeAnalysisIndexRef = useRef<number>(0);
  const moveAnalysisDepthRef = useRef<number>(MIN_ANALYSIS_DEPTH);
  const analysisCancelledRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisWorkerRef.current) {
        console.log('Terminating Stockfish worker on unmount');
        cleanupWorker(analysisWorkerRef.current);
        analysisWorkerRef.current = null;
      }
    };
  }, []);

  const ensureWorker = useCallback(() => {
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => { /* default no-op */ },
        (error: string) => {
          callbacks.onProgress(`Error initializing Stockfish: ${error}`);
          callbacks.onAnalysisStatusChange(false);
        },
        ENGINE_DEFAULT_OPTIONS
      );
    }
    return analysisWorkerRef.current;
  }, [callbacks]);

  const processNextPosition = useCallback((index: number) => {
    if (index >= targetPositionsRef.current.length) {
      callbacks.onComplete(analysisResultsRef.current);
      return;
    }

    if (analysisCancelledRef.current) {
      callbacks.onAnalysisStatusChange(false);
      return;
    }

    currentAnalysisIndexRef.current = index;
    const nextPosition = targetPositionsRef.current[index];
    const nextMove = targetMovesRef.current[index];

    callbacks.onProgress(`🔍 Starting analysis of move ${index + 1}/${targetPositionsRef.current.length}: "${nextMove}"`);

    const fingerprint = `Hash=${ENGINE_DEFAULT_OPTIONS.Hash}|MultiPV=${ENGINE_DEFAULT_OPTIONS.MultiPV}`;
    const key = makeKey(nextPosition.fen(), fingerprint);
    const nextActualFullMoveNumber = targetFullMoveNumbersRef.current[index];

    // Check Cache
    if (nextActualFullMoveNumber <= ANALYSIS_CACHE_FULL_MOVES_LIMIT) {
      const cached = getCachedEval(key);
      if (cached && cached.depth >= moveAnalysisDepthRef.current) {
        console.log(`⚡ Cache hit: depth=${cached.depth}`);
        const evaluation: EngineEvaluation = {
          evaluation: cached.cp,
          bestMove: cached.bestMove || '',
          principalVariation: '',
          depth: cached.depth,
          calculationTime: 0,
        };
        analysisResultsRef.current[index] = evaluation;

        callbacks.onEvaluation(index, evaluation, true, key);

        setTimeout(() => {
          processNextPosition(index + 1);
        }, 50);
        return;
      }
    }

    console.log(`⏭️ Skipping cache / Cache miss`);
    activeAnalysisIndexRef.current = index;
    const worker = ensureWorker();

    // We attach the message handler here or relies on the one set in startAnalysis?
    // The handler set in startAnalysis is persistent for the session.
    // So we just call analyzePosition.

    analyzePosition(
      worker,
      nextPosition.fen(),
      moveAnalysisDepthRef.current,
      false,
      (val) => { /* setIsAnalyzing */ },
      () => { },
      startTimeRef,
      analyzingFenRef
    );

  }, [ensureWorker, callbacks]);

  const cancelAnalysis = useCallback(() => {
    analysisCancelledRef.current = true;
    if (analysisWorkerRef.current) {
      stopAnalysis(analysisWorkerRef.current, true, (val) => callbacks.onAnalysisStatusChange(val));
    } else {
      callbacks.onAnalysisStatusChange(false);
    }
  }, [callbacks]);

  const startAnalysis = useCallback((
    moves: string[],
    positions: Chess[],
    fullMoveNumbers: number[],
    depth: number
  ) => {
    moveAnalysisDepthRef.current = depth;
    targetMovesRef.current = moves;
    targetPositionsRef.current = positions;
    targetFullMoveNumbersRef.current = fullMoveNumbers;
    analysisResultsRef.current = new Array(moves.length).fill(undefined);
    currentAnalysisIndexRef.current = 0;
    analysisCancelledRef.current = false;

    callbacks.onAnalysisStatusChange(true);
    callbacks.onProgress('Starting analysis of entire game...\n\nInitializing Stockfish engine...');

    const worker = ensureWorker();

    if (worker) worker.onmessage = (event: MessageEvent) => {
      const engineCallbacks: EngineCallbacks = {
        setEvaluation: (evaluation: EngineEvaluation) => {
          const currentMoveIndex = activeAnalysisIndexRef.current;
          analysisResultsRef.current[currentMoveIndex] = evaluation;

          try {
            const fingerprint = `Hash=${ENGINE_DEFAULT_OPTIONS.Hash}|MultiPV=${ENGINE_DEFAULT_OPTIONS.MultiPV}`;
            const currentFen = targetPositionsRef.current[currentMoveIndex]?.fen();
            const key = makeKey(currentFen!, fingerprint);
            const actualFullMoveNumber = targetFullMoveNumbersRef.current[currentMoveIndex];

            if (actualFullMoveNumber <= ANALYSIS_CACHE_FULL_MOVES_LIMIT) {
              setCachedEval(key, {
                cp: evaluation.evaluation,
                depth: evaluation.depth,
                bestMove: evaluation.bestMove,
                ts: Date.now()
              });
            }
            callbacks.onEvaluation(currentMoveIndex, evaluation, false, key);
          } catch (e) { console.error(e); }
        },
        setIsAnalyzing: (analyzing: boolean) => {
          if (!analyzing) {
            processNextPosition(currentAnalysisIndexRef.current + 1);
          }
        }
      };

      handleEngineMessage(
        event.data,
        moveAnalysisDepthRef.current,
        startTimeRef.current,
        analyzingFenRef.current,
        engineCallbacks
      );
    };

    processNextPosition(0);
  }, [ensureWorker, callbacks, processNextPosition]);

  const runCalibration = useCallback(async (
    onProgress: (depth: number, ms: number) => void
  ) => {
    const worker = ensureWorker();
    if (worker) worker.onmessage = () => { };
    return await calibrateDepth({
      worker,
      fen: CALIBRATION_TEST_FEN,
      targetMs: CALIBRATION_TARGET_MS,
      minDepth: MIN_ANALYSIS_DEPTH,
      maxDepth: MAX_ANALYSIS_DEPTH,
      timeoutPerRunMs: 20000,
      onProgress
    });
  }, [ensureWorker]);

  return {
    startAnalysis,
    cancelAnalysis,
    runCalibration,
    getResults: () => analysisResultsRef.current,
    workerRef: analysisWorkerRef,
    clearCache: clearPersistentCache
  };
}
