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

  // Connect to Server-Sent Events for real-time progress
  const connectToProgressStream = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/orchestration/stream/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'completed') {
          setProgress(prev => prev ? { ...prev, status: 'completed', overallProgress: 100 } : null);
          eventSource.close();
          setIsConnected(false);
          
          // Invalidate related queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
          
        } else if (data.type === 'error') {
          setProgress(prev => prev ? { ...prev, status: 'failed', error: data.error } : null);
          eventSource.close();
          setIsConnected(false);
          
        } else if (data.type === 'cancelled') {
          setProgress(prev => prev ? { ...prev, status: 'failed', error: 'Cancelled by user' } : null);
          eventSource.close();
          setIsConnected(false);
          
        } else {
          // Regular progress update
          setProgress(data);
        }
      } catch (error) {
        console.error('Failed to parse progress data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setIsConnected(false);
      eventSource.close();
    };
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
        eventSourceRef.current.close();
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
        eventSourceRef.current.close();
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