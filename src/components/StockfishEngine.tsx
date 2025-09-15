import React, { useState, useEffect, useRef, useCallback } from 'react';
import { uciToAlgebraic, formatPrincipalVariation, formatMoveWithNumber } from '../lib/chess-utils';

interface StockfishEngineProps {
  fen: string;
  depth?: number;
  onEvaluation?: (evaluation: number, bestMove: string, pv: string) => void;
  onCalculationTime?: (timeMs: number) => void;
}

interface EngineEvaluation {
  evaluation: number;
  bestMove: string;
  principalVariation: string;
  depth: number;
  calculationTime: number;
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

  // Initialize Stockfish worker
  useEffect(() => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') return;

      // Create worker with stockfish.js
      const wasmSupported = typeof WebAssembly === 'object' && 
        WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      
      // For now, we'll use the basic stockfish.js (not WASM) to avoid CORS issues
      workerRef.current = new Worker('/node_modules/stockfish.js/stockfish.js');
      
      workerRef.current.addEventListener('message', handleEngineMessage);
      workerRef.current.addEventListener('error', (e) => {
        console.error('Stockfish worker error:', e);
        setError('Engine initialization failed');
      });

      // Initialize UCI protocol
      workerRef.current.postMessage('uci');
      
    } catch (err) {
      console.error('Failed to initialize Stockfish:', err);
      setError('Failed to initialize chess engine');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleEngineMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    console.log('Engine message:', message);

    if (message.includes('uciok')) {
      // Engine is ready
      console.log('Stockfish engine initialized');
    } else if (message.includes('info depth')) {
      // Parse evaluation info
      const depthMatch = message.match(/depth (\d+)/);
      const scoreMatch = message.match(/score cp (-?\d+)/) || message.match(/score mate (-?\d+)/);
      const pvMatch = message.match(/\bpv ([a-h1-8qrnbk\s]+)/i);
      
      if (depthMatch && scoreMatch) {
        const currentDepth = parseInt(depthMatch[1]);
        const score = parseInt(scoreMatch[1]);
        const pv = pvMatch ? pvMatch[1].trim() : '';
        
        // Only update if we've reached the target depth or higher
        if (currentDepth >= depth) {
          const calculationTime = Date.now() - startTimeRef.current;
          
          // Extract the first move from the principal variation and convert to algebraic
          // PV format from Stockfish is UCI notation: "f4d6 d8d6 a5b3 a8d5..."
          const firstMoveUci = pv.split(' ')[0] || '';
          const firstMoveAlgebraic = firstMoveUci ? uciToAlgebraic(firstMoveUci, analyzingFenRef.current) || firstMoveUci : '';
          const bestMoveFormatted = firstMoveAlgebraic ? formatMoveWithNumber(firstMoveAlgebraic, analyzingFenRef.current) : '';
          
          // Convert the entire principal variation to algebraic notation
          const pvAlgebraic = formatPrincipalVariation(pv, analyzingFenRef.current);
          
          const newEvaluation: EngineEvaluation = {
            evaluation: scoreMatch[0].includes('mate') ? (score > 0 ? 10000 : -10000) : score,
            bestMove: bestMoveFormatted,
            principalVariation: pvAlgebraic,
            depth: currentDepth,
            calculationTime
          };
          
          setEvaluation(newEvaluation);
          
          if (onEvaluation) {
            onEvaluation(newEvaluation.evaluation, newEvaluation.bestMove, newEvaluation.principalVariation);
          }
          
          if (onCalculationTime) {
            onCalculationTime(calculationTime);
          }
        }
      }
    } else if (message.includes('bestmove')) {
      // Analysis complete
      setIsAnalyzing(false);
      const calculationTime = Date.now() - startTimeRef.current;
      
      if (onCalculationTime) {
        onCalculationTime(calculationTime);
      }
    }
  }, [depth, onEvaluation, onCalculationTime]);

  const analyzePosition = useCallback(() => {
    if (!workerRef.current || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setError(null);
    startTimeRef.current = Date.now();
    
    // Set position and start analysis
    // Store the FEN being analyzed for move conversion
    analyzingFenRef.current = fen;
    // Send 'stop' first to ensure clean state, then set new position
    workerRef.current.postMessage('stop');
    workerRef.current.postMessage('ucinewgame');
    workerRef.current.postMessage(`position fen ${fen}`);
    workerRef.current.postMessage(`go depth ${depth}`);
  }, [fen, depth, isAnalyzing]);

  const stopAnalysis = useCallback(() => {
    if (workerRef.current && isAnalyzing) {
      workerRef.current.postMessage('stop');
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  return {
    isAnalyzing,
    evaluation,
    error,
    analyzePosition,
    stopAnalysis
  };
}

export default StockfishEngine;