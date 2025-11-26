import React, { useState } from 'react';

export interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  isPlaceholder?: boolean;
  // Optional flag to indicate a cached evaluation for UI badge rendering
  isCached?: boolean;
}

interface EvaluationGraphProps {
  evaluations: EvaluationData[];
  currentMoveIndex?: number;
  onMoveClick?: (moveIndex: number) => void;
  height?: number;
}

// Exported constants/functions to keep tests resilient without literals
export const EVALUATION_GRAPH_TEST_ID = 'evaluation-graph';
export const EVALUATION_GRAPH_SVG_ID = 'evaluation-graph-svg';
export const EVALUATION_BAR_TEST_ID = 'evaluation-bar';
export const ZERO_LABEL_TEXT = '0.0';
export const NO_DATA_TEXT = 'No evaluation data available';
export const DEFAULT_EVALUATION_GRAPH_HEIGHT = 200;
export const MATE_BASE = 5000;
export const LOADING_TOOLTIP_TEXT = 'Analyzing...';
export const MIN_RANGE_CP = 300; // 3.0 pawns minimum

export const computeEvalRange = (evaluations: EvaluationData[]): number => {
  const hasData = !!evaluations && evaluations.length > 0;
  if (!hasData) return MIN_RANGE_CP;
  // Ignore placeholder and mate-coded values when determining axis scale
  const usable = evaluations.filter(e => !e.isPlaceholder && Math.abs(e.evaluation) < MATE_BASE);
  const maxEval = usable.length > 0 ? Math.max(...usable.map(e => Math.abs(e.evaluation))) : 0;
  // Keep a sensible minimum range in centipawns
  return Math.max(maxEval, MIN_RANGE_CP);
};

export const formatEvaluationText = (evaluation: EvaluationData): string => {
  if (evaluation.isPlaceholder) return LOADING_TOOLTIP_TEXT;
  if (evaluation.isMate) {
    const distance = Math.abs(evaluation.evaluation) - MATE_BASE;
    const sign = Math.sign(evaluation.evaluation);
    return `#${sign * distance}`;
  }
  return (evaluation.evaluation / 100).toFixed(2);
};

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({
  evaluations,
  currentMoveIndex = -1,
  onMoveClick,
  height = DEFAULT_EVALUATION_GRAPH_HEIGHT,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const hasData = !!evaluations && evaluations.length > 0;

  // Dynamic sizing (self-sizing): compute bar positions/widths in viewBox units (0–100 width)
  const totalBars = hasData ? evaluations.length : 0;
  const barSpacing = 0.3; // small gap between bars in viewBox units
  const viewBoxWidth = 100; // normalized width units
  const viewBoxHeight = height; // use height units directly for vertical scale
  
  // Graph dimensions in viewBox units
  const margin = { top: 16, right: 0, bottom: 24, left: 10 };
  const chartWidth = viewBoxWidth - margin.left - margin.right;
  const chartHeight = viewBoxHeight - margin.top - margin.bottom;

  // Precompute bar geometry shared across rendering and overlay
  const barWidth = Math.max(0.5, (chartWidth - Math.max(0, totalBars - 1) * barSpacing) / Math.max(1, totalBars));
  const totalBarWidth = barWidth + barSpacing;
  
  // Find evaluation range for scaling
  const evalRange = computeEvalRange(evaluations); // Minimum range of 3 for visibility
  
  // Normalization (linear clamp from [-evalRange, +evalRange] to [-1, 1])
  const clamp = (x: number) => Math.max(-1, Math.min(1, x));
  const normalize = (e: number) => clamp(e / evalRange);

  // Scale function for evaluation to y-coordinate using selected normalization
  const scaleY = (evaluation: number) => {
    const normalized = normalize(evaluation); // -1 to 1
    return chartHeight / 2 - (normalized * chartHeight / 2);
  };
  
  // Zero line position
  const zeroY = chartHeight / 2;
  
  // Overlay label positions as percentages relative to viewBox
  const axisLeftPct = (margin.left / viewBoxWidth) * 100;
  const topLabelPct = ((margin.top + 10) / viewBoxHeight) * 100;
  const zeroLabelPct = ((margin.top + zeroY) / viewBoxHeight) * 100;
  const bottomLabelPct = ((margin.top + chartHeight - 5) / viewBoxHeight) * 100;

  return (
    <div
      data-testid={EVALUATION_GRAPH_TEST_ID}
      style={{ width: '100%', position: 'relative' }}
    >
      <svg 
        id={EVALUATION_GRAPH_SVG_ID}
        width="100%" 
        height={height} 
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%' }}
      >
        {/* Background removed to allow mvp.css default styles */}
        
        {/* Chart area */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Progress overlay removed to avoid tinting the background */}
          {/* Zero line */}
          <line
            x1={0}
            y1={zeroY}
            x2={chartWidth}
            y2={zeroY}
            stroke="var(--color-text-secondary)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="2,2"
          />
          
          {/* Evaluation bars */}
          {hasData && evaluations.map((evaluation, index) => {
            const x = index * totalBarWidth;
            const barHeight = Math.abs(scaleY(evaluation.evaluation) - zeroY);
            const y = evaluation.evaluation >= 0 ? scaleY(evaluation.evaluation) : zeroY;
            
            // Use different colors for placeholder vs real data
            let fillColor = 'var(--color-link)';
            let opacity = 0.7;
            
            if (evaluation.isPlaceholder) {
              fillColor = 'var(--color-text-secondary)';
              opacity = 0.3;
            }
            // Use secondary text color for cached evaluations
            if (!evaluation.isPlaceholder && evaluation.isCached) {
              fillColor = 'var(--color-text-secondary)';
            }
            
            // Highlight current move with different opacity or stroke
            const isCurrentMove = index === currentMoveIndex;
            
            return (
              <g key={index}>
                {/* Bar */}
                <rect
                  data-testid={EVALUATION_BAR_TEST_ID}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={fillColor}
                  stroke={isCurrentMove ? 'var(--color-text)' : 'none'}
                  strokeWidth={isCurrentMove ? 2 : 0}
                  style={{ 
                    cursor: onMoveClick ? 'pointer' : 'default',
                    opacity: hoveredIndex === index ? 0.8 : (isCurrentMove ? 1 : opacity),
                    transition: 'opacity 0.2s ease'
                  }}
                  onClick={() => onMoveClick?.(index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                />
                
                {/* Hover tooltip moved to HTML overlay to avoid SVG text stretch */}
              </g>
            );
          })}
          
          {/* Y-axis labels moved to HTML overlay to avoid SVG stretch */}
        </g>
        
        {/* X-axis */}
        <line
          x1={margin.left}
          y1={viewBoxHeight - margin.bottom}
          x2={viewBoxWidth - margin.right}
          y2={viewBoxHeight - margin.bottom}
          stroke="var(--color-text-secondary)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        
        {/* Y-axis */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={viewBoxHeight - margin.bottom}
          stroke="var(--color-text-secondary)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {!hasData && (
        <div style={{ marginTop: 8 }}>
          <p>{NO_DATA_TEXT}</p>
        </div>
      )}
      {/* Non-stretched overlay labels */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          fontSize: '10px'
        }}
      >
        <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${topLabelPct}%`, transform: 'translateX(-6px) translateX(-100%)', whiteSpace: 'nowrap' }}>
          +{(evalRange / 100).toFixed(1)}
        </div>
        <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${zeroLabelPct}%`, transform: 'translateX(-6px) translateX(-100%) translateY(-50%)', whiteSpace: 'nowrap' }}>
          {ZERO_LABEL_TEXT}
        </div>
        <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${bottomLabelPct}%`, transform: 'translateX(-6px) translateX(-100%)', whiteSpace: 'nowrap' }}>
          -{(evalRange / 100).toFixed(1)}
        </div>

        {/* Hover tooltip overlay: crisp text that doesn’t stretch */}
        {hoveredIndex >= 0 && (() => {
          const evaluation = evaluations[hoveredIndex];
          const x = hoveredIndex * totalBarWidth;
          const leftPct = ((margin.left + x + barWidth / 2) / viewBoxWidth) * 100;
          // Anchor tooltip near the x-axis (zero line) to avoid jumping with bar height
          const axisTopPct = ((margin.top + zeroY) / viewBoxHeight) * 100;
          const valueText = formatEvaluationText(evaluation);
          return (
            <div
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${axisTopPct}%`,
                // Move tooltip up to avoid cursor overlap on small bars
                transform: 'translateX(-50%) translateY(-28px)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-text-secondary)',
                borderRadius: 3,
                padding: '2px 4px',
                color: 'var(--color-text)',
                whiteSpace: 'nowrap'
              }}
            >
              Move {evaluation.moveNumber} · {valueText}
            </div>
          );
        })()}

        {/* Cached badge overlay removed per design update */}
      </div>
    </div>
  );
};

export default EvaluationGraph;