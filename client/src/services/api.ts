import { apiRequest } from "@/lib/queryClient";
import type { Project, InsertProject, ProjectWithDetails } from "@shared/schema";

export const projectsApi = {
  getAll: (): Promise<Project[]> => 
    fetch("/api/projects").then(res => res.json()),
  
  getById: (id: number): Promise<ProjectWithDetails> =>
    fetch(`/api/projects/${id}`).then(res => res.json()),
  
  create: (project: InsertProject): Promise<Project> =>
    apiRequest("POST", "/api/projects", project).then(res => res.json()),
  
  update: (id: number, project: Partial<InsertProject>): Promise<Project> =>
    apiRequest("PUT", `/api/projects/${id}`, project).then(res => res.json()),
  
  delete: (id: number): Promise<void> =>
    apiRequest("DELETE", `/api/projects/${id}`).then(() => undefined),
};
