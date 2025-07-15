import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  KnowledgeDocument, 
  InsertKnowledgeDocument,
  ExtractionRule,
  InsertExtractionRule 
} from "@shared/schema";

// Knowledge Documents
export function useKnowledgeDocuments(projectId: number) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "knowledge"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/knowledge`),
  });
}

export function useCreateKnowledgeDocument(projectId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (document: Omit<InsertKnowledgeDocument, "projectId">) => 
      apiRequest(`/api/projects/${projectId}/knowledge`, {
        method: "POST",
        body: JSON.stringify(document),
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
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertKnowledgeDocument>) =>
      apiRequest(`/api/knowledge/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) =>
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
export function useExtractionRules(projectId: number) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "rules"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/rules`),
  });
}

export function useCreateExtractionRule(projectId: number) {
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
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertExtractionRule>) =>
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
    mutationFn: (id: number) =>
      apiRequest(`/api/rules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
    },
  });
}