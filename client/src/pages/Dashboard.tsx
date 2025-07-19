import { Plus, Settings, Search, LayoutDashboard } from "lucide-react";
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
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role === "admin";

  // Filter projects based on search query and showDeactivated checkbox
  const filteredProjects = projects?.filter(project => {
    // First filter by deactivated status
    const statusFilter = showDeactivated ? true : project.status !== "inactive";
    
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
          Get started by creating your first data extraction project
        </p>
        <Button
          onClick={() => setCreateDialogOpen(true)}
        >
          <DropletIcon className="h-4 w-4 mr-2" />
          Create Project
        </Button>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <ExtractlyLogo />
            <div className="flex items-center space-x-4">
              {isAdmin && (
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Page Title */}
          <div className="py-6">
            <div className="flex items-center space-x-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold">Dashboard</h2>
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
                  placeholder="Search projects by name, description, or organization..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-80"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Filter Controls */}
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
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
          
          {renderProjectsContent()}
        </div>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}