import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EngineEvaluation,
  EngineCallbacks,
  handleEngineMessage,
  initializeStockfishWorker,
  cleanupWorker,
  analyzePosition,
  stopAnalysis
} from '../lib/stockfish-engine';

interface StockfishEngineProps {
  fen: string;
  depth?: number;
  onEvaluation?: (evaluation: number, bestMove: string, pv: string) => void;
  onCalculationTime?: (timeMs: number) => void;
}

export function StockfishEngine({ 
  fen, 
  depth = 10, 
  onEvaluation, 
  onCalculationTime 
}: StockfishEngineProps) {
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');

  const handleEngineMessageWrapper = useCallback((event: MessageEvent) => {
    handleEngineMessage(
      event.data,
      depth,
      startTimeRef.current,
      analyzingFenRef.current,
      {
        setEvaluation,
        setIsAnalyzing,
        onEvaluation,
        onCalculationTime
      }
    );
  }, [depth, onEvaluation, onCalculationTime]);

  // Initialize Stockfish worker
  useEffect(() => {
    workerRef.current = initializeStockfishWorker(handleEngineMessageWrapper, setError);

    return () => {
      cleanupWorker(workerRef.current);
    };
  }, []);

  const handleAnalyzePosition = useCallback(() => {
    analyzePosition(
      workerRef.current,
      fen,
      depth,
      isAnalyzing,
      setIsAnalyzing,
      setError,
      startTimeRef,
      analyzingFenRef
    );
  }, [fen, depth, isAnalyzing]);

  const handleStopAnalysis = useCallback(() => {
    stopAnalysis(workerRef.current, isAnalyzing, setIsAnalyzing);
  }, [isAnalyzing]);

  return {
    isAnalyzing,
    evaluation,
    error,
    analyzePosition: handleAnalyzePosition,
    stopAnalysis: handleStopAnalysis
  };
}

export default StockfishEngine;