import { apiRequest } from "@/lib/queryClient";
import type { Project, InsertProject, ProjectWithDetails } from "@shared/schema";

export const projectsApi = {
  getAll: (): Promise<Project[]> => 
    apiRequest("/api/projects"),
  
  getById: (id: string): Promise<ProjectWithDetails> =>
    apiRequest(`/api/projects/${id}`),
  
  create: (project: InsertProject): Promise<Project> => {
    console.log("API: Creating project with data:", project);
    const token = localStorage.getItem("auth_token");
    console.log("API: Auth token exists:", !!token);
    return apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
  },
  
  update: (id: string, project: Partial<InsertProject>): Promise<Project> =>
    apiRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/api/projects/${id}`, {
      method: "DELETE",
    }),
  
  duplicate: (id: string, name: string): Promise<Project> =>
    apiRequest(`/api/projects/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  
  updateStatus: (id: string, status: "active" | "inactive"): Promise<Project> =>
    apiRequest(`/api/projects/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
};
