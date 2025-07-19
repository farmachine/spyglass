import { useState, useEffect, useRef } from "react";
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
  const userNavigatedRef = useRef(false);
  const initialTabSetRef = useRef(false);

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
    
    // If a specific tab is requested in URL, honor it first (always override current tab)
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
    
    // Check if user has already interacted with the project (to prevent welcome flow after CRUD operations)
    const hasInteracted = sessionStorage.getItem(`project-${project.id}-interacted`);
    
    // COMPLETELY DISABLE WELCOME FLOW if user has interacted with the project
    if (hasInteracted) {
      return;
    }
    
    // Only run welcome flow on the very first project access AND user hasn't interacted
    const isFirstAccess = !userNavigatedRef.current && !initialTabSetRef.current;
    
    // Welcome flow should ONLY trigger on genuine first load
    if (isFirstAccess && activeTab === 'upload' && !isSetupComplete && user?.role === 'admin') {
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      initialTabSetRef.current = true;
      setActiveTab('define');
      return;
    }
    
    // Mark that we've set an initial tab to prevent future welcome flow triggers
    if (!initialTabSetRef.current) {
      initialTabSetRef.current = true;
    }
    
    // Only set default if no tab is currently active
    if (!activeTab) {
      setActiveTab('upload');
    }
  }, [project, canAccessConfigTabs, canAccessPublishing, user?.role]);

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
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl"
              aria-label="Extractly - Go to Dashboard"
            >
              {/* Logo SVG */}
              <div className="relative">
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 80 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-md"
                >
                  <defs>
                    <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0EA5E9" />
                      <stop offset="100%" stopColor="#0284C7" />
                    </linearGradient>
                    <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38BDF8" />
                      <stop offset="100%" stopColor="#0EA5E9" />
                    </linearGradient>
                  </defs>
                  
                  {/* First wave line */}
                  <path
                    d="M5 15 Q20 8 35 15 Q50 22 65 15 Q72 12 75 15"
                    stroke="url(#waveGradient1)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  
                  {/* Second wave line */}
                  <path
                    d="M5 25 Q20 18 35 25 Q50 32 65 25 Q72 22 75 25"
                    stroke="url(#waveGradient2)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>
              
              {/* Project name instead of "Extractly" */}
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-foreground leading-tight tracking-tight">
                  {project.name}
                </span>
              </div>
            </button>
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
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
                    onClick={() => {
                      if (!isDisabled) {
                        userNavigatedRef.current = true;
                        // Mark that user has interacted with this project
                        sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
                        setActiveTab(item.id);
                      }
                    }}
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
