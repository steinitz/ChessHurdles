import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from '~stzUser/lib/auth'

import { ChessGameDatabase, type UserStatsTable, type GameTable } from './chess-database'

// Minimal server function to save a hard-coded sample game for the current user
export const saveSampleGame = createServerFn({ method: 'POST' })
  .handler(async () => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id

    // Simple, hard-coded PGN to test saving (now with headers)
    const pgn = `[Event "Sample Saved Game"]
[Site "Chess Hurdles"]
[Date "2024.10.01"]
[Round "?"]
[White "Sample White"]
[Black "Sample Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *`

    const saved = await ChessGameDatabase.saveGame(userId, {
      title: 'Sample Game Save',
      description: 'Hard-coded sample game saved from Developer Tools',
      pgn,
      game_type: 'game',
      difficulty_rating: null,
      tags: JSON.stringify(['sample', 'devtools']),
      is_favorite: false,
    })

    return saved
  })

// Server function to delete a game by id for the current user
export const deleteGameById = createServerFn({ method: 'POST' })
  .validator((gameId: string) => gameId)
  .handler(async ({ data: gameId }) => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id

    const result = await ChessGameDatabase.deleteGame(gameId, userId)
    return { success: true, gameId, result }
  })

export const getGames = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    const userId = session?.user?.id

    // If not authenticated, return an empty list for a nicer UX
    if (!userId) {
      return []
    }

    const games = await ChessGameDatabase.getUserGames(userId)
    return games
  })

// Fetch a specific game by ID for the authenticated user
export const getGameById = createServerFn({ method: 'POST' })
  .validator((gameId: string) => gameId)
  .handler(async ({ data: gameId }) => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const game = await ChessGameDatabase.getGame(gameId, userId)
    return game || null
  })

// Get current user's analysis depth preference
export const getUserAnalysisDepth = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    const userId = session?.user?.id

    if (!userId) {
      // For unauthenticated, return null to signal use of local storage
      return { depth: null }
    }

    const depth = await ChessGameDatabase.getUserAnalysisDepth(userId)
    return { depth }
  })

// Set current user's analysis depth preference
export const setUserAnalysisDepth = createServerFn({ method: 'POST' })
  .validator((depth: number) => depth)
  .handler(async ({ data: depth }) => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    await ChessGameDatabase.setUserAnalysisDepth(userId, depth)

    return { success: true }
  })

export const getUserStats = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest();
    if (!request?.headers) throw new Error('Request headers not available');
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new Error('Not authenticated');

    return await ChessGameDatabase.getUserStats(session.user.id);
  });

export const updateUserStats = createServerFn({ method: 'POST' })
  .validator((data: Partial<Omit<UserStatsTable, 'user_id' | 'updated_at'>>) => data)
  .handler(async ({ data }) => {
    const request = getWebRequest();
    if (!request?.headers) throw new Error('Request headers not available');
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new Error('Not authenticated');

    return await ChessGameDatabase.updateUserStats(session.user.id, data);
  });

export const savePlayedGame = createServerFn({ method: 'POST' })
  .validator((data: Omit<GameTable, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => data)
  .handler(async ({ data }) => {
    const request = getWebRequest();
    if (!request?.headers) throw new Error('Request headers not available');
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) throw new Error('Not authenticated');

    return await ChessGameDatabase.saveGame(session.user.id, data);
  });

// AI game position description generator
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dedent } from './utils';

export const getAIDescription = createServerFn({ method: 'POST' })
  .validator((data: {
    fen: string;
    move: string;
    evaluation: number;
    bestMove: string;
    pv: string;
    centipawnLoss: number;
  }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found. Returning mock response.');
      // Fallback to mock if no key (useful for dev without key)
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        description: `[MOCK AI (No Key)] You played **${data.move}** (cp loss: ${data.centipawnLoss}). The engine prefers **${data.bestMove}**. (PV: ${data.pv.substring(0, 20)}...)`
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      // Tagged template literal. See the dedent function in utils.ts
      const prompt = dedent`
        You are an expert chess coach. Analyze this specific move in a game.
        Position FEN: ${data.fen}
        Player Move: ${data.move}
        Engine Best Move: ${data.bestMove}
        Centipawn Loss: ${data.centipawnLoss}
        Principal Variation (Best Line): ${data.pv}

        Explain briefly (max 2 sentences) why the player's move was a mistake compared to the best move.
        Focus on the strategic, positional or tactical consequences or aspects or deviation from a workable plan.
        Do not mention centipawn values directly.
        Be constructive but clear.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return { description: text };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        description: `(AI Unavailable) The move ${data.move} was a mistake. Best was ${data.bestMove}.`
      };
    }
  });