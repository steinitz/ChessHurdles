
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import GameAnalysis from './GameAnalysis';
import { MIN_ANALYSIS_DEPTH, MAX_ANALYSIS_DEPTH, DEFAULT_ANALYSIS_DEPTH } from '~/lib/chess-constants'; // Imported from constants now?
// Note: original test imported constants from GameAnalysis. 
// New GameAnalysis IMPORTS them from constants.
// So test should import from constants too.
// I will check imports logic.
// In GameAnalysis.tsx: import { ... } from '~/lib/chess-constants'.
// So I should import from '~/lib/chess-constants'.

import { waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { initializeStockfishWorker, analyzePosition } from '~/lib/stockfish-engine';
import { getCachedEval, setCachedEval, makeKey } from '~/lib/analysis-cache';

// Mock the stockfish-engine module
vi.mock('~/lib/stockfish-engine', () => ({
  initializeStockfishWorker: vi.fn(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as Worker),
  analyzePosition: vi.fn(),
  handleEngineMessage: vi.fn(),
  cleanupWorker: vi.fn(), // Added
  calibrateDepth: vi.fn().mockResolvedValue(22), // Add calibrate mock if needed
}));

// Mock analysis-cache
vi.mock('~/lib/analysis-cache', () => ({
  makeKey: vi.fn((fen) => `key:${fen}`),
  getCachedEval: vi.fn(),
  setCachedEval: vi.fn(),
  clearPersistentCache: vi.fn(),
}));

// Mock EvaluationGraph component (match alias import in GameAnalysis)
vi.mock('./EvaluationGraph', () => ({
  default: ({ evaluations }: { evaluations: any[] }) => (
    <div data-testid="evaluation-graph">
      Graph with {evaluations.length} evaluations
    </div>
  ),
}));

// Mock auth client
vi.mock('~stzUser/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: { user: { id: 'test-user' } } }))
}));

// Mock chess-server
vi.mock('~/lib/chess-server', () => ({
  getUserAnalysisDepth: vi.fn().mockResolvedValue({ depth: 8 }),
  setUserAnalysisDepth: vi.fn().mockResolvedValue({}),
  getAIDescription: vi.fn().mockResolvedValue({ description: 'AI analysis' })
}));
// Mock hurdle server
vi.mock('~/lib/server/hurdles', () => ({
  saveHurdle: vi.fn()
}));

describe('GameAnalysis', () => {
  let mockGameMoves: any[];
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

    mockGoToMove = vi.fn();
  });

  it('renders the component with initial state', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={2}
      />
    );

    expect(screen.getByText('Game Analysis')).toBeInTheDocument();
    // Replaced "Analysis Depth:" with label "Analysis Depth used..."
    expect(screen.getByText(/Analysis Depth/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze Game' })).toBeEnabled();
  });

  it('displays analysis depth controls', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
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
  });

  it('shows evaluation graph placeholder when no evaluations exist', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
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
        goToMove={mockGoToMove}
      />
    );

    // Only header and no buttons?
    // "Analyze Entire Game" button is rendered ONLY if !isAnalyzing && !isCalibrating.
    // Also logic: if (gameMoves.length <= 1) setMoveAnalysisResults('No moves').
    // But button is still rendered?
    // Render condition: `{!isAnalyzing ... && ( <button ...`
    // It keeps existing.
    // Logic inside handle: if <=1 return.
    // But native button disabled? PROBABLY NOT disabled in new code.
    // Previous test: `expect(...).toBeDisabled()`.
    // My new code does NOT disable the button for empty games, it just shows a message when clicked?
    // Or does it?
    // Let's check `GameAnalysis.tsx`.
    // My code doesn't disable it.
    // I should disable it if moves <= 1?
    // "No moves to analyze" message is set on click.
    // I will SKIP this assertion or update my component to disable it.
    // Updating component is better.
    // I'll update component in a moment. For now, let's comment out this check or expect it to be enabled but no-op.

    expect(screen.getByRole('button', { name: 'Analyze Game' })).toBeDisabled();
  });

  it('allows depth adjustment via slider', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
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
  });

  it('respects maxMovesToAnalyze prop', () => {
    render(
      <GameAnalysis
        gameMoves={mockGameMoves}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={1}
      />
    );

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

    // Mock the worker
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onmessage: null,
    } as unknown as Worker;

    // Update the existing mock to return our mock worker
    vi.mocked(initializeStockfishWorker).mockReturnValue(mockWorker);

    render(
      <GameAnalysis
        gameMoves={gameWithMoves}
        goToMove={mockGoToMove}
        maxMovesToAnalyze={2}
      />
    );

    // Click the analyze button
    const analyzeButton = screen.getByRole('button', { name: 'Analyze Game' });
    analyzeButton.click();

    // The "Analyze Game" button is disabled when analyzing.
    // The "Stop" button appears.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze Game' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    // Verify analysis started message appears
    await waitFor(() => {
      expect(screen.getByText(/Starting analysis/)).toBeInTheDocument();
    });

    // Verify initializeStockfishWorker was called
    expect(vi.mocked(initializeStockfishWorker)).toHaveBeenCalled();
  });

  describe('Caching Logic', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('skips engine analysis on cache hit', async () => {
      const chess = new Chess();
      chess.move('e4');
      const position1 = new Chess(chess.fen());

      const gameMoves = [
        { position: new Chess(), moveNumber: 0 },
        { position: position1, move: 'e4', moveNumber: 1 }
      ];

      // Mock cache hit with sufficient depth
      const mockCachedEval = {
        cp: 50,
        depth: 100,
        bestMove: 'e5',
        ts: Date.now()
      };

      vi.mocked(getCachedEval).mockReturnValue(mockCachedEval);

      render(
        <GameAnalysis
          gameMoves={gameMoves}
          goToMove={vi.fn()}
          maxMovesToAnalyze={1}
        />
      );

      const analyzeButton = screen.getByRole('button', { name: 'Analyze Game' });
      analyzeButton.click();

      // Should check cache
      await waitFor(() => {
        expect(getCachedEval).toHaveBeenCalled();
      });

      // Should NOT save to cache again (optimization check)
      expect(setCachedEval).not.toHaveBeenCalled();

      // Should NOT call engine analyzePosition because we had a hit
      // NOTE: `startAnalysis` calls `ensureWorker`? 
      // Yes. `processNextPosition` checks cache. If hit, calls onEvaluation.
      // It DOES NOT call `analyzePosition`.
      expect(analyzePosition).not.toHaveBeenCalled();
    });
  });

  describe('Parent Synchronization', () => {
    it('calls onAnalysisUpdate with correct absoluteMoveIndex', async () => {
      const onAnalysisUpdate = vi.fn();
      const chess = new Chess();
      chess.move('e4');
      const gameMoves = [
        { position: new Chess(), moveNumber: 0 },
        { position: new Chess(chess.fen()), move: 'e4', moveNumber: 1 }
      ];

      // Mock cache hit so we get immediate completion for the test
      vi.mocked(getCachedEval).mockReturnValue({
        cp: 10,
        depth: 20,
        bestMove: 'e5',
        ts: Date.now()
      });

      render(
        <GameAnalysis
          gameMoves={gameMoves}
          goToMove={vi.fn()}
          onAnalysisUpdate={onAnalysisUpdate}
          maxMovesToAnalyze={1}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Analyze Game' }));

      await waitFor(() => {
        expect(onAnalysisUpdate).toHaveBeenCalled();
      });

      // Check the summary passed to parent
      const summary = onAnalysisUpdate.mock.calls[0][0];
      expect(summary).toHaveLength(1);
      // Move 1 (e4) should have moveIndex 1
      expect(summary[0].moveIndex).toBe(1);
    });
  });
});