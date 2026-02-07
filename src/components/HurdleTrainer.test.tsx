import { render, screen, fireEvent } from '@testing-library/react';
import { HurdleTrainer } from './HurdleTrainer';
import { HurdleTable } from '~/lib/chess-database';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('~/lib/server/hurdles', () => ({
  getUserHurdles: vi.fn(),
}));

// Mock ChessBoard to avoid canvas issues and simplify interaction
vi.mock('./ChessBoard', () => ({
  ChessBoard: ({ onMove, customSquareStyles }: any) => (
    <div data-testid="chess-board">
      <button onClick={() => onMove('e4')} data-testid="move-e4">Move e4</button>
      <button onClick={() => onMove('Nf3')} data-testid="move-Nf3">Move Nf3</button>
      <div data-testid="hint-styles">{JSON.stringify(customSquareStyles)}</div>
    </div>
  ),
}));

describe('HurdleTrainer Validation', () => {
  const baseHurdle: HurdleTable = {
    id: '1',
    user_id: 'user1',
    game_id: null,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'Test Hurdle',
    notes: null,
    move_number: 1,
    evaluation: 0.5,
    best_move: 'e4', // Clean UCI/SAN
    played_move: null,
    centipawn_loss: null,
    ai_description: 'Test Description',
    depth: 10,
    difficulty_level: 1,
    mastery_level: 0,
    practice_count: 0,
    last_practiced: null,
    created_at: new Date().toISOString(),
  };

  it('validates correct move with clean SAN', () => {
    render(<HurdleTrainer hurdle={baseHurdle} />);
    fireEvent.click(screen.getByTestId('move-e4'));
    expect(screen.getByText('Correct. Well done')).toBeInTheDocument();
  });

  it('validates correct move when best_move has move number prefix (e.g. "1. e4")', () => {
    const dirtyHurdle = { ...baseHurdle, best_move: '1. e4' };
    render(<HurdleTrainer hurdle={dirtyHurdle} />);
    fireEvent.click(screen.getByTestId('move-e4'));

    // Expect Success (Fix Verification)
    expect(screen.getByText('Correct. Well done')).toBeInTheDocument();
  });

  it('validates correct move when best_move has extra whitespace (e.g. " e4 ")', () => {
    const dirtyHurdle = { ...baseHurdle, best_move: ' e4 ' };
    render(<HurdleTrainer hurdle={dirtyHurdle} />);
    fireEvent.click(screen.getByTestId('move-e4'));

    // Expect Success (Fix Verification)
    expect(screen.getByText('Correct. Well done')).toBeInTheDocument();
  });
});
