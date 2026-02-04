import { Calendar, Settings, Trash2, Copy, Building, Users, Database, CheckCircle, AlertTriangle, TrendingUp, MoveLeft, MoveRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeleteProject, useDuplicateProject, useUpdateProjectStatus } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { ProjectWithAuthor, Organization, ProjectWithDetails, FieldValidation } from "@shared/schema";


interface ProjectCardProps {
  project: ProjectWithAuthor;
  onSwapLeft?: (projectId: string) => void;
  onSwapRight?: (projectId: string) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}

export default function ProjectCard({ 
  project, 
  onSwapLeft, 
  onSwapRight, 
  canMoveLeft = false, 
  canMoveRight = false 
}: ProjectCardProps) {
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();
  const updateProjectStatus = useUpdateProjectStatus();
  const { toast } = useToast();
  const { user } = useAuth();


  // Fetch project details with sessions
  const { data: projectDetails } = useQuery<ProjectWithDetails>({
    queryKey: ["/api/projects", project.id],
  });

  // Fetch validation data for all sessions
  const { data: allValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', project.id],
    queryFn: async () => {
      if (!projectDetails?.sessions) return [];
      const validations: FieldValidation[] = [];
      for (const session of projectDetails.sessions) {
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
    enabled: !!projectDetails?.sessions && projectDetails.sessions.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

  // Get verification status for a session
  const getVerificationStatus = (sessionId: string): 'verified' | 'in_progress' | 'pending' => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    return allVerified ? 'verified' : 'in_progress';
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const stats = { verified: 0, unverified: 0, total: 0 };
    
    if (projectDetails?.sessions) {
      for (const session of projectDetails.sessions) {
        const status = getVerificationStatus(session.id);
        stats.total++;
        if (status === 'verified') {
          stats.verified++;
        } else {
          stats.unverified++;
        }
      }
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  const handleDelete = async () => {
    // Prevent double-clicks by disabling the delete dialog immediately
    setDeleteDialogOpen(false);
    
    try {
      await deleteProject.mutateAsync(project.id);
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
    } catch (error: any) {
      // More specific error handling
      const errorMessage = error?.response?.status === 404 
        ? "Project has already been deleted." 
        : "Failed to delete the project. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    
    setDuplicateDialogOpen(false);
    
    try {
      await duplicateProject.mutateAsync({ 
        id: project.id, 
        name: duplicateName.trim() 
      });
      toast({
        title: "Project duplicated",
        description: "The project has been successfully duplicated.",
      });
      setDuplicateName("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to duplicate the project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (newStatus: "active" | "inactive") => {
    try {
      await updateProjectStatus.mutateAsync({ 
        id: project.id, 
        status: newStatus 
      });
      // Status update successful - UI will update automatically via React Query
    } catch (error: any) {
      console.error('Failed to update project status:', error);
    }
  };

  const openDuplicateDialog = () => {
    setDuplicateName(`${project.name} (Copy)`);
    setDuplicateDialogOpen(true);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <Card className={`bg-white dark:bg-gray-800 text-black dark:text-gray-100 rounded-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group relative overflow-hidden h-[200px] flex flex-col ${
        project.status === "inactive" ? "opacity-60" : ""
      }`} style={{
        border: '1px solid #a8b5d1',
        boxShadow: '0 4px 8px -2px rgba(168, 181, 209, 0.15), 2px 0 6px -1px rgba(168, 181, 209, 0.1)'
      }}>
        <CardHeader className="pt-4 pb-2 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 flex flex-col" onClick={() => setLocation(`/projects/${project.id}`)}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-lg font-bold transition-colors line-clamp-1 text-[#071d54] dark:text-white">
                  {project.name}
                </CardTitle>
              </div>
              {project.description && (
                <p className="text-xs font-normal text-black/70 dark:text-gray-400 leading-tight whitespace-pre-wrap break-words">
                  {project.description}
                </p>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-1">
              {/* Settings Dropdown - Only show to admin users */}
              {user?.role === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-black dark:text-gray-300 hover:bg-black/10 dark:hover:bg-gray-700 flex-shrink-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canMoveLeft && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        console.log('Move Left clicked for project:', project.id);
                        onSwapLeft?.(project.id);
                      }}>
                        <MoveLeft className="h-4 w-4 mr-2" />
                        Move Left
                      </DropdownMenuItem>
                    )}
                    {canMoveRight && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        console.log('Move Right clicked for project:', project.id);
                        onSwapRight?.(project.id);
                      }}>
                        <MoveRight className="h-4 w-4 mr-2" />
                        Move Right
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={openDuplicateDialog}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(project.status === "active" || !project.status ? "inactive" : "active");
                      }}
                      className={project.status === "active" || !project.status ? "text-orange-600" : "text-green-600"}
                    >
                      {project.status === "active" || !project.status ? (
                        <>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        
        {/* Flexible middle area */}
        <div className="flex-1" onClick={() => setLocation(`/projects/${project.id}`)} />
        
        {/* Fixed bottom area */}
        <CardContent className="pb-4 flex-shrink-0 relative bg-white dark:bg-gray-800" onClick={() => setLocation(`/projects/${project.id}`)}>
          {/* Created date - positioned above stats */}
          <div className="text-xs font-medium text-black/60 dark:text-gray-400 mb-2 space-y-0.5 italic">
            <div><span className="font-bold">Author:</span> {project.creatorName || 'Unknown'}</div>
            <div><span className="font-bold">Organization:</span> {project.creatorOrganizationName || 'Unknown'}</div>
            <div><span className="font-bold">Created:</span> {formatDate(project.createdAt)}</div>
          </div>
          
          {/* Bottom row with stats and wave only */}
          <div className="flex items-center justify-between pr-20">
            {/* Left side - Session stats */}
            <div className="flex items-center gap-3">
              {/* Total Sessions */}
              <div className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-black/70 dark:text-gray-400" />
                <span className="text-sm font-medium text-black dark:text-gray-200">{verificationStats.total}</span>
              </div>
              
              {/* Verified Sessions */}
              {verificationStats.verified > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                  <span className="text-sm font-medium text-black dark:text-gray-200">{verificationStats.verified}</span>
                </div>
              )}
              
              {/* Unverified Sessions */}
              {verificationStats.unverified > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm font-medium text-black dark:text-gray-200">{verificationStats.unverified}</span>
                </div>
              )}
            </div>
            

          </div>
          
        </CardContent>
        
        {/* Fade to white gradient overlay at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/50 dark:from-gray-800/50 to-transparent pointer-events-none" />
        
        {/* Deactivated overlay */}
        {project.status === "inactive" && (
          <div className="absolute inset-0 bg-gray-500/60 flex flex-col items-center justify-center z-10">
            <div className="text-white text-2xl font-bold mb-4 tracking-wide">
              DEACTIVATED
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange("active");
              }}
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 bg-white hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Reactivate
            </Button>
          </div>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone and will permanently delete all associated data, schema fields, collections, and sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Project</DialogTitle>
            <DialogDescription>
              Create a copy of "{project.name}" with all schema fields, collections, and extraction rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter name for duplicated project"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && duplicateName.trim()) {
                    handleDuplicate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateName.trim() || duplicateProject.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {duplicateProject.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
