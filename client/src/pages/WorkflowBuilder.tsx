import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Settings, ArrowRight, Workflow } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ExtractionStepWithDetails } from "@shared/schema";
import { StepCard } from "@/components/StepCard";
import { CreateStepDialog } from "@/components/CreateStepDialog";
import { StepDetailsDialog } from "@/components/StepDetailsDialog";

export function WorkflowBuilder() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [createStepOpen, setCreateStepOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<ExtractionStepWithDetails | null>(null);
  const [stepDetailsOpen, setStepDetailsOpen] = useState(false);

  // Fetch extraction steps for this project
  const { data: steps = [], isLoading } = useQuery<ExtractionStepWithDetails[]>({
    queryKey: [`/api/projects/${projectId}/extraction-steps`],
    enabled: !!projectId
  });

  // Fetch project details for context
  const { data: project } = useQuery<{ id: string; name: string; mainObjectName?: string }>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId
  });

  const runWorkflowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/projects/${projectId}/run-workflow`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      // Navigate to session view or results page
      setLocation(`/projects/${projectId}/sessions`);
    }
  });

  const handleCreateStep = () => {
    setCreateStepOpen(true);
  };

  const handleEditStep = (step: ExtractionStepWithDetails) => {
    setSelectedStep(step);
    setStepDetailsOpen(true);
  };

  const handleRunWorkflow = () => {
    if (steps.length > 0) {
      runWorkflowMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Workflow className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Builder</h1>
            <p className="text-gray-600">
              Create multi-step extraction workflows for {project?.name || 'this project'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleRunWorkflow}
            disabled={steps.length === 0 || runWorkflowMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-2" />
            {runWorkflowMutation.isPending ? "Running..." : "Run Workflow"}
          </Button>
          <Button onClick={handleCreateStep}>
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </div>
      </div>

      {/* Workflow Overview */}
      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Workflow Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{steps.length} Steps</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {steps.reduce((total, step) => total + step.schemaFields.length, 0)} Fields
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {steps.reduce((total, step) => total + step.collections.length, 0)} Collections
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Steps */}
      {steps.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Extraction Steps</h2>
          <div className="space-y-4">
            {steps
              .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
              .map((step, index) => (
                <div key={step.id} className="flex items-center space-x-4">
                  <StepCard
                    step={step}
                    stepNumber={index + 1}
                    onEdit={() => handleEditStep(step)}
                    onDelete={() => {
                      // TODO: Implement delete functionality
                    }}
                  />
                  {index < steps.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : (
        // Empty State
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Workflow className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No workflow steps yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md">
              Create your first extraction step to begin building a multi-step workflow. 
              Each step can extract different types of data and reference previous steps.
            </p>
            <Button onClick={handleCreateStep} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create First Step
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateStepDialog
        open={createStepOpen}
        onOpenChange={setCreateStepOpen}
        projectId={projectId!}
        stepCount={steps.length}
      />

      {selectedStep && (
        <StepDetailsDialog
          open={stepDetailsOpen}
          onOpenChange={setStepDetailsOpen}
          step={selectedStep}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/extraction-steps`] });
          }}
        />
      )}
    </div>
  );
}

export default WorkflowBuilder;