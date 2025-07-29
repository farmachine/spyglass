import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OrchestrationProgress {
  sessionId: string;
  currentPhase: string;
  phaseProgress: number;
  overallProgress: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  message: string;
  error?: string;
  completedPhases: string[];
  totalPhases: number;
}

export interface ExtractionRequest {
  sessionId: string;
  projectId: string;
  files: Array<{
    name: string;
    content: string; // Base64 encoded
    type: string;
  }>;
  userId: string;
  extractionMode?: 'standard' | 'debug';
}

export interface OrchestrationResult {
  success: boolean;
  sessionId: string;
  extractedData?: any;
  validationCount?: number;
  error?: string;
  progress: OrchestrationProgress;
}

export class ExtractionOrchestrator extends EventEmitter {
  private activeExtractions = new Map<string, OrchestrationProgress>();
  private readonly phases = [
    'initialization',
    'file_processing', 
    'text_extraction',
    'schema_retrieval',
    'ai_extraction',
    'validation_creation',
    'data_aggregation',
    'completion'
  ];

  constructor() {
    super();
    this.setMaxListeners(100); // Support multiple concurrent extractions
  }

  async startExtraction(request: ExtractionRequest): Promise<string> {
    const { sessionId } = request;
    
    // Initialize progress tracking
    const progress: OrchestrationProgress = {
      sessionId,
      currentPhase: 'initialization',
      phaseProgress: 0,
      overallProgress: 0,
      status: 'running',
      message: 'Starting extraction process...',
      completedPhases: [],
      totalPhases: this.phases.length
    };

    this.activeExtractions.set(sessionId, progress);
    this.emit('progress', progress);

    // Start the extraction pipeline
    this.executeExtractionPipeline(request).catch((error) => {
      this.handleError(sessionId, error);
    });

    return sessionId;
  }

  private async executeExtractionPipeline(request: ExtractionRequest): Promise<void> {
    const { sessionId, projectId, files, userId, extractionMode = 'standard' } = request;

    try {
      // Phase 1: Initialization
      await this.updateProgress(sessionId, 'initialization', 0, 'Initializing extraction process...');
      await this.sleep(500); // Brief pause for UI feedback
      await this.updateProgress(sessionId, 'initialization', 100, 'Initialization complete');
      this.completePhase(sessionId, 'initialization');

      // Phase 2: File Processing  
      await this.updateProgress(sessionId, 'file_processing', 0, 'Processing uploaded files...');
      const processedFiles = await this.processFiles(files);
      await this.updateProgress(sessionId, 'file_processing', 100, `Processed ${files.length} files`);
      this.completePhase(sessionId, 'file_processing');

      // Phase 3: Text Extraction
      await this.updateProgress(sessionId, 'text_extraction', 0, 'Extracting text content from documents...');
      const extractedTexts = await this.extractTextContent(sessionId, processedFiles);
      await this.updateProgress(sessionId, 'text_extraction', 100, 'Text extraction complete');
      this.completePhase(sessionId, 'text_extraction');

      // Phase 4: Schema Retrieval
      await this.updateProgress(sessionId, 'schema_retrieval', 0, 'Loading project schema...');
      const schemaData = await this.getProjectSchema(projectId);
      await this.updateProgress(sessionId, 'schema_retrieval', 100, 'Schema loaded successfully');
      this.completePhase(sessionId, 'schema_retrieval');

      // Phase 5: AI Extraction
      await this.updateProgress(sessionId, 'ai_extraction', 0, 'Running AI extraction...');
      const extractionResult = await this.runAIExtraction(sessionId, extractedTexts, schemaData, extractionMode);
      await this.updateProgress(sessionId, 'ai_extraction', 100, 'AI extraction complete');
      this.completePhase(sessionId, 'ai_extraction');

      // Phase 6: Validation Creation
      await this.updateProgress(sessionId, 'validation_creation', 0, 'Creating validation records...');
      const validationCount = await this.createValidationRecords(sessionId, extractionResult);
      await this.updateProgress(sessionId, 'validation_creation', 100, `Created ${validationCount} validation records`);
      this.completePhase(sessionId, 'validation_creation');

      // Phase 7: Data Aggregation
      await this.updateProgress(sessionId, 'data_aggregation', 0, 'Aggregating extracted data...');
      const aggregatedData = await this.aggregateExtractionData(sessionId);
      await this.updateProgress(sessionId, 'data_aggregation', 100, 'Data aggregation complete');
      this.completePhase(sessionId, 'data_aggregation');

      // Phase 8: Completion
      await this.updateProgress(sessionId, 'completion', 0, 'Finalizing extraction...');
      await this.finalizeExtraction(sessionId, aggregatedData);
      await this.updateProgress(sessionId, 'completion', 100, 'Extraction completed successfully');
      this.completePhase(sessionId, 'completion');

      // Mark as completed
      const finalProgress = this.activeExtractions.get(sessionId)!;
      finalProgress.status = 'completed';
      finalProgress.overallProgress = 100;
      finalProgress.message = 'Extraction completed successfully';
      this.emit('progress', finalProgress);
      this.emit('completed', { sessionId, data: aggregatedData, validationCount });

    } catch (error) {
      this.handleError(sessionId, error);
    }
  }

  private async processFiles(files: Array<{ name: string; content: string; type: string }>) {
    // Convert files to the format expected by existing systems
    return files.map(file => ({
      file_name: file.name,
      file_content: file.content,
      mime_type: file.type
    }));
  }

  private async extractTextContent(sessionId: string, files: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../test_text_extraction.py');
      const process = spawn('python3', [pythonScript], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.stdin.write(JSON.stringify({ files }));
      process.stdin.end();

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse text extraction result: ${e}`));
          }
        } else {
          reject(new Error(`Text extraction failed: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });
    });
  }

  private async getProjectSchema(projectId: string): Promise<any> {
    // This would typically call your storage layer directly
    // For now, we'll simulate the API call pattern
    const response = await fetch(`http://localhost:5000/api/projects/${projectId}/schema-data`);
    if (!response.ok) {
      throw new Error(`Failed to get schema: ${response.statusText}`);
    }
    return response.json();
  }

  private async runAIExtraction(
    sessionId: string, 
    extractedTexts: any, 
    schemaData: any, 
    mode: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptName = mode === 'debug' ? 'ai_extraction.py' : 'ai_extraction_single_step.py';
      const pythonScript = path.join(__dirname, '../../', scriptName);
      
      const process = spawn('python3', [pythonScript], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        // Parse progress updates if available
        this.parseProgressFromOutput(sessionId, data.toString());
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const inputData = {
        session_id: sessionId,
        extracted_texts: extractedTexts,
        schema_data: schemaData
      };

      process.stdin.write(JSON.stringify(inputData));
      process.stdin.end();

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse AI extraction result: ${e}`));
          }
        } else {
          reject(new Error(`AI extraction failed: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`AI extraction process error: ${error.message}`));
      });
    });
  }

  private async createValidationRecords(sessionId: string, extractionResult: any): Promise<number> {
    const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}/save-validations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractionResult)
    });

    if (!response.ok) {
      throw new Error(`Failed to save validations: ${response.statusText}`);
    }

    const result = await response.json();
    return result.count || 0;
  }

  private async aggregateExtractionData(sessionId: string): Promise<any> {
    const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}/validations`);
    if (!response.ok) {
      throw new Error(`Failed to get validation data: ${response.statusText}`);
    }
    return response.json();
  }

  private async finalizeExtraction(sessionId: string, data: any): Promise<void> {
    // Update session status, clean up temporary files, etc.
    const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'completed',
        extractedAt: new Date().toISOString(),
        recordCount: data.length || 0
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to finalize session: ${response.statusText}`);
    }
  }

  private parseProgressFromOutput(sessionId: string, output: string): void {
    // Parse any progress indicators from Python script output
    const progressMatch = output.match(/PROGRESS: (\d+)%/);
    if (progressMatch) {
      const progress = parseInt(progressMatch[1]);
      const currentProgress = this.activeExtractions.get(sessionId);
      if (currentProgress && currentProgress.currentPhase === 'ai_extraction') {
        this.updateProgress(sessionId, 'ai_extraction', progress, 'AI processing...');
      }
    }
  }

  private async updateProgress(
    sessionId: string, 
    phase: string, 
    phaseProgress: number, 
    message: string
  ): Promise<void> {
    const progress = this.activeExtractions.get(sessionId);
    if (!progress) return;

    progress.currentPhase = phase;
    progress.phaseProgress = phaseProgress;
    progress.message = message;
    
    // Calculate overall progress
    const phaseIndex = this.phases.indexOf(phase);
    const baseProgress = (phaseIndex / this.phases.length) * 100;
    const phaseContribution = (phaseProgress / 100) * (100 / this.phases.length);
    progress.overallProgress = Math.min(100, baseProgress + phaseContribution);

    this.activeExtractions.set(sessionId, progress);
    this.emit('progress', progress);
  }

  private completePhase(sessionId: string, phase: string): void {
    const progress = this.activeExtractions.get(sessionId);
    if (progress && !progress.completedPhases.includes(phase)) {
      progress.completedPhases.push(phase);
    }
  }

  private handleError(sessionId: string, error: any): void {
    const progress = this.activeExtractions.get(sessionId);
    if (progress) {
      progress.status = 'failed';
      progress.error = error.message || 'Unknown error occurred';
      progress.message = `Failed during ${progress.currentPhase}: ${progress.error}`;
      this.activeExtractions.set(sessionId, progress);
      this.emit('error', { sessionId, error: progress.error, progress });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring and control
  getProgress(sessionId: string): OrchestrationProgress | null {
    return this.activeExtractions.get(sessionId) || null;
  }

  getAllActiveExtractions(): OrchestrationProgress[] {
    return Array.from(this.activeExtractions.values());
  }

  async pauseExtraction(sessionId: string): Promise<boolean> {
    const progress = this.activeExtractions.get(sessionId);
    if (progress && progress.status === 'running') {
      progress.status = 'paused';
      this.emit('paused', { sessionId });
      return true;
    }
    return false;
  }

  async resumeExtraction(sessionId: string): Promise<boolean> {
    const progress = this.activeExtractions.get(sessionId);
    if (progress && progress.status === 'paused') {
      progress.status = 'running';
      this.emit('resumed', { sessionId });
      // Resume logic would need to be implemented based on current phase
      return true;
    }
    return false;
  }

  async cancelExtraction(sessionId: string): Promise<boolean> {
    const progress = this.activeExtractions.get(sessionId);
    if (progress) {
      progress.status = 'failed';
      progress.error = 'Cancelled by user';
      this.activeExtractions.delete(sessionId);
      this.emit('cancelled', { sessionId });
      return true;
    }
    return false;
  }

  cleanup(): void {
    this.activeExtractions.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const extractionOrchestrator = new ExtractionOrchestrator();