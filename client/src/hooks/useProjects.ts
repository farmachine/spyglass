import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import type { InsertProject } from "@shared/schema";

export function useProjects() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["/api/projects-with-orgs", user?.id, user?.organizationId],
    queryFn: projectsApi.getAll,
    enabled: !!user, // Only run query when user is authenticated
  });
}

export function useProject(id: string, options?: { pollingWhenInbox?: boolean }) {
  return useQuery({
    queryKey: ["/api/projects", id],
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
    refetchInterval: options?.pollingWhenInbox ? (query) => {
      const data = query.state.data as any;
      return data?.inboxEmailAddress ? 30000 : false;
    } : false,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (project: InsertProject) => projectsApi.create(project),
    onSuccess: () => {
      // Invalidate all project queries regardless of user - new project affects all users
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-orgs"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, project }: { id: string; project: Partial<InsertProject> }) =>
      projectsApi.update(id, project),
    onSuccess: (_, { id }) => {
      // Invalidate all project queries - updates affect all users
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Completely clear all project-related cache data
      queryClient.removeQueries({ 
        queryKey: ["/api/projects-with-orgs"]
      });
      queryClient.removeQueries({ 
        queryKey: ["/api/projects", deletedId]
      });
      queryClient.removeQueries({ 
        queryKey: ["/api/dashboard"]
      });
      
      // Then invalidate to force fresh fetches
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects-with-orgs"],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/dashboard"],
        exact: false 
      });
      
      // Force immediate refetch of project list
      queryClient.refetchQueries({ 
        queryKey: ["/api/projects-with-orgs"]
      });
    },
    onError: (error: any) => {
      console.error("Delete project error:", error);
    },
  });
}

export function useDuplicateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      projectsApi.duplicate(id, name),
    onSuccess: () => {
      // Invalidate all project queries - new duplicated project affects all users
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-orgs"] });
    },
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) => 
      projectsApi.updateStatus(id, status),
    onSuccess: () => {
      // Invalidate all project queries - status changes affect all users
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-orgs"] });
    },
  });
}
