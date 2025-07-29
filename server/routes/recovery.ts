import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Fix failed sessions endpoint
router.post('/sessions/:sessionId/fix', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`Fixing failed session: ${sessionId}`);
    
    // Get session details
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if session is indeed failed (in_progress with no extractedData)
    if (session.status === 'in_progress' && !session.extractedData) {
      console.log(`Session ${sessionId} appears to be failed - attempting recovery`);
      
      // Reset session status to allow re-extraction
      await storage.updateSession(sessionId, {
        status: 'pending',
        extractedData: null,
        updatedAt: new Date()
      });
      
      // Clear any existing empty validation records
      const validations = await storage.getFieldValidations(sessionId);
      const emptyValidations = validations.filter(v => 
        !v.extractedValue && v.confidenceScore === 0
      );
      
      for (const validation of emptyValidations) {
        await storage.deleteFieldValidation(validation.id);
      }
      
      console.log(`Cleared ${emptyValidations.length} empty validation records`);
      
      res.json({ 
        success: true, 
        message: `Session ${sessionId} reset and ready for re-extraction`,
        clearedRecords: emptyValidations.length
      });
    } else {
      res.json({ 
        success: false, 
        message: `Session ${sessionId} does not appear to be failed (status: ${session.status})` 
      });
    }
    
  } catch (error) {
    console.error('Error fixing session:', error);
    res.status(500).json({ error: 'Failed to fix session' });
  }
});

// Get failed sessions
router.get('/sessions/failed', async (req, res) => {
  try {
    const allSessions = await storage.getAllSessions();
    const failedSessions = allSessions.filter(session => 
      session.status === 'in_progress' && !session.extractedData
    );
    
    res.json(failedSessions);
  } catch (error) {
    console.error('Error getting failed sessions:', error);
    res.status(500).json({ error: 'Failed to get failed sessions' });
  }
});

export default router;