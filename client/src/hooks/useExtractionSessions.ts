import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ExtractionSession, 
  InsertExtractionSession
} from "@shared/schema";

export function useExtractionSessions(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "sessions"],
    queryFn: () => fetch(`/api/projects/${projectId}/sessions`).then(res => res.json()),
    enabled: !!projectId,
  });
}

export function useCreateExtractionSession(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (session: Omit<InsertExtractionSession, "projectId">) =>
      apiRequest(`/api/projects/${projectId}/sessions`, {
        method: "POST",
        body: JSON.stringify(session),
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
    mutationFn: ({ id, session }: { id: number; session: Partial<InsertExtractionSession> }) =>
      apiRequest(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(session),
      }),
    onSuccess: (_, { session }) => {
      if (session.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", session.projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", session.projectId, "sessions"] });
      }
    },
  });
}