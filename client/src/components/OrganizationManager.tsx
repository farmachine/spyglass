import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, Users, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Organization, InsertOrganization, User, InsertUser } from "@shared/schema";

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
});

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;
type UserFormData = z.infer<typeof userSchema>;

export default function OrganizationManager() {
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["/api/organizations"],
  });

  // Fetch users for selected organization
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users", selectedOrganization?.id],
    queryFn: () => fetch(`/api/users/${selectedOrganization?.id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      },
    }).then(res => res.json()),
    enabled: !!selectedOrganization,
  });

  // Organization form
  const orgForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // User form
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user",
    },
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: (data: OrganizationFormData) =>
      apiRequest("/api/organizations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setShowOrgDialog(false);
      orgForm.reset();
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: UserFormData & { organizationId: number }) =>
      apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedOrganization?.id] });
      setShowUserDialog(false);
      userForm.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onCreateOrganization = (data: OrganizationFormData) => {
    createOrgMutation.mutate(data);
  };

  const onCreateUser = (data: UserFormData) => {
    if (!selectedOrganization) return;
    createUserMutation.mutate({
      ...data,
      organizationId: selectedOrganization.id,
    });
  };

  if (orgsLoading) {
    return <div className="p-6">Loading organizations...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organization Management</h1>
          <p className="text-muted-foreground">Manage organizations and users</p>
        </div>
        <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <Form {...orgForm}>
              <form onSubmit={orgForm.handleSubmit(onCreateOrganization)} className="space-y-4">
                <FormField
                  control={orgForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter organization name" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter description (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowOrgDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createOrgMutation.isPending}>
                    {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="users" disabled={!selectedOrganization}>
            Users {selectedOrganization && `(${selectedOrganization.name})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org: Organization) => (
              <Card 
                key={org.id} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedOrganization?.id === org.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedOrganization(org)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Building2 className="h-5 w-5 text-primary" />
                    <Badge variant="secondary">
                      {org.id === 1 ? "Primary" : "Standard"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {org.description || "No description"}
                  </CardDescription>
                  <div className="mt-4 text-sm text-muted-foreground">
                    Created: {new Date(org.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {selectedOrganization && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Users in {selectedOrganization.name}
                  </h2>
                  <p className="text-muted-foreground">
                    Manage users for this organization
                  </p>
                </div>
                <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add User to {selectedOrganization.name}</DialogTitle>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit(onCreateUser)} className="space-y-4">
                        <FormField
                          control={userForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter email address" type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter password" type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <FormControl>
                                <select className="w-full p-2 border rounded" {...field}>
                                  <option value="user">User</option>
                                  <option value="admin">Administrator</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowUserDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? "Adding..." : "Add User"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {usersLoading ? (
                <div>Loading users...</div>
              ) : (
                <div className="grid gap-4">
                  {users.map((user: User) => (
                    <Card key={user.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">{user.name}</h3>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role === "admin" ? "Administrator" : "User"}
                            </Badge>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}