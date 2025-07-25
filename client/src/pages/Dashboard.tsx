import { Plus, Settings, Search, LayoutDashboard, Shield, Database, AlertTriangle, CheckCircle2, CheckCircle, FileText } from "lucide-react";
import { WaveIcon, DropletIcon } from "@/components/SeaIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useDashboardStatistics } from "@/hooks/useDashboardStatistics";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import ProjectCard from "@/components/ProjectCard";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import UserProfile from "@/components/UserProfile";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import WavePattern from "@/components/WavePattern";

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: projects, isLoading, error } = useProjects();
  const { data: statistics, isLoading: statisticsLoading } = useDashboardStatistics();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role === "admin";
  const isPrimaryOrgAdmin = user?.role === "admin" && user?.organization?.type === "primary";

  // Filter projects based on search query and showDeactivated checkbox
  const filteredProjects = projects?.filter(project => {
    // For non-admin users, always hide deactivated projects
    // For admin users, respect the showDeactivated checkbox
    const statusFilter = isAdmin 
      ? (showDeactivated ? true : project.status !== "inactive")
      : project.status !== "inactive";
    
    // Then filter by search query
    if (!searchQuery.trim()) {
      return statusFilter;
    }
    
    const query = searchQuery.toLowerCase();
    const nameMatch = project.name.toLowerCase().includes(query);
    const descriptionMatch = project.description?.toLowerCase().includes(query);
    
    // Check published organizations
    const orgMatch = project.publishedOrganizations?.some(org => 
      org.name.toLowerCase().includes(query)
    );
    
    return statusFilter && (nameMatch || descriptionMatch || orgMatch);
  }) || [];

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
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
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
          {isAdmin 
            ? "Get started by creating your first data extraction project"
            : "Contact your administrator to create projects"
          }
        </p>
        {isAdmin && (
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Fixed Header - Updated Layout */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <ExtractlyLogo />
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
              <UserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Dashboard Header and Controls */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
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
                    <Card className="w-32 h-16">
                      <CardContent className="p-3">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-6 w-8" />
                      </CardContent>
                    </Card>
                    <Card className="w-32 h-16">
                      <CardContent className="p-3">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-6 w-8" />
                      </CardContent>
                    </Card>
                    <Card className="w-32 h-16">
                      <CardContent className="p-3">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-6 w-8" />
                      </CardContent>
                    </Card>
                    <Card className="w-32 h-16">
                      <CardContent className="p-3">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-6 w-8" />
                      </CardContent>
                    </Card>
                  </>
                ) : statistics ? (
                  <>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="flex items-center p-3">
                        <FileText className="h-5 w-5 text-primary mr-2" />
                        <div>
                          <p className="text-xs text-primary font-medium">Projects</p>
                          <p className="text-lg font-bold text-primary">{statistics.totalProjects}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="flex items-center p-3">
                        <Database className="h-5 w-5 text-slate-700 mr-2" />
                        <div>
                          <p className="text-lg font-bold text-slate-700">{statistics.totalSessions}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="flex items-center p-3">
                        <CheckCircle className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <p className="text-lg font-bold text-red-800">{statistics.unverifiedSessions}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="flex items-center p-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="text-lg font-bold text-green-800">{statistics.verifiedSessions}</p>
                        </div>
                      </CardContent>
                    </Card>
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
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-deactivated"
                    checked={showDeactivated}
                    onCheckedChange={setShowDeactivated}
                  />
                  <Label 
                    htmlFor="show-deactivated"
                    className="text-sm text-gray-600 cursor-pointer"
                  >
                    Show Deactivated
                  </Label>
                </div>
              )}
              {isAdmin && (
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
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
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {renderProjectsContent()}
        </div>
        
        {/* Blue footer with fade */}
        <div className="h-32 bg-gradient-to-t from-blue-50 to-white"></div>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}