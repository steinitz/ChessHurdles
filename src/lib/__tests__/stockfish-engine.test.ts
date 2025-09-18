import { describe, it, expect } from 'vitest';
import { parseDepthInfo, parseUciOkMessage, parseBestMoveMessage } from '../stockfish-engine';

// Test the message parsing logic from stockfish-engine.ts
describe('Stockfish Engine Message Parsing', () => {
  describe('parseDepthInfo', () => {
    it('should extract correct UCI move from principal variation', () => {
      const message = "info depth 8 seldepth 12 multipv 1 score cp -679 nodes 3895 nps 11096 tbhits 0 time 351 pv f4d6 d8d6 a5b3 a8d5 b3d4 h7h5 h3g2 h5h4 g3h4 h8h4";

      const result = parseDepthInfo(message);

      expect(result).toEqual({
        depth: 8,
        score: -679,
        pv: 'f4d6 d8d6 a5b3 a8d5 b3d4 h7h5 h3g2 h5h4 g3h4 h8h4',
        isMate: false
      });
    });

    it('should handle multiple different UCI moves correctly', () => {
      const testCases = [
        {
          message: "info depth 5 score cp 25 pv e2e4 e7e5 g1f3 b8c6",
          expected: { depth: 5, score: 25, pv: 'e2e4 e7e5 g1f3 b8c6', isMate: false }
        },
        {
          message: "info depth 6 score cp 30 pv d2d4 d7d5 c2c4 e7e6",
          expected: { depth: 6, score: 30, pv: 'd2d4 d7d5 c2c4 e7e6', isMate: false }
        },
        {
          message: "info depth 7 score cp -15 pv g1f3 g8f6 d2d3 d7d6",
          expected: { depth: 7, score: -15, pv: 'g1f3 g8f6 d2d3 d7d6', isMate: false }
        },
        {
          message: "info depth 10 score cp 150 pv e1g1 e8g8 f1e1 f8e8",
          expected: { depth: 10, score: 150, pv: 'e1g1 e8g8 f1e1 f8e8', isMate: false }
        }
      ];

      testCases.forEach(({ message, expected }) => {
        const result = parseDepthInfo(message);
        expect(result).toEqual(expected);
      });
    });

    it('should handle mate scores correctly', () => {
      const testCases = [
        {
          message: "info depth 10 score mate 3 pv f7f8q g8h7 f8f7 h7g8 f7g7",
          expected: { depth: 10, score: 3, pv: 'f7f8q g8h7 f8f7 h7g8 f7g7', isMate: true }
        },
        {
          message: "info depth 8 score mate -2 pv h1g1 h2h1q",
          expected: { depth: 8, score: -2, pv: 'h1g1 h2h1q', isMate: true }
        }
      ];

      testCases.forEach(({ message, expected }) => {
        const result = parseDepthInfo(message);
        expect(result).toEqual(expected);
      });
    });

    it('should handle empty or malformed principal variation', () => {
      const testCases = [
        {
          message: "info depth 5 score cp 25 pv", // Empty PV
          expected: { depth: 5, score: 25, pv: '', isMate: false }
        },
        {
          message: "info depth 5 score cp 25", // No PV at all
          expected: { depth: 5, score: 25, pv: '', isMate: false }
        },
        {
          message: "info depth 5 score cp 25 pv ", // PV with just space
          expected: { depth: 5, score: 25, pv: '', isMate: false }
        }
      ];

      testCases.forEach(({ message, expected }) => {
        const result = parseDepthInfo(message);
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
        const result = parseDepthInfo(message);
        expect(result).toBeNull();
      });
    });

    it('should return null for messages missing required fields', () => {
      const incompleteMessages = [
        "info depth 5", // Missing score
        "info score cp 25", // Missing depth
        "info depth abc score cp 25", // Invalid depth
        "info depth 5 score cp abc" // Invalid score
      ];

      incompleteMessages.forEach(message => {
        const result = parseDepthInfo(message);
        expect(result).toBeNull();
      });
    });
  });

  describe('parseUciOkMessage', () => {
    it('should return true for uciok message', () => {
      expect(parseUciOkMessage('uciok')).toBe(true);
    });

    it('should return false for other messages', () => {
      const otherMessages = [
        "readyok",
        "bestmove e2e4",
        "info depth 5 score cp 25",
        "option name Hash type spin"
      ];

      otherMessages.forEach(message => {
        expect(parseUciOkMessage(message)).toBe(false);
      });
    });
  });

  describe('parseBestMoveMessage', () => {
    it('should return true for bestmove messages', () => {
      const bestMoveMessages = [
        "bestmove e2e4",
        "bestmove e2e4 ponder e7e5",
        "bestmove a1a2"
      ];

      bestMoveMessages.forEach(message => {
        expect(parseBestMoveMessage(message)).toBe(true);
      });
    });

    it('should return false for other messages', () => {
      const otherMessages = [
        "uciok",
        "readyok",
        "info depth 5 score cp 25",
        "option name Hash type spin"
      ];

      otherMessages.forEach(message => {
        expect(parseBestMoveMessage(message)).toBe(false);
      });
    });
  });
});