import { render, screen } from '@testing-library/react';
import { HurdleTrainer } from './HurdleTrainer';
import { HurdleTable } from '~/lib/chess-database';
import { describe, it, expect, vi } from 'vitest';
import { Chess } from 'chess.js';

// Mock dependencies
vi.mock('~/lib/server/hurdles', () => ({
  getUserHurdles: vi.fn().mockResolvedValue([]),
}));

describe('HurdleTrainer Display', () => {
  const baseHurdle: HurdleTable = {
    id: '1',
    user_id: 'user1',
    game_id: null,
    side: 'w',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'Test Hurdle',
    notes: null,
    move_number: 1,
    evaluation: 0.5,
    best_move: 'e4',
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

  const mockGame = new Chess(baseHurdle.fen);

  it('renders status message from props', () => {
    const { rerender } = render(
      <HurdleTrainer
        hurdle={baseHurdle}
        game={mockGame}
        message="Test Message"
        isSolved={false}
        setCustomSquareStyles={vi.fn()}
        onHurdleChange={vi.fn()}
      />
    );
    expect(screen.getByText('Test Message')).toBeInTheDocument();

    rerender(
      <HurdleTrainer
        hurdle={baseHurdle}
        game={mockGame}
        message="Solved!"
        isSolved={true}
        setCustomSquareStyles={vi.fn()}
        onHurdleChange={vi.fn()}
      />
    );
    expect(screen.getByText('Solved!')).toBeInTheDocument();
  });

  it('shows turn text correctly', () => {
    render(
      <HurdleTrainer
        hurdle={baseHurdle}
        game={mockGame}
        message=""
        isSolved={false}
        setCustomSquareStyles={vi.fn()}
        onHurdleChange={vi.fn()}
      />
    );
    expect(screen.getByText('White to move')).toBeInTheDocument();
  });
});
