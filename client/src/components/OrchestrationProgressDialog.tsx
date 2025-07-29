import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Pause, 
  Play, 
  X,
  Activity 
} from 'lucide-react';
import { OrchestrationProgress } from '@/hooks/useOrchestrationExtraction';

interface OrchestrationProgressDialogProps {
  open: boolean;
  progress: OrchestrationProgress | null;
  isConnected: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  isPausing?: boolean;
  isResuming?: boolean;
  isCancelling?: boolean;
}

const phaseDisplayNames: Record<string, string> = {
  initialization: 'Initializing',
  file_processing: 'Processing Files',
  text_extraction: 'Extracting Text',
  schema_retrieval: 'Loading Schema',
  ai_extraction: 'AI Processing',
  validation_creation: 'Creating Validations',
  data_aggregation: 'Aggregating Data',
  completion: 'Finalizing'
};

const phaseDescriptions: Record<string, string> = {
  initialization: 'Setting up extraction environment',
  file_processing: 'Converting and validating uploaded files',
  text_extraction: 'Extracting content from documents using AI',
  schema_retrieval: 'Loading project configuration and rules',
  ai_extraction: 'Running AI analysis on document content',
  validation_creation: 'Creating validation records in database',
  data_aggregation: 'Combining and organizing extracted data',
  completion: 'Finalizing extraction process'
};

export function OrchestrationProgressDialog({
  open,
  progress,
  isConnected,
  onPause,
  onResume,
  onCancel,
  onClose,
  isPausing,
  isResuming,
  isCancelling
}: OrchestrationProgressDialogProps) {
  
  // Auto-close dialog when completed
  useEffect(() => {
    if (progress?.status === 'completed' && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000); // Auto close after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [progress?.status, onClose]);

  const getStatusIcon = () => {
    if (!progress) return <Loader2 className="h-5 w-5 animate-spin" />;
    
    switch (progress.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'paused':
        return <Pause className="h-5 w-5 text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    if (!progress) return 'bg-gray-400';
    
    switch (progress.status) {
      case 'running':
        return 'bg-blue-600';
      case 'paused':
        return 'bg-orange-600';
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-gray-400';
    }
  };

  const renderPhaseList = () => {
    if (!progress) return null;

    return (
      <div className="space-y-2">
        {Object.keys(phaseDisplayNames).map((phaseKey, index) => {
          const isCompleted = progress.completedPhases.includes(phaseKey);
          const isCurrent = progress.currentPhase === phaseKey;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div
              key={phaseKey}
              className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                isCurrent ? 'bg-blue-50 border border-blue-200' : 
                isCompleted ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-900' : 
                    isCompleted ? 'text-green-900' : 'text-gray-600'
                  }`}>
                    {phaseDisplayNames[phaseKey]}
                  </p>
                  
                  <Badge variant={
                    isCompleted ? 'success' : 
                    isCurrent ? 'default' : 'secondary'
                  } className="ml-2">
                    {isCompleted ? 'Done' : 
                     isCurrent ? `${progress.phaseProgress}%` : 'Pending'}
                  </Badge>
                </div>
                
                <p className="text-xs text-gray-500 mt-1">
                  {phaseDescriptions[phaseKey]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>Document Extraction</span>
            <div className="flex items-center space-x-2 ml-auto">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-gray-600">{Math.round(progress?.overallProgress || 0)}%</span>
            </div>
            <Progress 
              value={progress?.overallProgress || 0} 
              className="h-2"
            />
            
            {/* Current Status Message */}
            <p className="text-sm text-gray-600 mt-2">
              {progress?.message || 'Preparing extraction...'}
            </p>
          </div>

          {/* Phase Progress */}
          {renderPhaseList()}

          {/* Error Display */}
          {progress?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{progress.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          {progress && progress.status !== 'completed' && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex space-x-2">
                {progress.status === 'running' && onPause && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPause}
                    disabled={isPausing}
                  >
                    {isPausing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Pause className="h-4 w-4 mr-1" />
                    )}
                    Pause
                  </Button>
                )}
                
                {progress.status === 'paused' && onResume && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResume}
                    disabled={isResuming}
                  >
                    {isResuming ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Resume
                  </Button>
                )}
              </div>
              
              {onCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <X className="h-4 w-4 mr-1" />
                  )}
                  Cancel
                </Button>
              )}
            </div>
          )}

          {/* Completion Message */}
          {progress?.status === 'completed' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Extraction completed successfully!
                </p>
              </div>
              <p className="text-sm text-green-700 mt-1">
                You can now review and validate the extracted data.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}