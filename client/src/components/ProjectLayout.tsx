import { useState, useEffect } from "react";
import { ArrowLeft, Upload, Database, Brain, Settings, FolderOpen, Home as HomeIcon } from "lucide-react";
import { WaveIcon, FlowIcon, StreamIcon, TideIcon, ShipIcon, DropletIcon } from "@/components/SeaIcons";
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
import ExtractlyLogo from "./ExtractlyLogo";
import WavePattern from "./WavePattern";

interface ProjectLayoutProps {
  projectId: string;
}

type ActiveTab = "upload" | "data" | "knowledge" | "define" | "publishing";

export default function ProjectLayout({ projectId }: ProjectLayoutProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const { data: project, isLoading, error } = useProject(projectId);
  const { user } = useAuth();

  // Check user role for access control (needed in useEffect)
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;

  // Read URL parameters and handle welcome flow
  useEffect(() => {
    if (!project) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    // Check if initial setup is complete
    const isSetupComplete = project.isInitialSetupComplete || 
      (project.schemaFields && project.schemaFields.length > 0) ||
      (project.collections && project.collections.length > 0);
    
    // If a specific tab is requested in URL, honor it first
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
      return;
    }
    
    // Only apply welcome flow if no specific tab is requested AND setup is not complete
    if (!isSetupComplete) {
      if (user?.role === 'admin') {
        setActiveTab('define');
      } else {
        setActiveTab('upload');
      }
      return;
    }
    
    // Default to upload tab if no tab specified and setup is complete
    setActiveTab('upload');
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



  const navItems = [
    { id: "upload" as const, label: `New ${project.mainObjectName || "Session"}`, icon: DropletIcon, disabled: !isSetupComplete },
    { id: "data" as const, label: `All ${project.mainObjectName || "Session"}s`, icon: FlowIcon, disabled: !isSetupComplete },
    ...(canAccessConfigTabs ? [
      { id: "knowledge" as const, label: "Knowledge/Rules", icon: TideIcon, disabled: !isSetupComplete },
      { id: "define" as const, label: "Define Data", icon: StreamIcon, disabled: false },
    ] : []),
    ...(canAccessPublishing ? [
      { id: "publishing" as const, label: "Publishing", icon: ShipIcon, disabled: false },
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
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <ExtractlyLogo showText={false} />
              <Breadcrumb items={[{ label: project.name }]} />
            </div>
            <UserProfile />
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200">
          <div className="p-6">
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
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                      isDisabled
                        ? "text-gray-400 cursor-not-allowed opacity-50 font-medium"
                        : isActive
                        ? "bg-primary text-white font-bold"
                        : "text-gray-700 hover:bg-gray-50 font-medium"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      isDisabled ? "text-gray-300" : isActive ? "text-white" : "text-gray-400"
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
