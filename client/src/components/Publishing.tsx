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
        description: "Project has been successfully published to the organization.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to publish",
        description: "Could not publish project to organization. Please try again.",
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
        description: "Project has been removed from the organization.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to unpublish",
        description: "Could not remove project from organization. Please try again.",
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
    <div className="space-y-8 bg-slate-900 dark:bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-100 dark:text-gray-100">Project Publishing</h2>
        <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
          Manage which organizations have access to this project
        </p>
      </div>

      {/* Publish to New Organization */}
      <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100 dark:text-gray-100">
            <Plus className="h-5 w-5 text-blue-400" />
            Publish to Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-300 dark:text-gray-300">
          <div>
            <Label htmlFor="organization-select" className="text-gray-200 dark:text-gray-200">Select Organization</Label>
            <div className="flex gap-3 mt-2">
              <Select value={selectedOrganizationId} onValueChange={setSelectedOrganizationId}>
                <SelectTrigger className="flex-1 bg-slate-700 border-slate-600 text-gray-300">
                  <SelectValue placeholder="Choose an organization..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {availableOrganizations.map((org: Organization) => (
                    <SelectItem key={org.id} value={org.id} className="text-gray-300 hover:bg-slate-600">
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handlePublish}
                disabled={!selectedOrganizationId || publishMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>
          
          {availableOrganizations.length === 0 && (
            <div className="text-sm text-gray-400 bg-slate-700 p-3 rounded">
              All organizations already have access to this project.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Published Organizations */}
      <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100 dark:text-gray-100">
            <Building className="h-5 w-5 text-green-400" />
            Published Organizations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-300 dark:text-gray-300">
          {publishedOrganizations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-100 dark:text-gray-100">No organizations</h3>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-400">
                This project hasn't been published to any organizations yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedOrganizations.map((org: Organization) => (
                <div key={org.id} className="flex items-center justify-between p-4 border border-slate-600 rounded-lg bg-slate-750 dark:bg-slate-750">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${
                      org.type === 'primary' 
                        ? 'bg-slate-600' 
                        : 'bg-blue-900'
                    }`}>
                      <Building className={`h-5 w-5 ${
                        org.type === 'primary' 
                          ? 'text-gray-300' 
                          : 'text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-100 dark:text-gray-100">{org.name}</h4>
                      {org.description && (
                        <p className="text-sm text-gray-400 dark:text-gray-400">{org.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-900 text-green-300 border-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpublish(org.id)}
                      disabled={unpublishMutation.isPending}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900 border-red-700"
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
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Access Rules</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Users from published organizations can view and work with this project</li>
                <li>• Users from your primary organization (Internal) always have access</li>
                <li>• Project data remains secure within authorized organizations only</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}