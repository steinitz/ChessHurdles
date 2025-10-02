import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from '~stzUser/lib/auth'
import { ChessGameDatabase } from './chess-database'

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

    // Simple, hard-coded PGN to test saving
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7'

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