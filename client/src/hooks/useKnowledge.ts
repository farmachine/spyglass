import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  KnowledgeDocument, 
  InsertKnowledgeDocument,
  ExtractionRule,
  InsertExtractionRule 
} from "@shared/schema";

// Knowledge Documents
export function useKnowledgeDocuments(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "knowledge"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/knowledge`),
  });
}

export function useCreateKnowledgeDocument(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (document: { fileName: string; displayName: string; fileType: string; fileSize: number; description: string }) => 
      apiRequest(`/api/projects/${projectId}/knowledge`, {
        method: "POST",
        body: JSON.stringify({ ...document, projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "knowledge"] });
    },
  });
}

export function useUpdateKnowledgeDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<InsertKnowledgeDocument>) =>
      apiRequest(`/api/knowledge/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/knowledge/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
    },
  });
}

// Extraction Rules
export function useExtractionRules(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "rules"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/rules`),
  });
}

export function useCreateExtractionRule(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (rule: Omit<InsertExtractionRule, "projectId">) => 
      apiRequest(`/api/projects/${projectId}/rules`, {
        method: "POST",
        body: JSON.stringify(rule),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "rules"] });
    },
  });
}

export function useUpdateExtractionRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<InsertExtractionRule>) =>
      apiRequest(`/api/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
    },
  });
}

export function useDeleteExtractionRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/rules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
    },
  });
}