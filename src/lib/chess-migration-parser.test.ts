// @vitest-environment node
import { parseGameDescription } from './chess-migration-parser.ts';
import { describe, it, expect } from 'vitest';

describe('Migration Parser', () => {
    it('parses standard won game description', () => {
        const desc = "Result: 1-0  Elo: 1200 -> 1210";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: '1-0', user_elo_before: 1200, user_elo_after: 1210 });
    });

    it('parses lost game description', () => {
        const desc = "Result: 0-1  Elo: 1200 -> 1190";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: '0-1', user_elo_before: 1200, user_elo_after: 1190 });
    });

    it('parses draw game description', () => {
        const desc = "Result: 1/2-1/2  Elo: 1200 -> 1200";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: '1/2-1/2', user_elo_before: 1200, user_elo_after: 1200 });
    });

    it('handles extra spaces', () => {
        const desc = "Result:   1-0     Elo:   1200   ->   1210";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: '1-0', user_elo_before: 1200, user_elo_after: 1210 });
    });

    it('returns nulls for invalid description', () => {
        const desc = "Just some random text";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: null, user_elo_before: null, user_elo_after: null });
    });

    it('returns nulls for null description', () => {
        const result = parseGameDescription(null);
        expect(result).toEqual({ result: null, user_elo_before: null, user_elo_after: null });
    });

    it('parses partial data (result only)', () => {
        const desc = "Result: 1-0";
        const result = parseGameDescription(desc);
        expect(result).toEqual({ result: '1-0', user_elo_before: null, user_elo_after: null });
    });
});
