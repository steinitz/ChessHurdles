import React from 'react';
import { EngineEvaluation } from '~/lib/stockfish-engine';

interface PositionAnalysisProps {
  isAnalyzing: boolean;
  analysisDepth: number;
  engineEvaluation: EngineEvaluation | null;
  error: string | null;
  containerWidth: string;
  onAnalyzePosition: () => void;
  onDepthChange: (depth: number) => void;
  formatEvaluation: (evaluation: number) => string;
}

export function PositionAnalysis({
  isAnalyzing,
  analysisDepth,
  engineEvaluation,
  error,
  containerWidth,
  onAnalyzePosition,
  onDepthChange,
  formatEvaluation
}: PositionAnalysisProps) {
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
          onClick={onAnalyzePosition}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
        </button>
        <label>
          Depth:
          <input
            type="range"
            min="1"
            max="15"
            value={analysisDepth}
            onChange={(e) => onDepthChange(parseInt(e.target.value))}
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