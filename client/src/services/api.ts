import { apiRequest } from "@/lib/queryClient";
import type { Project, InsertProject, ProjectWithDetails } from "@shared/schema";

export const projectsApi = {
  getAll: (): Promise<Project[]> => 
    apiRequest("/api/projects"),
  
  getById: (id: number): Promise<ProjectWithDetails> =>
    apiRequest(`/api/projects/${id}`),
  
  create: (project: InsertProject): Promise<Project> =>
    apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(project),
    }),
  
  update: (id: number, project: Partial<InsertProject>): Promise<Project> =>
    apiRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  
  delete: (id: number): Promise<void> =>
    apiRequest(`/api/projects/${id}`, {
      method: "DELETE",
    }),
};
