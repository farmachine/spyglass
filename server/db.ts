/**
 * Database Connection and Configuration
 *
 * Sets up PostgreSQL connection with support for both:
 * - Neon Database (serverless, WebSocket-based) for Replit deployment
 * - Standard pg driver for AWS RDS deployment
 *
 * The driver is selected based on the DB_DRIVER environment variable.
 * Defaults to 'neon' for backwards compatibility.
 *
 * AWS/ISO 27001 requirements:
 * - SSL/TLS enforcement for RDS connections
 * - Connection pooling with configurable limits
 * - Connection string from environment (Secrets Manager in production)
 */

import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbDriver = process.env.DB_DRIVER || 'neon';

let pool: any;
let db: any;

if (dbDriver === 'pg') {
  // Standard pg driver for AWS RDS
  const pg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
    ssl: process.env.DB_SSL === 'false' ? false : {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  });

  db = drizzle(pool, { schema });
} else {
  // Neon serverless driver (default, backwards compatible with Replit)
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = (await import('ws')).default;

  neonConfig.webSocketConstructor = ws;

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
