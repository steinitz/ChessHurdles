import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameAnalysis from './GameAnalysis';
import { Chess } from 'chess.js';
import { useRef } from 'react';

// Mock the stockfish-engine module
vi.mock('../../lib/stockfish-engine', () => ({
  initializeStockfishWorker: vi.fn(() => Promise.resolve(new Worker('mock'))),
  analyzePosition: vi.fn(),
  handleEngineMessage: vi.fn(),
}));

// Mock EvaluationGraph component
vi.mock('../EvaluationGraph', () => ({
  default: ({ evaluations }: { evaluations: any[] }) => (
    <div data-testid="evaluation-graph">
      Graph with {evaluations.length} evaluations
    </div>
  ),
}));

describe('GameAnalysis', () => {
  let mockGameMoves: any[];
  let mockAnalysisWorkerRef: React.MutableRefObject<Worker | null>;
  let mockGoToMove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock game moves
    const game1 = new Chess();
    const game2 = new Chess();
    game2.move('e4');
    const game3 = new Chess();
    game3.move('e4');
    game3.move('e5');

    mockGameMoves = [
      { position: game1, moveNumber: 0 },
      { position: game2, move: 'e4', moveNumber: 1, isWhiteMove: true },
      { position: game3, move: 'e5', moveNumber: 2, isWhiteMove: false },
    ];

    mockAnalysisWorkerRef = { current: null };
    mockGoToMove = vi.fn();
  });

  it('renders the component with initial state', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={2}
      />
    );

    expect(screen.getByText('Game Analysis')).toBeInTheDocument();
    expect(screen.getByText(/Analysis Depth:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze Entire Game' })).toBeEnabled();
  });

  it('displays analysis depth controls', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    expect(screen.getByText(/Analysis Depth:/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Default depth
    expect(screen.getByText('5 (Fast)')).toBeInTheDocument();
    expect(screen.getByText('20 (Deep)')).toBeInTheDocument();
  });

  it('shows evaluation graph placeholder when no evaluations exist', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    expect(screen.getByTestId('evaluation-graph')).toBeInTheDocument();
    expect(screen.getByText('Graph with 0 evaluations')).toBeInTheDocument();
  });

  it('disables analyze button when game has no moves', () => {
    const emptyGameMoves = [{ position: new Chess(), moveNumber: 0 }];
    
    render(
      <GameAnalysis
        gameMoves={emptyGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    expect(screen.getByRole('button', { name: 'Analyze Entire Game' })).toBeDisabled();
  });

  it('allows depth adjustment via slider', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('1'); // Default depth
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '21');
  });

  it('respects maxMovesToAnalyze prop', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        containerWidth={800}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={1}
      />
    );

    // Component should render normally with the prop
    expect(screen.getByText('Game Analysis')).toBeInTheDocument();
  });
});