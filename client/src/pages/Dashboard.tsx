/**
 * Dashboard Page - Main Application Landing
 * 
 * Primary interface for users after login, displaying project overview and management.
 * Features project grid, statistics cards, search/filtering, and project creation.
 * 
 * Key Features:
 * - Project grid with drag-and-drop reordering
 * - Real-time statistics (sessions, documents, validations)
 * - Search and filter functionality (active/deactivated projects)
 * - Project creation dialog
 * - User profile and settings access
 * 
 * Data Sources:
 * - useProjects: Project list with details
 * - useDashboardStatistics: Aggregated platform statistics
 * - useAuth: Current user context and permissions
 * 
 * Navigation:
 * - Links to individual project views
 * - Admin panel access for admin users
 * - Session management and organization settings
 */

import { Plus, Settings, Search, LayoutDashboard, Shield, Database, AlertTriangle, CheckCircle2, CheckCircle, TrendingUp } from "lucide-react";
import { WaveIcon, DropletIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useDashboardStatistics } from "@/hooks/useDashboardStatistics";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/hooks/usePageTitle";

import ProjectCard from "@/components/ProjectCard";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import UserProfile from "@/components/UserProfile";
import ExtraplLogo from "@/components/ExtraplLogo";
import DarkModeToggle from "@/components/DarkModeToggle";


export default function Dashboard() {
  usePageTitle("Dashboard");
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const { data: projects, isLoading, error } = useProjects();
  const { data: statistics, isLoading: statisticsLoading } = useDashboardStatistics();
  const { user } = useAuth();
  const [, navigate] = useLocation();


  // Load saved project order from user's profile
  useMemo(() => {
    if (user?.projectOrder && Array.isArray(user.projectOrder)) {
      setProjectOrder(user.projectOrder);
    }
  }, [user?.projectOrder]);

  // Save project order effect
  const saveProjectOrder = async (newOrder: string[]) => {
    try {
      if (!user?.id) return;
      await apiRequest(`/api/users/${user.id}/project-order`, {
        method: 'PUT',
        body: JSON.stringify({ projectOrder: newOrder })
      });
    } catch (error) {
      console.error("Failed to save project order:", error);
    }
  };



  // Direct role checks for security - never use local const for admin checks
  const isPrimaryOrgAdmin = user?.role === "admin" && user?.organization?.type === "primary";

  // Filter projects based on search query and showDeactivated checkbox
  const baseFilteredProjects = projects?.filter(project => {
    // For non-admin users, always hide deactivated projects
    // For admin users, respect the showDeactivated checkbox
    const statusFilter = user?.role === "admin" 
      ? (showDeactivated ? true : project.status !== "inactive")
      : project.status !== "inactive";
    
    // Then filter by search query
    if (!searchQuery.trim()) {
      return statusFilter;
    }
    
    const query = searchQuery.toLowerCase();
    const nameMatch = project.name.toLowerCase().includes(query);
    const descriptionMatch = project.description?.toLowerCase().includes(query);
    
    return statusFilter && (nameMatch || descriptionMatch);
  }) || [];

  // Apply custom ordering
  const filteredProjects = useMemo(() => {
    if (!baseFilteredProjects || baseFilteredProjects.length === 0) return [];
    if (projectOrder.length === 0) return baseFilteredProjects;
    
    // Sort according to projectOrder, then append any new projects not in the order
    const ordered = [];
    const remaining = [...baseFilteredProjects];
    
    // Add projects in the specified order
    for (const projectId of projectOrder) {
      const projectIndex = remaining.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        ordered.push(remaining.splice(projectIndex, 1)[0]);
      }
    }
    
    // Add any remaining projects that weren't in the order
    ordered.push(...remaining);
    
    return ordered;
  }, [baseFilteredProjects, projectOrder]);

  // Swap functionality
  const handleSwapLeft = (projectId: string) => {
    if (!filteredProjects) return;
    
    const currentIndex = filteredProjects.findIndex(p => p.id === projectId);
    if (currentIndex <= 0) return; // Can't move left if it's the first item
    
    // Create new order based on current filtered projects
    const newOrder = filteredProjects.map(p => p.id);
    // Swap with the item to the left
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = 
    [newOrder[currentIndex], newOrder[currentIndex - 1]];
    
    setProjectOrder(newOrder);
    saveProjectOrder(newOrder);
    console.log(`Swapping project ${projectId} left`);
  };

  const handleSwapRight = (projectId: string) => {
    if (!filteredProjects) return;
    
    const currentIndex = filteredProjects.findIndex(p => p.id === projectId);
    if (currentIndex >= filteredProjects.length - 1) return; // Can't move right if it's the last item
    
    // Create new order based on current filtered projects
    const newOrder = filteredProjects.map(p => p.id);
    // Swap with the item to the right
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = 
    [newOrder[currentIndex + 1], newOrder[currentIndex]];
    
    setProjectOrder(newOrder);
    saveProjectOrder(newOrder);
    console.log(`Swapping project ${projectId} right`);
  };

  const renderProjectsContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-48">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredProjects && filteredProjects.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project, index) => (
            <ProjectCard 
              key={project.id} 
              project={project}
              onSwapLeft={handleSwapLeft}
              onSwapRight={handleSwapRight}
              canMoveLeft={index > 0}
              canMoveRight={index < filteredProjects.length - 1}
            />
          ))}
        </div>
      );
    }

    // Check if there are projects but they're all filtered out
    if (projects && projects.length > 0 && filteredProjects.length === 0) {
      const hasSearchQuery = searchQuery.trim();
      const hasActiveProjects = projects.some(p => p.status !== "inactive");
      
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-secondary/20 rounded-full flex items-center justify-center mb-4">
            <WaveIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {hasSearchQuery ? "No matching projects" : "No active projects"}
          </h3>
          <p className="text-gray-600 mb-6">
            {hasSearchQuery 
              ? "Try adjusting your search or check 'Show Deactivated' to see more projects."
              : hasActiveProjects 
                ? "All projects are currently deactivated. Check 'Show Deactivated' to view them."
                : "All projects are currently deactivated."
            }
          </p>
        </div>
      );
    }

    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-secondary/20 rounded-full flex items-center justify-center mb-4">
          <WaveIcon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No projects yet
        </h3>
        <p className="text-gray-600 mb-6">
          {user?.role === "admin" 
            ? "Get started by creating your first data extraction project"
            : "Contact your administrator to create projects"
          }
        </p>
        {user?.role === "admin" && (
          <Button
            onClick={() => setCreateDialogOpen(true)}
          >
            <DropletIcon className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 mb-2">Error Loading Projects</h2>
              <p className="text-sm text-gray-600">
                Failed to load projects. Please try again later.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Fixed Header - Updated Layout */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <ExtraplLogo />
            <div className="flex items-center space-x-4">
              {isPrimaryOrgAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DarkModeToggle />
              <UserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Dashboard Header and Controls */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Page Title and Statistics */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="h-8 w-8 text-primary" />
                <h2 className="text-3xl font-bold">Dashboard</h2>
              </div>
              
              {/* Statistics Cards */}
              <div className="flex items-center space-x-4">
                {statisticsLoading ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-8" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-8" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-8" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-8" />
                    </div>
                  </>
                ) : statistics ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-primary" />
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{statistics?.totalProjects || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Database className="h-6 w-6 text-slate-700 dark:text-slate-400" />
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{statistics?.totalSessions || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{statistics?.unverifiedSessions || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{statistics?.verifiedSessions || 0}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          
          {/* Controls Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Search Box positioned to the left */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search projects"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-80"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Filter Controls - Only show to admin users */}
              {user?.role === "admin" && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-deactivated"
                    checked={showDeactivated}
                    onCheckedChange={(checked) => setShowDeactivated(checked === true)}
                  />
                  <Label 
                    htmlFor="show-deactivated"
                    className="text-sm text-gray-600 cursor-pointer"
                  >
                    Show Deactivated
                  </Label>
                </div>
              )}
              {user?.role === "admin" && (
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 px-3 py-1.5 h-8"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Project Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {renderProjectsContent()}
        </div>
        
        {/* Blue footer with fade */}
        <div className="h-32 bg-gradient-to-t from-blue-50 to-white dark:from-gray-800 dark:to-gray-900"></div>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}