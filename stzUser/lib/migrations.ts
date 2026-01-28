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
      .addColumn('type', 'text', (col) => col.notNull().defaultTo('consumption')) // 'daily_grant', 'consumption', etc.
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    // Ensure 'type' column exists (for existing tables)
    try {
      await db.schema
        .alterTable('transactions')
        .addColumn('type', 'text', (col) => col.notNull().defaultTo('consumption'))
        .execute();
    } catch (e) {
      // Ignore if exists
    }

    // Create index for user lookup
    await db.schema
      .createIndex('idx_transactions_user_id')
      .ifNotExists()
      .on('transactions')
      .column('user_id')
      .execute();

    // 2. Add 'credits' column to user table
    try {
      await db.schema
        .alterTable('user')
        .addColumn('credits', 'integer', (col) => col.notNull().defaultTo(0))
        .execute();
    } catch (e) {
      // Ignore if exists
    }

    // 3. Add 'welcome_claimed' column to user table
    try {
      await db.schema
        .alterTable('user')
        .addColumn('welcome_claimed', 'integer', (col) => col.notNull().defaultTo(0))
        .execute();
    } catch (e) {
      // Ignore if exists
    }

    // 4. Drop legacy resource_usage table
    await db.schema.dropTable('resource_usage').ifExists().execute();

    console.log('✅ Additional foundation tables are ready');
  } catch (error) {
    console.error('❌ Error ensuring additional tables:', error);
    // We throw because if the DB isn't ready, the app shouldn't start
    throw error;
  }
}
