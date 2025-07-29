import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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
  extractionMode?: 'standard' | 'debug';
}

export const useOrchestrationExtraction = () => {
  const [progress, setProgress] = useState<OrchestrationProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: async (request: ExtractionRequest) => {
      const response = await apiRequest('/api/orchestration/extract', {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.sessionId) {
        // Start listening for progress updates
        connectToProgressStream(data.sessionId);
      }
    },
    onError: (error) => {
      console.error('Failed to start extraction:', error);
    }
  });

  // Connect to progress updates using polling instead of SSE
  const connectToProgressStream = (sessionId: string) => {
    if (eventSourceRef.current) {
      clearInterval(eventSourceRef.current as any);
    }

    setIsConnected(true);
    
    // Poll for progress updates every 1 second
    const pollInterval = setInterval(async () => {
      try {
        const response = await getProgress(sessionId);
        if (response && response.success) {
          const progressData = response.progress;
          
          if (progressData.status === 'completed') {
            setProgress(prev => prev ? { ...prev, status: 'completed', overallProgress: 100 } : null);
            clearInterval(pollInterval);
            setIsConnected(false);
            
            // Invalidate related queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
            
          } else if (progressData.status === 'failed') {
            setProgress(prev => prev ? { ...prev, status: 'failed', error: progressData.error } : null);
            clearInterval(pollInterval);
            setIsConnected(false);
            
          } else {
            // Regular progress update
            setProgress(progressData);
          }
        }
      } catch (error) {
        console.error('Failed to get progress:', error);
        clearInterval(pollInterval);
        setIsConnected(false);
      }
    }, 1000);

    // Store interval reference for cleanup
    eventSourceRef.current = pollInterval as any;
  };

  // Control mutations
  const pauseMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/orchestration/pause/${sessionId}`, {
        method: 'POST'
      });
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/orchestration/resume/${sessionId}`, {
        method: 'POST'
      });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/orchestration/cancel/${sessionId}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      // Clean up progress tracking
      setProgress(null);
      if (eventSourceRef.current) {
        if (typeof eventSourceRef.current === 'number') {
          clearInterval(eventSourceRef.current);
        } else {
          eventSourceRef.current.close();
        }
        setIsConnected(false);
      }
    }
  });

  // Get current progress
  const getProgress = async (sessionId: string) => {
    try {
      const response = await apiRequest(`/api/orchestration/progress/${sessionId}`);
      if (response.success) {
        setProgress(response.progress);
      }
      return response;
    } catch (error) {
      console.error('Failed to get progress:', error);
      return null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        if (typeof eventSourceRef.current === 'number') {
          clearInterval(eventSourceRef.current);
        } else {
          eventSourceRef.current.close();
        }
      }
    };
  }, []);

  return {
    // State
    progress,
    isConnected,
    
    // Actions
    startExtraction: startExtractionMutation.mutate,
    pauseExtraction: pauseMutation.mutate,
    resumeExtraction: resumeMutation.mutate,
    cancelExtraction: cancelMutation.mutate,
    getProgress,
    connectToProgressStream,
    
    // Loading states
    isStarting: startExtractionMutation.isPending,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isCancelling: cancelMutation.isPending,
    
    // Error states
    startError: startExtractionMutation.error,
    controlError: pauseMutation.error || resumeMutation.error || cancelMutation.error,
    
    // Reset function
    reset: () => {
      setProgress(null);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
      startExtractionMutation.reset();
      pauseMutation.reset();
      resumeMutation.reset();
      cancelMutation.reset();
    }
  };
};