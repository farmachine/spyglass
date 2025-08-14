import { pgTable, text, timestamp, integer, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Job queue for extraction tasks
export const extractionJobs = pgTable('extraction_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  
  // Job configuration
  status: text('status', { 
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] 
  }).notNull().default('pending'),
  jobType: text('job_type', { 
    enum: ['extraction', 'ai_analysis', 'excel_function'] 
  }).notNull().default('extraction'),
  priority: integer('priority').default(0),
  
  // Extraction parameters
  extractionNumber: integer('extraction_number').default(0),
  documentIds: text('document_ids').array(),
  targetFields: jsonb('target_fields'),
  identifierReferences: jsonb('identifier_references'),
  extractionRules: jsonb('extraction_rules'),
  
  // Progress tracking
  progress: integer('progress').default(0), // 0-100
  currentStep: text('current_step'),
  totalSteps: integer('total_steps').default(1),
  
  // Results and metadata
  results: jsonb('results'),
  errorMessage: text('error_message'),
  logs: text('logs').array().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  // Performance metrics
  processingTimeMs: integer('processing_time_ms'),
  recordsProcessed: integer('records_processed').default(0),
});

// Job dependencies for chaining extractions
export const jobDependencies = pgTable('job_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => extractionJobs.id, { onDelete: 'cascade' }),
  dependsOnJobId: uuid('depends_on_job_id').notNull().references(() => extractionJobs.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Temporary extraction cache for intermediate results
export const extractionCache = pgTable('extraction_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => extractionJobs.id, { onDelete: 'cascade' }),
  cacheKey: text('cache_key').notNull(),
  cacheData: jsonb('cache_data'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertExtractionJobSchema = createInsertSchema(extractionJobs).extend({
  documentIds: z.array(z.string()).optional(),
  targetFields: z.any().optional(),
  identifierReferences: z.any().optional(),
  extractionRules: z.any().optional(),
  results: z.any().optional(),
  logs: z.array(z.string()).optional(),
});

export const insertJobDependencySchema = createInsertSchema(jobDependencies);
export const insertExtractionCacheSchema = createInsertSchema(extractionCache);

// Types
export type ExtractionJob = typeof extractionJobs.$inferSelect;
export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;
export type JobDependency = typeof jobDependencies.$inferSelect;
export type InsertJobDependency = z.infer<typeof insertJobDependencySchema>;
export type ExtractionCacheEntry = typeof extractionCache.$inferSelect;
export type InsertExtractionCacheEntry = z.infer<typeof insertExtractionCacheSchema>;

// Job status enums
export const JobStatus = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const,
} as const;

export const JobType = {
  EXTRACTION: 'extraction' as const,
  AI_ANALYSIS: 'ai_analysis' as const,
  EXCEL_FUNCTION: 'excel_function' as const,
} as const;