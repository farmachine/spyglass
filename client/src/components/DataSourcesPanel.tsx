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
import { Plus, Trash2, RefreshCw, Database, CheckCircle, XCircle, Eye, EyeOff, ChevronDown, ChevronRight, Pencil, Check, X, Mail, Copy, Loader2 } from "lucide-react";
import type { ApiDataSource } from "@shared/schema";
import { useProject } from "@/hooks/useProjects";

interface DataSourcesPanelProps {
  projectId: string;
}

export default function DataSourcesPanel({ projectId }: DataSourcesPanelProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [fetchedData, setFetchedData] = useState<Record<string, any>>({});
  const [editingColumn, setEditingColumn] = useState<{ sourceId: string; column: string } | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  
  const { data: project, refetch: refetchProject } = useProject(projectId);

  const createInboxMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/projects/${projectId}/inbox`, {
        method: "POST"
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      refetchProject();
      toast({ 
        title: "Email inbox created", 
        description: `Sessions can now be created by emailing ${data.email}` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create email inbox", 
        variant: "destructive" 
      });
    }
  });

  const copyEmailToClipboard = () => {
    if (project?.inboxEmailAddress) {
      navigator.clipboard.writeText(project.inboxEmailAddress);
      toast({ title: "Copied to clipboard" });
    }
  };

  const processEmailsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/inbox/process`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      if (data.sessionsCreated > 0) {
        toast({ 
          title: "Emails processed", 
          description: `Created ${data.sessionsCreated} new session(s) from emails` 
        });
      } else {
        toast({ 
          title: "No new emails", 
          description: "No new emails found to process" 
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to process emails", 
        variant: "destructive" 
      });
    }
  });

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
      return apiRequest(`/api/projects/${projectId}/data-sources`);
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

  const updateColumnMappingsMutation = useMutation({
    mutationFn: async ({ sourceId, columnMappings }: { sourceId: string; columnMappings: Record<string, string> }) => {
      return apiRequest(`/api/data-sources/${sourceId}/column-mappings`, {
        method: "PATCH",
        body: JSON.stringify({ columnMappings })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "data-sources"] });
      setEditingColumn(null);
      toast({ title: "Column renamed", description: "Column mapping saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save column mapping", variant: "destructive" });
    }
  });

  const handleColumnRename = (source: ApiDataSource, originalColumn: string, newName: string) => {
    const currentMappings = (source.columnMappings as Record<string, string>) || {};
    const updatedMappings = { ...currentMappings, [originalColumn]: newName };
    if (!newName.trim() || newName === originalColumn) {
      delete updatedMappings[originalColumn];
    }
    updateColumnMappingsMutation.mutate({ sourceId: source.id, columnMappings: updatedMappings });
  };

  const getDisplayColumnName = (source: ApiDataSource, originalColumn: string): string => {
    const mappings = (source.columnMappings as Record<string, string>) || {};
    return mappings[originalColumn] || originalColumn;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const formatColumnHeader = (key: string): string => {
    // Keep technical field names (c_text_0001, etc.) as-is
    if (/^c_[a-z]+_\d+$/.test(key)) {
      return key;
    }
    // Format other keys for readability
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
      if (Array.isArray(value)) return `[${value.length} items]`;
      return JSON.stringify(value);
    }
    const str = String(value);
    if (str.match(/^\d{4}-\d{2}-\d{2}T/)) {
      try {
        return new Date(str).toLocaleString();
      } catch { return str; }
    }
    return str;
  };

  const flattenObject = (obj: Record<string, any>, prefix = ""): { key: string; value: string }[] => {
    const result: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value === null || value === undefined) continue;
      if (typeof value === "object" && !Array.isArray(value)) {
        result.push(...flattenObject(value, fullKey));
      } else if (!Array.isArray(value)) {
        result.push({ key: fullKey, value: formatCellValue(value) });
      }
    }
    return result;
  };

  const renderArrayAsTable = (arr: any[], source?: ApiDataSource): JSX.Element => {
    if (arr.length === 0) return <p className="text-gray-500">Empty array</p>;
    
    const firstItem = arr[0];
    if (typeof firstItem === "object" && firstItem !== null) {
      const allKeys = new Set<string>();
      arr.slice(0, 20).forEach(item => {
        if (item && typeof item === "object") {
          Object.keys(item).forEach(k => allKeys.add(k));
        }
      });
      const columns = Array.from(allKeys);
      
      const renderColumnHeader = (col: string) => {
        const displayName = source ? getDisplayColumnName(source, col) : col;
        const isEditing = editingColumn?.sourceId === source?.id && editingColumn?.column === col;
        
        if (isEditing && source) {
          return (
            <div className="flex items-center gap-1">
              <Input
                value={editingColumnName}
                onChange={(e) => setEditingColumnName(e.target.value)}
                className="h-6 w-32 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleColumnRename(source, col, editingColumnName);
                  } else if (e.key === 'Escape') {
                    setEditingColumn(null);
                  }
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleColumnRename(source, col, editingColumnName)}
              >
                <Check className="w-3 h-3 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setEditingColumn(null)}
              >
                <X className="w-3 h-3 text-red-600" />
              </Button>
            </div>
          );
        }
        
        return (
          <div className="flex items-center gap-1">
            <span>{displayName !== col ? displayName : formatColumnHeader(col)}</span>
            {displayName !== col && (
              <span className="text-xs text-gray-400">({col})</span>
            )}
            {source && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 ml-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {
                  setEditingColumn({ sourceId: source.id, column: col });
                  setEditingColumnName(displayName !== col ? displayName : '');
                }}
                title="Rename column"
              >
                <Pencil className="w-3 h-3 text-gray-400 hover:text-gray-600" />
              </Button>
            )}
          </div>
        );
      };
      
      return (
        <div className="overflow-x-auto border rounded-lg max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10">
              <TableRow>
                <TableHead className="font-semibold text-gray-500 w-12">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="font-semibold whitespace-nowrap">
                    {renderColumnHeader(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {arr.slice(0, 100).map((row, idx) => (
                <TableRow key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <TableCell className="text-gray-400 text-sm">{idx + 1}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className="max-w-[300px]" title={formatCellValue(row[col])}>
                      <span className="block truncate">{formatCellValue(row[col])}</span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {arr.length > 100 && (
            <p className="text-sm text-gray-500 p-2 text-center border-t">
              Showing first 100 of {arr.length} records
            </p>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        {arr.slice(0, 50).map((item, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
            {String(item)}
          </div>
        ))}
      </div>
    );
  };

  const findMainDataArray = (obj: any): { data: any[]; metadata: Record<string, any> } | null => {
    if (!obj || typeof obj !== "object") return null;
    
    const commonDataKeys = ["entries", "data", "items", "results", "records", "rows", "list"];
    
    // Check if obj itself has a common data array key
    for (const key of commonDataKeys) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        const metadata: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== key) metadata[k] = v;
        }
        return { data: obj[key], metadata };
      }
    }
    
    // Check nested "data" object
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      for (const key of commonDataKeys) {
        if (Array.isArray(obj.data[key]) && obj.data[key].length > 0) {
          const metadata: Record<string, any> = {};
          for (const [k, v] of Object.entries(obj.data)) {
            if (k !== key) metadata[k] = v;
          }
          return { data: obj.data[key], metadata };
        }
      }
    }
    
    // Find any array with objects
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        const metadata: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== key) metadata[k] = v;
        }
        return { data: value, metadata };
      }
    }
    
    return null;
  };

  const renderJsonTable = (data: any, source?: ApiDataSource): JSX.Element => {
    if (!data) return <p className="text-gray-500">No data</p>;

    let parsedData = data;
    if (typeof data === "string") {
      try {
        parsedData = JSON.parse(data);
      } catch {
        return <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm overflow-auto whitespace-pre-wrap">{data}</pre>;
      }
    }
    
    // Try to find the main data array (handles nested structures like {data: {entries: [...]}})
    const found = findMainDataArray(parsedData);
    if (found) {
      parsedData = found.data;
      // Render with metadata header
      const flatMeta = flattenObject(found.metadata);
      if (flatMeta.length > 0) {
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 pb-2 border-b">
              {flatMeta.map(({ key, value }) => (
                <span key={key}>
                  <span className="font-medium">{formatColumnHeader(key)}:</span> {value}
                </span>
              ))}
            </div>
            <div>
              <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
                Records ({found.data.length} items)
              </h4>
              {renderArrayAsTable(found.data, source)}
            </div>
          </div>
        );
      }
      return renderArrayAsTable(found.data, source);
    }

    if (Array.isArray(parsedData)) {
      return renderArrayAsTable(parsedData, source);
    }

    if (typeof parsedData === "object" && parsedData !== null) {
      const allEntries = Object.entries(parsedData);
      
      // Find the main data array - prioritize common names, then largest array
      const commonDataKeys = ["entries", "data", "items", "results", "records", "rows", "list"];
      const arrayEntries = allEntries.filter(([, v]) => Array.isArray(v) && (v as any[]).length > 0);
      
      let mainDataEntry: [string, any] | null = null;
      
      // First check for common data array names
      for (const key of commonDataKeys) {
        const found = arrayEntries.find(([k]) => k.toLowerCase() === key);
        if (found) {
          mainDataEntry = found;
          break;
        }
      }
      
      // If no common name found, use the largest array
      if (!mainDataEntry && arrayEntries.length > 0) {
        mainDataEntry = arrayEntries.reduce((a, b) => 
          (a[1] as any[]).length >= (b[1] as any[]).length ? a : b
        );
      }
      
      // Collect metadata (everything that's not the main data array)
      const metadataEntries = allEntries.filter(([k]) => k !== mainDataEntry?.[0]);
      
      // Flatten nested metadata objects for display
      const flattenMetadata = (entries: [string, any][]): { key: string; value: string }[] => {
        const result: { key: string; value: string }[] = [];
        for (const [key, value] of entries) {
          if (value === null || value === undefined) continue;
          if (typeof value === "object" && !Array.isArray(value)) {
            // Flatten nested object
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (nestedValue !== null && nestedValue !== undefined && !Array.isArray(nestedValue)) {
                result.push({ key: `${key}.${nestedKey}`, value: formatCellValue(nestedValue) });
              }
            }
          } else if (!Array.isArray(value)) {
            result.push({ key, value: formatCellValue(value) });
          }
        }
        return result;
      };
      
      if (mainDataEntry) {
        const [dataKey, dataValue] = mainDataEntry;
        const metadata = flattenMetadata(metadataEntries);
        
        return (
          <div className="space-y-3">
            {metadata.length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 pb-2 border-b">
                {metadata.map(({ key, value }) => (
                  <span key={key}>
                    <span className="font-medium">{formatColumnHeader(key)}:</span> {value}
                  </span>
                ))}
              </div>
            )}
            <div>
              <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
                {formatColumnHeader(dataKey)} ({(dataValue as any[]).length} records)
              </h4>
              {renderJsonTable(dataValue, source)}
            </div>
          </div>
        );
      }
      
      // No main array found, show as key-value pairs
      const metadata = flattenMetadata(allEntries);
      if (metadata.length > 0) {
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {metadata.map(({ key, value }) => (
              <div key={key} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <span className="font-medium text-sm text-gray-600 dark:text-gray-400">{formatColumnHeader(key)}</span>
                <div className="text-sm mt-1">{value}</div>
              </div>
            ))}
          </div>
        );
      }
    }

    return <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm overflow-auto">{JSON.stringify(parsedData, null, 2)}</pre>;
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4F63A4' }}></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connect Your Data</h1>
        </div>
      </div>

      {/* Email Inbox Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" style={{ color: '#4F63A4' }} />
            <CardTitle className="text-lg">Email Inbox</CardTitle>
          </div>
          <CardDescription>
            Create sessions automatically by sending emails to this project's inbox
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project?.inboxEmailAddress ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-sm">{project.inboxEmailAddress}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEmailToClipboard}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => processEmailsMutation.mutate()}
                disabled={processEmailsMutation.isPending}
                className="flex items-center gap-2"
              >
                {processEmailsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Check for Emails
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                No inbox configured. Create one to receive documents via email.
              </p>
              <Button
                onClick={() => createInboxMutation.mutate()}
                disabled={createInboxMutation.isPending}
                style={{ backgroundColor: '#4F63A4' }}
              >
                {createInboxMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Inbox
                  </>
                )}
              </Button>
            </div>
          )}
          {project?.inboxEmailAddress && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Email attachments will automatically be uploaded as session documents
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data Sources Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" style={{ color: '#4F63A4' }} />
              <CardTitle className="text-lg">API Data Sources</CardTitle>
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
          <CardDescription>
            Connect to external REST APIs to import data into your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : dataSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg">
              <Database className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm text-center">
                No API data sources configured yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dataSources.map((source) => (
                <div key={source.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
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
                        <h4 className="font-medium">{source.name}</h4>
                        {source.description && (
                          <p className="text-sm text-gray-500">{source.description}</p>
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
                  <div className="text-sm text-gray-500 mb-2">
                    <span className="font-medium">Endpoint:</span>{" "}
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
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
                        renderJsonTable(fetchedData[source.id] || source.cachedData, source)
                      ) : (
                        <p className="text-gray-500 text-sm">
                          Click "Fetch" to load data from the API.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
