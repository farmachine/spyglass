import { useState, useEffect } from "react";
import { ArrowLeft, Upload, Database, Brain, Settings, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import NewUpload from "./NewUpload";
import AllData from "./AllData";
import KnowledgeRules from "./KnowledgeRules";
import DefineData from "./DefineData";
import Publishing from "./Publishing";
import UserProfile from "./UserProfile";
import Breadcrumb from "./Breadcrumb";

interface ProjectLayoutProps {
  projectId: number;
}

type ActiveTab = "upload" | "data" | "knowledge" | "define" | "publishing";

export default function ProjectLayout({ projectId }: ProjectLayoutProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const { data: project, isLoading, error } = useProject(projectId);
  const { user } = useAuth();

  // Read URL parameters and handle welcome flow
  useEffect(() => {
    if (!project) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    // Check if initial setup is complete
    const isSetupComplete = project.isInitialSetupComplete || 
      (project.schemaFields && project.schemaFields.length > 0) ||
      (project.collections && project.collections.length > 0);
    
    // For new projects, admins start with 'define' tab, users with 'upload'
    if (!isSetupComplete) {
      if (user?.role === 'admin') {
        setActiveTab('define');
      } else {
        setActiveTab('upload');
      }
      return;
    }
    
    if (tab) {
      switch (tab) {
        case 'upload':
          setActiveTab('upload');
          break;
        case 'all-data':
          setActiveTab('data');
          break;
        case 'knowledge':
          if (canAccessConfigTabs) setActiveTab('knowledge');
          break;
        case 'define':
          if (canAccessConfigTabs) setActiveTab('define');
          break;
        case 'publishing':
          if (canAccessPublishing) setActiveTab('publishing');
          break;
        default:
          setActiveTab('upload');
      }
    }
  }, [project]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 mb-2">Error Loading Project</h2>
              <p className="text-sm text-gray-600 mb-4">
                Failed to load project details. Please try again later.
              </p>
              <Button onClick={() => setLocation("/")} variant="outline">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-64" />
            </div>
          </div>
        </div>
        <div className="flex h-[calc(100vh-80px)]">
          <div className="w-64 bg-white border-r border-gray-200 p-6">
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Project Not Found</h2>
              <p className="text-sm text-gray-600 mb-4">
                The requested project could not be found.
              </p>
              <Button onClick={() => setLocation("/")} variant="outline">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if initial setup is complete
  const isSetupComplete = project.isInitialSetupComplete || 
    (project.schemaFields && project.schemaFields.length > 0) ||
    (project.collections && project.collections.length > 0);

  // Check user role for access control
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.name === 'Internal';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;

  const navItems = [
    { id: "upload" as const, label: `New ${project.mainObjectName || "Session"}`, icon: Upload, disabled: !isSetupComplete },
    { id: "data" as const, label: `All ${project.mainObjectName || "Session"} Data`, icon: Database, disabled: !isSetupComplete },
    ...(canAccessConfigTabs ? [
      { id: "knowledge" as const, label: "Knowledge/Rules", icon: Brain, disabled: !isSetupComplete },
      { id: "define" as const, label: "Define Data", icon: Settings, disabled: false },
    ] : []),
    ...(canAccessPublishing ? [
      { id: "publishing" as const, label: "Publishing", icon: FolderOpen, disabled: false },
    ] : []),
  ];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "upload":
        return <NewUpload project={project} />;
      case "data":
        return <AllData project={project} />;
      case "knowledge":
        return <KnowledgeRules project={project} />;
      case "define":
        return <DefineData project={project} />;
      case "publishing":
        return <Publishing project={project} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <Breadcrumb 
                items={[
                  { label: project.name, icon: <FolderOpen className="h-4 w-4" /> }
                ]} 
              />
              <UserProfile />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200">
          <div className="p-6">
            <div className="mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {project.name}
              </div>
              <div className="text-sm text-gray-600">
                {project.description || "Data extraction project"}
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isDisabled = item.disabled;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && setActiveTab(item.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isDisabled
                        ? "text-gray-400 cursor-not-allowed opacity-50"
                        : isActive
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 ml-[-1px]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      isDisabled ? "text-gray-300" : isActive ? "text-blue-600" : "text-gray-400"
                    }`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8">
          {renderActiveContent()}
        </div>
      </div>
    </div>
  );
}
