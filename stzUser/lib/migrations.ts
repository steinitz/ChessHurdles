import { db } from './database'

/**
 * Ensures all additional foundation tables exist in the database.
 * This follows the "Slim Sync" pattern: declarative and safe to run on every startup.
 */
export async function ensureAdditionalTables(): Promise<void> {
  try {
    console.log('🏁 Ensuring additional foundation tables...');

    // 1. Transactions Table (for credit history)
    await db.schema
      .createTable('transactions')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('amount', 'integer', (col) => col.notNull()) // Positive for credits, negative for debits
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    // Create index for user lookup
    await db.schema
      .createIndex('idx_transactions_user_id')
      .ifNotExists()
      .on('transactions')
      .column('user_id')
      .execute();

    // 2. Resource Usage Table (for tracking actions like game analyses)
    await db.schema
      .createTable('resource_usage')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('resource_type', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    // Create index for user/type lookup
    await db.schema
      .createIndex('idx_resource_usage_user_id')
      .ifNotExists()
      .on('resource_usage')
      .column('user_id')
      .execute();

    console.log('✅ Additional foundation tables are ready');
  } catch (error) {
    console.error('❌ Error ensuring additional tables:', error);
    // We throw because if the DB isn't ready, the app shouldn't start
    throw error;
  }
}
