import { Settings, Home, Users, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const { data: organizations, isLoading } = useQuery({
    queryKey: ["/api/organizations"],
    enabled: user?.role === "admin",
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/organizations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setCreateOrgOpen(false);
      orgForm.reset();
      toast({ title: "Organization created successfully" });
    },
  });

  const orgForm = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  if (user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const totalUsers = organizations?.reduce((sum: number, org: any) => sum + (org.userCount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col space-y-4">
            <Breadcrumb 
              items={[
                { label: "Admin Panel", icon: <Settings className="h-4 w-4" /> }
              ]} 
            />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Admin Panel
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage organizations and users
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Organizations Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Total organizations
              </p>
            </CardContent>
          </Card>

          {/* Users Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Total users across all organizations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Organizations List */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Organizations</CardTitle>
            <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Building2 className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Organization</DialogTitle>
                  <DialogDescription>
                    Create a new organization to manage users and projects.
                  </DialogDescription>
                </DialogHeader>
                <Form {...orgForm}>
                  <form onSubmit={orgForm.handleSubmit((data) => createOrgMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={orgForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ACME Corporation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={orgForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Brief description of the organization" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCreateOrgOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createOrgMutation.isPending}>
                        {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-4">
                {organizations
                  ?.sort((a: any, b: any) => {
                    // Primary organizations first
                    if (a.type === 'primary' && b.type !== 'primary') return -1;
                    if (b.type === 'primary' && a.type !== 'primary') return 1;
                    return 0;
                  })
                  ?.map((org: any) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${
                        org.type === 'primary' 
                          ? 'bg-gray-100' 
                          : 'bg-blue-100'
                      }`}>
                        <Building2 className={`h-5 w-5 ${
                          org.type === 'primary' 
                            ? 'text-black' 
                            : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-medium">{org.name}</h3>
                        <p className="text-sm text-gray-600">{org.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {org.userCount || 0} users
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/organizations/${org.id}`)}
                        className="p-2"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}