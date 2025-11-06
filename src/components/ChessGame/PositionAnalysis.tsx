import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { 
  initializeStockfishWorker, 
  analyzePosition, 
  handleEngineMessage,
  cleanupWorker,
  stopAnalysis,
  EngineEvaluation,
  EngineCallbacks
} from '~/lib/stockfish-engine';

interface PositionAnalysisProps {
  game: Chess;
  containerWidth: string;
}

export function PositionAnalysis({
  game,
  containerWidth
}: PositionAnalysisProps) {
  // Position analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDepth, setAnalysisDepth] = useState(10);
  const [engineEvaluation, setEngineEvaluation] = useState<EngineEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Position analysis refs
  const positionWorkerRef = useRef<Worker | null>(null);
  const positionStartTimeRef = useRef<number>(0);
  const positionAnalyzingFenRef = useRef<string>('');

  // Format evaluation helper
  const formatEvaluation = useCallback((evaluation: number): string => {
    if (evaluation === 0) return '0.00';
    if (Math.abs(evaluation) > 900) {
      return evaluation > 0 ? `+M${Math.ceil((1000 - evaluation) / 2)}` : `-M${Math.ceil((1000 + evaluation) / 2)}`;
    }
    return (evaluation / 100).toFixed(2);
  }, []);

  // Position analysis handler
  const handleAnalyzePosition = useCallback(() => {
    if (isAnalyzing) return;

    const currentFen = game.fen();
    console.log('Starting position analysis for FEN:', currentFen);
    
    setIsAnalyzing(true);
    setError(null);
    setEngineEvaluation(null);
    positionStartTimeRef.current = Date.now();
    positionAnalyzingFenRef.current = currentFen;

    // Initialize position worker if not already done
    if (!positionWorkerRef.current) {
      positionWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const message = event.data;
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              setEngineEvaluation(evaluation);
            },
            setIsAnalyzing,
            onEvaluation: (evaluation, bestMove, principalVariation) => {
              setEngineEvaluation({ 
                evaluation, 
                bestMove, 
                principalVariation,
                depth: analysisDepth,
                calculationTime: Date.now() - positionStartTimeRef.current
              });
            },
            onCalculationTime: (timeMs) => {
              setEngineEvaluation(prev => prev ? { ...prev, calculationTime: timeMs } : null);
            }
          };
          
          handleEngineMessage(
            message,
            analysisDepth,
            positionStartTimeRef.current,
            positionAnalyzingFenRef.current,
            callbacks
          );
        },
        (errorMsg: string) => {
          setError(errorMsg);
          setIsAnalyzing(false);
        }
      );
    }

    // Analyze current position
    analyzePosition(
      positionWorkerRef.current,
      currentFen,
      analysisDepth,
      isAnalyzing,
      setIsAnalyzing,
      setError,
      positionStartTimeRef,
      positionAnalyzingFenRef
    );
  }, [game, analysisDepth, isAnalyzing]);

  const handleCancelPositionAnalysis = useCallback(() => {
    stopAnalysis(positionWorkerRef.current, isAnalyzing, setIsAnalyzing);
    setError(null);
  }, [positionWorkerRef, isAnalyzing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (positionWorkerRef.current) {
        cleanupWorker(positionWorkerRef.current);
        positionWorkerRef.current = null;
      }
    };
  }, []);
  return (
    <div style={{ 
      marginTop: '1rem', 
      padding: '0.5rem', 
      border: '1px solid var(--color-bg-secondary)', 
      borderRadius: '4px', 
      maxWidth: containerWidth 
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '0.5rem' 
      }}>
        <button
          onClick={handleAnalyzePosition}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
        </button>
        <button
          onClick={handleCancelPositionAnalysis}
          disabled={!isAnalyzing}
        >
          Cancel
        </button>
        <label>
          Depth:
          <input
            type="range"
            min="1"
            max="15"
            value={analysisDepth}
            onChange={(e) => setAnalysisDepth(parseInt(e.target.value))}
            style={{ marginLeft: '0.5rem', width: '80px' }}
          />
          <span style={{ marginLeft: '0.5rem' }}>{analysisDepth}</span>
        </label>
      </div>
      
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.9rem' }}>
          Error: {error}
        </p>
      )}
      
      {engineEvaluation && (
        <div style={{ fontSize: '0.9rem' }}>
          <p><strong>Evaluation:</strong> {formatEvaluation(engineEvaluation.evaluation)}</p>
          {engineEvaluation.bestMove && (
            <p><strong>Best Move:</strong> {engineEvaluation.bestMove}</p>
          )}
          {engineEvaluation.calculationTime && (
            <p><strong>Time:</strong> {engineEvaluation.calculationTime}ms</p>
          )}
          {engineEvaluation.principalVariation && (
            <p><strong>Principal Variation:</strong> {engineEvaluation.principalVariation}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default PositionAnalysis;