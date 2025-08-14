import { jobDb, initializeJobTables } from './job-db';
import { extractionJobs, jobDependencies, extractionCache, JobStatus, JobType } from '@shared/job-schema';
import { eq, and, lt } from 'drizzle-orm';
import { spawn } from 'child_process';

export class JobService {
  
  async initialize() {
    await initializeJobTables();
  }
  
  async createExtractionJob(data: {
    sessionId: string;
    projectId: string;
    userId: string;
    extractionNumber?: number;
    documentIds?: string[];
    targetFields?: any;
    identifierReferences?: any;
    extractionRules?: any;
  }) {
    const job = await jobDb.insert(extractionJobs).values({
      sessionId: data.sessionId,
      projectId: data.projectId,
      userId: data.userId,
      jobType: JobType.EXTRACTION,
      extractionNumber: data.extractionNumber || 0,
      documentIds: data.documentIds,
      targetFields: data.targetFields,
      identifierReferences: data.identifierReferences,
      extractionRules: data.extractionRules,
      status: JobStatus.PENDING,
      currentStep: 'Initializing extraction job',
      totalSteps: 4,
    }).returning();
    
    return job[0];
  }

  async updateJobStatus(jobId: string, status: string, updates: {
    progress?: number;
    currentStep?: string;
    errorMessage?: string;
    results?: any;
    processingTimeMs?: number;
    recordsProcessed?: number;
    logs?: string[];
  } = {}) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
      ...updates,
    };

    if (status === JobStatus.RUNNING && !updates.hasOwnProperty('startedAt')) {
      updateData.startedAt = new Date();
    }
    
    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    await jobDb.update(extractionJobs)
      .set(updateData)
      .where(eq(extractionJobs.id, jobId));
  }

  async addJobLog(jobId: string, logMessage: string) {
    const job = await this.getJob(jobId);
    if (job) {
      const logs = [...(job.logs || []), `${new Date().toISOString()}: ${logMessage}`];
      await jobDb.update(extractionJobs)
        .set({ 
          logs,
          updatedAt: new Date(),
        })
        .where(eq(extractionJobs.id, jobId));
    }
  }

  async getJob(jobId: string) {
    const jobs = await jobDb.select()
      .from(extractionJobs)
      .where(eq(extractionJobs.id, jobId));
    return jobs[0] || null;
  }

  async getJobsBySession(sessionId: string) {
    return await jobDb.select()
      .from(extractionJobs)
      .where(eq(extractionJobs.sessionId, sessionId))
      .orderBy(extractionJobs.createdAt);
  }

  async executeExtractionJob(jobId: string) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      await this.updateJobStatus(jobId, JobStatus.RUNNING, {
        progress: 10,
        currentStep: 'Starting Python extraction process',
      });

      await this.addJobLog(jobId, `Starting extraction for session ${job.sessionId}`);

      const extractionData = {
        session_id: job.sessionId,
        document_ids: job.documentIds || [],
        target_fields: job.targetFields,
        identifier_references: job.identifierReferences,
        extraction_rules: job.extractionRules,
        extraction_number: job.extractionNumber,
      };

      const result = await this.runPythonExtraction(jobId, extractionData);

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, {
        progress: 100,
        currentStep: 'Extraction completed successfully',
        results: result,
        recordsProcessed: result.recordCount || 0,
      });

      await this.addJobLog(jobId, `Extraction completed successfully with ${result.recordCount || 0} records`);

      return result;

    } catch (error: any) {
      await this.updateJobStatus(jobId, JobStatus.FAILED, {
        errorMessage: error.message,
        currentStep: 'Extraction failed',
      });

      await this.addJobLog(jobId, `Extraction failed: ${error.message}`);
      throw error;
    }
  }

  private async runPythonExtraction(jobId: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const python = spawn('python3', ['extraction_wizardry.py']);
      
      python.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });

      python.stdin.write(JSON.stringify(data));
      python.stdin.end();

      let output = '';
      let error = '';

      python.stdout.on('data', async (data) => {
        const chunk = data.toString();
        output += chunk;
        
        await this.addJobLog(jobId, `Python output: ${chunk.slice(0, 200)}...`);
        
        if (chunk.includes('EXTRACTION RUN')) {
          await this.updateJobStatus(jobId, JobStatus.RUNNING, {
            progress: 25,
            currentStep: 'Analyzing documents with AI',
          });
        } else if (chunk.includes('EXTRACTION RESULTS')) {
          await this.updateJobStatus(jobId, JobStatus.RUNNING, {
            progress: 75,
            currentStep: 'Processing extraction results',
          });
        }
      });

      python.stderr.on('data', async (data) => {
        const chunk = data.toString();
        error += chunk;
        await this.addJobLog(jobId, `Python stderr: ${chunk}`);
      });

      python.on('close', async (code) => {
        const processingTime = Date.now() - startTime;
        
        await this.updateJobStatus(jobId, JobStatus.RUNNING, {
          processingTimeMs: processingTime,
        });

        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${error}`));
          return;
        }

        try {
          const lines = output.split('\n');
          let recordCount = 0;

          for (const line of lines) {
            if (line.includes('records extracted')) {
              const match = line.match(/(\d+) records extracted/);
              if (match) {
                recordCount = parseInt(match[1]);
              }
            }
          }

          resolve({
            output: output.trim(),
            recordCount,
            processingTimeMs: processingTime,
            success: true,
          });
        } catch (parseError: any) {
          reject(new Error(`Failed to parse Python output: ${parseError.message}`));
        }
      });
    });
  }

  async cacheData(jobId: string, key: string, data: any, expirationHours: number = 24) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    await jobDb.insert(extractionCache).values({
      jobId,
      cacheKey: key,
      cacheData: data,
      expiresAt,
    });
  }

  async getCachedData(jobId: string, key: string) {
    const cached = await jobDb.select()
      .from(extractionCache)
      .where(
        and(
          eq(extractionCache.jobId, jobId),
          eq(extractionCache.cacheKey, key)
        )
      );

    if (cached.length > 0 && cached[0].expiresAt > new Date()) {
      return cached[0].cacheData;
    }

    return null;
  }

  async cleanupExpiredCache() {
    await jobDb.delete(extractionCache)
      .where(lt(extractionCache.expiresAt, new Date()));
  }

  async getActiveJobs() {
    return await jobDb.select()
      .from(extractionJobs)
      .where(eq(extractionJobs.status, JobStatus.RUNNING));
  }

  async cancelJob(jobId: string) {
    await this.updateJobStatus(jobId, JobStatus.CANCELLED, {
      currentStep: 'Job cancelled by user',
    });
    
    await this.addJobLog(jobId, 'Job cancelled by user request');
  }
}

export const jobService = new JobService();