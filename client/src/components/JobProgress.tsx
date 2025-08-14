import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Job {
  id: string;
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  totalSteps: number;
  extractionNumber: number;
  results?: any;
  errorMessage?: string;
  logs?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  recordsProcessed: number;
}

interface JobProgressProps {
  sessionId: string;
  onJobComplete?: (job: Job) => void;
}

export function JobProgress({ sessionId, onJobComplete }: JobProgressProps) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch jobs for this session
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'jobs'],
    refetchInterval: (data: Job[] | undefined) => {
      // Refresh every 2 seconds if there are running or pending jobs
      const hasActiveJobs = data?.some(job => 
        job.status === 'running' || job.status === 'pending'
      );
      return hasActiveJobs ? 2000 : false;
    },
  });

  useEffect(() => {
    // Check for completed jobs and trigger callback
    const completedJobs = jobs.filter((job: Job) => 
      job.status === 'completed' && job.results
    );
    
    completedJobs.forEach((job: Job) => {
      if (onJobComplete) {
        onJobComplete(job);
      }
    });
  }, [jobs, onJobComplete]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      queryClient.invalidateQueries({
        queryKey: ['/api/sessions', sessionId, 'jobs']
      });
      
      toast({
        title: "Job cancelled",
        description: "The extraction job has been cancelled successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel the job. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading job status...
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Extraction Jobs</h3>
      {jobs.map((job: Job) => (
        <Card key={job.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(job.status)}
                <CardTitle className="text-base">
                  Extraction #{job.extractionNumber + 1}
                </CardTitle>
                <Badge className={getStatusColor(job.status)}>
                  {job.status}
                </Badge>
              </div>
              {job.status === 'running' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelJob(job.id)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <CardDescription>
              {job.currentStep}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {job.status === 'running' && (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{job.progress}%</span>
                </div>
                <Progress value={job.progress} className="w-full" />
                <div className="text-sm text-muted-foreground">
                  Step {Math.ceil((job.progress / 100) * job.totalSteps)} of {job.totalSteps}
                </div>
              </div>
            )}

            {job.status === 'completed' && (
              <div className="space-y-2 mb-4">
                <div className="text-sm text-green-600">
                  ✓ Completed successfully
                </div>
                <div className="text-sm text-muted-foreground">
                  Processed {job.recordsProcessed} records
                </div>
              </div>
            )}

            {job.status === 'failed' && job.errorMessage && (
              <div className="space-y-2 mb-4">
                <div className="text-sm text-red-600">
                  ✗ Failed: {job.errorMessage}
                </div>
              </div>
            )}

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Created: {new Date(job.createdAt).toLocaleTimeString()}</span>
              {job.completedAt && (
                <span>Completed: {new Date(job.completedAt).toLocaleTimeString()}</span>
              )}
            </div>

            {job.logs && job.logs.length > 0 && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedJob(
                    expandedJob === job.id ? null : job.id
                  )}
                >
                  {expandedJob === job.id ? 'Hide Logs' : 'Show Logs'}
                </Button>
                
                {expandedJob === job.id && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs max-h-40 overflow-y-auto">
                    {job.logs.slice(-10).map((log, index) => (
                      <div key={index} className="mb-1 font-mono">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}