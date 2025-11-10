import React, { useState } from 'react';

interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  isPlaceholder?: boolean;
}

interface EvaluationGraphProps {
  evaluations: EvaluationData[];
  currentMoveIndex?: number;
  onMoveClick?: (moveIndex: number) => void;
  height?: number;
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({
  evaluations,
  currentMoveIndex = -1,
  onMoveClick,
  height = 200,
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
  const maxEval = hasData ? Math.max(...evaluations.map(e => Math.abs(e.evaluation))) : 0;
  const evalRange = Math.max(maxEval, 3); // Minimum range of 3 for visibility
  
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
      data-testid="evaluation-graph"
      style={{ width: '100%', position: 'relative' }}
    >
      <svg 
        id="evaluation-graph-svg"
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
            
            // Highlight current move with different opacity or stroke
            const isCurrentMove = index === currentMoveIndex;
            
            return (
              <g key={index}>
                {/* Bar */}
                <rect
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
          <p>No evaluation data available</p>
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
          +{evalRange.toFixed(1)}
        </div>
        <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${zeroLabelPct}%`, transform: 'translateX(-6px) translateX(-100%) translateY(-50%)', whiteSpace: 'nowrap' }}>
          0.0
        </div>
        <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${bottomLabelPct}%`, transform: 'translateX(-6px) translateX(-100%)', whiteSpace: 'nowrap' }}>
          -{evalRange.toFixed(1)}
        </div>

        {/* Hover tooltip overlay: crisp text that doesn’t stretch */}
        {hoveredIndex >= 0 && (() => {
          const evaluation = evaluations[hoveredIndex];
          const x = hoveredIndex * totalBarWidth;
          const leftPct = ((margin.left + x + barWidth / 2) / viewBoxWidth) * 100;
          // Anchor tooltip near the x-axis (zero line) to avoid jumping with bar height
          const axisTopPct = ((margin.top + zeroY) / viewBoxHeight) * 100;
          const valueText = evaluation.isPlaceholder
            ? 'Analyzing...'
            : evaluation.isMate
              ? `#${Math.sign(evaluation.evaluation) * (Math.abs(evaluation.evaluation) - 5000)}`
              : (evaluation.evaluation / 100).toFixed(2);
          return (
            <div
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${axisTopPct}%`,
                transform: 'translateX(-50%) translateY(-8px)',
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
      </div>
    </div>
  );
};

export default EvaluationGraph;