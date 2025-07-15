import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ExtractionSession, 
  InsertExtractionSession
} from "@shared/schema";

// Extraction Sessions
export function useExtractionSessions(projectId: number) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "sessions"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/sessions`),
  });
}

export function useCreateExtractionSession(projectId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (session: { sessionName: string; description: string | null; documentCount: number; status: string }) => 
      apiRequest(`/api/projects/${projectId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ ...session, projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "sessions"] });
    },
  });
}

export function useUpdateExtractionSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertExtractionSession>) =>
      apiRequest(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}

export function useDeleteExtractionSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/sessions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}