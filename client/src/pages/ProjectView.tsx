import { useParams } from "wouter";
import ProjectLayout from "@/components/ProjectLayout";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");

  if (!projectId || isNaN(projectId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Project</h1>
          <p className="text-gray-600">The project ID is invalid or missing.</p>
        </div>
      </div>
    );
  }

  return <ProjectLayout projectId={projectId} />;
}
