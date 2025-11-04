import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import GameAnalysis, { MIN_ANALYSIS_DEPTH, MAX_ANALYSIS_DEPTH, DEFAULT_ANALYSIS_DEPTH } from './GameAnalysis';
import { waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { initializeStockfishWorker } from '../../lib/stockfish-engine';

// Mock the stockfish-engine module
vi.mock('../../lib/stockfish-engine', () => ({
  initializeStockfishWorker: vi.fn(() => new Worker('mock')),
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
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    // Check for depth slider existence and accessibility
    const depthSlider = screen.getByRole('slider');
    expect(depthSlider).toBeInTheDocument();
    expect(depthSlider).toHaveAttribute('min', MIN_ANALYSIS_DEPTH.toString());
    expect(depthSlider).toHaveAttribute('max', MAX_ANALYSIS_DEPTH.toString());
    
    // Verify slider has the default value
    expect(depthSlider).toHaveValue(DEFAULT_ANALYSIS_DEPTH.toString());
    
    // Check that depth control section exists (more flexible than exact text)
    expect(screen.getByText(/depth/i)).toBeInTheDocument();
  });

  it('shows evaluation graph placeholder when no evaluations exist', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
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
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
      />
    );

    const depthSlider = screen.getByRole('slider');
    
    // Test changing the slider value to middle range
    const midValue = Math.floor((MIN_ANALYSIS_DEPTH + MAX_ANALYSIS_DEPTH) / 2);
    fireEvent.change(depthSlider, { target: { value: midValue.toString() } });
    expect(depthSlider).toHaveValue(midValue.toString());
    
    // Test boundary values
    fireEvent.change(depthSlider, { target: { value: MIN_ANALYSIS_DEPTH.toString() } });
    expect(depthSlider).toHaveValue(MIN_ANALYSIS_DEPTH.toString());
    
    fireEvent.change(depthSlider, { target: { value: MAX_ANALYSIS_DEPTH.toString() } });
    expect(depthSlider).toHaveValue(MAX_ANALYSIS_DEPTH.toString());
  });

  it('respects maxMovesToAnalyze prop', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        analysisWorkerRef={mockAnalysisWorkerRef}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={1}
      />
    );

    // Component should render normally with the prop
    expect(screen.getByText('Game Analysis')).toBeInTheDocument();
  });

  it('triggers analysis workflow with maxMovesToAnalyze=2', async () => {
    // Create a more realistic game with multiple moves
    const chess = new Chess();
    chess.move('e4'); // Move 1
    const position1 = new Chess(chess.fen());
    chess.move('e5'); // Move 2
    const position2 = new Chess(chess.fen());
    chess.move('Nf3'); // Move 3
    const position3 = new Chess(chess.fen());

    const gameWithMoves = [
      { position: new Chess(), moveNumber: 0 }, // Initial position
      { position: position1, move: 'e4', moveNumber: 1 },
      { position: position2, move: 'e5', moveNumber: 2 },
      { position: position3, move: 'Nf3', moveNumber: 3 }
    ];

    // Mock the worker to simulate analysis responses
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onmessage: null,
      onerror: null,
      onmessageerror: null
    } as unknown as Worker;

    // Start with null worker ref so component will initialize its own (mocked) worker
    const mockWorkerRef = { current: null as Worker | null };

    // Update the existing mock to return our mock worker
    vi.mocked(initializeStockfishWorker).mockReturnValue(mockWorker);

    render(
      <GameAnalysis
        gameMoves={gameWithMoves}
        analysisWorkerRef={mockWorkerRef}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={2}
      />
    );

    // Click the analyze button
    const analyzeButton = screen.getByRole('button', { name: 'Analyze Entire Game' });
    expect(analyzeButton).toBeEnabled();
    
    // Trigger the analysis
    analyzeButton.click();

    // Wait for the button state to change to analyzing
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
    });

    // Verify analysis started message appears
    await waitFor(() => {
      expect(screen.getByText(/Starting analysis of entire game/)).toBeInTheDocument();
      expect(screen.getByText(/Initializing Stockfish engine/)).toBeInTheDocument();
    });

    // Verify initializeStockfishWorker was called (analysis was triggered)
    expect(vi.mocked(initializeStockfishWorker)).toHaveBeenCalled();
    
    // Verify the worker ref was set
    expect(mockWorkerRef.current).toBe(mockWorker);
  });
});