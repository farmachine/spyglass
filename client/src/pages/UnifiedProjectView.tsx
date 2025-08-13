import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Database, Brain, Settings, FolderOpen, Home as HomeIcon, TrendingUp, Edit3, Check, X, AlertTriangle, CheckCircle, User, List, Plus, Cog } from "lucide-react";
import { WaveIcon, FlowIcon, StreamIcon, TideIcon, ShipIcon, DropletIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { ProjectWithDetails, FieldValidation } from "@shared/schema";
import AllData from "@/components/AllData";
import KnowledgeRules from "@/components/KnowledgeRules";
import DefineData from "@/components/DefineData";
import Publishing from "@/components/Publishing";
import UserProfile from "@/components/UserProfile";
import Breadcrumb from "@/components/Breadcrumb";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import WavePattern from "@/components/WavePattern";
import { AppHeader } from "@/components/AppHeader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Import SessionView components we'll need
import SessionView from "./SessionView";

interface UnifiedProjectViewProps {
  projectId: string;
  sessionId?: string;
}

type ActiveTab = "sessions" | "session-detail";
type SettingsTab = "knowledge" | "define" | "publishing";

export default function UnifiedProjectView() {
  const { id: projectId, sessionId } = useParams();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("sessions");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab | null>(null);
  const [schemaActiveTab, setSchemaActiveTab] = useState<string>("main-data");
  const addCollectionCallbackRef = useRef<(() => void) | null>(null);
  const { data: project, isLoading, error } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    enabled: !!projectId
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Check user role for access control
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;
  const canEditProject = isAdmin;

  // Effect to handle URL changes
  useEffect(() => {
    if (sessionId) {
      setActiveTab("session-detail");
    } else {
      setActiveTab("sessions");
    }
  }, [sessionId]);

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

  // Project update mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (updates: { name?: string; description?: string }) => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
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

  const handleSessionSelect = (sessionId: string) => {
    setLocation(`/projects/${projectId}/sessions/${sessionId}`);
  };

  const handleBackToSessions = () => {
    setLocation(`/projects/${projectId}`);
  };

  const handleSettingsClick = (settingsTab: SettingsTab) => {
    setActiveSettingsTab(settingsTab);
  };

  const closeSettings = () => {
    setActiveSettingsTab(null);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 mb-2">Error Loading Project</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
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
        <AppHeader />
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Project Not Found</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
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
  const hasDataItems = project.schemaFields.length > 0 || project.collections.length > 0;
  const showWelcomeFlow = !hasDataItems;

  // Render settings modal content
  const renderSettingsContent = () => {
    if (!activeSettingsTab) return null;

    switch (activeSettingsTab) {
      case "knowledge":
        return <KnowledgeRules project={project} />;
      case "define":
        return <DefineData project={project} activeTab={schemaActiveTab} onTabChange={setSchemaActiveTab} onSetAddCollectionCallback={(callback) => { addCollectionCallbackRef.current = callback; }} />;
      case "publishing":
        return <Publishing project={project} />;
      default:
        return null;
    }
  };

  // If we're in session detail mode, show the session view
  if (activeTab === "session-detail" && sessionId) {
    return <SessionView />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Project Title */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="w-full px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 mr-6">
              <TrendingUp className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1 space-y-2">
                {/* Project Title */}
                <div className="flex items-center space-x-2">
                  {isEditingTitle ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-2xl font-bold border-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleTitleSave();
                          if (e.key === 'Escape') handleTitleCancel();
                        }}
                        autoFocus
                      />
                      <Button onClick={handleTitleSave} size="sm" disabled={!editTitle.trim()}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleTitleCancel} variant="outline" size="sm">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                      {canEditProject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleTitleEdit}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Project Description */}
                <div className="flex items-start space-x-2">
                  {isEditingDescription ? (
                    <div className="flex items-start space-x-2 flex-1">
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="resize-none border-primary"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleDescriptionSave();
                          }
                          if (e.key === 'Escape') handleDescriptionCancel();
                        }}
                        autoFocus
                      />
                      <div className="flex flex-col space-y-1 mt-1">
                        <Button onClick={handleDescriptionSave} size="sm">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleDescriptionCancel} variant="outline" size="sm">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2 flex-1 group">
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        {project.description || "Click to add description..."}
                      </p>
                      {canEditProject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDescriptionEdit}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{project.sessions?.length || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {project.mainObjectName || "Session"}s
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {allValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Verified</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {allValidations.filter(v => v.validationStatus === 'pending').length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-160px)]">
        {/* Left Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-6">
            {/* Main Navigation */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <FlowIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {project.mainObjectName || "Session"}s
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              {/* General Information - Greyed out */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 px-3 py-2 opacity-50 cursor-not-allowed">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">General Information</span>
                </div>

                {/* Collections - Greyed out */}
                {project.collections && project.collections.length > 0 && (
                  <div className="ml-6 space-y-1">
                    {project.collections.map((collection) => (
                      <div key={collection.id} className="flex items-center space-x-2 px-3 py-1 opacity-50 cursor-not-allowed">
                        <List className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{collection.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <AllData project={project} />
        </div>
      </div>

      {/* Settings Wheel - Bottom Left */}
      <div className="fixed bottom-6 left-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full h-12 w-12 shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <Cog className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-56">
            {canAccessConfigTabs && (
              <>
                <DropdownMenuItem onClick={() => handleSettingsClick("knowledge")}>
                  <TideIcon className="h-4 w-4 mr-2" />
                  Knowledge/Rules
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSettingsClick("define")}>
                  <StreamIcon className="h-4 w-4 mr-2" />
                  Define Data
                </DropdownMenuItem>
              </>
            )}
            {canAccessPublishing && (
              <DropdownMenuItem onClick={() => handleSettingsClick("publishing")}>
                <ShipIcon className="h-4 w-4 mr-2" />
                Publishing
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Settings Modal */}
      {activeSettingsTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeSettingsTab === "knowledge" && "Knowledge Base & Rules"}
                {activeSettingsTab === "define" && "Define Data Schema"}
                {activeSettingsTab === "publishing" && "Publishing Settings"}
              </h2>
              <Button variant="ghost" size="sm" onClick={closeSettings}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {renderSettingsContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}