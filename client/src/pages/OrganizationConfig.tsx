import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Users, Settings, Plus, Trash2, KeyRound, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import Breadcrumb from "@/components/Breadcrumb";
import React from "react";

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
});

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

const resetPasswordSchema = z.object({
  tempPassword: z.string().min(6, "Temporary password must be at least 6 characters"),
});

const editUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["admin", "user"]),
});

export default function OrganizationConfig() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const organizationId = id || "";

  const { data: organizations } = useQuery({
    queryKey: ["/api/organizations"],
    enabled: user?.role === "admin",
  });

  const organization = organizations?.find((org: any) => org.id === organizationId);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users", organizationId],
    enabled: user?.role === "admin" && !!organizationId,
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/organizations/${organizationId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization updated successfully" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({ ...data, organizationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setCreateUserOpen(false);
      toast({ title: "User created successfully" });
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      return apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "User status updated successfully" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, tempPassword }: { userId: number; tempPassword: string }) => {
      return apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ userId, tempPassword }),
      });
    },
    onSuccess: (data) => {
      setResetPasswordOpen(false);
      resetPasswordForm.reset();
      toast({ 
        title: "Password Reset Successful",
        description: `Temporary password set successfully. User must change this on next login.`,
        duration: 5000,
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ userId, name, role }: { userId: number; name: string; role: string }) => {
      return apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ name, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setEditUserOpen(false);
      editUserForm.reset();
      toast({ 
        title: "User Updated",
        description: "User information updated successfully.",
      });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/organizations/${organizationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      navigate("/admin");
      toast({ title: "Organization deleted successfully" });
    },
  });

  const orgForm = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization?.name || "",
      description: organization?.description || "",
    },
  });

  const userForm = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user" as const,
    },
  });

  const resetPasswordForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      tempPassword: "",
    },
  });

  const editUserForm = useForm({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      role: "user" as const,
    },
  });

  // Update form when organization data loads
  React.useEffect(() => {
    if (organization) {
      orgForm.reset({
        name: organization.name,
        description: organization.description || "",
      });
    }
  }, [organization, orgForm]);

  if (user?.role !== "admin" || user?.organization?.type !== "primary") {
    navigate("/");
    return null;
  }

  if (!organizations) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!organization) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Organization not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col space-y-4">
            <Breadcrumb 
              items={[
                { label: "Admin Panel", href: "/admin", icon: <Settings className="h-4 w-4" /> },
                { label: organization.name }
              ]} 
            />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {organization.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Organization configuration
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...orgForm}>
                  <form onSubmit={orgForm.handleSubmit((data) => updateOrgMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={orgForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={updateOrgMutation.isPending}>
                      {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>

                <div className="pt-6 border-t">
                  <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                  {organization?.type === "primary" ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">Primary Organization</Badge>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Primary organizations cannot be deleted. You can only modify the name, description, and manage users.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Deleting this organization will permanently remove all associated users and data.
                      </p>
                      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                        <DialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Organization
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Are you sure?</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                              This action cannot be undone. This will permanently delete the organization "{organization.name}" and all associated users.
                            </p>
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => deleteOrgMutation.mutate()}
                                disabled={deleteOrgMutation.isPending}
                              >
                                {deleteOrgMutation.isPending ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Users</CardTitle>
                <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add User to {organization.name}</DialogTitle>
                      <DialogDescription>
                        Create a new user account for this organization.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={userForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                                <Input {...field} />
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
                                <Input type="password" {...field} />
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? "Creating..." : "Add User"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : (
                  <div className="space-y-0">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 items-center p-4 border-b bg-gray-50 font-medium text-sm text-gray-700">
                      <div className="col-span-4">User</div>
                      <div className="col-span-2">Role</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-4 text-right">Actions</div>
                    </div>
                    {users?.map((user: any) => (
                      <div
                        key={user.id}
                        className="grid grid-cols-12 gap-4 items-center p-4 border-b hover:bg-gray-50"
                      >
                        {/* User Info - Takes up 4 columns */}
                        <div className="col-span-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-sm text-gray-600">{user.email}</span>
                          </div>
                        </div>
                        
                        {/* Role Badge - Takes up 2 columns */}
                        <div className="col-span-2">
                          <Badge 
                            variant={user.role === "admin" ? "default" : "secondary"}
                            className={user.role === "admin" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                          >
                            {user.role}
                          </Badge>
                        </div>
                        
                        {/* Status - Takes up 2 columns */}
                        <div className="col-span-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Active</span>
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) =>
                                toggleUserActiveMutation.mutate({
                                  userId: user.id,
                                  isActive: checked,
                                })
                              }
                            />
                          </div>
                        </div>
                        
                        {/* Actions - Takes up 4 columns, aligned to the right */}
                        <div className="col-span-4 flex items-center justify-end space-x-2">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              editUserForm.setValue("name", user.name);
                              editUserForm.setValue("role", user.role);
                              setEditUserOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setResetPasswordOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            Reset Password
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for this user. They will be required to change it on their next login.
            </DialogDescription>
          </DialogHeader>
          <Form {...resetPasswordForm}>
            <form
              onSubmit={resetPasswordForm.handleSubmit((data) => {
                if (selectedUserId) {
                  resetPasswordMutation.mutate({
                    userId: selectedUserId,
                    tempPassword: data.tempPassword,
                  });
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={resetPasswordForm.control}
                name="tempPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter temporary password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetPasswordOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editUserForm}>
            <form
              onSubmit={editUserForm.handleSubmit((data) => {
                if (selectedUser) {
                  editUserMutation.mutate({
                    userId: selectedUser.id,
                    name: data.name,
                    role: data.role,
                  });
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={editUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter user name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUserOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editUserMutation.isPending}>
                  {editUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}