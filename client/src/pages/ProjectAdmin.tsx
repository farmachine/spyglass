import { useState, useRef } from "react";
import { ArrowLeft, Settings, Database, Brain, Upload, User, List, Wrench, Plus, GraduationCap, Link2 } from "lucide-react";
import { TideIcon, StreamIcon, ShipIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import KnowledgeRules from "@/components/KnowledgeRules";
import DefineData from "@/components/DefineData";
import ExtraplLogo from "@/components/ExtraplLogo";
import UserProfile from "@/components/UserProfile";
import DarkModeToggle from "@/components/DarkModeToggle";
import Tools from "@/components/Tools";
import DataSourcesPanel from "@/components/DataSourcesPanel";
import { usePageTitle } from "@/hooks/usePageTitle";

interface ProjectAdminProps {
  projectId: string;
}

type AdminTab = "data" | "knowledge" | "rules" | "tools" | "connect";

export default function ProjectAdmin({ projectId }: ProjectAdminProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("data");
  const [schemaActiveTab, setSchemaActiveTab] = useState<string>("main-data");
  const addCollectionCallbackRef = useRef<(() => void) | null>(null);
  const { data: project, isLoading, error } = useProject(projectId);
  const { user } = useAuth();

  // Set dynamic page title for admin pages
  usePageTitle(project?.name ? `Admin - ${project.name}` : "Admin");

  // Check user role for access control
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 mb-2">Error Loading Project</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-64" />
            </div>
          </div>
        </div>
        <div className="flex h-[calc(100vh-80px)]">
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Project Not Found</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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

  const adminNavItems = [
    { id: "data" as const, label: "Extraction", icon: StreamIcon, disabled: false },
    ...(canAccessConfigTabs ? [
      { id: "knowledge" as const, label: "Knowledge Base", icon: GraduationCap, disabled: false },
      { id: "rules" as const, label: "Rulebook", icon: Brain, disabled: false },
      { id: "tools" as const, label: "Toolbox", icon: Wrench, disabled: false },
    ] : []),
    ...(canAccessConfigTabs ? [
      { id: "connect" as const, label: "Connect", icon: Link2, disabled: false },
    ] : []),
  ];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "data":
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={(callback) => { addCollectionCallbackRef.current = callback; }} />;
      case "knowledge":
        return <KnowledgeRules project={project} mode="knowledge" />;
      case "rules":
        return <KnowledgeRules project={project} mode="rules" />;
      case "tools":
        return <Tools projectId={projectId} />;
      case "connect":
        return <DataSourcesPanel projectId={projectId} />;
      default:
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={(callback) => { addCollectionCallbackRef.current = callback; }} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtraplLogo showConfigure={true} />
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <UserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Page Title */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="w-full px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-gray-700 dark:text-gray-300" />
              <div>
                <h2 className="text-3xl font-bold text-gray-700 dark:text-white">{project.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-100">Configure</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-168px)]">
        {/* Sidebar */}
        <div className="w-72 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
          <div className="p-4">
            {/* Back to Project Link */}
            <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/projects/${projectId}`)}
                className="w-full justify-start px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 font-normal"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </div>
            
            <nav className="space-y-0.5">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isDisabled = item.disabled;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!isDisabled) {
                        setActiveTab(item.id);
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                      isDisabled
                        ? "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50 font-normal"
                        : isActive
                        ? "bg-gray-700 dark:bg-primary text-white font-medium shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 font-normal"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      isDisabled ? "text-slate-300 dark:text-slate-600" : isActive ? "text-white" : "text-slate-500 dark:text-slate-400"
                    }`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50 dark:bg-gray-900">
          {renderActiveContent()}
        </div>
      </div>
    </div>
  );
}