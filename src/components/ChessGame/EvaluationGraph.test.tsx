import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import EvaluationGraph, {
  type EvaluationData,
  EVALUATION_GRAPH_TEST_ID,
  EVALUATION_GRAPH_SVG_ID,
  EVALUATION_BAR_TEST_ID,
  ZERO_LABEL_TEXT,
  NO_DATA_TEXT,
  computeEvalRange,
  formatEvaluationText,
  DEFAULT_EVALUATION_GRAPH_HEIGHT,
} from './EvaluationGraph';

describe('EvaluationGraph', () => {
  it('renders base structure and axis labels using exported values', () => {
    const evaluations: EvaluationData[] = [
      { moveNumber: 1, evaluation: 50, isMate: false },
      { moveNumber: 2, evaluation: -30, isMate: false },
    ];

    const evalRange = computeEvalRange(evaluations);

    render(<EvaluationGraph evaluations={evaluations} height={DEFAULT_EVALUATION_GRAPH_HEIGHT} />);

    // Structural IDs
    expect(screen.getByTestId(EVALUATION_GRAPH_TEST_ID)).toBeInTheDocument();
    expect(document.getElementById(EVALUATION_GRAPH_SVG_ID)).toBeTruthy();

    // Axis labels (displayed in pawns)
    const pawnRange = (evalRange / 100).toFixed(1);
    expect(screen.getByText(`+${pawnRange}`)).toBeInTheDocument();
    expect(screen.getByText(ZERO_LABEL_TEXT)).toBeInTheDocument();
    expect(screen.getByText(`-${pawnRange}`)).toBeInTheDocument();

    // Bars
    const bars = screen.getAllByTestId(EVALUATION_BAR_TEST_ID);
    expect(bars.length).toBe(evaluations.length);
  });

  it('shows no data message when evaluations is empty', () => {
    render(<EvaluationGraph evaluations={[]} />);
    expect(screen.getByText(NO_DATA_TEXT)).toBeInTheDocument();
  });

  it('shows tooltip with formatted text on hover for different evaluation types', () => {
    const evaluations: EvaluationData[] = [
      { moveNumber: 10, evaluation: 25, isMate: false },
      { moveNumber: 11, evaluation: 5002, isMate: true },
      { moveNumber: 12, evaluation: 0, isMate: false, isPlaceholder: true },
    ];

    render(<EvaluationGraph evaluations={evaluations} />);

    const bars = screen.getAllByTestId(EVALUATION_BAR_TEST_ID);

    // Hover first bar (centipawn)
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getByText(`Move ${evaluations[0].moveNumber} · ${formatEvaluationText(evaluations[0])}`)).toBeInTheDocument();

    // Hover second bar (mate)
    fireEvent.mouseEnter(bars[1]);
    expect(screen.getByText(`Move ${evaluations[1].moveNumber} · ${formatEvaluationText(evaluations[1])}`)).toBeInTheDocument();

    // Hover third bar (placeholder)
    fireEvent.mouseEnter(bars[2]);
    expect(screen.getByText(`Move ${evaluations[2].moveNumber} · ${formatEvaluationText(evaluations[2])}`)).toBeInTheDocument();

    // Mouse leave hides tooltip
    fireEvent.mouseLeave(bars[2]);
    // Tooltip container is aria-hidden and conditionally rendered; after leave, the text should not be found
    expect(screen.queryByText(`Move ${evaluations[2].moveNumber} · ${formatEvaluationText(evaluations[2])}`)).toBeNull();
  });

  it('computes range ignoring mate-coded and placeholder values; enforces minimum range', () => {
    const evaluations: EvaluationData[] = [
      { moveNumber: 1, evaluation: 0, isMate: false, isPlaceholder: true }, // placeholder
      { moveNumber: 2, evaluation: 5002, isMate: true }, // mate-coded, should be ignored for range
      { moveNumber: 3, evaluation: 80, isMate: false }, // small cp
      { moveNumber: 4, evaluation: -120, isMate: false }, // small cp
    ];

    const evalRange = computeEvalRange(evaluations);
    // With small cp values (max 120) and MIN_RANGE_CP=300, expect 300
    expect(evalRange).toBeGreaterThanOrEqual(300);
    expect(evalRange).toBe(300);

    render(<EvaluationGraph evaluations={evaluations} height={DEFAULT_EVALUATION_GRAPH_HEIGHT} />);

    // Axis labels should reflect ±(evalRange/100) in pawns
    const pawnRange = (evalRange / 100).toFixed(1);
    expect(screen.getByText(`+${pawnRange}`)).toBeInTheDocument();
    expect(screen.getByText(ZERO_LABEL_TEXT)).toBeInTheDocument();
    expect(screen.getByText(`-${pawnRange}`)).toBeInTheDocument();
  });
});