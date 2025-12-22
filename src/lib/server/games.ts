import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';
import { ChessGameDatabase, GameTable } from '../chess-database';
import { auth } from '~stzUser/lib/auth';
import * as v from 'valibot';

const GameSchema = v.object({
  pgn: v.string(),
  white: v.optional(v.string()),
  black: v.optional(v.string()),
  result: v.optional(v.string()),
  date: v.optional(v.string()),
});

export const saveGame = createServerFn({ method: 'POST' })
  .validator((data: unknown) => v.parse(GameSchema, data))
  .handler(async ({ data }) => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    const gameData: Omit<GameTable, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      pgn: data.pgn,
      title: `${data.white || '?'} vs ${data.black || '?'}`,
      description: `Result: ${data.result || '?'} Date: ${data.date || '?'}`,
      game_type: 'game',
      difficulty_rating: null,
      tags: null,
      is_favorite: false,
    };

    return await ChessGameDatabase.saveGame(session.user.id, gameData);
  });

export const getUserGames = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    return await ChessGameDatabase.getUserGames(session.user.id);
  });

export const deleteGameById = createServerFn({ method: 'POST' })
  .validator((gameId: string) => gameId)
  .handler(async ({ data: gameId }) => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    return await ChessGameDatabase.deleteGame(gameId, session.user.id);
  });

export const getGameById = createServerFn({ method: 'GET' })
  .validator((gameId: string) => gameId)
  .handler(async ({ data: gameId }) => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    return await ChessGameDatabase.getGame(gameId, session.user.id);
  });
