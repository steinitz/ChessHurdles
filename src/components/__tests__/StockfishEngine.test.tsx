import {describe, it, expect} from 'vitest';

// Test the message parsing logic directly
describe('Stockfish Engine Message Parsing', () => {
  // Helper function to simulate the parsing logic from StockfishEngine
  function parseEngineMessage(message: string) {
    if (!message.includes('info depth')) {
      return null;
    }

    const depthMatch = message.match(/depth (\d+)/);
    const scoreMatch = message.match(/score cp (-?\d+)/) || message.match(/score mate (-?\d+)/);
    const pvMatch = message.match(/\bpv ([a-h1-8qrnbk\s]+)/i);

    if (!depthMatch || !scoreMatch) {
      return null;
    }

    const currentDepth = parseInt(depthMatch[1]);
    const score = parseInt(scoreMatch[1]);
    const pv = pvMatch ? pvMatch[1].trim() : '';

    // Extract the first move from the principal variation
    // PV format from Stockfish is UCI notation: "f4d6 d8d6 a5b3 a8d5..."
    const firstMove = pv.split(' ')[0] || '';

    return {
      depth: currentDepth,
      score: scoreMatch[0].includes('mate') ? (score > 0 ? 10000 : -10000) : score,
      bestMove: firstMove,
      pv: pv
    };
  }

  it('should extract correct UCI move from principal variation', () => {
    const message = "info depth 8 seldepth 12 multipv 1 score cp -679 nodes 3895 nps 11096 tbhits 0 time 351 pv f4d6 d8d6 a5b3 a8d5 b3d4 h7h5 h3g2 h5h4 g3h4 h8h4";

    const result = parseEngineMessage(message);

    expect(result).toEqual({
      depth: 8,
      score: -679,
      bestMove: 'f4d6',
      pv: 'f4d6 d8d6 a5b3 a8d5 b3d4 h7h5 h3g2 h5h4 g3h4 h8h4'
    });
  });

  it('should handle multiple different UCI moves correctly', () => {
    const testCases = [
      {
        message: "info depth 5 score cp 25 pv e2e4 e7e5 g1f3 b8c6",
        expected: {bestMove: 'e2e4', score: 25, depth: 5, pv: 'e2e4 e7e5 g1f3 b8c6'}
      },
      {
        message: "info depth 6 score cp 30 pv d2d4 d7d5 c2c4 e7e6",
        expected: {bestMove: 'd2d4', score: 30, depth: 6, pv: 'd2d4 d7d5 c2c4 e7e6'}
      },
      {
        message: "info depth 7 score cp -15 pv g1f3 g8f6 d2d3 d7d6",
        expected: {bestMove: 'g1f3', score: -15, depth: 7, pv: 'g1f3 g8f6 d2d3 d7d6'}
      },
      {
        message: "info depth 10 score cp 150 pv e1g1 e8g8 f1e1 f8e8",
        expected: {bestMove: 'e1g1', score: 150, depth: 10, pv: 'e1g1 e8g8 f1e1 f8e8'}
      }
    ];

    testCases.forEach(({message, expected}) => {
      const result = parseEngineMessage(message);
      expect(result).toEqual(expected);
    });
  });

  it('should handle mate scores correctly', () => {
    const testCases = [
      {
        message: "info depth 10 score mate 3 pv f7f8q g8h7 f8f7 h7g8 f7g7",
        expected: {bestMove: 'f7f8q', score: 10000, depth: 10, pv: 'f7f8q g8h7 f8f7 h7g8 f7g7'}
      },
      {
        message: "info depth 8 score mate -2 pv h1g1 h2h1q",
        expected: {bestMove: 'h1g1', score: -10000, depth: 8, pv: 'h1g1 h2h1q'}
      }
    ];

    testCases.forEach(({message, expected}) => {
      const result = parseEngineMessage(message);
      expect(result).toEqual(expected);
    });
  });

  it('should handle empty or malformed principal variation', () => {
    const testCases = [
      {
        message: "info depth 5 score cp 25 pv", // Empty PV
        expected: {bestMove: '', score: 25, depth: 5, pv: ''}
      },
      {
        message: "info depth 5 score cp 25", // No PV at all
        expected: {bestMove: '', score: 25, depth: 5, pv: ''}
      },
      {
        message: "info depth 5 score cp 25 pv ", // PV with just space
        expected: {bestMove: '', score: 25, depth: 5, pv: ''}
      }
    ];

    testCases.forEach(({message, expected}) => {
      const result = parseEngineMessage(message);
      expect(result).toEqual(expected);
    });
  });

  it('should return null for non-engine messages', () => {
    const nonEngineMessages = [
      "uciok",
      "readyok",
      "bestmove e2e4 ponder e7e5",
      "info string some debug info",
      "option name Hash type spin default 16 min 1 max 33554432"
    ];

    nonEngineMessages.forEach(message => {
      const result = parseEngineMessage(message);
      expect(result).toBeNull();
    });
  });
});