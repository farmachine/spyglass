/**
 * Project View - Project Management and Configuration Hub
 * 
 * Simple wrapper component that loads project details and delegates to ProjectLayout.
 * Handles project ID validation and provides error states for invalid projects.
 * 
 * Features:
 * - Project ID parameter extraction from URL
 * - Error handling for missing/invalid project IDs
 * - Delegates to ProjectLayout component for main interface
 * 
 * ProjectLayout provides:
 * - Project overview and statistics
 * - Session management and creation
 * - Workflow configuration interface
 * - Document processing status
 * - User permissions and access control
 */

import { useParams } from "wouter";
import ProjectLayout from "@/components/ProjectLayout";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = id || "";

  if (!projectId) {
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
