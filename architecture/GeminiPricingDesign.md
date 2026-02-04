# --- CURRENCY & CREDITS ---
CREDIT_PRICE_AUD=0.001
MIN_CREDITS_PURCHASE=10000 
DEFAULT_CREDITS_PURCHASE=10000

# --- USER ALLOWANCES ---
DAILY_GRANT_CREDITS=100
WELCOME_GRANT_CREDITS=1000

# --- THE HURDLE FILTER ---
AI_WORTHY_THRESHOLD=0.15
MAX_AUTO_AI_PER_GAME=3

# --- ACTION COSTS ---
COST_SAVE_GAME=1
COST_AI_EXPLANATION=15
COST_TRAINING_MINUTE=2

/**
 * Converts Centipawn evaluation to Win Probability (Scale: -1 to 1)
 */
const getWinProbability = (cp) => {
    if (cp === null) return 0;
    return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
};

/**
 * Identifies high-impact blunders by comparing probabilities
 */
const identifyHurdles = (moves) => {
    const hurdles = moves.map((move, index) => {
        const probBefore = getWinProbability(move.evalBefore);
        const probAfter = getWinProbability(move.evalAfter);
        const wpl = probBefore - probAfter; // Win Probability Loss

        return {
            index,
            wpl,
            moveData: move,
            isWorthy: wpl >= parseFloat(process.env.AI_WORTHY_THRESHOLD)
        };
    });

    // Sort by severity and cap at MAX_AUTO_AI_PER_GAME
    return hurdles
        .filter(h => h.isWorthy)
        .sort((a, b) => b.wpl - a.wpl)
        .slice(0, parseInt(process.env.MAX_AUTO_AI_PER_GAME));
};

async function handleAnalysisRequest(user, gameData) {
    const worthyHurdles = identifyHurdles(gameData.moves);
    
    const analysisCost = worthyHurdles.length * process.env.COST_AI_EXPLANATION;
    const totalCost = analysisCost + parseInt(process.env.COST_SAVE_GAME);

    if (user.creditBalance < totalCost) {
        throw new Error("Insufficient credits for full AI analysis.");
    }

    // 1. Deduct Credits
    await db.users.update(user.id, { 
        creditBalance: user.creditBalance - totalCost 
    });

    // 2. Trigger AI Explanations for worthyHurdles only
    return performAIAnalysis(worthyHurdles);
}

function applyDailyGrant(user) {
    const today = new Date().toISOString().split('T')[0];
    
    if (user.lastGrantDate !== today) {
        user.creditBalance += parseInt(process.env.DAILY_GRANT_CREDITS);
        user.lastGrantDate = today;
        return user.save();
    }
}

Stripe Compliance Snippet (Terms)
Unit: 1 Credit = $0.001 AUD.

Refund Policy: Credits represent digital compute time and are non-refundable once consumed. Unused balances are refundable within 14 days of purchase.

Expiration: Credits do not expire unless the account is inactive for 12+ months.