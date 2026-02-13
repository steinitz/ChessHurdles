
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Chess } from 'chess.js';
import { useGameClock } from './useGameClock';

describe('useGameClock', () => {
  const whiteInitial = 60000;
  const blackInitial = 60000;
  const whiteInc = 20000;
  const blackInc = 20000;
  const onTimeout = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('adds the correct increment when addIncrement is called', () => {
    const game = new Chess();
    const { result } = renderHook(() =>
      useGameClock(game, {
        whiteInitialTimeMs: whiteInitial,
        blackInitialTimeMs: blackInitial,
        whiteIncrementMs: whiteInc,
        blackIncrementMs: blackInc,
        onTimeout,
        userSide: 'w',
        isActive: true
      })
    );

    expect(result.current.whiteTime).toBe(whiteInitial);

    act(() => {
      result.current.addIncrement('w');
    });

    expect(result.current.whiteTime).toBe(whiteInitial + whiteInc);
    // If it was doubling, it would be +40000
    expect(result.current.whiteTime).not.toBe(whiteInitial + whiteInc * 2);
  });

  it('reproduces double increment if triggered by turn change (hypothetically)', () => {
    const game = new Chess();
    const { result, rerender } = renderHook(({ g }) =>
      useGameClock(g, {
        whiteInitialTimeMs: whiteInitial,
        blackInitialTimeMs: blackInitial,
        whiteIncrementMs: whiteInc,
        blackIncrementMs: blackInc,
        onTimeout,
        userSide: 'w',
        isActive: true
      }),
      { initialProps: { g: game } }
    );

    // Simulate a move
    act(() => {
      game.move('e4');
      result.current.addIncrement('w');
    });

    // Rerender with the updated game object (turn changed)
    rerender({ g: new Chess(game.fen()) });

    // The bug report says it adds double the increment. 
    // Let's see if it's still whiteInitial + whiteInc
    expect(result.current.whiteTime).toBe(whiteInitial + whiteInc);
  });
});
