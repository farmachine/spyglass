import { useState, useEffect, useRef } from 'react';

interface ProcessingStatus {
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'error';
  progressMessage?: string;
  errorMessage?: string;
  updatedAt: string;
}

interface UseAsyncProcessingOptions {
  sessionId: string;
  enabled: boolean;
  pollInterval?: number;
  onComplete?: (status: ProcessingStatus) => void;
  onError?: (status: ProcessingStatus) => void;
}

export function useAsyncProcessing({
  sessionId,
  enabled = true,
  pollInterval = 2000,
  onComplete,
  onError
}: UseAsyncProcessingOptions) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`);
      if (response.ok) {
        const statusData = await response.json();
        setStatus(statusData);

        // Check if processing is complete
        if (statusData.status === 'completed') {
          onComplete?.(statusData);
          setIsPolling(false);
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          onError?.(statusData);
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error('Error fetching processing status:', error);
    }
  };

  const startPolling = () => {
    if (!enabled || isPolling) return;
    
    setIsPolling(true);
    fetchStatus(); // Initial fetch
    
    intervalRef.current = setInterval(fetchStatus, pollInterval);
  };

  const stopPolling = () => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (enabled && sessionId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [sessionId, enabled]);

  useEffect(() => {
    // Stop polling when status is terminal
    if (status && ['completed', 'failed', 'error'].includes(status.status)) {
      stopPolling();
    }
  }, [status]);

  return {
    status,
    isPolling,
    startPolling,
    stopPolling,
    refetch: fetchStatus
  };
}