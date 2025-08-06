import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAsyncProcessing } from '@/hooks/useAsyncProcessing';
import { useLocation } from 'wouter';

interface AsyncProcessingStatusProps {
  sessionId: string;
  onComplete?: () => void;
  onError?: (errorMessage: string) => void;
  showNavigateButton?: boolean;
}

export function AsyncProcessingStatus({
  sessionId,
  onComplete,
  onError,
  showNavigateButton = true
}: AsyncProcessingStatusProps) {
  const [, setLocation] = useLocation();
  
  const { status, isPolling, refetch } = useAsyncProcessing({
    sessionId,
    enabled: true,
    pollInterval: 3000,
    onComplete: () => {
      onComplete?.();
    },
    onError: (statusData) => {
      onError?.("Processing failed. Please try again.");
    }
  });

  const getStatusIcon = () => {
    if (!status) return <Loader2 className="h-5 w-5 animate-spin" />;
    
    switch (status.status) {
      case 'pending':
        return <div className="h-5 w-5 bg-gray-400 rounded-full" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    if (!status) return 'secondary';
    
    switch (status.status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getProgressValue = () => {
    if (!status) return 0;
    
    switch (status.status) {
      case 'pending':
        return 10;
      case 'processing':
        return 60;
      case 'completed':
        return 100;
      case 'failed':
      case 'error':
        return 0;
      default:
        return 0;
    }
  };

  const getStatusMessage = () => {
    if (!status) return 'Loading processing status...';
    
    // Use static messages since database fields don't exist yet
    switch (status.status) {
      case 'pending':
        return 'Processing request queued...';
      case 'processing':
        return 'AI is analyzing your documents...';
      case 'completed':
        return 'Document processing completed successfully!';
      case 'failed':
      case 'error':
        return 'Processing failed. Please try again.';
      default:
        return 'Processing...';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className="font-semibold text-lg">Document Processing</h3>
                <Badge variant={getStatusColor()} className="mt-1">
                  {status?.status?.toUpperCase() || 'LOADING'}
                </Badge>
              </div>
            </div>
            
            {status && ['failed', 'error'].includes(status.status) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={refetch}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Check
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={getProgressValue()} className="w-full" />
            <p className="text-sm text-gray-600">
              {getStatusMessage()}
            </p>
          </div>

          {/* Status Details */}
          {status && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="text-sm">
                <span className="font-medium">Session ID:</span> {sessionId}
              </div>
              <div className="text-sm">
                <span className="font-medium">Last Updated:</span>{' '}
                {new Date(status.updatedAt).toLocaleString()}
              </div>
              {status.status === 'failed' || status.status === 'error' ? (
                <div className="text-sm text-red-600">
                  <span className="font-medium">Error:</span> Processing failed
                </div>
              ) : null}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            {status?.status === 'completed' && showNavigateButton && (
              <Button
                onClick={() => setLocation(`/sessions/${sessionId}`)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                View Results
              </Button>
            )}
            
            {status && ['processing', 'pending'].includes(status.status) && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isPolling ? 'Checking status...' : 'Status checking paused'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}