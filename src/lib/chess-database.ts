import { Kysely, SqliteDialect, sql } from 'kysely';
import { appDatabase, Database } from '~stzUser/lib/database';

/**
 * Chess-specific database interfaces extending the base Database interface
 */

export interface GameTable {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  pgn: string;
  game_type: 'game' | 'study' | 'analysis';
  difficulty_rating: number | null;
  tags: string | null; // JSON array of tags
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface HurdleTable {
  id: string;
  user_id: string;
  game_id: string | null; // Optional reference to parent game
  fen: string;
  title: string | null;
  notes: string | null;
  move_number: number | null;
  evaluation: number | null; // Stockfish evaluation
  best_move: string | null;
  difficulty_level: number | null; // 1-5 scale
  mastery_level: number; // 0-3 (not attempted, struggling, improving, mastered)
  practice_count: number;
  last_practiced: string | null;
  created_at: string;
}

// Extended database interface including chess tables
export interface ChessDatabase extends Database {
  games: GameTable;
  hurdles: HurdleTable;
}

// Kysely instance for chess operations
export const chessDb = new Kysely<ChessDatabase>({
  dialect: new SqliteDialect({
    database: appDatabase
  }),
});

/**
 * Chess Game Database Access Layer
 * Provides type-safe CRUD operations for chess-related data
 */
export class ChessGameDatabase {
  
  // ===== GAME OPERATIONS =====
  
  /**
   * Save a new game to the database
   */
  static async saveGame(userId: string, gameData: Omit<GameTable, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    return await chessDb
      .insertInto('games')
      .values({
        id,
        user_id: userId,
        created_at: now,
        updated_at: now,
        // Spread other fields first, then override boolean to integer for SQLite
        ...gameData,
        is_favorite: (gameData.is_favorite ? 1 : 0) as unknown as boolean,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Get all games for a specific user
   */
  static async getUserGames(userId: string) {
    return await chessDb
      .selectFrom('games')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /**
   * Get a specific game by ID (with user validation)
   */
  static async getGame(gameId: string, userId: string) {
    return await chessDb
      .selectFrom('games')
      .selectAll()
      .where('id', '=', gameId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  /**
   * Update an existing game
   */
  static async updateGame(gameId: string, userId: string, updates: Partial<Omit<GameTable, 'id' | 'user_id' | 'created_at'>>) {
    const now = new Date().toISOString();
    
    return await chessDb
      .updateTable('games')
      .set({
        ...updates,
        updated_at: now
      })
      .where('id', '=', gameId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  /**
   * Delete a game by ID, scoped to the current user.
   * Also deletes associated hurdles to avoid orphaned records.
   */
  static async deleteGame(gameId: string, userId: string) {
    // First delete related hurdles for this game and user
    await chessDb
      .deleteFrom('hurdles')
      .where('game_id', '=', gameId)
      .where('user_id', '=', userId)
      .execute();

    // Then delete the game itself
    return await chessDb
      .deleteFrom('games')
      .where('id', '=', gameId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }


  // ===== HURDLE OPERATIONS =====

  /**
   * Save a difficult position (hurdle) to the database
   */
  static async saveHurdle(userId: string, hurdleData: Omit<HurdleTable, 'id' | 'user_id' | 'created_at' | 'mastery_level' | 'practice_count'>) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    return await chessDb
      .insertInto('hurdles')
      .values({
        id,
        user_id: userId,
        created_at: now,
        mastery_level: 0, // Default: not attempted
        practice_count: 0, // Default: no practice yet
        ...hurdleData
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Get all hurdles for a specific user
   */
  static async getUserHurdles(userId: string) {
    return await chessDb
      .selectFrom('hurdles')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /**
   * Get hurdles for a specific game
   */
  static async getGameHurdles(gameId: string, userId: string) {
    return await chessDb
      .selectFrom('hurdles')
      .selectAll()
      .where('game_id', '=', gameId)
      .where('user_id', '=', userId)
      .orderBy('move_number', 'asc')
      .execute();
  }

  /**
   * Update hurdle practice data (mastery level, practice count)
   */
  static async updateHurdlePractice(hurdleId: string, userId: string, masteryLevel: number) {
    const now = new Date().toISOString();
    
    return await chessDb
      .updateTable('hurdles')
      .set({
        mastery_level: masteryLevel,
        practice_count: sql`practice_count + 1`,
        last_practiced: now
      })
      .where('id', '=', hurdleId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  /**
   * Delete a hurdle
   */
  static async deleteHurdle(hurdleId: string, userId: string) {
    return await chessDb
      .deleteFrom('hurdles')
      .where('id', '=', hurdleId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  // ===== UTILITY OPERATIONS =====

  /**
   * Get user's favorite games
   */
  static async getFavoriteGames(userId: string) {
    return await chessDb
      .selectFrom('games')
      .selectAll()
      .where('user_id', '=', userId)
      .where('is_favorite', '=', true)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /**
   * Toggle game favorite status
   */
  static async toggleGameFavorite(gameId: string, userId: string) {
    const now = new Date().toISOString();
    
    return await chessDb
      .updateTable('games')
      .set({
        is_favorite: sql`NOT is_favorite`,
        updated_at: now
      })
      .where('id', '=', gameId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }

  /**
   * Get hurdles that need practice (low mastery level)
   */
  static async getHurdlesForPractice(userId: string, masteryThreshold: number = 2) {
    return await chessDb
      .selectFrom('hurdles')
      .selectAll()
      .where('user_id', '=', userId)
      .where('mastery_level', '<', masteryThreshold)
      .orderBy('last_practiced', 'asc') // Practice least recently practiced first
      .execute();
  }
}