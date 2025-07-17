import { apiRequest } from "@/lib/queryClient";
import type { Project, InsertProject, ProjectWithDetails } from "@shared/schema";

export const projectsApi = {
  getAll: (): Promise<Project[]> => 
    apiRequest("/api/projects"),
  
  getById: (id: string): Promise<ProjectWithDetails> =>
    apiRequest(`/api/projects/${id}`),
  
  create: (project: InsertProject): Promise<Project> =>
    apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(project),
    }),
  
  update: (id: string, project: Partial<InsertProject>): Promise<Project> =>
    apiRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/api/projects/${id}`, {
      method: "DELETE",
    }),
};
