import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ExtractionStep {
  id: string;
  projectId: string;
  stepName: string;
  stepDescription: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useExtractionSteps = (projectId: string) => {
  return useQuery({
    queryKey: ["/api/projects", projectId, "steps"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/steps`),
    enabled: !!projectId,
  });
};

export const useCreateExtractionStep = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, stepData }: { projectId: string; stepData: any }) =>
      apiRequest(`/api/projects/${projectId}/steps`, {
        method: "POST",
        body: JSON.stringify(stepData),
      }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "steps"] });
    },
  });
};

export const useUpdateExtractionStep = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, stepData }: { id: string; stepData: any }) =>
      apiRequest(`/api/extraction-steps/${id}`, {
        method: "PUT",
        body: JSON.stringify(stepData),
      }),
    onSuccess: (_, { stepData }) => {
      if (stepData.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", stepData.projectId, "steps"] });
      }
    },
  });
};

export const useDeleteExtractionStep = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/extraction-steps/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
};