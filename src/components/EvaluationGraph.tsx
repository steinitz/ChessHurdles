import React, { useState } from 'react';

interface EvaluationData {
  moveNumber: number;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
}

interface EvaluationGraphProps {
  evaluations: EvaluationData[];
  currentMoveIndex?: number;
  onMoveClick?: (moveIndex: number) => void;
  width?: number;
  height?: number;
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({
  evaluations,
  currentMoveIndex = -1,
  onMoveClick,
  width = 800,
  height = 200
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="evaluation-graph-empty">
        <p>No evaluation data available</p>
      </div>
    );
  }

  // Calculate bar width in pixels (0.8rem ≈ 12.8px at default font size)
  const barWidth = 12.8;
  const barSpacing = 1;
  const totalBarWidth = barWidth + barSpacing;
  
  // Calculate actual width needed
  const neededWidth = evaluations.length * totalBarWidth;
  const graphWidth = Math.max(width, neededWidth);
  
  // Graph dimensions
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = graphWidth - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Find evaluation range for scaling
  const maxEval = Math.max(...evaluations.map(e => Math.abs(e.evaluation)));
  const evalRange = Math.max(maxEval, 3); // Minimum range of 3 for visibility
  
  // Scale function for evaluation to y-coordinate
  const scaleY = (evaluation: number) => {
    const normalized = evaluation / evalRange; // -1 to 1
    return chartHeight / 2 - (normalized * chartHeight / 2);
  };
  
  // Zero line position
  const zeroY = chartHeight / 2;
  
  return (
    <div className="evaluation-graph" style={{ width: '100%', overflowX: 'auto' }}>
      <svg 
        width={graphWidth} 
        height={height} 
        style={{ 
          border: '1px solid var(--color-bg-secondary)', 
          borderRadius: '4px',
          minWidth: '100%'
        }}
      >
        {/* Background */}
        <rect 
          width={graphWidth} 
          height={height} 
          fill="var(--color-bg)" 
        />
        
        {/* Chart area */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Zero line */}
          <line
            x1={0}
            y1={zeroY}
            x2={chartWidth}
            y2={zeroY}
            stroke="var(--color-text-secondary)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
          
          {/* Evaluation bars */}
          {evaluations.map((evaluation, index) => {
            const x = index * totalBarWidth;
            const barHeight = Math.abs(scaleY(evaluation.evaluation) - zeroY);
            const y = evaluation.evaluation >= 0 ? scaleY(evaluation.evaluation) : zeroY;
            
            // Use single color for all bars
            let fillColor = 'var(--color-link)';
            
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
                    opacity: hoveredIndex === index ? 0.8 : (isCurrentMove ? 1 : 0.7),
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
                      x={x - 30}
                      y={y - 35}
                      width={60}
                      height={25}
                      fill="var(--color-bg)"
                      stroke="var(--color-text-secondary)"
                      strokeWidth={1}
                      rx={3}
                    />
                    <text
                      x={x}
                      y={y - 20}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-text)"
                    >
                      Move {evaluation.moveNumber}
                    </text>
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-text)"
                    >
                      {evaluation.isMate 
                        ? `#${Math.sign(evaluation.evaluation) * (Math.abs(evaluation.evaluation) - 5000)}`
                        : (evaluation.evaluation / 100).toFixed(2)
                      }
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          
          {/* Y-axis labels */}
          <text x={-10} y={10} textAnchor="end" fontSize="12" fill="var(--color-text-secondary)">
            +{evalRange.toFixed(1)}
          </text>
          <text x={-10} y={zeroY + 4} textAnchor="end" fontSize="12" fill="var(--color-text-secondary)">
            0.0
          </text>
          <text x={-10} y={chartHeight - 5} textAnchor="end" fontSize="12" fill="var(--color-text-secondary)">
            -{evalRange.toFixed(1)}
          </text>
        </g>
        
        {/* X-axis */}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={graphWidth - margin.right}
          y2={height - margin.bottom}
          stroke="var(--color-text-secondary)"
          strokeWidth={1}
        />
        
        {/* Y-axis */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={height - margin.bottom}
          stroke="var(--color-text-secondary)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

export default EvaluationGraph;