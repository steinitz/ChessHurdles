import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

// Database instance (legacy)
export const appDatabase = new Database("sqlite.db");

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
  // Add other tables as needed
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

// Initialize Kysely instance
export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: appDatabase
  }),
});
