
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Chess } from 'chess.js';
import EvaluationGraph from './EvaluationGraph';
import { useAnalysisEngine } from './useAnalysisEngine';
import { formatAnalysisText, type MissingDescription } from './analysis-formatter';
import { Spacer } from '~stzUtils/components/Spacer';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserAnalysisDepth, setUserAnalysisDepth, getAIDescription } from '~/lib/chess-server';
import { saveHurdle as saveHurdleServer } from '~/lib/server/hurdles';
import {
  CALIBRATION_TARGET_MS,
  MIN_ANALYSIS_DEPTH,
  MAX_ANALYSIS_DEPTH,
  DEFAULT_ANALYSIS_DEPTH,
} from '~/lib/chess-constants';
import { type EngineEvaluation } from '~/lib/stockfish-engine';

// Helper functions
const isMateScoreHelper = (evaluation: number): boolean => Math.abs(evaluation) > 5000;
const getMateDistanceHelper = (evaluation: number): number => Math.abs(evaluation) - 5000;

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
  goToMove: (index: number) => void;
  maxMovesToAnalyze?: number;
  autoAnalyze?: boolean;
  onHurdleSaved?: () => void;
}

export default function GameAnalysis({
  gameMoves,
  goToMove,
  maxMovesToAnalyze,
  autoAnalyze,
  onHurdleSaved
}: GameAnalysisProps) {
  const [moveAnalysisDepth, setMoveAnalysisDepth] = useState(DEFAULT_ANALYSIS_DEPTH);
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');
  const [currentEvaluations, setCurrentEvaluations] = useState<EvaluationData[]>([]);
  const [aiDescriptions, setAiDescriptions] = useState<Record<number, string>>({});
  const { data: session } = useSession();

  const isCalibratingRef = useRef(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const processingHurdlesRef = useRef<Set<number>>(new Set());

  // display refs (needed for callbacks)
  const displayMoveNumbersRef = useRef<number[]>([]);
  const displayMovesRef = useRef<string[]>([]);
  const displayPositionsRef = useRef<Chess[]>([]); // Added for FEN lookup

  // Hook Callback Defs
  const onProgress = useCallback((msg: string) => {
    setMoveAnalysisResults(prev => (prev.includes('Comparing') ? prev : msg));
  }, []);

  const { startAnalysis, cancelAnalysis, runCalibration, getResults } = useAnalysisEngine({
    onProgress,
    onEvaluation: (index, evaluation, isCached) => {
      // Update Graph
      setCurrentEvaluations(prev => {
        const updated = [...prev];
        const displayIndex = (prev.length - 1) - index;
        if (displayIndex >= 0 && displayIndex < updated.length) {
          updated[displayIndex] = {
            ...updated[displayIndex],
            evaluation: evaluation.evaluation,
            isMate: isMateScoreHelper(evaluation.evaluation),
            mateIn: isMateScoreHelper(evaluation.evaluation) ? getMateDistanceHelper(evaluation.evaluation) : undefined,
            isPlaceholder: false,
            isCached
          };
        }
        return updated;
      });
    },
    onComplete: (results) => {
      // Pass 2: Formatting
      // Reverse everything to chronological for the formatter
      const displayMoves = [...displayMovesRef.current].reverse();
      const displayResults = [...results].reverse();
      const displayMoveNumbers = [...displayMoveNumbersRef.current].reverse();

      const formatted = formatAnalysisText(
        displayMoves,
        displayResults,
        displayMoveNumbers,
        moveAnalysisDepth,
        aiDescriptions
      );

      setMoveAnalysisResults(formatted.analysisText);
      setIsAnalyzingMoves(false);

      // Trigger Hurdle Processing
      const processingSet = processingHurdlesRef.current;
      const newItems = formatted.missingDescriptions.filter(item => !processingSet.has(item.moveNumber));

      if (newItems.length > 0) {
        newItems.forEach(item => processingSet.add(item.moveNumber));

        // Async process hurdles
        (async () => {
          for (const item of newItems) {
            try {
              // Fetch AI?
              if (item.data.willUseAI) {
                try {
                  const response = await getAIDescription({ data: item.data });
                  if (response?.description) {
                    setAiDescriptions(prev => ({ ...prev, [item.moveNumber]: response.description }));
                  }
                } catch (e: any) {
                  if (typeof e.message === 'string' && e.message.includes('Insufficient credits')) {
                    if (typeof window !== 'undefined') window.dispatchEvent(new Event('INSUFFICIENT_CREDITS'));
                  }
                }
              }

              // Save Hurdle
              if (session?.user) {
                // Find position before move
                // item.moveNumber is 1-based move number.
                // lookup FEN.
                // displayPositionsRef has REVERSE chronological positions.
                // So we can find it by index? 
                // item.index correponds to the formatted list (chronological).
                // But `processGameAnalysis` in formatter returns `gameAnalysisItems` matched to CHRONOLOGICAL inputs.
                // So item.index IS the chronological index.
                // displayMoves[item.index] should be the move text.

                // Wait. `formatted` uses `displayMoves` (chronological).
                // `displayPositionsRef.current` is REVERSE chronological (from startAnalysis logic).
                // So we need to reverse positions ref too? Or just use correct index.

                // `startAnalysis` stored `targetPositions` (Reverse).
                // So `displayPositionsRef.current[i]` matches `results[i]`.
                // `results` were passed to `onComplete` in analysis order (Reverse).
                // But we reversed `displayResults` for formatter.
                // So `displayResults[k]` corresponds to `displayPositionsRef.current[N-1-k]`.

                // `item.index` is index in `displayMoves` (chronological).
                // So we need `displayPositionsRef.current[ (length-1) - item.index ]`.

                const positionsReversed = displayPositionsRef.current;
                const targetIndex = (positionsReversed.length - 1) - item.index;
                const prevPos = positionsReversed[targetIndex];
                const fen = prevPos?.fen();

                if (fen) {
                  await saveHurdleServer({
                    data: {
                      fen,
                      move: item.data.move,
                      evaluation: item.data.evaluation,
                      bestMove: item.data.bestMove,
                      pv: item.data.pv,
                      centipawnLoss: item.data.centipawnLoss,
                      wpl: item.data.wpl,
                      isWorthy: item.data.isWorthy,
                      willUseAI: item.data.willUseAI,
                      aiDescription: aiDescriptions[item.moveNumber]
                    } as any
                  });
                }
              }
            } catch (e) {
              console.error(e);
            }
          }

          if (onHurdleSaved) onHurdleSaved();
        })();
      }
    },
    onAnalysisStatusChange: setIsAnalyzingMoves
  });

  // Local storage logic
  const LS_KEY = 'chesshurdles.analysisDepth';
  useEffect(() => {
    const restore = async () => {
      try {
        if (session?.user?.id) {
          const res = await getUserAnalysisDepth();
          if (res?.depth) setMoveAnalysisDepth(res.depth);
        } else {
          const stored = localStorage.getItem(LS_KEY);
          if (stored) setMoveAnalysisDepth(Number(stored));
        }
      } catch { }
    };
    restore();
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) setUserAnalysisDepth({ data: moveAnalysisDepth }).catch(console.error);
    localStorage.setItem(LS_KEY, String(moveAnalysisDepth));
  }, [moveAnalysisDepth, session]);

  const handleAnalyzeEntireGame = useCallback(() => {
    if (gameMoves.length <= 1) {
      setMoveAnalysisResults('No moves to analyze.');
      return;
    }
    if (isAnalyzingMoves) return;

    const allMoves = gameMoves.slice(1).map(m => m.move!);
    const allPositionsBefore = gameMoves.slice(0, -1).map(m => m.position);
    const allMoveNumbers = gameMoves.slice(1).map((m, i) => m.moveNumber ?? Math.floor(i / 2) + 1);

    const selectionSize = maxMovesToAnalyze || 999;

    // Reverse for analysis engine (it expects last move first?)
    // Actually engine processes linearly. The `targetMoves` order matters?
    // `useAnalysisEngine` iterates 0..N.
    // My hook logs "Starting analysis of move X...".
    // If I pass chronological [1,2,3], it analyzes 1, then 2, then 3.
    // If I pass reverse [3,2,1], it analyzes 3, then 2, then 1.
    // Stockfish doesn't care about order for individual Fen analysis (it's stateless mostly if we send Fen).
    // Original `GameAnalysis` created `targetMoves` via `.reverse()`.
    // Presumably to show "Latest move" first or prioritize?
    // "Analyzing move 1/50" (where 1 is the latest move?).
    // Yes, original text was populated in reverse chronological order presumably?
    // The graph shows chronological (Left to Right).
    // Let's stick to .reverse() to match original optimization (analyze end game first?)

    const targetMoves = allMoves.slice(-selectionSize).reverse();
    const targetPositions = allPositionsBefore.slice(-selectionSize).reverse();
    const targetFullMoveNumbers = allMoveNumbers.slice(-selectionSize).reverse();

    const totalMoves = allMoves.length;
    const targetDisplayMoveNumbers = Array.from(
      { length: Math.min(selectionSize, totalMoves) },
      (_, i) => totalMoves - i
    );

    displayMovesRef.current = targetMoves;
    displayMoveNumbersRef.current = targetDisplayMoveNumbers;
    displayPositionsRef.current = targetPositions;

    const placeholders = targetFullMoveNumbers.map(n => ({
      moveNumber: n,
      evaluation: 0,
      isMate: false,
      isPlaceholder: true
    }));
    setCurrentEvaluations(placeholders);

    startAnalysis(targetMoves, targetPositions, targetFullMoveNumbers, moveAnalysisDepth);

  }, [gameMoves, isAnalyzingMoves, maxMovesToAnalyze, moveAnalysisDepth, startAnalysis]);

  const handleCalibrate = useCallback(async () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    setMoveAnalysisResults('Calibrating...');
    try {
      const rec = await runCalibration((d, ms) => setMoveAnalysisResults(p => p + `\nDepth ${d}: ${ms}ms`));
      setMoveAnalysisDepth(rec);
      setMoveAnalysisResults(p => p + `\nDone: ${rec}`);
    } finally { setIsCalibrating(false); }
  }, [isCalibrating, runCalibration]);

  return (
    <div className="game-analysis-container">
      <h3>Game Analysis</h3>

      <div className="analysis-controls mb-4">
        <label htmlFor="depth-slider" className="block text-sm font-medium mb-1">
          Analysis Depth used for "Analyze Entire Game": {moveAnalysisDepth}
        </label>
        <div className="flex items-center gap-4">
          <input
            id="depth-slider"
            type="range"
            min={MIN_ANALYSIS_DEPTH}
            max={MAX_ANALYSIS_DEPTH}
            value={moveAnalysisDepth}
            onChange={(e) => setMoveAnalysisDepth(Number(e.target.value))}
            disabled={isAnalyzingMoves || isCalibrating}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm w-12 text-center">{moveAnalysisDepth}</span>
        </div>
      </div>

      <div className="analysis-buttons flex gap-4 mb-4">
        {!isAnalyzingMoves && !isCalibrating && (
          <button onClick={handleAnalyzeEntireGame} className="btn-primary">
            Analyze Game
          </button>
        )}
        <button onClick={handleCalibrate} disabled={isAnalyzingMoves || isCalibrating}>
          Calibrate Depth
        </button>
        {(isAnalyzingMoves || isCalibrating) && (
          <button onClick={cancelAnalysis} className="btn-danger">Stop</button>
        )}
      </div>

      <div className="analysis-output">
        <EvaluationGraph
          evaluations={currentEvaluations.filter(e => e !== null && !e.isPlaceholder)}
        />
        <Spacer />
        <textarea
          className="w-full h-64 p-2 border rounded"
          value={moveAnalysisResults}
          readOnly
        />
      </div>
    </div>
  );
}