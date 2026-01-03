import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Building, Users, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectWithDetails, Organization } from "@shared/schema";

interface PublishingProps {
  project: ProjectWithDetails;
}

export default function Publishing({ project }: PublishingProps) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all organizations
  const { data: allOrganizations = [], isLoading: organizationsLoading } = useQuery({
    queryKey: ["/api/organizations"],
  });

  // Get published organizations for this project
  const { data: publishedOrganizations = [], isLoading: publishedLoading } = useQuery({
    queryKey: ["/api/projects", project.id, "publishing"],
  });

  // Mutation to publish project to organization
  const publishMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest(`/api/projects/${project.id}/publishing`, {
        method: "POST",
        body: JSON.stringify({ organizationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "publishing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); // Invalidate dashboard projects cache
      setSelectedOrganizationId("");
      toast({
        title: "Project published",
        description: "Project has been successfully published to the team.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to publish",
        description: "Could not publish project to team. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to unpublish project from organization
  const unpublishMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest(`/api/projects/${project.id}/publishing/${organizationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "publishing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); // Invalidate dashboard projects cache
      toast({
        title: "Project unpublished",
        description: "Project has been removed from the team.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to unpublish",
        description: "Could not remove project from team. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter available organizations (exclude already published ones)
  const availableOrganizations = allOrganizations.filter(
    (org: Organization) => !publishedOrganizations.some((pub: Organization) => pub.id === org.id)
  );

  const handlePublish = () => {
    if (selectedOrganizationId) {
      publishMutation.mutate(selectedOrganizationId);
    }
  };

  const handleUnpublish = (organizationId: string) => {
    unpublishMutation.mutate(organizationId);
  };

  if (organizationsLoading || publishedLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          <span style={{ color: '#4F63A4' }}>•</span> Publish
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage which teams have access to this project
        </p>
      </div>

      {/* Publish to New Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Publish to Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="organization-select">Select Team</Label>
            <div className="flex gap-3 mt-2">
              <Select value={selectedOrganizationId} onValueChange={setSelectedOrganizationId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOrganizations.map((org: Organization) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handlePublish}
                disabled={!selectedOrganizationId || publishMutation.isPending}
                className=""
              >
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>
          
          {availableOrganizations.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
              All teams already have access to this project.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Published Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-green-600" />
            Published Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {publishedOrganizations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No teams</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                This project hasn't been published to any teams yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedOrganizations.map((org: Organization) => (
                <div key={org.id} className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${
                      org.type === 'primary' 
                        ? 'bg-gray-100 dark:bg-gray-700' 
                        : 'bg-blue-100 dark:bg-blue-900/50'
                    }`}>
                      <Building className={`h-5 w-5 ${
                        org.type === 'primary' 
                          ? 'text-black dark:text-white' 
                          : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{org.name}</h4>
                      {org.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{org.description}</p>
                      )}
                      {org.type === 'primary' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Primary</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpublish(org.id)}
                      disabled={unpublishMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">Access Rules</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-400">
                <li>• Users from published teams can view and work with this project</li>
                <li>• Users from your primary team (Internal) always have access</li>
                <li>• Project data remains secure within authorized teams only</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}