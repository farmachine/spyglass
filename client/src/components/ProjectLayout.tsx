import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, Database, Brain, Settings, FolderOpen, Home as HomeIcon, TrendingUp, Edit3, Check, X, AlertTriangle, CheckCircle, User, List, Plus } from "lucide-react";
import { WaveIcon, FlowIcon, StreamIcon, TideIcon, ShipIcon, DropletIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import type { FieldValidation } from "@shared/schema";
import AllData from "./AllData";
import KnowledgeRules from "./KnowledgeRules";
import DefineData from "./DefineData";
import Publishing from "./Publishing";
import UserProfile from "./UserProfile";
import Breadcrumb from "./Breadcrumb";
import ExtractlyLogo from "./ExtractlyLogo";
import WavePattern from "./WavePattern";
import { AppHeader } from "./AppHeader";

interface ProjectLayoutProps {
  projectId: string;
}

type ActiveTab = "data" | "knowledge" | "define" | "publishing";

export default function ProjectLayout({ projectId }: ProjectLayoutProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("data");
  const [schemaActiveTab, setSchemaActiveTab] = useState<string>("main-data");
  const addCollectionCallbackRef = useRef<(() => void) | null>(null);
  const { data: project, isLoading, error } = useProject(projectId);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userNavigatedRef = useRef(false);
  const initialTabSetRef = useRef(false);
  
  // Editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Check user role for access control (needed in useEffect)
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;
  const canEditProject = isAdmin;

  // Fetch validation data for statistics (only when project has sessions)
  const { data: allValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', project?.id],
    queryFn: async () => {
      if (!project || project.sessions.length === 0) return [];
      const validations: FieldValidation[] = [];
      for (const session of project.sessions) {
        try {
          const response = await fetch(`/api/sessions/${session.id}/validations`);
          if (response.ok) {
            const sessionValidations = await response.json();
            validations.push(...sessionValidations);
          }
        } catch (error) {
          console.error(`Failed to fetch validations for session ${session.id}:`, error);
        }
      }
      return validations;
    },
    enabled: !!project && project.sessions.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

  // Calculate verification statistics
  const getVerificationStats = () => {
    if (!project) return { verified: 0, in_progress: 0, pending: 0 };
    
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    for (const session of project.sessions) {
      const sessionValidations = allValidations.filter(v => v.sessionId === session.id);
      if (sessionValidations.length === 0) {
        stats.pending++;
      } else {
        const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
        if (allVerified) {
          stats.verified++;
        } else {
          stats.in_progress++;
        }
      }
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  // Read URL parameters and handle initial tab setup
  useEffect(() => {
    if (!project) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    // If a specific tab is requested in URL, honor it first (always override current tab)
    if (tab) {
      switch (tab) {
        case 'all-data':
        case 'upload': // Redirect old upload tab to data
          setActiveTab('data');
          break;
        case 'knowledge':
          if (canAccessConfigTabs) setActiveTab('knowledge');
          break;
        case 'define-data':
        case 'define':
          if (canAccessConfigTabs) setActiveTab('define');
          break;
        case 'publishing':
          if (canAccessPublishing) setActiveTab('publishing');
          break;
        default:
          setActiveTab('data');
      }
      // Mark as interacted to prevent any future welcome flow
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      return;
    }
    
    // Check if project has any data items created (schema fields or collections)
    const hasDataItems = project.schemaFields.length > 0 || project.collections.length > 0;
    const hasUserInteracted = sessionStorage.getItem(`project-${project.id}-interacted`) === 'true';
    
    console.log(`Project ${project.id} DEBUG - hasDataItems: ${hasDataItems}, hasUserInteracted: ${hasUserInteracted}, activeTab: ${activeTab}, initialTabSet: ${initialTabSetRef.current}`);
    
    // If project has data items, disable welcome flow permanently
    if (hasDataItems) {
      console.log(`Project ${project.id} - fields: ${project.schemaFields.length}, collections: ${project.collections.length} - marking as interacted`);
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      return; // Don't change tabs if user already has data
    }
    
    // If user has interacted, don't redirect them
    if (hasUserInteracted) {
      console.log(`Project ${project.id} - user has interacted, not redirecting`);
      return;
    }
    
    // Welcome flow: redirect to define tab ONLY on very first load when no active tab is set
    if (!activeTab && !initialTabSetRef.current) {
      console.log(`Project ${project.id} - no data items, starting welcome flow - fields: ${project.schemaFields.length}, collections: ${project.collections.length}`);
      setActiveTab('define');
      initialTabSetRef.current = true;
    }
  }, [project?.id]); // Only run when project ID changes, not on every project data update

  // Project update mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      setIsEditingTitle(false);
      setIsEditingDescription(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const handleTitleEdit = () => {
    if (!canEditProject || !project) return;
    setEditTitle(project.name);
    setIsEditingTitle(true);
  };

  const handleDescriptionEdit = () => {
    if (!canEditProject || !project) return;
    setEditDescription(project.description || "");
    setIsEditingDescription(true);
  };

  const handleTitleSave = () => {
    if (!editTitle.trim()) return;
    updateProjectMutation.mutate({ name: editTitle.trim() });
  };

  const handleDescriptionSave = () => {
    updateProjectMutation.mutate({ description: editDescription.trim() });
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditTitle("");
  };

  const handleDescriptionCancel = () => {
    setIsEditingDescription(false);
    setEditDescription("");
  };

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

  // Check if we should show welcome flow (no data items exist)
  const hasDataItems = project.schemaFields.length > 0 || project.collections.length > 0;
  const showWelcomeFlow = !hasDataItems;

  const navItems = [
    { id: "data" as const, label: `All ${project.mainObjectName || "Session"}s`, icon: FlowIcon, disabled: showWelcomeFlow },
    ...(canAccessConfigTabs ? [
      { id: "knowledge" as const, label: "Knowledge/Rules", icon: TideIcon, disabled: showWelcomeFlow },
      { id: "define" as const, label: "Define Data", icon: StreamIcon, disabled: false }, // Define Data always enabled
    ] : []),
    ...(canAccessPublishing ? [
      { id: "publishing" as const, label: "Publishing", icon: ShipIcon, disabled: showWelcomeFlow },
    ] : []),
  ];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "data":
        return <AllData project={project} />;
      case "knowledge":
        return <KnowledgeRules project={project} />;
      case "define":
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={(callback) => { addCollectionCallbackRef.current = callback; }} />;
      case "publishing":
        return <Publishing project={project} />;
      default:
        return <AllData project={project} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader />
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtractlyLogo />
            <UserProfile />
          </div>
        </div>
      </div>



      {/* Main Content - Full Width */}
      <div className="flex h-[calc(100vh-168px)]">
        {/* Sidebar - Hide when activeTab is "data" */}
        {activeTab !== "data" && (
          <div className="w-72 bg-slate-50 border-r border-slate-200">
            <div className="p-4">
            <nav className="space-y-0.5">
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
                        // Mark that user has interacted with this project when they navigate manually
                        sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
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

                  {/* Add List Button */}
                  <button
                    onClick={() => {
                      if (addCollectionCallbackRef.current) {
                        addCollectionCallbackRef.current();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-600 transition-all duration-200"
                  >
                    <Plus className="h-4 w-4" />
                    Add List
                  </button>
                </nav>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={`flex-1 overflow-auto ${activeTab === "data" ? "p-0" : "p-8"} relative`}>
          {renderActiveContent()}
          
          {/* Settings Icon - Only show when activeTab is "data" and user has access */}
          {activeTab === "data" && (canAccessConfigTabs || canAccessPublishing) && (
            <div className="fixed bottom-6 left-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 shadow-lg"
                  >
                    <Settings className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  {canAccessConfigTabs && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          userNavigatedRef.current = true;
                          sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
                          setActiveTab("define");
                        }}
                        className="flex items-center gap-2"
                      >
                        <StreamIcon className="h-4 w-4" />
                        Define Data
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          userNavigatedRef.current = true;
                          sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
                          setActiveTab("knowledge");
                        }}
                        className="flex items-center gap-2"
                      >
                        <TideIcon className="h-4 w-4" />
                        Knowledge Base
                      </DropdownMenuItem>
                    </>
                  )}
                  {canAccessPublishing && (
                    <DropdownMenuItem
                      onClick={() => {
                        userNavigatedRef.current = true;
                        sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
                        setActiveTab("publishing");
                      }}
                      className="flex items-center gap-2"
                    >
                      <ShipIcon className="h-4 w-4" />
                      Publishing
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
