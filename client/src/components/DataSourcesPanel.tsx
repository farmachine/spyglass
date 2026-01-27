import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, Database, CheckCircle, XCircle, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import type { ApiDataSource } from "@shared/schema";

interface DataSourcesPanelProps {
  projectId: string;
}

export default function DataSourcesPanel({ projectId }: DataSourcesPanelProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [fetchedData, setFetchedData] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    endpointUrl: "",
    authType: "bearer" as "none" | "bearer" | "basic" | "api_key",
    authToken: "",
    authHeader: ""
  });

  const { data: dataSources = [], isLoading } = useQuery<ApiDataSource[]>({
    queryKey: ["/api/projects", projectId, "data-sources"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/data-sources`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch data sources");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest(`/api/projects/${projectId}/data-sources`, {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "data-sources"] });
      setIsAddDialogOpen(false);
      setFormData({ name: "", description: "", endpointUrl: "", authType: "bearer", authToken: "", authHeader: "" });
      toast({ title: "Data source created", description: "Your API connection has been configured." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create data source", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/data-sources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "data-sources"] });
      toast({ title: "Data source deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete data source", variant: "destructive" });
    }
  });

  const fetchDataMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/data-sources/${id}/fetch`, { method: "POST" });
      return { id, data: res.data };
    },
    onSuccess: ({ id, data }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "data-sources"] });
      setFetchedData(prev => ({ ...prev, [id]: data }));
      setExpandedSource(id);
      toast({ title: "Data fetched successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error fetching data", description: error.message || "Failed to fetch from API", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const renderJsonTable = (data: any): JSX.Element => {
    if (!data) return <p className="text-gray-500">No data</p>;

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <p className="text-gray-500">Empty array</p>;
      }

      const firstItem = data[0];
      if (typeof firstItem === "object" && firstItem !== null) {
        const columns = Object.keys(firstItem);
        return (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="font-semibold whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 100).map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col} className="max-w-xs truncate">
                        {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.length > 100 && (
              <p className="text-sm text-gray-500 p-2 text-center">Showing first 100 of {data.length} records</p>
            )}
          </div>
        );
      } else {
        return (
          <div className="space-y-1">
            {data.slice(0, 50).map((item, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                {String(item)}
              </div>
            ))}
          </div>
        );
      }
    }

    if (typeof data === "object") {
      const entries = Object.entries(data);
      const arrayEntries = entries.filter(([, v]) => Array.isArray(v));
      const simpleEntries = entries.filter(([, v]) => !Array.isArray(v));

      return (
        <div className="space-y-4">
          {simpleEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {simpleEntries.map(([key, value]) => (
                <div key={key} className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span className="font-medium text-sm">{key}:</span>{" "}
                  <span className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}</span>
                </div>
              ))}
            </div>
          )}
          {arrayEntries.map(([key, value]) => (
            <div key={key}>
              <h4 className="font-medium mb-2">{key} ({(value as any[]).length} items)</h4>
              {renderJsonTable(value)}
            </div>
          ))}
        </div>
      );
    }

    return <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4F63A4' }}></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connect Your Data</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: '#4F63A4' }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Data Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add REST API Data Source</DialogTitle>
              <DialogDescription>
                Configure a connection to fetch data from an external REST API.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Customer Database API"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this data source..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpointUrl">Endpoint URL *</Label>
                <Input
                  id="endpointUrl"
                  type="url"
                  placeholder="https://api.example.com/data"
                  value={formData.endpointUrl}
                  onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authType">Authentication Type</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(value: "none" | "bearer" | "basic" | "api_key") => 
                    setFormData({ ...formData, authType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Authentication</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.authType !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="authToken">
                    {formData.authType === "bearer" ? "Bearer Token" : 
                     formData.authType === "api_key" ? "API Key" : 
                     "Username:Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="authToken"
                      type={showToken ? "text" : "password"}
                      placeholder={formData.authType === "basic" ? "username:password" : "Enter token or key..."}
                      value={formData.authToken}
                      onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {formData.authType === "api_key" && (
                <div className="space-y-2">
                  <Label htmlFor="authHeader">Header Name</Label>
                  <Input
                    id="authHeader"
                    placeholder="X-API-Key (default)"
                    value={formData.authHeader}
                    onChange={(e) => setFormData({ ...formData, authHeader: e.target.value })}
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} style={{ backgroundColor: '#4F63A4' }}>
                  {createMutation.isPending ? "Creating..." : "Create Data Source"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Connect to external REST APIs to import data into your project. Configure GET endpoints with authentication.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : dataSources.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Sources</h3>
            <p className="text-gray-500 text-center mb-4">
              Add your first REST API connection to start importing external data.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} style={{ backgroundColor: '#4F63A4' }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Data Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dataSources.map((source) => (
            <Card key={source.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
                    >
                      {expandedSource === source.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </Button>
                    <div>
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      {source.description && (
                        <CardDescription>{source.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {source.lastFetchStatus === "success" && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {source.lastFetchStatus === "error" && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDataMutation.mutate(source.id)}
                      disabled={fetchDataMutation.isPending}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${fetchDataMutation.isPending ? "animate-spin" : ""}`} />
                      Fetch
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(source.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">Endpoint:</span>{" "}
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {source.endpointUrl}
                  </code>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    <span className="font-medium">Auth:</span>{" "}
                    {source.authType === "bearer" ? "Bearer Token" :
                     source.authType === "api_key" ? "API Key" :
                     source.authType === "basic" ? "Basic Auth" : "None"}
                  </span>
                  {source.lastFetchedAt && (
                    <span>
                      <span className="font-medium">Last fetched:</span>{" "}
                      {new Date(source.lastFetchedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {source.lastFetchError && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {source.lastFetchError}
                  </div>
                )}

                {expandedSource === source.id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-3">Data Preview</h4>
                    {fetchedData[source.id] || source.cachedData ? (
                      renderJsonTable(fetchedData[source.id] || source.cachedData)
                    ) : (
                      <p className="text-gray-500 text-sm">
                        Click "Fetch" to load data from the API.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
