
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Chess } from 'chess.js';
import EvaluationGraph from './EvaluationGraph';
import { useAnalysisEngine } from './useAnalysisEngine';
import { formatAnalysisText, type MissingDescription, type AnalysisDisplayItem } from './analysis-formatter';
import { AnalysisList } from './AnalysisList';
import { MiniButton } from '~/components/ui/MiniButton';
import { HelpTooltip } from '~/components/ui/HelpTooltip';
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
  moveIndex?: number;
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
  currentMoveIndex?: number;
}

export default function GameAnalysis({
  gameMoves,
  goToMove,
  maxMovesToAnalyze,
  autoAnalyze,
  onHurdleSaved,
  currentMoveIndex
}: GameAnalysisProps) {
  const [moveAnalysisDepth, setMoveAnalysisDepth] = useState(DEFAULT_ANALYSIS_DEPTH);
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');
  const [structuredAnalysis, setStructuredAnalysis] = useState<AnalysisDisplayItem[]>([]);
  const [showInaccuracies, setShowInaccuracies] = useState(true);

  const [currentEvaluations, setCurrentEvaluations] = useState<EvaluationData[]>([]);
  const [aiDescriptions, setAiDescriptions] = useState<Record<number, string>>({});
  const { data: session } = useSession();

  // Persistence Logic
  const STORAGE_KEY = 'chesshurdles.analysis.state.v2'; // Version 2 to clear old strictness/bugs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Simple signature check: match game length and last move
        const currentSig = gameMoves.length > 0 ? `${gameMoves.length}-${gameMoves[gameMoves.length - 1]?.move || ''}` : '';
        if (parsed.signature === currentSig && parsed.structured?.length > 0) {
          setMoveAnalysisResults(parsed.results || '');
          setStructuredAnalysis(parsed.structured || []);
          setAiDescriptions(parsed.ai || {});

          if (parsed.evaluations) {
            setCurrentEvaluations(parsed.evaluations);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore analysis state', e);
    }
  }, [gameMoves]); // Re-run when game loaded

  useEffect(() => {
    if (structuredAnalysis.length > 0) {
      const signature = gameMoves.length > 0 ? `${gameMoves.length}-${gameMoves[gameMoves.length - 1]?.move || ''}` : '';
      const state = {
        results: moveAnalysisResults,
        structured: structuredAnalysis,
        ai: aiDescriptions,
        evaluations: currentEvaluations, // New: Persist graph data
        signature
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [structuredAnalysis, moveAnalysisResults, aiDescriptions, gameMoves, currentEvaluations]);

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

      // Determine starting color for the formatted batch
      // displayMoves[0] corresponds to the first analyzed move.
      // We need to know if it was White or Black.
      // We can use the global `gameMoves` to find it, but we are inside a callback.
      // `gameMoves` might be stale in closure? No, `useAnalysisEngine` deps.
      // But simpler: `displayMoveNumbers` has the move number.
      // If we see "1", is it White or Black?
      // Usually "1" is White, "1..." is Black.
      // `displayMoveNumbers` is just `[1, 1, 2, 2]`. Ambiguous.
      // We need to pass `startWithWhite` into `startAnalysis` context or derive it?
      // Let's rely on the fact that we analyzed `targetMoves`.
      // `targetMoves[targetMoves.length - 1]` is the FIRST chronological move.
      // (Because targetMoves is REVERSED).
      // So let's look at `gameMoves`.
      // The analyzed range is the LAST `displayMoves.length` moves of the game.
      // So the FIRST analyzed move is at index `gameMoves.length - displayMoves.length` (considering gameMoves[0] is startpos).
      // `gameMoves` length = N+1.
      // Moves = N.
      // Analyzed = K.
      // Start Index in `moves` (0-based) = N - K.
      // `gameMoves` access: `gameMoves[1 + (N-K)]`.
      // Example: 2 moves (1. e4). gameMoves len 2. Analyzed 1.
      // Start Index = 1 - 1 = 0.
      // gameMoves[1+0] = gameMoves[1] = e4. isWhite=true.

      // We need to capture this boolean before starting analysis to be safe, 
      // but `gameMoves` prop is reliable here.

      const totalGameMoves = gameMoves.length - 1;
      const analyzedCount = displayMoves.length;
      const firstAnalyzedMoveIndex = totalGameMoves - analyzedCount + 1;
      const startWithWhite = gameMoves[firstAnalyzedMoveIndex]?.isWhiteMove ?? true;

      const formatted = formatAnalysisText(
        displayMoves,
        displayResults,
        displayMoveNumbers,
        moveAnalysisDepth,
        aiDescriptions,
        startWithWhite
      );

      setMoveAnalysisResults(formatted.analysisText);
      setStructuredAnalysis(formatted.structuredAnalysis);
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

  // Local storage logic (Depth)
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

    // Clear previous state explicitly to avoid duplication or stale data
    setStructuredAnalysis([]);
    setCurrentEvaluations([]);
    setMoveAnalysisResults('');

    // Logic Reverted: Analyze positions BEFORE each move.
    // This allows us to know the "Best Move" in the position (Pre-Move).
    // We will calculate "Quality" by comparing Pre-Move (Best) vs Next Pre-Move (Actual/Post).
    const allMoves = gameMoves.slice(1).map(m => m.move!);
    const allPositionsBefore = gameMoves.slice(0, -1).map(m => m.position);
    const allMoveNumbers = gameMoves.slice(1).map((m, i) => m.moveNumber ?? Math.floor(i / 2) + 1);

    const selectionSize = maxMovesToAnalyze || 999;

    // Reverse for analysis engine (analyze latest first if desired, or simpler linear logic?)
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
    displayPositionsRef.current = targetPositions; // For Hurdle saving (requires Pre-Move fen)

    const placeholders = targetFullMoveNumbers.map((n, i) => {
      // Logic: targetMoves/numbers are reversed. 
      // i=0 is the last element of the slice.
      // We need the absolute index in `allMoves` (0-based Ply).
      // slice start index:
      const sliceStart = Math.max(0, totalMoves - selectionSize);
      const relativeIndex = (targetFullMoveNumbers.length - 1) - i;
      const absoluteIndex = sliceStart + relativeIndex;

      return {
        moveNumber: n,
        moveIndex: absoluteIndex,
        evaluation: 0,
        isMate: false,
        isPlaceholder: true
      };
    });
    setCurrentEvaluations(placeholders.reverse());

    // Pass Pre-Move positions to engine
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

  const [isExpanded, setIsExpanded] = useState(false);

  // Compute filtered count for display
  // Compute filtered count for display
  const filteredCount = structuredAnalysis.filter(item => {
    // Logic matches AnalysisList default (showAllMoves=false) and hideInaccuracies
    if (item.classification === 'none' || item.classification === 'good') return false; // Default hidden
    return true;
  }).length;

  return (
    <div className="game-analysis-container">
      <h3>Game Analysis</h3>

      {/* ... controls ... */}
      <div className="analysis-controls mb-4">
        {/* ... depth slider ... */}
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
        </div>
      </div>

      <div className="analysis-buttons" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'nowrap' }}>
        <button
          onClick={handleAnalyzeEntireGame}
          className="btn-primary"
          disabled={isAnalyzingMoves || isCalibrating}
        >
          Analyze Game
        </button>

        <button onClick={handleCalibrate} disabled={isAnalyzingMoves || isCalibrating}>
          {isCalibrating ? "Calibrating..." : "Recalibrate Ideal Engine Depth"}
        </button>
        <HelpTooltip content="Calibration adjusts the engine depth to match your device's speed for optimal analysis. You usually only need to run this once." />
        {(isAnalyzingMoves || isCalibrating) && (
          <button onClick={cancelAnalysis} className="btn-danger">Stop</button>
        )}
      </div>

      <div className="analysis-output">
        <EvaluationGraph
          evaluations={currentEvaluations.filter(e => e !== null && !e.isPlaceholder)}
          totalMoves={gameMoves.length - 1} // Pass total plys
          onMoveClick={(index) => {
            goToMove(index);
          }}
        />
        <div style={{ height: '1rem' }} />

        {/* Controls for Analysis List */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {filteredCount} {filteredCount === 1 ? 'inaccuracy' : 'inaccuracies'} found
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <MiniButton
              onClick={() => setIsExpanded(!isExpanded)}
              title="Toggle Full Height"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </MiniButton>
          </div>
        </div>

        <div style={{
          height: isExpanded ? '70vh' : '300px',
          minHeight: '150px',
          maxHeight: '80vh',
          overflowY: 'auto',
          resize: 'vertical',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          transition: 'height 0.2s ease-in-out'
        }}>
          <AnalysisList
            items={structuredAnalysis}
            onMoveClick={(index) => {
              // Calculate absolute index in gameMoves
              // gameMoves: [Start, Move1, Move2, ...] (Length N+1)
              // structuredAnalysis maps to displayMoves (Length M)
              // displayMoves is the *last* M moves of the game.

              const totalMoves = gameMoves.length - 1;
              const analyzedCount = structuredAnalysis.length;
              const startIndex = totalMoves - analyzedCount + 1;

              const targetIndex = startIndex + index;

              if (targetIndex >= 0 && targetIndex < gameMoves.length) {
                goToMove(targetIndex);
              }
            }}
            hideInaccuracies={false}
            currentMoveIndex={currentMoveIndex}
          />
        </div>

        {/* Hidden debug text area (or removed entirely?) 
            User replaced it. I'll remove it.
        */}
      </div>
    </div >
  );
}