import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

// Database instance (legacy)
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
export const appDatabase = new Database(dbPath);

/**
 * User-related database types
 * 
 * All user-related TypeScript interfaces are consolidated here to:
 * 1. Provide a single source of truth for database schemas
 * 2. Simplify the migration to Kysely
 * 3. Separate database concerns from UI/client types
 */

// Database Types
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended user type with role information
export interface UserWithRole extends User {
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}

// Better Auth listUsers response structure
export interface ListUsersResponse {
  users: UserWithRole[];
  total: number;
  limit: number | undefined;
  offset: number | undefined;
}

// Kysely Database Interface
export interface Database {
  user: UserTable;
  transactions: TransactionTable;
  resource_usage: ResourceUsageTable;
}

// Define the user table schema based on UserWithRole
export interface UserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string; // SQLite stores dates as strings
  updatedAt: string; // SQLite stores dates as strings
  role: string | null;
  banned: number | null; // SQLite stores booleans as 0/1
  banReason: string | null;
  banExpires: string | null; // SQLite stores dates as strings
}

export interface TransactionTable {
  id: string;
  user_id: string;
  amount: number; // Positive for credits, negative for debits
  description: string;
  created_at: string;
}

export interface ResourceUsageTable {
  id: string;
  user_id: string;
  resource_type: string; // e.g., 'chess_game_analysis'
  created_at: string;
}

// Initialize Kysely instance
export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: appDatabase
  }),
});

// ---
// Database Field Adapters (tuned for SQLite idiosyncrasies)
// Note: These adapters currently normalize values for SQLite binding/storage.
// They may be relocated to a dedicated module and generalized per dialect.
// Convert booleans to SQLite-friendly integers (0/1)
export function asSqlBool(value: boolean): number {
  return value ? 1 : 0
}

// Convert SQLite integers (0/1) back to JavaScript booleans
export function fromSqlBool(value: number | boolean | null): boolean {
  if (value === null) return false
  if (typeof value === 'boolean') return value
  return value === 1
}

// Safely stringify JSON values for storage in TEXT columns
export function stringifyJson(value: unknown | null): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

// Safely parse JSON text from TEXT columns
export function parseJson<T = unknown>(text: string | null): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// Utility helpers
export const nowIso = () => new Date().toISOString()
