import { describe, it, expect, vi } from 'vitest';
import { handleEngineMessage, type EngineCallbacks } from '../stockfish-engine';

describe('handleEngineMessage normalization to White perspective', () => {
  const baseCallbacks = () => {
    const last: { eval?: number; best?: string; pv?: string; depth?: number; time?: number; analyzing?: boolean } = {};
    const callbacks: EngineCallbacks = {
      setEvaluation: (e) => { last.eval = e.evaluation; last.best = e.bestMove; last.pv = e.principalVariation; last.depth = e.depth; },
      setIsAnalyzing: (a) => { last.analyzing = a; },
      onEvaluation: (evaluation) => { last.eval = evaluation; },
      onCalculationTime: (t) => { last.time = t; },
    };
    return { last, callbacks };
  };

  it('keeps positive cp for White to move and flips for Black to move', () => {
    const { last, callbacks } = baseCallbacks();
    const start = Date.now() - 25; // stable calc time

    // White to move FEN
    const fenWhite = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
    handleEngineMessage('info depth 6 score cp 200 pv e2e4 e7e5', 4, start, fenWhite, callbacks);
    expect(last.eval).toBe(200);

    // Black to move FEN
    const fenBlack = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    handleEngineMessage('info depth 6 score cp 200 pv e7e5 g1f3', 4, start, fenBlack, callbacks);
    expect(last.eval).toBe(-200);
  });

  it('encodes mate scores with base 5000 + distance and normalizes sign', () => {
    const { last, callbacks } = baseCallbacks();
    const start = Date.now() - 25;

    // White to move, mate in 3 for side to move (White winning)
    const fenWhite = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
    handleEngineMessage('info depth 10 score mate 3 pv e2e4 e7e5', 4, start, fenWhite, callbacks);
    expect(last.eval).toBe(5003);

    // Black to move, mate in -2 for side to move (Black losing); should yield White advantage
    const fenBlack = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    handleEngineMessage('info depth 10 score mate -2 pv e7e5 g1f3', 4, start, fenBlack, callbacks);
    expect(last.eval).toBe(5002);
  });
});