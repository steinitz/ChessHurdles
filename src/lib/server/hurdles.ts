import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';
import { ChessGameDatabase, HurdleTable } from '../chess-database';
import { auth } from '~stzUser/lib/auth';
import * as v from 'valibot';

const HurdleSchema = v.object({
  gameId: v.optional(v.string()),
  fen: v.string(),
  side: v.optional(v.union([v.literal('w'), v.literal('b')])),
  title: v.optional(v.string()),
  moveNumber: v.optional(v.number()),
  evaluation: v.optional(v.number()),
  bestMove: v.optional(v.string()),
  playedMove: v.optional(v.string()),
  centipawnLoss: v.optional(v.number()),
  aiDescription: v.optional(v.string()),
  depth: v.optional(v.number()),
  difficultyLevel: v.optional(v.number()),
  // New Metadata
  mateIn: v.optional(v.number()),
  calculationTime: v.optional(v.number()),
  openingTags: v.optional(v.string()),
});

export const saveHurdle = createServerFn({ method: 'POST' })
  .validator((data: unknown) => v.parse(HurdleSchema, data))
  .handler(async ({ data }) => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Prepare JSON notes to store extra metadata without schema migration
    // We store these in the 'notes' column which is a text/json field
    const metadata = {
      mateIn: data.mateIn,
      calculationTime: data.calculationTime,
      openingTags: data.openingTags
    };

    const hurdleData: Omit<HurdleTable, 'id' | 'user_id' | 'created_at' | 'mastery_level' | 'practice_count'> = {
      game_id: data.gameId || null,
      fen: data.fen,
      side: data.side || null,
      title: data.title || null,
      notes: JSON.stringify(metadata), // Storing new metadata in notes for now
      move_number: data.moveNumber || null,
      evaluation: data.evaluation || null,
      best_move: data.bestMove || null,
      played_move: data.playedMove || null,
      centipawn_loss: data.centipawnLoss || null,
      ai_description: data.aiDescription || null,
      depth: data.depth || null,
      difficulty_level: data.difficultyLevel || null,
      last_practiced: null,
    };

    return await ChessGameDatabase.saveHurdle(session.user.id, hurdleData);
  });

export const deleteHurdle = createServerFn({ method: 'POST' })
  .validator((hurdleId: string) => hurdleId)
  .handler(async ({ data: hurdleId }) => {
    const request = getWebRequest()
    if (!request?.headers) {
      throw new Error('Request headers not available')
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    await ChessGameDatabase.deleteHurdle(hurdleId, userId)
    return { success: true, hurdleId }
  });

export const getUserHurdles = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest();
    const session = await auth.api.getSession({ headers: request!.headers });

    if (!session) {
      throw new Error('Unauthorized');
    }

    return await ChessGameDatabase.getUserHurdles(session.user.id);
  });
