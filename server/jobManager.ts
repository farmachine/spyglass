// Simple in-memory job manager for background workflow test execution
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowTestJob {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

class JobManager {
  private jobs: Map<string, WorkflowTestJob> = new Map();
  
  createJob(projectId: string): string {
    const jobId = uuidv4();
    const job: WorkflowTestJob = {
      id: jobId,
      projectId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.jobs.set(jobId, job);
    
    // Clean up old jobs (keep last 100)
    if (this.jobs.size > 100) {
      const sortedJobs = Array.from(this.jobs.entries())
        .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
      
      while (this.jobs.size > 100) {
        const [oldestId] = sortedJobs.shift()!;
        this.jobs.delete(oldestId);
      }
    }
    
    return jobId;
  }
  
  getJob(jobId: string): WorkflowTestJob | undefined {
    return this.jobs.get(jobId);
  }
  
  updateJob(jobId: string, updates: Partial<WorkflowTestJob>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date() });
    }
  }
  
  updateProgress(jobId: string, current: number, total: number, message?: string): void {
    this.updateJob(jobId, {
      status: 'running',
      progress: { current, total, message }
    });
  }
  
  completeJob(jobId: string, result: any): void {
    this.updateJob(jobId, {
      status: 'completed',
      result
    });
  }
  
  failJob(jobId: string, error: string): void {
    this.updateJob(jobId, {
      status: 'failed',
      error
    });
  }
}

// Singleton instance
export const jobManager = new JobManager();