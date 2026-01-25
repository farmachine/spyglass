import React, { useState, useMemo, useEffect } from "react";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Plus, Settings2, GripVertical, Eye, EyeOff, BarChart3, PieChart, Loader2, X, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectWithDetails, FieldValidation } from "@shared/schema";
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Chart configuration type from AI
interface ChartConfig {
  type: 'pie' | 'bar';
  title: string;
  fieldName: string;
  data: { name: string; value: number; color?: string }[];
}

interface ColumnConfig {
  id: string;
  name: string;
  visible: boolean;
  orderIndex: number;
  valueId?: string;
  stepId?: string;
  fieldIdentifierId?: string;
}

interface AllDataProps {
  project: ProjectWithDetails;
}

type SortField = 'sessionName' | 'documentCount' | 'progress' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Chart colors palette
const CHART_COLORS = ['#4F63A4', '#6B7FBF', '#8A9AD9', '#3A4A7C', '#5C73B8', '#2E3A5F', '#7B8DC4', '#9AACDE'];

export default function AllData({ project }: AllDataProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  
  // Analytics state
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedAnalyticsFields, setSelectedAnalyticsFields] = useState<Set<string>>(new Set());
  const [generatedCharts, setGeneratedCharts] = useState<ChartConfig[]>([]);
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false);
  const [showAnalyticsPane, setShowAnalyticsPane] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workflow to get info page fields
  const { data: workflowData } = useQuery<{ steps?: any[] }>({
    queryKey: [`/api/projects/${project.id}/workflow`],
  });

  // Extract info page fields from workflow
  const infoPageFields = useMemo(() => {
    if (!workflowData?.steps) return [];
    
    const fields: { id: string; name: string; valueId: string; stepId: string; fieldIdentifierId?: string }[] = [];
    
    for (const step of workflowData.steps) {
      if (step.stepType === 'page') {
        for (const value of (step.values || [])) {
          // Check if value has multi-field configuration
          if (value.fields && Array.isArray(value.fields)) {
            for (const field of value.fields) {
              fields.push({
                id: `${value.id}-${field.identifierId}`,
                name: field.name,
                valueId: value.id,
                stepId: step.id,
                fieldIdentifierId: field.identifierId
              });
            }
          } else {
            // Single-field value
            fields.push({
              id: value.id,
              name: value.valueName,
              valueId: value.id,
              stepId: step.id
            });
          }
        }
      }
    }
    
    return fields;
  }, [workflowData]);

  // Load column settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(`column-settings-${project.id}`);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setColumnConfigs(parsed);
      } catch (e) {
        console.error('Failed to parse column settings:', e);
      }
    }
  }, [project.id]);

  // Initialize and sync column configs when info page fields change
  useEffect(() => {
    if (infoPageFields.length === 0) return;
    
    const savedSettings = localStorage.getItem(`column-settings-${project.id}`);
    
    if (savedSettings && columnConfigs.length > 0) {
      // Merge new fields from workflow that aren't in saved settings
      const existingIds = new Set(columnConfigs.map(c => c.id));
      const newFields = infoPageFields.filter(f => !existingIds.has(f.id));
      
      if (newFields.length > 0) {
        const maxOrderIndex = Math.max(...columnConfigs.map(c => c.orderIndex), -1);
        const newConfigs = newFields.map((field, index) => ({
          id: field.id,
          name: field.name,
          visible: false,
          orderIndex: maxOrderIndex + 1 + index,
          valueId: field.valueId,
          stepId: field.stepId,
          fieldIdentifierId: field.fieldIdentifierId
        }));
        const merged = [...columnConfigs, ...newConfigs];
        saveColumnSettings(merged);
      }
    } else if (!savedSettings && columnConfigs.length === 0) {
      // Initialize with all fields hidden by default
      const initialConfigs = infoPageFields.map((field, index) => ({
        id: field.id,
        name: field.name,
        visible: false,
        orderIndex: index,
        valueId: field.valueId,
        stepId: field.stepId,
        fieldIdentifierId: field.fieldIdentifierId
      }));
      setColumnConfigs(initialConfigs);
    }
  }, [infoPageFields, project.id]);

  // Save column settings to localStorage
  const saveColumnSettings = (configs: ColumnConfig[]) => {
    localStorage.setItem(`column-settings-${project.id}`, JSON.stringify(configs));
    setColumnConfigs(configs);
  };

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    const updated = columnConfigs.map(c => 
      c.id === columnId ? { ...c, visible: !c.visible } : c
    );
    saveColumnSettings(updated);
  };

  // Reorder columns via drag and drop
  const handleDragStart = (columnId: string) => {
    setDraggedColumn(columnId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetId) return;
    
    const draggedIndex = columnConfigs.findIndex(c => c.id === draggedColumn);
    const targetIndex = columnConfigs.findIndex(c => c.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const updated = [...columnConfigs];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, removed);
    
    // Update order indices
    updated.forEach((c, i) => c.orderIndex = i);
    setColumnConfigs(updated);
  };

  const handleDragEnd = () => {
    if (draggedColumn) {
      saveColumnSettings(columnConfigs);
    }
    setDraggedColumn(null);
  };

  // Get visible columns sorted by order index
  const visibleColumns = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [columnConfigs]);

  // Get extracted value for a session and column
  const getExtractedValue = (sessionId: string, column: ColumnConfig): string => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    
    // Find validation that matches the column
    const validation = sessionValidations.find(v => {
      if (column.fieldIdentifierId) {
        // Multi-field: match by identifierId (the unique field identifier)
        return v.identifierId === column.fieldIdentifierId;
      } else {
        // Single-field: match by valueId
        return v.valueId === column.valueId;
      }
    });
    
    if (!validation) return '-';
    return validation.extractedValue || '-';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Fetch validation data for all sessions
  const { data: allValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', project.id],
    queryFn: async () => {
      const validations: FieldValidation[] = [];
      // Filter out null/undefined sessions before iterating
      const validSessions = (project.sessions || []).filter(session => session && session.id);
      for (const session of validSessions) {
        try {
          const response = await fetch(`/api/sessions/${session.id}/validations`);
          if (response.ok) {
            const sessionValidations = await response.json();
            validations.push(...sessionValidations);
          }
        } catch (error) {
          console.error(`Failed to fetch validations for session ${session.id}:`, error);
        }
      }
      return validations;
    },
    enabled: project.sessions.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 0  // Make sure data is always fresh
  });

  // Get verification status for a session
  const getVerificationStatus = (sessionId: string): 'verified' | 'in_progress' | 'pending' => {
    // Safety check for sessionId
    if (!sessionId) return 'pending';
    
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    
    // Debug logging
    console.log(`Session ${sessionId} - Validations: ${sessionValidations.length}, All verified: ${allVerified}`);
    console.log(`Session ${sessionId} - Status breakdown:`, sessionValidations.map(v => ({ field: (v as any).fieldName || 'Unknown', status: v.validationStatus })));
    
    return allVerified ? 'verified' : 'in_progress';
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    // Filter out null/undefined sessions before iterating
    const validSessions = (project.sessions || []).filter(session => session && session.id);
    for (const session of validSessions) {
      const status = getVerificationStatus(session.id);
      stats[status]++;
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      return apiRequest(`/api/projects/${project.id}/sessions/create-empty`, {
        method: 'POST',
        body: JSON.stringify({ sessionName })
      });
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', newSession.id] });
      setShowCreateModal(false);
      setSessionName('');
      // Navigate to the new session
      setLocation(`/projects/${project.id}/sessions/${newSession.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create new session",
        variant: "destructive",
      });
    },
  });

  const handleCreateNewSession = () => {
    setShowCreateModal(true);
  };

  const handleSubmitCreate = () => {
    if (!sessionName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a session name",
        variant: "destructive",
      });
      return;
    }
    createSessionMutation.mutate(sessionName.trim());
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setSessionName('');
  };

  // Toggle analytics field selection
  const toggleAnalyticsField = (fieldId: string) => {
    const newSelected = new Set(selectedAnalyticsFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedAnalyticsFields(newSelected);
  };

  // Get all data for selected fields from sessions
  const getFieldDataForAnalytics = (fieldId: string): { values: string[], fieldName: string } => {
    const column = columnConfigs.find(c => c.id === fieldId) || infoPageFields.find(f => f.id === fieldId);
    if (!column) return { values: [], fieldName: 'Unknown' };
    
    const columnConfig: ColumnConfig = {
      id: column.id,
      name: column.name,
      visible: true,
      orderIndex: 0,
      valueId: column.valueId,
      stepId: column.stepId,
      fieldIdentifierId: column.fieldIdentifierId
    };
    
    const values: string[] = [];
    const validSessions = (project.sessions || []).filter(s => s && s.id);
    
    for (const session of validSessions) {
      const value = getExtractedValue(session.id, columnConfig);
      if (value && value !== '-') {
        values.push(value);
      }
    }
    
    return { values, fieldName: column.name };
  };

  // Generate charts using AI
  const generateAnalyticsCharts = async () => {
    if (selectedAnalyticsFields.size === 0) {
      toast({
        title: "No fields selected",
        description: "Please select at least one field to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCharts(true);
    setShowAnalyticsModal(false);
    
    try {
      // Collect data for selected fields
      const fieldData: { fieldName: string; values: string[] }[] = [];
      
      for (const fieldId of selectedAnalyticsFields) {
        const data = getFieldDataForAnalytics(fieldId);
        if (data.values.length > 0) {
          fieldData.push(data);
        }
      }

      if (fieldData.length === 0) {
        toast({
          title: "No data available",
          description: "Selected fields have no extracted values to analyze",
          variant: "destructive",
        });
        setIsGeneratingCharts(false);
        return;
      }

      // Call AI endpoint to generate chart configurations
      const response = await apiRequest(`/api/analytics/generate-charts`, {
        method: 'POST',
        body: JSON.stringify({ fieldData })
      }) as { charts?: ChartConfig[] };

      if (response && response.charts && Array.isArray(response.charts)) {
        setGeneratedCharts(response.charts);
        setShowAnalyticsPane(true);
      } else {
        throw new Error('Invalid response from analytics API');
      }
    } catch (error) {
      console.error('Failed to generate analytics:', error);
      toast({
        title: "Error",
        description: "Failed to generate analytics charts",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCharts(false);
    }
  };

  // Clear analytics
  const clearAnalytics = () => {
    setGeneratedCharts([]);
    setShowAnalyticsPane(false);
    setSelectedAnalyticsFields(new Set());
  };

  // Get verification progress for a session
  const getSessionProgress = (sessionId: string) => {
    // Safety check for sessionId
    if (!sessionId) return { verified: 0, total: 0, percentage: 0 };
    
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return { verified: 0, total: 0, percentage: 0 };
    
    const verified = sessionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const total = sessionValidations.length;
    // Only show 100% if truly 100% verified, otherwise round down to avoid confusion
    const exactPercentage = (verified / total) * 100;
    const percentage = verified === total ? 100 : Math.floor(exactPercentage);
    
    return { verified, total, percentage };
  };

  // Sortable column header component
  const SortableHeader = ({ field, children, className = "py-3" }: { 
    field: SortField; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    const isSorted = sortField === field;
    const isAsc = isSorted && sortDirection === 'asc';
    const isDesc = isSorted && sortDirection === 'desc';

    return (
      <TableHead 
        className={`${className} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isSorted ? (
            isAsc ? (
              <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </TableHead>
    );
  };

  // Sorted sessions using useMemo for performance
  const sortedSessions = useMemo(() => {
    const sessions = [...(project.sessions || [])].filter(session => session && session.id);
    
    return sessions.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'sessionName':
          aValue = (a.sessionName || '').toLowerCase();
          bValue = (b.sessionName || '').toLowerCase();
          break;
        case 'documentCount':
          aValue = a.documentCount || 0;
          bValue = b.documentCount || 0;
          break;
        case 'progress':
          aValue = getSessionProgress(a.id).percentage;
          bValue = getSessionProgress(b.id).percentage;
          break;
        case 'status':
          const statusOrder = { 'verified': 3, 'in_progress': 2, 'pending': 1 };
          aValue = statusOrder[getVerificationStatus(a.id)];
          bValue = statusOrder[getVerificationStatus(b.id)];
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [project.sessions, sortField, sortDirection, allValidations]);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{project.mainObjectName || "Session"}s</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Collect, validate & manage all {project.mainObjectName || "session"} documents & data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Analytics Button */}
            <Button
              variant="outline"
              onClick={() => setShowAnalyticsModal(true)}
              disabled={isGeneratingCharts}
              className="flex items-center gap-2"
            >
              {isGeneratingCharts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              Analytics
            </Button>

            {/* Column Settings Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowColumnSettings(true)}
              title="Column Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
              <DialogTrigger asChild>
                <Button 
                  onClick={handleCreateNewSession}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New {project.mainObjectName || "Session"}
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New {project.mainObjectName || "Session"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionName">Name</Label>
                  <Input
                    id="sessionName"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder={`Enter ${(project.mainObjectName || "session").toLowerCase()} name`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitCreate();
                      }
                      if (e.key === 'Escape') {
                        handleCancelCreate();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelCreate}
                    disabled={createSessionMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitCreate}
                    disabled={createSessionMutation.isPending || !sessionName.trim()}
                  >
                    {createSessionMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Column Settings Modal */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Column Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Show or hide info page fields as columns. Drag to reorder.
            </p>
            {columnConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No info page fields configured in this project.
              </p>
            ) : (
              <div className="space-y-1">
                {[...columnConfigs]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((column) => (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={() => handleDragStart(column.id)}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-move transition-colors ${
                        draggedColumn === column.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background hover:bg-muted/50 border-border'
                      }`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm truncate">{column.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleColumnVisibility(column.id)}
                        className="h-8 w-8 p-0"
                      >
                        {column.visible ? (
                          <Eye className="h-4 w-4 text-primary" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowColumnSettings(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Field Selection Modal */}
      <Dialog open={showAnalyticsModal} onOpenChange={setShowAnalyticsModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Analytics
            </DialogTitle>
            <DialogDescription>
              Select data fields to visualize. AI will create appropriate charts based on your data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {infoPageFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No info page fields configured in this project.
              </p>
            ) : (
              <div className="space-y-2">
                {infoPageFields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedAnalyticsFields.has(field.id)}
                      onCheckedChange={() => toggleAnalyticsField(field.id)}
                    />
                    <span className="flex-1 text-sm">{field.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setSelectedAnalyticsFields(new Set())}>
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAnalyticsModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={generateAnalyticsCharts}
                disabled={selectedAnalyticsFields.size === 0 || isGeneratingCharts}
              >
                {isGeneratingCharts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Charts
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Pane - Shows generated charts */}
      {showAnalyticsPane && generatedCharts.length > 0 && (
        <Card className="w-full mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Analytics
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnalyticsModal(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearAnalytics}
                  title="Close Analytics"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ maxHeight: '280px', overflow: 'auto' }}>
              {generatedCharts.map((chart, index) => (
                <div key={index} className="border rounded-lg p-4 bg-background">
                  <h4 className="text-sm font-medium mb-3 text-center">{chart.title}</h4>
                  <div className="h-[180px]">
                    {chart.type === 'pie' ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={chart.data}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {chart.data.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chart.data} layout="vertical">
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={4}>
                            {chart.data.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card className="w-full">
        <CardContent className="p-0">
          {project.sessions.length === 0 ? (
            <div className="text-center py-8 px-6">
              <Database className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No {(project.mainObjectName || "session").toLowerCase()} extractions</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click "New {project.mainObjectName || "Session"}" to create your first extraction session
              </p>
              <div className="mt-4 flex justify-center">
                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleCreateNewSession}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      New {project.mainObjectName || "Session"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New {project.mainObjectName || "Session"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sessionName2">Name</Label>
                        <Input
                          id="sessionName2"
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder={`Enter ${(project.mainObjectName || "session").toLowerCase()} name`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmitCreate();
                            }
                            if (e.key === 'Escape') {
                              handleCancelCreate();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={handleCancelCreate}
                          disabled={createSessionMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSubmitCreate}
                          disabled={createSessionMutation.isPending || !sessionName.trim()}
                        >
                          {createSessionMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <div className="border-t">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="sessionName" className="py-3 w-[200px] min-w-[200px]">{project.mainObjectName || 'Session'} Name</SortableHeader>
                    <SortableHeader field="documentCount" className="py-3 w-[60px] min-w-[60px] text-center">Docs</SortableHeader>
                    {/* Dynamic columns from info page fields */}
                    {visibleColumns.map(column => (
                      <TableHead key={column.id} className="py-3 w-[150px] min-w-[150px]">
                        <span className="text-xs font-medium text-muted-foreground truncate">{column.name}</span>
                      </TableHead>
                    ))}
                    <SortableHeader field="progress" className="py-3 w-[120px] min-w-[120px]">Progress</SortableHeader>
                    <SortableHeader field="status" className="py-3 w-[50px] min-w-[50px] text-center">
                      <div className="flex justify-center">
                        <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </SortableHeader>
                    <SortableHeader field="createdAt" className="py-3 w-[100px] min-w-[100px]">Created</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {sortedSessions.map((session) => {
                  if (!session || !session.id) return null;
                  const progress = getSessionProgress(session.id);
                  const verificationStatus = getVerificationStatus(session.id);
                  
                  return (
                    <TableRow key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="py-3">
                        <Link href={`/projects/${project.id}/sessions/${session.id}`}>
                          <div className="cursor-pointer hover:text-primary transition-colors">
                            <p className="font-medium text-sm truncate">{session.sessionName || 'Untitled Session'}</p>
                            {session.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {session.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-gray-800 dark:text-gray-300 text-center">
                        {session.documentCount || 0}
                      </TableCell>
                      {/* Dynamic column values */}
                      {visibleColumns.map(column => (
                        <TableCell key={column.id} className="py-3">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-[140px]" title={getExtractedValue(session.id, column)}>
                            {getExtractedValue(session.id, column)}
                          </span>
                        </TableCell>
                      ))}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                progress.percentage === 100 ? 'bg-green-600' : 
                                progress.percentage > 0 ? 'bg-green-600' : 'bg-gray-400'
                              }`}
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-300 min-w-[32px]">
                            {progress.percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex justify-center">
                          {verificationStatus === 'verified' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-xs text-gray-800 dark:text-gray-400">
                          {session.createdAt ? formatDate(session.createdAt).split(',')[0] : 'Unknown'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }).filter(Boolean)}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
