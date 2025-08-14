import { useState } from "react";
import { ArrowLeft, Settings, Database, Brain, Upload, User, List } from "lucide-react";
import { TideIcon, StreamIcon, ShipIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import KnowledgeRules from "@/components/KnowledgeRules";
import DefineData from "@/components/DefineData";
import Publishing from "@/components/Publishing";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import UserProfile from "@/components/UserProfile";

interface ProjectAdminProps {
  projectId: string;
}

type AdminTab = "knowledge" | "define" | "publishing";

export default function ProjectAdmin({ projectId }: ProjectAdminProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("define");
  const [schemaActiveTab, setSchemaActiveTab] = useState<string>("main-data");
  const { data: project, isLoading, error } = useProject(projectId);
  const { user } = useAuth();

  // Check user role for access control
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;

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

  const adminNavItems = [
    { id: "define" as const, label: "Define Data", icon: StreamIcon, disabled: false },
    ...(canAccessConfigTabs ? [
      { id: "knowledge" as const, label: "Knowledge/Rules", icon: TideIcon, disabled: false },
    ] : []),
    ...(canAccessPublishing ? [
      { id: "publishing" as const, label: "Publishing", icon: ShipIcon, disabled: false },
    ] : []),
  ];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "knowledge":
        return <KnowledgeRules project={project} />;
      case "define":
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={() => {}} />;
      case "publishing":
        return <Publishing project={project} />;
      default:
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={() => {}} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtractlyLogo />
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Page Title */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-3xl font-bold">Project Admin</h2>
                <p className="text-sm text-gray-600">{project.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-168px)]">
        {/* Sidebar */}
        <div className="w-72 bg-slate-50 border-r border-slate-200">
          <div className="p-4">
            {/* Back to Project Link */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/projects/${projectId}`)}
                className="w-full justify-start px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal"
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
                        ? "text-slate-400 cursor-not-allowed opacity-50 font-normal"
                        : isActive
                        ? "bg-primary text-white font-medium shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      isDisabled ? "text-slate-300" : isActive ? "text-white" : "text-slate-500"
                    }`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Schema Navigation - Only show when Define Data tab is active */}
            {activeTab === 'define' && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="px-3 mb-2">
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    SCHEMA INFORMATION
                  </h3>
                </div>
                <nav className="space-y-0.5">
                  {/* Main Data Section */}
                  <button
                    onClick={() => setSchemaActiveTab('main-data')}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                      schemaActiveTab === 'main-data'
                        ? "bg-primary text-white font-medium shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    General Information
                  </button>

                  {/* Collection Sections */}
                  {project.collections?.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => setSchemaActiveTab(collection.collectionName)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                        schemaActiveTab === collection.collectionName
                          ? "bg-primary text-white font-medium shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal"
                      }`}
                    >
                      <List className="h-4 w-4" />
                      {collection.collectionName}
                    </button>
                  ))}
                </nav>
              </div>
            )}
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