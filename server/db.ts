/**
 * Database Connection and Configuration
 * 
 * Sets up PostgreSQL connection using Neon Database (serverless Postgres)
 * with Drizzle ORM for type-safe database operations.
 * 
 * Configuration:
 * - Uses DATABASE_URL environment variable for connection string
 * - WebSocket constructor configured for serverless environment
 * - Schema imported from shared module for type safety
 * 
 * Exports:
 * - pool: Raw database connection pool
 * - db: Drizzle ORM instance with schema
 * 
 * Usage:
 * - Import `db` for all database operations
 * - Use with Drizzle query builder for type-safe queries
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
