import React, { useLayoutEffect, useRef, useState } from 'react';

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
  scaleMode?: 'linear' | 'log' | 'tanh';
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({
  evaluations,
  currentMoveIndex = -1,
  onMoveClick,
  height = 200,
  scaleMode = 'linear'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  if (!evaluations || evaluations.length === 0) {
    return (
      <div>
        <p>No evaluation data available</p>
      </div>
    );
  }

  // Dynamic sizing (self-sizing): compute bar positions/widths in viewBox units (0–100 width)
  const totalBars = evaluations.length;
  const barSpacing = 0.3; // small gap between bars in viewBox units
  const viewBoxWidth = 100; // normalized width units
  const viewBoxHeight = height; // use height units directly for vertical scale
  
  // Graph dimensions in viewBox units
  const margin = { top: 16, right: 8, bottom: 24, left: 12 };
  const chartWidth = viewBoxWidth - margin.left - margin.right;
  const chartHeight = viewBoxHeight - margin.top - margin.bottom;
  
  // Find evaluation range for scaling
  const maxEval = Math.max(...evaluations.map(e => Math.abs(e.evaluation)));
  const evalRange = Math.max(maxEval, 3); // Minimum range of 3 for visibility
  
  // Normalization helpers for different scale modes
  const clamp = (x: number) => Math.max(-1, Math.min(1, x));
  const normalizeLinear = (e: number) => clamp(e / evalRange);
  const normalizeLog = (e: number) => {
    const s = Math.sign(e);
    const abs = Math.abs(e);
    // log1p compresses extremes while keeping 0 linear near origin
    const normAbs = Math.log1p(abs) / Math.log1p(evalRange);
    return clamp(s * normAbs);
  };
  const normalizeTanh = (e: number) => clamp(Math.tanh(e / evalRange));
  const normalize = (e: number) => {
    switch (scaleMode) {
      case 'log':
        return normalizeLog(e);
      case 'tanh':
        return normalizeTanh(e);
      case 'linear':
      default:
        return normalizeLinear(e);
    }
  };

  // Scale function for evaluation to y-coordinate using selected normalization
  const scaleY = (evaluation: number) => {
    const normalized = normalize(evaluation); // -1 to 1
    return chartHeight / 2 - (normalized * chartHeight / 2);
  };
  
  // Zero line position
  const zeroY = chartHeight / 2;
  
  // refs and pixel ratio for horizontal alignment of overlay labels
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pxPerUnitX, setPxPerUnitX] = useState<number>(1);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => setPxPerUnitX(el.clientWidth / viewBoxWidth);
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewBoxWidth]);

  // Precompute overlay label positions (CSS pixels)
  const axisPx = margin.left * pxPerUnitX;
  const topLabelY = margin.top + 10;
  const zeroLabelY = margin.top + zeroY;
  const bottomLabelY = margin.top + chartHeight - 5;

  return (
    <div
      ref={wrapperRef}
      data-testid="evaluation-graph"
      style={{ width: '100%', position: 'relative' }}
    >
      <svg 
        id="evaluation-graph-svg"
        width="100%" 
        height={height} 
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
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
          {evaluations.map((evaluation, index) => {
            const barWidth = Math.max(0.5, (chartWidth - Math.max(0, totalBars - 1) * barSpacing) / Math.max(1, totalBars));
            const totalBarWidth = barWidth + barSpacing;
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
                
                {/* Click target (invisible, larger area) */}
                {onMoveClick && (
                  <rect
                    x={x - 2}
                    y={0}
                    width={barWidth + 4}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onMoveClick(index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(-1)}
                  />
                )}
                
                {/* Hover tooltip */}
                {hoveredIndex === index && (
                  <g>
                    <rect
                      x={x - 6}
                      y={y - 20}
                      width={12}
                      height={12}
                      fill="var(--color-bg)"
                      stroke="var(--color-text-secondary)"
                      strokeWidth={1}
                      rx={3}
                    />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-text)"
                    >
                      Move {evaluation.moveNumber}
                    </text>
                    <text
                      x={x}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-text)"
                    >
                      {evaluation.isPlaceholder 
                        ? 'Analyzing...'
                        : evaluation.isMate 
                          ? `#${Math.sign(evaluation.evaluation) * (Math.abs(evaluation.evaluation) - 5000)}`
                          : (evaluation.evaluation / 100).toFixed(2)
                      }
                    </text>
                  </g>
                )}
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
        <div style={{ position: 'absolute', left: `${axisPx}px`, top: `${topLabelY}px`, transform: 'translateX(-6px) translateX(-100%)', whiteSpace: 'nowrap' }}>
          +{evalRange.toFixed(1)}
        </div>
        <div style={{ position: 'absolute', left: `${axisPx}px`, top: `${zeroLabelY}px`, transform: 'translateX(-6px) translateX(-100%) translateY(-50%)', whiteSpace: 'nowrap' }}>
          0.0
        </div>
        <div style={{ position: 'absolute', left: `${axisPx}px`, top: `${bottomLabelY}px`, transform: 'translateX(-6px) translateX(-100%)', whiteSpace: 'nowrap' }}>
          -{evalRange.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default EvaluationGraph;