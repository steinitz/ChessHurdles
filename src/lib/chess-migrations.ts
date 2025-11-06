import { chessDb } from './chess-database';

/**
 * Chess Database Migration System
 * 
 * This module provides automatic table creation for chess-related tables.
 * It follows the same declarative pattern as Better Auth, ensuring tables
 * exist without complex migration history management.
 */

/**
 * Ensures all chess-related tables exist in the database
 * Safe to run multiple times - uses IF NOT EXISTS
 */
export async function ensureChessTables(): Promise<void> {
  try {
    console.log('🏁 Starting chess database table creation...');
    
    // First, let's check what tables already exist
    const existingTables = await chessDb.introspection.getTables();
    console.log('📋 Existing tables before chess initialization:', existingTables.map(t => t.name));
    
    // Check if user table exists and count users (safety check)
    try {
      const userCount = await chessDb.selectFrom('user').select(chessDb.fn.count('id').as('count')).executeTakeFirst();
      console.log('👥 Current user count before chess table creation:', userCount?.count || 0);
    } catch (error) {
      console.log('⚠️  Could not check user count (table may not exist yet):', error);
    }

    console.log('🎮 Creating games table...');
    // Create games table
    await chessDb.schema
      .createTable('games')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('title', 'text')
      .addColumn('description', 'text')
      .addColumn('pgn', 'text', (col) => col.notNull())
      .addColumn('game_type', 'text', (col) => col.notNull().defaultTo('game'))
      .addColumn('difficulty_rating', 'integer')
      .addColumn('tags', 'text') // JSON array
      .addColumn('is_favorite', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();
    console.log('✅ Games table created successfully');

    console.log('🚧 Creating hurdles table...');
    // Create hurdles table
    await chessDb.schema
      .createTable('hurdles')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('game_id', 'text') // Optional reference to parent game
      .addColumn('fen', 'text', (col) => col.notNull())
      .addColumn('title', 'text')
      .addColumn('notes', 'text')
      .addColumn('move_number', 'integer')
      .addColumn('evaluation', 'real') // Stockfish evaluation (can be decimal)
      .addColumn('best_move', 'text')
      .addColumn('difficulty_level', 'integer') // 1-5 scale
      .addColumn('mastery_level', 'integer', (col) => col.notNull().defaultTo(0)) // 0-3
      .addColumn('practice_count', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('last_practiced', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();
    console.log('✅ Hurdles table created successfully');

    console.log('⚙️ Creating user_preferences table...');
    // Create user preferences table for storing per-user analysis depth
    await chessDb.schema
      .createTable('user_preferences')
      .ifNotExists()
      .addColumn('user_id', 'text', (col) => col.primaryKey())
      .addColumn('analysis_depth', 'integer')
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();
    console.log('✅ User preferences table created successfully');

    console.log('🔍 Creating database indexes...');
    // Create indexes for better query performance
    await createIndexes();
    console.log('✅ Database indexes created successfully');

    // Final safety check - verify user data is still intact
    try {
      const finalUserCount = await chessDb.selectFrom('user').select(chessDb.fn.count('id').as('count')).executeTakeFirst();
      console.log('👥 Final user count after chess table creation:', finalUserCount?.count || 0);
    } catch (error) {
      console.log('⚠️  Could not verify final user count:', error);
    }

    console.log('✅ Chess database tables are ready');
  } catch (error) {
    console.error('❌ Error ensuring chess tables:', error);
    throw error;
  }
}

/**
 * Creates database indexes for optimal query performance
 * Safe to run multiple times - uses IF NOT EXISTS
 */
async function createIndexes(): Promise<void> {
  try {
    console.log('📊 Creating index: idx_games_user_id');
    // Index for user's games lookup
    await chessDb.schema
      .createIndex('idx_games_user_id')
      .ifNotExists()
      .on('games')
      .column('user_id')
      .execute();

    console.log('📊 Creating index: idx_games_created_at');
    // Index for chronological game sorting
    await chessDb.schema
      .createIndex('idx_games_created_at')
      .ifNotExists()
      .on('games')
      .column('created_at')
      .execute();

    console.log('📊 Creating index: idx_games_game_type');
    // Index for filtering by game type
    await chessDb.schema
      .createIndex('idx_games_game_type')
      .ifNotExists()
      .on('games')
      .column('game_type')
      .execute();

    console.log('📊 Creating index: idx_games_is_favorite');
    // Index for favorite games
    await chessDb.schema
      .createIndex('idx_games_is_favorite')
      .ifNotExists()
      .on('games')
      .column('is_favorite')
      .execute();

    console.log('📊 Creating index: idx_hurdles_user_id');
    // Index for user's hurdles lookup
    await chessDb.schema
      .createIndex('idx_hurdles_user_id')
      .ifNotExists()
      .on('hurdles')
      .column('user_id')
      .execute();

    console.log('📊 Creating index: idx_hurdles_game_id');
    // Index for game-specific hurdles
    await chessDb.schema
      .createIndex('idx_hurdles_game_id')
      .ifNotExists()
      .on('hurdles')
      .column('game_id')
      .execute();

    console.log('📊 Creating index: idx_hurdles_mastery_level');
    // Index for filtering by mastery level
    await chessDb.schema
      .createIndex('idx_hurdles_mastery_level')
      .ifNotExists()
      .on('hurdles')
      .column('mastery_level')
      .execute();

    console.log('📊 Creating index: idx_hurdles_difficulty_level');
    // Index for filtering by difficulty
    await chessDb.schema
      .createIndex('idx_hurdles_difficulty_level')
      .ifNotExists()
      .on('hurdles')
      .column('difficulty_level')
      .execute();

    console.log('📊 Creating index: idx_hurdles_last_practiced');
    // Index for practice scheduling
    await chessDb.schema
      .createIndex('idx_hurdles_last_practiced')
      .ifNotExists()
      .on('hurdles')
      .column('last_practiced')
      .execute();

    console.log('📊 Creating index: idx_user_prefs_user_id');
    await chessDb.schema
      .createIndex('idx_user_prefs_user_id')
      .ifNotExists()
      .on('user_preferences')
      .column('user_id')
      .execute();

    console.log('✅ Chess database indexes created');
  } catch (error) {
    console.error('❌ Error creating chess indexes:', error);
    throw error;
  }
}

/**
 * Checks if chess tables exist in the database
 * Useful for debugging and health checks
 */
export async function checkChessTablesExist(): Promise<{ games: boolean; hurdles: boolean }> {
  try {
    const introspection = chessDb.introspection;
    const tables = await introspection.getTables();
    
    const tableNames = tables.map(table => table.name);
    
    return {
      games: tableNames.includes('games'),
      hurdles: tableNames.includes('hurdles')
    };
  } catch (error) {
    console.error('Error checking chess tables:', error);
    return { games: false, hurdles: false };
  }
}

/**
 * Initialize chess database on application startup
 * This should be called early in the application lifecycle
 */
export async function initializeChessDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing chess database...');
    
    // Check current state
    const tablesExist = await checkChessTablesExist();
    console.log('📊 Current chess tables:', tablesExist);
    
    // Ensure all tables exist
    await ensureChessTables();
    
    // Verify final state
    const finalState = await checkChessTablesExist();
    console.log('✅ Chess database initialization complete:', finalState);
    
    if (!finalState.games || !finalState.hurdles) {
      throw new Error('Chess database initialization failed - tables missing');
    }
  } catch (error) {
    console.error('❌ Chess database initialization failed:', error);
    throw error;
  }
}