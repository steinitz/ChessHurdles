export function parseGameDescription(description: string | null): {
    result: string | null;
    user_elo_before: number | null;
    user_elo_after: number | null
} {
    if (!description) return { result: null, user_elo_before: null, user_elo_after: null };

    // Expected format: "Result: 1-0  Elo: 1200 -> 1210"
    // Allow flexible spacing
    const resultMatch = description.match(/Result:\s*(1-0|0-1|1\/2-1\/2)/);
    const eloMatch = description.match(/Elo:\s*(\d+)\s*->\s*(\d+)/);

    return {
        result: resultMatch ? resultMatch[1] : null,
        user_elo_before: eloMatch ? parseInt(eloMatch[1], 10) : null,
        user_elo_after: eloMatch ? parseInt(eloMatch[2], 10) : null
    };
}
