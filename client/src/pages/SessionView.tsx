import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import SessionView from "@/components/SessionView";
import { Loader2 } from "lucide-react";
import type { ProjectWithDetails, ExtractionSession } from "@shared/schema";

export default function SessionViewPage() {
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    enabled: !!projectId,
  });

  const session = project?.sessions.find(s => s.id === parseInt(sessionId || '0'));

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900">Project not found</h2>
          <p className="text-sm text-gray-500">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900">Session not found</h2>
          <p className="text-sm text-gray-500">The extraction session you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return <SessionView session={session} project={project} />;
}