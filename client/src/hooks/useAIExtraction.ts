import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ProcessExtractionData {
  sessionId: number;
  files: Array<{
    name: string;
    size: number;
    type: string;
    content?: string;
  }>;
  project_data: any;
}

export function useProcessExtraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, files, project_data }: ProcessExtractionData) => {
      const response = await apiRequest(`/api/sessions/${sessionId}/process`, {
        method: "POST",
        body: JSON.stringify({
          files,
          project_data
        }),
      });
      return response;
    },
    onSuccess: (_, { project_data }) => {
      if (project_data?.id) {
        // Delay query invalidation to avoid interfering with navigation
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id, "sessions"] });
        }, 200);
      }
    },
  });
}