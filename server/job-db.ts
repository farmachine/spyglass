import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as jobSchema from "@shared/job-schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const jobPool = new Pool({ connectionString: process.env.DATABASE_URL });
export const jobDb = drizzle({ client: jobPool, schema: jobSchema });

// Initialize job tables if they don't exist
export async function initializeJobTables() {
  try {
    // Create extraction_jobs table
    await jobPool.query(`
      CREATE TABLE IF NOT EXISTS extraction_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        job_type TEXT NOT NULL DEFAULT 'extraction' CHECK (job_type IN ('extraction', 'ai_analysis', 'excel_function')),
        priority INTEGER DEFAULT 0,
        extraction_number INTEGER DEFAULT 0,
        document_ids TEXT[],
        target_fields JSONB,
        identifier_references JSONB,
        extraction_rules JSONB,
        progress INTEGER DEFAULT 0,
        current_step TEXT,
        total_steps INTEGER DEFAULT 1,
        results JSONB,
        error_message TEXT,
        logs TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW(),
        processing_time_ms INTEGER,
        records_processed INTEGER DEFAULT 0
      );
    `);

    // Create job_dependencies table
    await jobPool.query(`
      CREATE TABLE IF NOT EXISTS job_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES extraction_jobs(id) ON DELETE CASCADE,
        depends_on_job_id UUID NOT NULL REFERENCES extraction_jobs(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create extraction_cache table
    await jobPool.query(`
      CREATE TABLE IF NOT EXISTS extraction_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES extraction_jobs(id) ON DELETE CASCADE,
        cache_key TEXT NOT NULL,
        cache_data JSONB,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Job database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing job tables:', error);
  }
}