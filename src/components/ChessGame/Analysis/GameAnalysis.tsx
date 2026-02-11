

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
import { isBookMove } from '~/lib/opening-book';

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
  onAnalysisUpdate?: (analysis: { moveIndex: number; classification: string }[]) => void;
}

export default function GameAnalysis({
  gameMoves,
  goToMove,
  maxMovesToAnalyze,
  autoAnalyze,
  onHurdleSaved,
  currentMoveIndex,
  onAnalysisUpdate
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

      // Propagate analysis to parent for Navigation
      // Optimization: Only trigger if structuredAnalysis or gameMoves changed.
      // We moved the live update during analysis to onComplete.
      // This useEffect now primarily handles: 
      // 1. Initial restoration from localStorage
      // 2. Changes to aiDescriptions (to keep parent in sync if needed, though parent currently doesn't use it)
      // 3. Game move changes (re-mapping indices)
    }
  }, [structuredAnalysis, moveAnalysisResults, aiDescriptions, gameMoves]); // REMOVED currentEvaluations and onAnalysisUpdate (callback is memoized)

  // Separate effect for parent synchronization to avoid slamming parent during live graph updates
  const lastSyncRef = useRef<string>('');
  useEffect(() => {
    if (onAnalysisUpdate && structuredAnalysis.length > 0) {
      const summary = structuredAnalysis.map(item => {
        const matchIndex = gameMoves.findIndex(m =>
          m.moveNumber === item.moveNumber &&
          (item.playerColor === 'White' ? m.isWhiteMove : !m.isWhiteMove)
        );
        return {
          moveIndex: matchIndex,
          classification: item.classification || 'none',
          isWhiteMove: item.isWhiteMove
        };
      }).filter(s => s.moveIndex !== -1);

      const syncKey = JSON.stringify(summary);
      if (syncKey !== lastSyncRef.current) {
        lastSyncRef.current = syncKey;
        onAnalysisUpdate(summary);
      }
    }
  }, [structuredAnalysis, gameMoves, onAnalysisUpdate]);

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

  const handleEvaluation = useCallback((index: number, evaluation: EngineEvaluation, isCached: boolean, cacheKey: string) => {
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
  }, []);

  const handleAnalysisComplete = useCallback((results: EngineEvaluation[]) => {
    // Pass 2: Formatting
    // Reverse everything to chronological for the formatter
    const displayMoves = [...displayMovesRef.current].reverse();
    const displayResults = [...results].reverse();
    const displayMoveNumbers = [...displayMoveNumbersRef.current].reverse();
    const displayPositions = [...displayPositionsRef.current].reverse();

    const totalGameMoves = gameMoves.length - 1;
    const analyzedCount = displayMoves.length;
    const firstAnalyzedMoveIndex = totalGameMoves - analyzedCount + 1;
    const startWithWhite = gameMoves[firstAnalyzedMoveIndex]?.isWhiteMove ?? true;

    // Handle async book check
    (async () => {
      const bookIndices = new Set<number>();
      // Only check first 12 moves (24 plies) to keep API calls reasonable
      const limit = Math.min(displayMoves.length, 12);

      const checks = displayMoves.slice(0, limit).map(async (moveSan, i) => {
        const position = displayPositions[i];
        if (!position) return;

        // Need UCI for book check
        const moves = position.moves({ verbose: true });
        const match = moves.find(m => m.san === moveSan);
        if (match) {
          const uci = match.from + match.to + (match.promotion || '');
          const isBook = await isBookMove(position.fen(), uci);
          if (isBook) bookIndices.add(i);
        }
      });

      if (checks.length > 0) {
        await Promise.all(checks);
      }

      const formatted = formatAnalysisText(
        displayMoves,
        displayResults,
        displayMoveNumbers,
        moveAnalysisDepth,
        aiDescriptions,
        startWithWhite,
        bookIndices,
        firstAnalyzedMoveIndex
      );

      setMoveAnalysisResults(formatted.analysisText);
      setStructuredAnalysis(formatted.structuredAnalysis);
      setIsAnalyzingMoves(false);

      // Notify parent if callback provided
      if (onAnalysisUpdate) {
        const summary = formatted.structuredAnalysis.map(item => ({
          moveIndex: item.absoluteMoveIndex,
          classification: item.classification || 'none',
          isWhiteMove: item.isWhiteMove
        }));
        onAnalysisUpdate(summary);
      }

      // Trigger Hurdle Processing
      const processingSet = processingHurdlesRef.current;
      const newItems = formatted.missingDescriptions.filter(item => !processingSet.has(item.moveNumber));

      if (newItems.length > 0) {
        newItems.forEach(item => processingSet.add(item.moveNumber));

        for (const item of newItems) {
          try {
            // Fetch AI if worthy and approved
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
              // item.index is chronological index in displayMoves
              const prevPos = displayPositions[item.index];
              const fen = prevPos?.fen();

              // SKIP LOGIC 1: Dead Lost Threshold
              // If the best move still results in a heavily losing position (< -5.0), skip it.
              // Logic: -500 centipawns. Exception: Forced mates might still be puzzles.
              const DEAD_LOST_THRESHOLD = -500;
              const evalVal = item.data.evaluation;
              const isMate = Math.abs(evalVal) > 4000;

              // SKIP LOGIC 2: Mate-to-Mate Noise
              // "Changed Mate in 23 to Mate in 17" -> WHO CARES.
              // If BOTH Pre and Post moves are forced mates for the same side, skip it.
              // Unless we went from "Winning" to "Getting Mated" (Blunder).
              const postEval = item.data.postMoveEvaluation; // Evaluation after user move

              if (isMate && postEval !== undefined) {
                const isPostMate = Math.abs(postEval) > 4000;
                // If both are mates, and they have the same sign (same side winning), skip.
                if (isPostMate && Math.sign(evalVal) === Math.sign(postEval)) {
                  console.log(`[Analysis] Skipping Hurdle at move ${item.moveNumber}: Mate optimization (M${getMateDistanceHelper(evalVal)} -> M${getMateDistanceHelper(postEval)}) is noise.`);
                  continue;
                }
              }

              if (evalVal < DEAD_LOST_THRESHOLD && !isMate) {
                console.log(`[Analysis] Skipping Hurdle at move ${item.moveNumber}: Evaluation ${evalVal} is below Dead Lost Threshold (${DEAD_LOST_THRESHOLD})`);
                continue;
              }

              if (fen) {
                // Determine Generic Opening Tag if isBook
                // We don't have perfect opening names yet, but we know if it was book.
                // Improvement: If we had the PGN tags or Eco code, we'd use them.
                // For now, if "Analyze Entire Game" was run, we have bookIndices.
                // If this move index is in bookIndices, mark as "Opening".
                const isOpeningPhase = item.index < 16; // Simple heuristic
                const tag = isOpeningPhase ? 'Opening' : 'Middlegame';

                const mateInVal = isMate ? getMateDistanceHelper(evalVal) : undefined;
                // Engine calculation time available?
                // We need to access the raw result for calculationTime.
                // displayResults[item.index] has it.
                const rawResultVal = displayResults[item.index];
                const calcTime = rawResultVal?.calculationTime;

                await saveHurdleServer({
                  data: {
                    fen,
                    side: item.data.side,
                    moveNumber: item.moveNumber, // Ensure moveNumber is passed!
                    playedMove: item.data.move,
                    evaluation: item.data.evaluation,
                    bestMove: item.data.bestMove,
                    pv: item.data.pv,
                    centipawnLoss: item.data.centipawnLoss,
                    wpl: item.data.wpl,
                    isWorthy: item.data.isWorthy,
                    willUseAI: item.data.willUseAI,
                    aiDescription: aiDescriptions[item.moveNumber],
                    // New Metadata passed to server wrapper
                    mateIn: mateInVal,
                    calculationTime: calcTime,
                    openingTags: tag
                  } as any
                });
              }
            }
          } catch (e) {
            console.error('[Analysis] Failed to process hurdle:', e);
          }
        }

        if (onHurdleSaved) onHurdleSaved();
      }
    })();
  }, [gameMoves, moveAnalysisDepth, aiDescriptions, onAnalysisUpdate, onHurdleSaved, session?.user]);

  const { startAnalysis, cancelAnalysis, runCalibration, getResults } = useAnalysisEngine({
    onProgress,
    onEvaluation: handleEvaluation,
    onComplete: handleAnalysisComplete,
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

      // absoluteIndex is index in allMoves (0-based).
      // gameMoves has 1 extra element (start pos).
      // So gameMoves index = absoluteIndex + 1.
      const gameMovesIndex = absoluteIndex + 1;

      return {
        moveNumber: n,
        moveIndex: gameMovesIndex,
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
  const filteredCount = structuredAnalysis.filter(item => {
    if (item.classification === 'none' || item.classification === 'good') return false;
    return true;
  }).length;

  return (
    <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)', marginTop: '2rem' }}>
      <h3 style={{ marginTop: 0 }}>Game Analysis</h3>

      {/* ... controls ... */}
      <div style={{ marginBottom: '1rem' }}>
        {/* ... depth slider ... */}
        <label htmlFor="depth-slider" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          Analysis Depth used for "Analyze Entire Game": {moveAnalysisDepth}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            id="depth-slider"
            type="range"
            min={MIN_ANALYSIS_DEPTH}
            max={MAX_ANALYSIS_DEPTH}
            value={moveAnalysisDepth}
            onChange={(e) => setMoveAnalysisDepth(Number(e.target.value))}
            disabled={isAnalyzingMoves || isCalibrating}
            className="depth-slider-input"
            style={{
              width: '100%',
              height: '0.5rem',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>

      <div className="analysis-buttons" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'nowrap' }}>
        <button
          onClick={handleAnalyzeEntireGame}
          style={{
            backgroundColor: 'var(--color-link)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          disabled={isAnalyzingMoves || isCalibrating || gameMoves.length <= 1}
        >
          Analyze Game
        </button>

        <button onClick={handleCalibrate} disabled={isAnalyzingMoves || isCalibrating}>
          {isCalibrating ? "Calibrating..." : "Recalibrate Ideal Engine Depth"}
        </button>
        <HelpTooltip content="Calibration adjusts the engine depth to match your device's speed for optimal analysis. You usually only need to run this once." />
        {(isAnalyzingMoves || isCalibrating) && (
          <button
            onClick={cancelAnalysis}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Stop
          </button>
        )}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <EvaluationGraph
          evaluations={currentEvaluations.filter(e => e !== null && !e.isPlaceholder)}
          totalMoves={gameMoves.length - 1} // Pass total plys
          onMoveClick={(index) => {
            // index matches currentEvaluations index.
            const data = currentEvaluations[index];
            if (data && typeof data.moveIndex === 'number') {
              goToMove(data.moveIndex);
            } else {
              // Fallback / legacy?
              goToMove(index + 1); // Approximate
            }
          }}
        />
        <div style={{ height: '1rem' }} />

        {/* Analysis Progress Log */}
        {isAnalyzingMoves && moveAnalysisResults && (
          <div style={{
            marginBottom: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            maxHeight: '10rem',
            overflowY: 'auto',
            border: '1px solid var(--color-border)'
          }}>
            {moveAnalysisResults}
          </div>
        )}

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
            onMoveClick={(analysisIndex) => {
              const item = structuredAnalysis[analysisIndex];
              if (!item) {
                console.warn("[Analysis] No item at index", analysisIndex);
                return;
              }

              const matchIndex = item.absoluteMoveIndex;

              console.log("[Analysis] Clicked:", item.moveLabel, item.moveSan, "AbsoluteIndex:", matchIndex, "CurrentIndex:", currentMoveIndex);

              if (matchIndex >= 0 && matchIndex < gameMoves.length) {
                goToMove(matchIndex);
              } else {
                console.warn("[Analysis] absoluteMoveIndex out of bounds", item);
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