import { Router } from 'express';
import { z } from 'zod';
import { extractionOrchestrator, ExtractionRequest } from '../services/ExtractionOrchestrator.js';
import { authenticateToken, type AuthRequest } from '../auth.js';

const router = Router();

// Schema for extraction request validation
const extractionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  projectId: z.string().uuid(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string(), // Base64 encoded
    type: z.string()
  })),
  extractionMode: z.enum(['standard', 'debug']).optional().default('standard')
});

const sessionIdSchema = z.object({
  sessionId: z.string().uuid()
});

// Start a new extraction process
router.post('/extract', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const validatedData = extractionRequestSchema.parse(req.body);
    
    const extractionRequest: ExtractionRequest = {
      ...validatedData,
      userId: req.user!.id
    };

    const sessionId = await extractionOrchestrator.startExtraction(extractionRequest);
    
    res.json({
      success: true,
      sessionId,
      message: 'Extraction process started',
      endpoints: {
        progress: `/api/orchestration/progress/${sessionId}`,
        cancel: `/api/orchestration/cancel/${sessionId}`,
        pause: `/api/orchestration/pause/${sessionId}`,
        resume: `/api/orchestration/resume/${sessionId}`
      }
    });
  } catch (error) {
    console.error('Failed to start extraction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start extraction'
    });
  }
});

// Get extraction progress
router.get('/progress/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const progress = extractionOrchestrator.getProgress(sessionId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Failed to get progress:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get progress'
    });
  }
});

// Get all active extractions (admin only)
router.get('/active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only allow admins to see all active extractions
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const activeExtractions = extractionOrchestrator.getAllActiveExtractions();
    
    res.json({
      success: true,
      activeExtractions,
      count: activeExtractions.length
    });
  } catch (error) {
    console.error('Failed to get active extractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active extractions'
    });
  }
});

// Pause extraction
router.post('/pause/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const success = await extractionOrchestrator.pauseExtraction(sessionId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Could not pause extraction (not running or not found)'
      });
    }

    res.json({
      success: true,
      message: 'Extraction paused successfully'
    });
  } catch (error) {
    console.error('Failed to pause extraction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause extraction'
    });
  }
});

// Resume extraction
router.post('/resume/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const success = await extractionOrchestrator.resumeExtraction(sessionId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Could not resume extraction (not paused or not found)'
      });
    }

    res.json({
      success: true,
      message: 'Extraction resumed successfully'
    });
  } catch (error) {
    console.error('Failed to resume extraction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume extraction'
    });
  }
});

// Cancel extraction
router.post('/cancel/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const success = await extractionOrchestrator.cancelExtraction(sessionId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    res.json({
      success: true,
      message: 'Extraction cancelled successfully'
    });
  } catch (error) {
    console.error('Failed to cancel extraction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel extraction'
    });
  }
});

// WebSocket-like endpoint for real-time progress updates
router.get('/stream/:sessionId', async (req, res) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    
    // For now, skip authentication check for SSE endpoint
    // TODO: Implement token-based authentication via query parameter
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial progress
    const initialProgress = extractionOrchestrator.getProgress(sessionId);
    if (initialProgress) {
      res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
    }

    // Set up event listeners
    const onProgress = (progress: any) => {
      if (progress.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    };

    const onCompleted = (result: any) => {
      if (result.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({ type: 'completed', ...result })}\n\n`);
        res.end();
      }
    };

    const onError = (error: any) => {
      if (error.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({ type: 'error', ...error })}\n\n`);
        res.end();
      }
    };

    const onCancelled = (result: any) => {
      if (result.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({ type: 'cancelled', ...result })}\n\n`);
        res.end();
      }
    };

    // Register listeners
    extractionOrchestrator.on('progress', onProgress);
    extractionOrchestrator.on('completed', onCompleted);
    extractionOrchestrator.on('error', onError);
    extractionOrchestrator.on('cancelled', onCancelled);

    // Clean up on client disconnect
    req.on('close', () => {
      extractionOrchestrator.off('progress', onProgress);
      extractionOrchestrator.off('completed', onCompleted);
      extractionOrchestrator.off('error', onError);
      extractionOrchestrator.off('cancelled', onCancelled);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    console.error('Failed to set up stream:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set up stream'
    });
  }
});

export default router;