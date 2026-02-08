import React, { useState } from 'react';


export interface EvaluationData {
  // Index of the move in the game sequence (0-based: 0=1.e4, 1=1...e5)
  moveIndex?: number;
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
  totalMoves?: number;
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
  totalMoves = 0,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  // Ensure we have a valid totalMoves count. If not provided, fallback to evaluations length (legacy behavior)
  const safeTotalMoves = totalMoves > 0 ? totalMoves : evaluations.length;
  // If we still have 0, default to 1 to avoid division by zero
  const moveCount = Math.max(1, safeTotalMoves);

  const hasData = !!evaluations && evaluations.length > 0;

  // Dynamic sizing
  const viewBoxWidth = 100; // normalized width units
  const viewBoxHeight = height; // use height units directly for vertical scale

  // Graph dimensions in viewBox units
  const margin = { top: 16, right: 0, bottom: 24, left: 10 };
  const chartWidth = viewBoxWidth - margin.left - margin.right;
  const chartHeight = viewBoxHeight - margin.top - margin.bottom;

  // Calculate fixed bar width based on TOTAL moves for the game
  // logic: 1-based moveNumber maps to [0..totalMoves-1]
  const barSpacing = 0.05; // Tight spacing for cleaner look
  const totalBarWidth = chartWidth / moveCount;
  const barWidth = Math.max(0.1, totalBarWidth - barSpacing);

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

  // Overlay label positions
  const axisLeftPct = (margin.left / viewBoxWidth) * 100;
  const topLabelPct = (margin.top / viewBoxHeight) * 100;
  const zeroLabelPct = ((margin.top + zeroY) / viewBoxHeight) * 100;
  const bottomLabelPct = ((margin.top + chartHeight) / viewBoxHeight) * 100;

  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMoveClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Convert clickX to viewBox coordinates
    const scaleX = viewBoxWidth / rect.width;
    const viewBoxX = clickX * scaleX;

    // Adjust for margin
    const relativeX = viewBoxX - margin.left;

    if (relativeX < 0 || relativeX > chartWidth) return;

    // Map to move index (0-based Ply)
    // relativeX = moveIndex * totalBarWidth
    // moveIndex = relativeX / totalBarWidth
    const moveIndex = Math.floor(relativeX / totalBarWidth);

    // Check bounds
    if (moveIndex >= 0 && moveIndex < moveCount) {
      // onMoveClick expects the "Target Move Index" (usually 1-based, or same as GameMoves index).
      // If standard GameMoves uses index 0=Start, index 1=Move1.
      // And our graph 0th bar = Move 1.
      // So pass moveIndex + 1.
      onMoveClick(moveIndex + 1);
    }
  };

  return (
    <div data-testid={EVALUATION_GRAPH_TEST_ID} style={{ width: '100%' }}>
      <div style={{ width: '100%', height: height, position: 'relative' }}>
        <svg
          id={EVALUATION_GRAPH_SVG_ID}
          width="100%"
          height={height}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="none"
          style={{ display: 'block', width: '100%', cursor: onMoveClick ? 'pointer' : 'default' }}
          onClick={handleChartClick}
        >
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
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2,2"
            />

            {/* Evaluation bars */}
            {hasData && evaluations.map((evaluation, index) => {
              // Position based strictly on moveIndex (0-based Ply).
              // Fallback to index if moveIndex is missing (e.g. legacy data)
              const moveIdx = evaluation.moveIndex !== undefined ? evaluation.moveIndex : index;
              const x = moveIdx * totalBarWidth;

              const val = evaluation.evaluation;
              const barHeight = Math.abs(scaleY(val) - zeroY);
              const y = val >= 0 ? scaleY(val) : zeroY;

              // Use different colors for placeholder vs real data
              let fillColor = 'var(--color-link)';

              if (evaluation.isPlaceholder) {
                fillColor = 'var(--color-text-secondary)';
              } else if (evaluation.isCached) {
                // Keep logic simple.
              }

              // Highlight current move
              // The prop currentMoveIndex passed from GameAnalysis usually is 0-based index in gameMoves.
              // So moveIdx === currentMoveIndex - 1 ? No.
              // GameMoves: Index 0=Start. Index 1=Move1.
              // Our moveIdx 0=Move1.
              // So if currentMoveIndex=1 (Move 1), moveIdx should be 0.
              // So isCurrentMove = moveIdx === currentMoveIndex - 1.
              // Or does GameAnalysis pass index of the move in its own list?
              // GameAnalysis passes `currentMoveIndex` prop. 
              // Usually `currentMoveIndex` is the global index.
              const isCurrentMove = (moveIdx + 1) === currentMoveIndex;

              return (
                <rect
                  key={index}
                  data-testid={EVALUATION_BAR_TEST_ID}
                  x={x}
                  y={y}
                  width={Math.max(0.1, barWidth)}
                  height={Math.max(0.5, barHeight)} // Minimum height
                  fill={fillColor}
                  opacity={hoveredIndex === index ? 0.8 : (isCurrentMove ? 1 : 0.7)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  style={{ transition: 'opacity 0.1s' }}
                />
              );
            })}
          </g>

          {/* X/Y Axes Lines */}
          <line
            x1={margin.left}
            y1={viewBoxHeight - margin.bottom}
            x2={viewBoxWidth - margin.right}
            y2={viewBoxHeight - margin.bottom}
            stroke="var(--color-text-secondary)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
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

        {/* Labels Overlay */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontSize: '10px' }}>
          {/* Axis Labels */}
          <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${topLabelPct}%`, transform: 'translate(-110%, -50%)', whiteSpace: 'nowrap' }}>
            +{(evalRange / 100).toFixed(1)}
          </div>
          <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${zeroLabelPct}%`, transform: 'translate(-110%, -50%)', whiteSpace: 'nowrap' }}>
            {ZERO_LABEL_TEXT}
          </div>
          <div style={{ position: 'absolute', left: `${axisLeftPct}%`, top: `${bottomLabelPct}%`, transform: 'translate(-110%, -50%)', whiteSpace: 'nowrap' }}>
            -{(evalRange / 100).toFixed(1)}
          </div>

          {/* Smart Tooltip (Lichess Style) */}
          {hoveredIndex >= 0 && evaluations[hoveredIndex] && (() => {
            const ev = evaluations[hoveredIndex];
            const moveIdx = ev.moveIndex !== undefined ? ev.moveIndex : hoveredIndex;
            const moveNum = ev.moveNumber || (Math.floor(moveIdx / 2) + 1);

            // X Position
            // If move is in Left Half (< total/2), show Right. Else Left.
            const isLeftHalf = moveIdx <= (moveCount / 2);

            // Calculate bar center X in %
            const barCenterX = ((margin.left + moveIdx * totalBarWidth + totalBarWidth / 2) / viewBoxWidth) * 100;

            // Vertical Position
            // Positive -> Top of bar. Negative -> Bottom of bar.
            const scaledY = scaleY(ev.evaluation); // in viewBox height units

            const isPositive = ev.evaluation >= 0;

            // Correction:
            // Positive eval: bar goes from scaleY(val) down to zeroY. Top is scaleY(val).
            // Negative eval: bar goes from zeroY down to scaleY(val). Bottom is scaleY(val).

            // So:
            // If Positive: Anchor to scaleY(val) (Top of bar).
            // If Negative: Anchor to scaleY(val) (Bottom of bar).
            const anchorYPct = ((margin.top + scaleY(ev.evaluation)) / viewBoxHeight) * 100;

            const valueText = formatEvaluationText(ev);

            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${barCenterX}%`,
                  top: `${anchorYPct}%`,
                  transform: `translate(${isLeftHalf ? '10%' : '-110%'}, ${isPositive ? '-100%' : '0%'})`,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-text-secondary)',
                  borderRadius: 3,
                  padding: '2px 6px',
                  zIndex: 20,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap',
                  marginTop: isPositive ? '-4px' : '4px'
                }}
              >
                <span style={{ fontWeight: 600 }}>{valueText}</span>
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Move {moveNum}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {!hasData && (
        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1rem' }}>
          {NO_DATA_TEXT}
        </div>
      )}
    </div>
  );
};
export default EvaluationGraph;