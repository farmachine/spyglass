import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ProcessExtractionData {
  sessionId: string;
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

export function useStartBackgroundExtraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, files, project_data }: ProcessExtractionData) => {
      const response = await apiRequest(`/api/sessions/${sessionId}/start-background-extraction`, {
        method: "POST",
        body: JSON.stringify({
          files,
          project_data
        }),
      });
      return response;
    },
    onSuccess: (_, { sessionId, project_data }) => {
      if (project_data?.id) {
        // Immediately invalidate queries to show processing status
        queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id, "sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/validations/project", project_data.id] });
        
        // Set up polling to check for completion and refresh cache
        const checkCompletion = async () => {
          try {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (response.ok) {
              const session = await response.json();
              if (session.status !== 'processing') {
                // Extraction completed, invalidate all relevant caches
                queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id] });
                queryClient.invalidateQueries({ queryKey: ["/api/projects", project_data.id, "sessions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/validations/project", project_data.id] });
                return;
              }
            }
          } catch (error) {
            console.error('Error checking session status:', error);
          }
          
          // Continue polling if still processing
          setTimeout(checkCompletion, 3000);
        };
        
        // Start polling after 5 seconds to allow backend processing
        setTimeout(checkCompletion, 5000);
      }
    },
  });
}