import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Plus, Settings2, GripVertical, Eye, EyeOff, BarChart3, PieChart, Loader2, X, Sparkles, RefreshCw, Mail, Circle, Upload, FileText } from "lucide-react";
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
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ChartType = 'pie' | 'bar' | 'timeline' | 'total' | 'ranking';

interface ChartConfig {
  type: ChartType;
  title: string;
  fieldName: string;
  fieldId?: string;
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
  isDataTable?: boolean;
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
  
  // Document type uploads for session creation
  const [documentUploads, setDocumentUploads] = useState<Record<string, File | null>>({});
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const requiredDocumentTypes = ((project as any).requiredDocumentTypes || []) as Array<{id: string; name: string; description: string}>;
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  
  // Document validation state
  interface DocumentValidation {
    isValid: boolean;
    confidence: number;
    reasoning: string;
    missingElements: string[];
    guidance: string;
    isValidating?: boolean;
  }
  const [documentValidations, setDocumentValidations] = useState<Record<string, DocumentValidation>>({});
  
  // Analytics state - load from localStorage
  const analyticsStorageKey = `analytics-${project.id}`;
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedAnalyticsFields, setSelectedAnalyticsFields] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(analyticsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.selectedFields || [];
      }
    } catch (e) {}
    return [];
  });
  const [generatedCharts, setGeneratedCharts] = useState<ChartConfig[]>(() => {
    try {
      const saved = localStorage.getItem(analyticsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.charts || [];
      }
    } catch (e) {}
    return [];
  });
  const [analyticsChartTypes, setAnalyticsChartTypes] = useState<Record<string, ChartType>>(() => {
    try {
      const saved = localStorage.getItem(analyticsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.chartTypes || {};
      }
    } catch (e) {}
    return {};
  });
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false);
  const [showAnalyticsPane, setShowAnalyticsPane] = useState(() => {
    try {
      const saved = localStorage.getItem(analyticsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.showPane === true && (parsed.charts?.length > 0);
      }
    } catch (e) {}
    return false;
  });
  
  // Save analytics state to localStorage whenever it changes
  useEffect(() => {
    const data = {
      selectedFields: selectedAnalyticsFields,
      charts: generatedCharts,
      showPane: showAnalyticsPane,
      chartTypes: analyticsChartTypes
    };
    localStorage.setItem(analyticsStorageKey, JSON.stringify(data));
  }, [selectedAnalyticsFields, generatedCharts, showAnalyticsPane, analyticsStorageKey, analyticsChartTypes]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const workflowStatusOptions = ((project as any).workflowStatusOptions || []) as string[];
  const workflowStatusColors = ((project as any).workflowStatusColors || []) as string[];

  const STATUS_DEFAULT_COLORS = ['#4F63A4', '#5B8DBD', '#4F9A94', '#5EA47B', '#C4A35A', '#C47B5A', '#A45B73'];
  const getStatusColor = (status: string): string => {
    const idx = workflowStatusOptions.indexOf(status);
    if (idx >= 0) {
      return workflowStatusColors[idx] || STATUS_DEFAULT_COLORS[idx % STATUS_DEFAULT_COLORS.length];
    }
    return '#94a3b8';
  };

  // Fetch workflow to get info page fields
  const { data: workflowData } = useQuery<{ steps?: any[] }>({
    queryKey: [`/api/projects/${project.id}/workflow`],
  });

  // Fetch kanban progress for all sessions (supports multiple kanban steps)
  const { data: kanbanProgressData, refetch: refetchKanbanProgress, isRefetching: isRefetchingKanban } = useQuery<{
    hasKanban: boolean;
    kanbanSteps: Array<{
      stepId: string;
      stepName: string;
      statusColumns: string[];
      columnColors: string[];
      lastColumn: string;
    }>;
    progress: Record<string, Record<string, { 
      total: number; 
      completed: number; 
      percentage: number;
      statusBreakdown: Record<string, number>;
    }>>;
  }>({
    queryKey: [`/api/projects/${project.id}/kanban-progress`],
  });

  // Extract info page fields from workflow
  const infoPageFields = useMemo(() => {
    if (!workflowData?.steps) return [];
    
    const fields: { id: string; name: string; valueId: string; stepId: string; fieldIdentifierId?: string; isDataTable?: boolean; dataType?: string }[] = [];
    
    for (const step of workflowData.steps) {
      if (step.stepType === 'page') {
        for (const value of (step.values || [])) {
          if (value.fields && Array.isArray(value.fields) && value.fields.length > 0) {
            for (const field of value.fields) {
              fields.push({
                id: `${value.id}-${field.identifierId}`,
                name: field.name,
                valueId: value.id,
                stepId: step.id,
                fieldIdentifierId: field.identifierId,
                isDataTable: false,
                dataType: field.dataType
              });
            }
          } else {
            fields.push({
              id: value.id,
              name: value.valueName,
              valueId: value.id,
              stepId: step.id,
              isDataTable: false
            });
          }
        }
      }
    }
    
    return fields;
  }, [workflowData]);

  // Extract data table fields from workflow (list type steps)
  const dataTableFields = useMemo(() => {
    if (!workflowData?.steps) return [];
    
    const fields: { id: string; name: string; valueId: string; stepId: string; stepName: string; isDataTable: boolean }[] = [];
    
    for (const step of workflowData.steps) {
      if (step.stepType === 'list') {
        for (const value of (step.values || [])) {
          fields.push({
            id: `dt-${value.id}`,
            name: value.valueName,
            valueId: value.id,
            stepId: step.id,
            stepName: step.stepName,
            isDataTable: true
          });
        }
      }
    }
    
    return fields;
  }, [workflowData]);

  // Combined fields for column settings and analytics
  const allConfigurableFields = useMemo(() => {
    return [...infoPageFields, ...dataTableFields];
  }, [infoPageFields, dataTableFields]);

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

  // Initialize and sync column configs when fields change
  useEffect(() => {
    if (allConfigurableFields.length === 0) return;
    
    const savedSettings = localStorage.getItem(`column-settings-${project.id}`);
    
    if (savedSettings && columnConfigs.length > 0) {
      // Merge new fields from workflow that aren't in saved settings
      const existingIds = new Set(columnConfigs.map(c => c.id));
      const newFields = allConfigurableFields.filter(f => !existingIds.has(f.id));
      
      if (newFields.length > 0) {
        const maxOrderIndex = Math.max(...columnConfigs.map(c => c.orderIndex), -1);
        const newConfigs = newFields.map((field, index) => ({
          id: field.id,
          name: field.name,
          visible: false,
          orderIndex: maxOrderIndex + 1 + index,
          valueId: field.valueId,
          stepId: field.stepId,
          fieldIdentifierId: (field as any).fieldIdentifierId,
          isDataTable: field.isDataTable
        }));
        const merged = [...columnConfigs, ...newConfigs];
        saveColumnSettings(merged);
      }
    } else if (!savedSettings && columnConfigs.length === 0) {
      // Initialize with all fields hidden by default
      const initialConfigs = allConfigurableFields.map((field, index) => ({
        id: field.id,
        name: field.name,
        visible: false,
        orderIndex: index,
        valueId: field.valueId,
        stepId: field.stepId,
        fieldIdentifierId: (field as any).fieldIdentifierId,
        isDataTable: field.isDataTable
      }));
      setColumnConfigs(initialConfigs);
    }
  }, [allConfigurableFields, project.id]);

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
    
    // Handle data table fields - show count of valid values
    if (column.isDataTable) {
      const matchingValidations = sessionValidations.filter(v => 
        v.fieldId === column.valueId && 
        v.extractedValue && 
        v.extractedValue !== 'null' && 
        v.extractedValue !== '-'
      );
      const validCount = matchingValidations.filter(v => v.validationStatus === 'valid').length;
      return validCount > 0 ? `${validCount}` : '-';
    }
    
    // Find validation that matches the column (info page fields)
    const validation = sessionValidations.find(v => {
      if (column.fieldIdentifierId) {
        // Multi-field: match by identifierId (the unique field identifier)
        return v.identifierId === column.fieldIdentifierId;
      } else {
        // Single-field: match by valueId
        return v.fieldId === column.valueId;
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
      setDocumentUploads({});
      setDocumentValidations({});
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

  // Upload a document to a session
  const uploadDocumentToSession = async (sessionId: string, file: File, documentTypeId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentTypeId', documentTypeId);
    
    const response = await fetch(`/api/sessions/${sessionId}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload document');
    }
    
    return response.json();
  };

  const handleSubmitCreate = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a session name",
        variant: "destructive",
      });
      return;
    }
    
    // Check if all required documents are uploaded
    if (requiredDocumentTypes.length > 0) {
      const missingDocs = requiredDocumentTypes.filter(dt => !documentUploads[dt.id]);
      if (missingDocs.length > 0) {
        toast({
          title: "Missing Documents",
          description: `Please upload: ${missingDocs.map(d => d.name).join(', ')}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      setUploadingDocuments(true);
      
      // Create the session without triggering navigation (bypassing mutation's onSuccess)
      const response = await apiRequest(`/api/projects/${project.id}/sessions/create-empty`, {
        method: 'POST',
        body: JSON.stringify({ sessionName: sessionName.trim() })
      });
      const newSession = response;
      
      // Then upload all documents
      if (requiredDocumentTypes.length > 0) {
        for (const docType of requiredDocumentTypes) {
          const file = documentUploads[docType.id];
          if (file) {
            await uploadDocumentToSession(newSession.id, file, docType.id);
          }
        }
      }
      
      // Now invalidate queries and navigate after everything is done
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', newSession.id] });
      setShowCreateModal(false);
      setSessionName('');
      setDocumentUploads({});
      setDocumentValidations({});
      setLocation(`/projects/${project.id}/sessions/${newSession.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setSessionName('');
    setDocumentUploads({});
    setDocumentValidations({});
  };
  
  // Extract document content using Python extractor (via API) and validate with AI
  const validateDocument = async (file: File, docType: {id: string; name: string; description: string}) => {
    // Set validating state
    setDocumentValidations(prev => ({
      ...prev,
      [docType.id]: { isValid: false, confidence: 0, reasoning: '', missingElements: [], guidance: '', isValidating: true }
    }));
    
    try {
      // First, upload the file temporarily to extract its content
      const formData = new FormData();
      formData.append('file', file);
      
      const extractResponse = await fetch('/api/extract-document-content', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });
      
      if (!extractResponse.ok) {
        throw new Error('Failed to extract document content');
      }
      
      const { content } = await extractResponse.json();
      
      // Now validate the content against the document type description
      const validateResponse = await apiRequest('/api/validate-document', {
        method: 'POST',
        body: JSON.stringify({
          documentContent: content,
          documentTypeName: docType.name,
          documentTypeDescription: docType.description,
          fileName: file.name
        })
      });
      
      setDocumentValidations(prev => ({
        ...prev,
        [docType.id]: { ...validateResponse, isValidating: false }
      }));
      
    } catch (error) {
      console.error('Document validation error:', error);
      setDocumentValidations(prev => ({
        ...prev,
        [docType.id]: {
          isValid: false,
          confidence: 0,
          reasoning: 'Could not validate document',
          missingElements: [],
          guidance: 'Please ensure the document is readable and try again.',
          isValidating: false
        }
      }));
    }
  };

  const handleDocumentUpload = async (docTypeId: string, file: File | null) => {
    setDocumentUploads(prev => ({ ...prev, [docTypeId]: file }));
    
    // If file is removed, clear validation
    if (!file) {
      setDocumentValidations(prev => {
        const newState = { ...prev };
        delete newState[docTypeId];
        return newState;
      });
      return;
    }
    
    // Find the document type
    const docType = requiredDocumentTypes.find(dt => dt.id === docTypeId);
    if (docType && docType.description) {
      // Validate the document against its type description
      await validateDocument(file, docType);
    }
  };

  const getDefaultChartType = (fieldId: string): ChartType => {
    const field = infoPageFields.find(f => f.id === fieldId);
    if (field?.dataType === 'DATE') return 'timeline';
    if (fieldId === 'workflow-status') return 'pie';
    if (fieldId.startsWith('kanban-')) return 'pie';
    return 'pie';
  };

  const getChartTypeForField = (fieldId: string): ChartType => {
    return analyticsChartTypes[fieldId] || getDefaultChartType(fieldId);
  };

  const setChartTypeForField = (fieldId: string, type: ChartType) => {
    setAnalyticsChartTypes(prev => ({ ...prev, [fieldId]: type }));
  };

  const [draggedAnalyticsField, setDraggedAnalyticsField] = useState<string | null>(null);

  const toggleAnalyticsField = (fieldId: string) => {
    if (selectedAnalyticsFields.includes(fieldId)) {
      setSelectedAnalyticsFields(selectedAnalyticsFields.filter(f => f !== fieldId));
    } else {
      if (!analyticsChartTypes[fieldId]) {
        setChartTypeForField(fieldId, getDefaultChartType(fieldId));
      }
      setSelectedAnalyticsFields([...selectedAnalyticsFields, fieldId]);
    }
  };

  const handleAnalyticsDragStart = (fieldId: string) => {
    setDraggedAnalyticsField(fieldId);
  };

  const handleAnalyticsDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedAnalyticsField || draggedAnalyticsField === targetId) return;
    const fromIdx = selectedAnalyticsFields.indexOf(draggedAnalyticsField);
    const toIdx = selectedAnalyticsFields.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...selectedAnalyticsFields];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedAnalyticsField);
    setSelectedAnalyticsFields(reordered);
  };

  const getFieldDataWithDates = (fieldId: string): { values: string[], dates: string[], fieldName: string, isDateField: boolean } => {
    const field = infoPageFields.find(f => f.id === fieldId);
    const isDateField = field?.dataType === 'DATE';
    const dataTableField = dataTableFields.find(f => f.id === fieldId);
    
    const values: string[] = [];
    const dates: string[] = [];
    const validSessions = (project.sessions || []).filter(s => s && s.id);

    if (dataTableField) {
      for (const session of validSessions) {
        const sessionValidations = allValidations.filter(v => 
          v.sessionId === session.id && 
          v.fieldId === dataTableField.valueId &&
          v.extractedValue && 
          v.extractedValue !== 'null' && 
          v.extractedValue !== '-'
        );
        for (const v of sessionValidations) {
          if (v.extractedValue) {
            values.push(v.extractedValue);
            const sessionDate = (session as any).createdAt;
            if (sessionDate) dates.push(sessionDate);
            else dates.push('');
          }
        }
      }
      return { values, dates, fieldName: dataTableField.name, isDateField: false };
    }

    const column = columnConfigs.find(c => c.id === fieldId) || infoPageFields.find(f => f.id === fieldId);
    if (!column) return { values: [], dates: [], fieldName: 'Unknown', isDateField };

    const columnConfig: ColumnConfig = {
      id: column.id,
      name: column.name,
      visible: true,
      orderIndex: 0,
      valueId: column.valueId,
      stepId: column.stepId,
      fieldIdentifierId: column.fieldIdentifierId
    };

    for (const session of validSessions) {
      const value = getExtractedValue(session.id, columnConfig);
      if (value && value !== '-') {
        values.push(value);
        const sessionDate = (session as any).createdAt;
        if (sessionDate) dates.push(sessionDate);
        else dates.push('');
      }
    }

    return { values, dates, fieldName: column.name, isDateField };
  };

  // Get all data for selected fields from sessions
  const getFieldDataForAnalytics = (fieldId: string): { values: string[], fieldName: string } => {
    // Check if it's a data table field
    const dataTableField = dataTableFields.find(f => f.id === fieldId);
    if (dataTableField) {
      // For data table fields, get all extracted values across all sessions
      const values: string[] = [];
      const validSessions = (project.sessions || []).filter(s => s && s.id);
      
      for (const session of validSessions) {
        const sessionValidations = allValidations.filter(v => 
          v.sessionId === session.id && 
          v.fieldId === dataTableField.valueId &&
          v.extractedValue && 
          v.extractedValue !== 'null' && 
          v.extractedValue !== '-'
        );
        for (const v of sessionValidations) {
          if (v.extractedValue) {
            values.push(v.extractedValue);
          }
        }
      }
      
      return { values, fieldName: dataTableField.name };
    }
    
    // Info page fields
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

  const buildTimelineChart = (fieldId: string): ChartConfig | null => {
    const data = getFieldDataWithDates(fieldId);
    if (data.values.length === 0) return null;

    const parsedDates: Date[] = [];
    const dateSources = data.isDateField ? data.values : data.dates;
    for (const raw of dateSources) {
      if (!raw) continue;
      const parsed = new Date(raw.trim());
      if (!isNaN(parsed.getTime())) parsedDates.push(parsed);
    }
    if (parsedDates.length === 0) return null;

    const minDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));
    const spanDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

    type BucketMode = 'week' | 'month' | 'quarter' | 'year';
    let bucketMode: BucketMode;
    if (spanDays <= 90) bucketMode = 'week';
    else if (spanDays <= 730) bucketMode = 'month';
    else if (spanDays <= 2190) bucketMode = 'quarter';
    else bucketMode = 'year';

    const getWeekStart = (d: Date) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const dow = day.getDay();
      day.setDate(day.getDate() - dow);
      return day;
    };

    const bucketKey = (d: Date): string => {
      switch (bucketMode) {
        case 'week': {
          const ws = getWeekStart(d);
          return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
        }
        case 'month':
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        case 'quarter': {
          const q = Math.floor(d.getMonth() / 3) + 1;
          return `${d.getFullYear()} Q${q}`;
        }
        case 'year':
          return `${d.getFullYear()}`;
      }
    };

    const formatLabel = (key: string): string => {
      switch (bucketMode) {
        case 'week': {
          const d = new Date(key);
          return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
        }
        case 'month': {
          const [y, m] = key.split('-');
          const d = new Date(parseInt(y), parseInt(m) - 1);
          return `${d.toLocaleString('default', { month: 'short' })} ${y.slice(2)}`;
        }
        case 'quarter':
        case 'year':
          return key;
      }
    };

    const timePoints: Record<string, number> = {};
    for (const d of parsedDates) {
      const key = bucketKey(d);
      timePoints[key] = (timePoints[key] || 0) + 1;
    }

    const allBucketKeys: string[] = [];
    const incrementBucket = (d: Date): Date => {
      const next = new Date(d);
      switch (bucketMode) {
        case 'week': next.setDate(next.getDate() + 7); break;
        case 'month': next.setMonth(next.getMonth() + 1); break;
        case 'quarter': next.setMonth(next.getMonth() + 3); break;
        case 'year': next.setFullYear(next.getFullYear() + 1); break;
      }
      return next;
    };
    const startBucket = (d: Date): Date => {
      const s = new Date(d);
      switch (bucketMode) {
        case 'week': return getWeekStart(s);
        case 'month': return new Date(s.getFullYear(), s.getMonth(), 1);
        case 'quarter': return new Date(s.getFullYear(), Math.floor(s.getMonth() / 3) * 3, 1);
        case 'year': return new Date(s.getFullYear(), 0, 1);
      }
    };
    let cursor = startBucket(minDate);
    const endCursor = startBucket(maxDate);
    while (cursor <= endCursor) {
      allBucketKeys.push(bucketKey(cursor));
      cursor = incrementBucket(cursor);
    }

    const chartData = allBucketKeys.map(k => ({ name: formatLabel(k), value: timePoints[k] || 0 }));
    const bucketLabel = bucketMode === 'week' ? 'Weekly' : bucketMode === 'month' ? 'Monthly' : bucketMode === 'quarter' ? 'Quarterly' : 'Yearly';
    return {
      type: 'timeline',
      title: `${data.fieldName} Over Time (${bucketLabel})`,
      fieldName: data.fieldName,
      fieldId,
      data: chartData
    };
  };

  const buildTotalCard = (fieldId: string): ChartConfig | null => {
    if (fieldId === 'workflow-status') {
      const validSessions = (project.sessions || []).filter(s => s && s.id);
      const total = validSessions.length;
      const statusSet = new Set<string>();
      for (const session of validSessions) {
        statusSet.add((session as any).workflowStatus || workflowStatusOptions[0] || 'Unknown');
      }
      return {
        type: 'total',
        title: 'Workflow Status',
        fieldName: 'Workflow Status',
        fieldId,
        data: [{ name: 'Total Sessions', value: total }, { name: 'Status Types', value: statusSet.size }]
      };
    }
    const data = getFieldDataForAnalytics(fieldId);
    if (data.values.length === 0) return null;
    const uniqueValues = new Set(data.values.map(v => v.trim().toLowerCase())).size;
    return {
      type: 'total',
      title: data.fieldName,
      fieldName: data.fieldName,
      fieldId,
      data: [{ name: 'Total Entries', value: data.values.length }, { name: 'Unique Values', value: uniqueValues }]
    };
  };

  const buildRankingChart = (fieldId: string): ChartConfig | null => {
    let valueCounts: Record<string, number> = {};
    let fieldName = '';

    if (fieldId === 'workflow-status') {
      fieldName = 'Workflow Status';
      const validSessions = (project.sessions || []).filter(s => s && s.id);
      for (const session of validSessions) {
        const ws = (session as any).workflowStatus || workflowStatusOptions[0] || 'Unknown';
        valueCounts[ws] = (valueCounts[ws] || 0) + 1;
      }
    } else {
      const data = getFieldDataForAnalytics(fieldId);
      if (data.values.length === 0) return null;
      fieldName = data.fieldName;
      for (const val of data.values) {
        const normalized = val.trim();
        if (normalized) {
          valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
        }
      }
    }

    const sorted = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));

    if (sorted.length === 0) return null;
    return {
      type: 'ranking',
      title: `${fieldName} Ranking`,
      fieldName,
      fieldId,
      data: sorted
    };
  };

  // Generate pie chart data for a kanban step (aggregate status breakdown across all sessions)
  const generateKanbanChartData = (stepId: string): ChartConfig | null => {
    const step = kanbanProgressData?.kanbanSteps?.find(s => s.stepId === stepId);
    if (!step) return null;
    
    // Aggregate status counts across all sessions
    const aggregatedCounts: Record<string, number> = {};
    for (const col of step.statusColumns) {
      aggregatedCounts[col] = 0;
    }
    
    const sessions = project.sessions || [];
    for (const session of sessions) {
      const sessionProgress = kanbanProgressData?.progress?.[session.id]?.[stepId];
      if (sessionProgress?.statusBreakdown) {
        for (const [status, count] of Object.entries(sessionProgress.statusBreakdown)) {
          aggregatedCounts[status] = (aggregatedCounts[status] || 0) + count;
        }
      }
    }
    
    // Build chart data using configured column colors
    const data = step.statusColumns.map((status, index) => ({
      name: status,
      value: aggregatedCounts[status] || 0,
      color: step.columnColors?.[index] || CHART_COLORS[index % CHART_COLORS.length]
    })).filter(d => d.value > 0);
    
    if (data.length === 0) return null;
    
    return {
      type: 'pie',
      title: `${step.stepName} - Task Status`,
      fieldName: step.stepName,
      fieldId: `kanban-${stepId}`,
      data
    };
  };

  // Generate charts using AI
  const generateAnalyticsCharts = async () => {
    if (selectedAnalyticsFields.length === 0) {
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
      const charts: ChartConfig[] = [];
      
      const aiFieldData: { fieldId: string; fieldName: string; values: string[]; chartType: ChartType }[] = [];
      
      for (const fieldId of selectedAnalyticsFields) {
        const chartType = getChartTypeForField(fieldId);
        
        if (fieldId.startsWith('kanban-')) {
          const stepId = fieldId.replace('kanban-', '');
          if (chartType === 'total') {
            const chart = buildTotalCard(fieldId);
            if (chart) charts.push(chart);
          } else if (chartType === 'ranking') {
            const chart = buildRankingChart(fieldId);
            if (chart) charts.push(chart);
          } else {
            const kanbanChart = generateKanbanChartData(stepId);
            if (kanbanChart) {
              kanbanChart.type = chartType;
              charts.push(kanbanChart);
            }
          }
          continue;
        }

        if (chartType === 'timeline') {
          const chart = buildTimelineChart(fieldId);
          if (chart) charts.push(chart);
          continue;
        }

        if (chartType === 'total') {
          const chart = buildTotalCard(fieldId);
          if (chart) charts.push(chart);
          continue;
        }

        if (chartType === 'ranking') {
          const chart = buildRankingChart(fieldId);
          if (chart) charts.push(chart);
          continue;
        }

        if (fieldId === 'workflow-status' && workflowStatusOptions.length > 0) {
          const statusCounts: Record<string, number> = {};
          for (const opt of workflowStatusOptions) {
            statusCounts[opt] = 0;
          }
          const validSessions = (project.sessions || []).filter(s => s && s.id);
          for (const session of validSessions) {
            const ws = (session as any).workflowStatus || workflowStatusOptions[0];
            if (statusCounts[ws] !== undefined) {
              statusCounts[ws]++;
            } else {
              statusCounts[ws] = (statusCounts[ws] || 0) + 1;
            }
          }
          const statusData = workflowStatusOptions
            .map((opt, idx) => ({
              name: opt,
              value: statusCounts[opt] || 0,
              color: workflowStatusColors[idx] || CHART_COLORS[idx % CHART_COLORS.length]
            }))
            .filter(d => d.value > 0);
          if (statusData.length > 0) {
            charts.push({
              type: chartType,
              title: 'Workflow Status Distribution',
              fieldName: 'Workflow Status',
              fieldId: 'workflow-status',
              data: statusData
            });
          }
          continue;
        }

        const data = getFieldDataForAnalytics(fieldId);
        if (data.values.length > 0) {
          aiFieldData.push({ fieldId, ...data, chartType });
        }
      }
      
      if (aiFieldData.length > 0) {
        const response = await apiRequest(`/api/analytics/generate-charts`, {
          method: 'POST',
          body: JSON.stringify({ fieldData: aiFieldData.map(f => ({ fieldName: f.fieldName, values: f.values, chartType: f.chartType })) })
        }) as { charts?: ChartConfig[] };

        if (response && response.charts && Array.isArray(response.charts)) {
          const fieldNameToId: Record<string, string> = {};
          for (const f of aiFieldData) {
            fieldNameToId[f.fieldName] = f.fieldId;
          }
          for (const chart of response.charts) {
            chart.fieldId = fieldNameToId[chart.fieldName] || chart.fieldName;
          }
          charts.push(...response.charts);
        }
      }

      charts.sort((a, b) => {
        const idxA = selectedAnalyticsFields.indexOf(a.fieldId || '');
        const idxB = selectedAnalyticsFields.indexOf(b.fieldId || '');
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
      
      if (charts.length === 0) {
        toast({
          title: "No data available",
          description: "Selected fields have no data to analyze",
          variant: "destructive",
        });
        setIsGeneratingCharts(false);
        return;
      }

      setGeneratedCharts(charts);
      setShowAnalyticsPane(true);
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

  const clearAnalytics = () => {
    setGeneratedCharts([]);
    setShowAnalyticsPane(false);
    setSelectedAnalyticsFields([]);
    setAnalyticsChartTypes({});
  };

  // Refresh analytics - refetch data, check emails, and regenerate charts
  const refreshAnalytics = async () => {
    setIsGeneratingCharts(true);
    try {
      // Check for new emails if the project has an inbox
      if (project.inboxEmailAddress) {
        try {
          const emailResult = await apiRequest(`/api/projects/${project.id}/inbox/process`, { method: "POST" });
          if (emailResult?.sessionsCreated > 0) {
            toast({
              title: "New emails processed",
              description: `Created ${emailResult.sessionsCreated} new session(s) from email`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
          }
        } catch (emailError) {
          console.error('Failed to check emails:', emailError);
        }
      }
      
      await refetchKanbanProgress();
      // Wait a tick for state to update, then regenerate charts
      setTimeout(() => {
        const charts: ChartConfig[] = [];
        
        // Regenerate charts for selected kanban fields
        for (const fieldId of selectedAnalyticsFields) {
          if (fieldId.startsWith('kanban-')) {
            const stepId = fieldId.replace('kanban-', '');
            const kanbanChart = generateKanbanChartData(stepId);
            if (kanbanChart) {
              charts.push(kanbanChart);
            }
          }
        }
        
        if (charts.length > 0) {
          setGeneratedCharts(charts);
        }
        setIsGeneratingCharts(false);
      }, 100);
    } catch (error) {
      console.error('Failed to refresh analytics:', error);
      setIsGeneratingCharts(false);
    }
  };

  // Get verification progress for a session (for non-kanban projects)
  const getSessionProgress = (sessionId: string) => {
    // Safety check for sessionId
    if (!sessionId) return { verified: 0, total: 0, percentage: 0 };
    
    // Fallback to field validation progress for non-kanban projects
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return { verified: 0, total: 0, percentage: 0 };
    
    const verified = sessionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const total = sessionValidations.length;
    // Only show 100% if truly 100% verified, otherwise round down to avoid confusion
    const exactPercentage = (verified / total) * 100;
    const percentage = verified === total ? 100 : Math.floor(exactPercentage);
    
    return { verified, total, percentage };
  };

  // Get kanban progress for a specific session and step
  const getKanbanStepProgress = (sessionId: string, stepId: string) => {
    if (!sessionId || !stepId) return { total: 0, completed: 0, percentage: 0 };
    
    const sessionProgress = kanbanProgressData?.progress?.[sessionId];
    if (!sessionProgress) return { total: 0, completed: 0, percentage: 0 };
    
    const stepProgress = sessionProgress[stepId];
    if (!stepProgress) return { total: 0, completed: 0, percentage: 0 };
    
    return {
      total: stepProgress.total,
      completed: stepProgress.completed,
      percentage: stepProgress.percentage
    };
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

  // Portal target for header action buttons
  const headerSlot = typeof document !== 'undefined' ? document.getElementById('header-actions-slot') : null;

  // Action buttons to render in header
  const actionButtons = (
    <>
      {/* Analytics Button */}
      <Button
        variant="outline"
        size="sm"
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

      {/* Single Refresh Button - refreshes sessions, emails, and analytics if open */}
      <Button
        variant="outline"
        size="icon"
        onClick={async () => {
          setIsRefreshingSessions(true);
          try {
            if (project.inboxEmailAddress) {
              try {
                const emailResult = await apiRequest(`/api/projects/${project.id}/inbox/process`, { method: "POST" });
                if (emailResult?.sessionsCreated > 0) {
                  toast({
                    title: "New emails processed",
                    description: `Created ${emailResult.sessionsCreated} new session(s) from email`,
                  });
                }
              } catch (emailError) {
                console.error('Failed to check emails:', emailError);
              }
            }
            await queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
            await queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
            if (showAnalyticsPane && generatedCharts.length > 0) {
              await refreshAnalytics();
            }
          } finally {
            setIsRefreshingSessions(false);
          }
        }}
        title="Refresh"
        disabled={isRefreshingSessions || isGeneratingCharts}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshingSessions || isGeneratingCharts ? 'animate-spin' : ''}`} />
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
      </Dialog>
    </>
  );

  return (
    <div>
      {/* Render action buttons into header slot via portal */}
      {headerSlot && createPortal(actionButtons, headerSlot)}

      {/* Create Session Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogContent className={requiredDocumentTypes.length > 0 ? "sm:max-w-lg" : "sm:max-w-md"}>
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
                      if (e.key === 'Enter' && requiredDocumentTypes.length === 0) {
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
                
                {/* Required Document Uploads */}
                {requiredDocumentTypes.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-amber-600" />
                      <Label className="text-sm font-medium">Required Documents</Label>
                    </div>
                    <div className="space-y-2">
                      {requiredDocumentTypes.map((docType) => {
                        const validation = documentValidations[docType.id];
                        const hasFile = !!documentUploads[docType.id];
                        const isValidating = validation?.isValidating;
                        const isValid = validation?.isValid && !isValidating;
                        const isInvalid = hasFile && validation && !validation.isValid && !isValidating;
                        
                        return (
                          <div
                            key={docType.id}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              isValidating
                                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10 border-dashed'
                                : isValid
                                  ? 'border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
                                  : isInvalid
                                    ? 'border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
                                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 border-dashed'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {isValidating && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                  {isValid && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  {isInvalid && <AlertCircle className="h-4 w-4 text-red-500" />}
                                  <span className="font-medium text-sm">{docType.name}</span>
                                </div>
                                {docType.description && !hasFile && (
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {docType.description}
                                  </div>
                                )}
                                {isValidating && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Validating document...
                                  </div>
                                )}
                                {isValid && (
                                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Document accepted
                                  </div>
                                )}
                                {isInvalid && validation && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                                      Document does not match requirements
                                    </div>
                                    {validation.guidance && (
                                      <div className="text-xs text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                                        {validation.guidance}
                                      </div>
                                    )}
                                    {validation.missingElements && validation.missingElements.length > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        Missing: {validation.missingElements.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {hasFile ? (
                                  <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-1.5 ${isValid ? 'text-green-600 dark:text-green-400' : isInvalid ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                      <FileText className="h-4 w-4" />
                                      <span className="text-xs truncate max-w-[100px]">
                                        {documentUploads[docType.id]?.name}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                      onClick={() => handleDocumentUpload(docType.id, null)}
                                      disabled={isValidating}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.xlsx,.xls,.doc,.docx,.txt"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleDocumentUpload(docType.id, file);
                                        }
                                      }}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      asChild
                                    >
                                      <span>
                                        <Upload className="h-3 w-3 mr-1" />
                                        Upload
                                      </span>
                                    </Button>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelCreate}
                    disabled={createSessionMutation.isPending || uploadingDocuments}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitCreate}
                    disabled={
                      createSessionMutation.isPending || 
                      uploadingDocuments || 
                      !sessionName.trim() ||
                      (requiredDocumentTypes.length > 0 && requiredDocumentTypes.some(dt => !documentUploads[dt.id]))
                    }
                  >
                    {uploadingDocuments ? "Uploading..." : createSessionMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
      </Dialog>

      {/* Column Settings Modal */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Column Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Show or hide fields as columns. Drag to reorder.
            </p>
            {columnConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fields configured in this project.
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
                      {column.isDataTable && (
                        <Badge variant="secondary" className="text-xs">Count</Badge>
                      )}
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
            {allConfigurableFields.length === 0 && (!kanbanProgressData?.kanbanSteps || kanbanProgressData.kanbanSteps.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fields configured in this project.
              </p>
            ) : (() => {
              const allFields: { id: string; name: string; badge?: string; badgeClass?: string; bgClass?: string; chartOptions: ChartType[] }[] = [];
              if (workflowStatusOptions.length > 0) {
                allFields.push({ id: 'workflow-status', name: 'Workflow Status', badge: 'Status', badgeClass: 'bg-purple-100 dark:bg-purple-900/30', bgClass: 'bg-purple-50/50 dark:bg-purple-900/10', chartOptions: ['pie', 'bar', 'total', 'ranking'] });
              }
              for (const field of infoPageFields) {
                allFields.push({ id: field.id, name: field.name, badge: field.dataType === 'DATE' ? 'Date' : undefined, badgeClass: 'bg-blue-100 dark:bg-blue-900/30', chartOptions: ['pie', 'bar', 'timeline', 'total', 'ranking'] });
              }
              for (const field of dataTableFields) {
                allFields.push({ id: field.id, name: field.name, badge: 'Data', badgeClass: 'bg-green-100 dark:bg-green-900/30', bgClass: 'bg-green-50/50 dark:bg-green-900/10', chartOptions: ['pie', 'bar', 'timeline', 'total', 'ranking'] });
              }
              for (const step of (kanbanProgressData?.kanbanSteps || [])) {
                allFields.push({ id: `kanban-${step.stepId}`, name: step.stepName, badge: 'Tasks', bgClass: 'bg-blue-50/50 dark:bg-blue-900/10', chartOptions: ['pie', 'bar', 'total', 'ranking'] });
              }
              const selectedFields = selectedAnalyticsFields.map(id => allFields.find(f => f.id === id)).filter(Boolean) as typeof allFields;
              const unselectedFields = allFields.filter(f => !selectedAnalyticsFields.includes(f.id));
              
              const renderFieldRow = (field: typeof allFields[0], isSelected: boolean) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 ${field.bgClass || ''} ${isSelected ? 'border-[#4F63A4]/30 bg-[#4F63A4]/5' : ''}`}
                  draggable={isSelected}
                  onDragStart={() => handleAnalyticsDragStart(field.id)}
                  onDragOver={(e) => handleAnalyticsDragOver(e, field.id)}
                  onDragEnd={() => setDraggedAnalyticsField(null)}
                >
                  {isSelected && (
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                  )}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleAnalyticsField(field.id)}
                  />
                  <span className="flex-1 text-sm flex items-center gap-2 cursor-pointer min-w-0" onClick={() => toggleAnalyticsField(field.id)}>
                    <span className="truncate">{field.name}</span>
                    {field.badge && (
                      <Badge variant="secondary" className={`text-xs flex-shrink-0 ${field.badgeClass || ''}`}>{field.badge}</Badge>
                    )}
                  </span>
                  {isSelected && (
                    <Select value={getChartTypeForField(field.id)} onValueChange={(v) => setChartTypeForField(field.id, v as ChartType)}>
                      <SelectTrigger className="w-[110px] h-8 text-xs flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.chartOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>
                            {opt === 'pie' ? 'Pie' : opt === 'bar' ? 'Bar' : opt === 'timeline' ? 'Timeline' : opt === 'total' ? 'Total Card' : 'Ranking'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
              
              return (
                <div className="space-y-2">
                  {selectedFields.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Selected — drag to reorder</p>
                      {selectedFields.map(f => renderFieldRow(f, true))}
                    </>
                  )}
                  {unselectedFields.length > 0 && (
                    <>
                      {selectedFields.length > 0 && <div className="border-t my-2" />}
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Available Fields</p>
                      {unselectedFields.map(f => renderFieldRow(f, false))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setSelectedAnalyticsFields([])}>
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAnalyticsModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={generateAnalyticsCharts}
                disabled={selectedAnalyticsFields.length === 0 || isGeneratingCharts}
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
      {showAnalyticsPane && generatedCharts.length > 0 && (() => {
        const sortedCharts = [...generatedCharts].sort((a, b) => {
          const idxA = selectedAnalyticsFields.indexOf(a.fieldId || '');
          const idxB = selectedAnalyticsFields.indexOf(b.fieldId || '');
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
        return (
        <Card className="w-full mb-6 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 z-10"
            onClick={clearAnalytics}
            title="Close analytics"
          >
            <X className="h-4 w-4" />
          </Button>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sortedCharts.map((chart, index) => {
                const totalCharts = sortedCharts.length;
                const posInRow = index % 3;
                const remainingInRow = totalCharts - index;
                const isAloneOnRow = (posInRow === 0 && remainingInRow === 1);
                return (
                <div key={index} className={`border rounded-lg bg-background ${chart.type === 'total' || chart.type === 'ranking' ? 'p-4' : 'p-5'} ${isAloneOnRow ? 'md:col-span-3' : ''}`}>
                  <h4 className="text-base font-medium mb-3 text-center">{chart.title}</h4>
                  {chart.type === 'pie' ? (
                    <div className="h-[200px]">
                      <div className="flex h-full gap-3 items-center">
                        <div className="w-[40%] h-full flex-shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={chart.data}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={65}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {chart.data.map((entry, i) => (
                                  <Cell key={`cell-${i}`} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-[60%] flex flex-col justify-center gap-1 overflow-y-auto max-h-full pr-1">
                          {chart.data.map((entry, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs min-h-[20px]">
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: entry.color || CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="flex-1 truncate" title={entry.name}>{entry.name}</span>
                              <span className="font-semibold flex-shrink-0">{entry.value}</span>
                            </div>
                          ))}
                          <div className="border-t pt-1 mt-0.5 flex items-center gap-1.5 text-xs font-semibold">
                            <span className="flex-1">Total</span>
                            <span>{chart.data.reduce((sum, d) => sum + d.value, 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : chart.type === 'bar' ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chart.data} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={4}>
                            {chart.data.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : chart.type === 'timeline' ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart.data}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={45} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#4F63A4" strokeWidth={2} dot={{ fill: '#4F63A4', r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : chart.type === 'total' ? (
                    <div className="flex items-center justify-center gap-6 py-3">
                      {chart.data.map((item, i) => (
                        <div key={i} className="text-center">
                          <div className="text-3xl font-bold text-[#4F63A4]">{item.value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{item.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : chart.type === 'ranking' ? (
                    <div className="max-h-[200px] overflow-y-auto">
                      <div className="space-y-1">
                        {chart.data.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50">
                            <span className="text-xs font-semibold text-muted-foreground w-5 text-right">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs truncate" title={entry.name}>{entry.name}</span>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">({entry.value})</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1 mt-0.5">
                                <div 
                                  className="h-1 rounded-full transition-all"
                                  style={{ 
                                    width: `${(entry.value / chart.data[0].value) * 100}%`,
                                    backgroundColor: entry.color || CHART_COLORS[i % CHART_COLORS.length]
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        );
      })()}

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
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="sessionName" className="py-3 w-1/3">{project.mainObjectName || 'Session'} Name</SortableHeader>
                    <SortableHeader field="createdAt" className="py-3 whitespace-nowrap">Created</SortableHeader>
                    {workflowStatusOptions.length > 0 && (
                      <TableHead className="py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-muted-foreground">Status</span>
                      </TableHead>
                    )}
                    <SortableHeader field="documentCount" className="py-3 text-center">Docs</SortableHeader>
                    {/* Dynamic columns from info page fields */}
                    {visibleColumns.map(column => (
                      <TableHead key={column.id} className="py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-muted-foreground">{column.name}</span>
                      </TableHead>
                    ))}
                    {/* Kanban progress columns - one per kanban step */}
                    {kanbanProgressData?.kanbanSteps?.map((step) => (
                      <TableHead key={`kanban-header-${step.stepId}`} className="py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-muted-foreground">{step.stepName}</span>
                      </TableHead>
                    ))}
                    {/* Fallback progress column for non-kanban projects */}
                    {(!kanbanProgressData?.hasKanban || !kanbanProgressData?.kanbanSteps?.length) && (
                      <SortableHeader field="progress" className="py-3 whitespace-nowrap">Progress</SortableHeader>
                    )}
                    <SortableHeader field="status" className="py-3 text-center">
                      <div className="flex justify-center">
                        <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {sortedSessions.map((session) => {
                  if (!session || !session.id) return null;
                  const progress = getSessionProgress(session.id);
                  const verificationStatus = getVerificationStatus(session.id);
                  
                  return (
                    <TableRow key={session.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!(session as any).isViewed ? 'bg-gray-100 dark:bg-gray-800/60' : ''}`}>
                      <TableCell className="py-3">
                        <Link href={`/projects/${project.id}/sessions/${session.id}`}>
                          <div className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate flex items-center gap-1.5">
                                {session.sessionName || 'Untitled Session'}
                                {!(session as any).isViewed && (
                                  <Circle className="h-2 w-2 flex-shrink-0 fill-[#4F63A4] text-[#4F63A4]" />
                                )}
                              </p>
                              {session.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {session.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-800 dark:text-gray-400">
                          <span>{session.createdAt ? new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown'}</span>
                          <span className="text-gray-500 dark:text-gray-500 ml-1">{session.createdAt ? new Date(session.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      </TableCell>
                      {workflowStatusOptions.length > 0 && (() => {
                        const displayStatus = (session as any).workflowStatus || workflowStatusOptions[0] || '';
                        return (
                          <TableCell className="py-3">
                            {displayStatus ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: getStatusColor(displayStatus) }}
                              >
                                {displayStatus}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })()}
                      <TableCell className="py-3 text-sm text-gray-800 dark:text-gray-300 text-center">
                        {session.documentCount || 0}
                      </TableCell>
                      {/* Dynamic column values */}
                      {visibleColumns.map(column => (
                        <TableCell key={column.id} className="py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-700 dark:text-gray-300" title={getExtractedValue(session.id, column)}>
                            {getExtractedValue(session.id, column) || '-'}
                          </span>
                        </TableCell>
                      ))}
                      {/* Kanban progress cells - one per kanban step */}
                      {kanbanProgressData?.kanbanSteps?.map((step) => {
                        const stepProgress = getKanbanStepProgress(session.id, step.stepId);
                        return (
                          <TableCell key={`kanban-cell-${step.stepId}`} className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full transition-all duration-300 ${
                                    stepProgress.percentage === 100 ? 'bg-green-600' : 
                                    stepProgress.percentage > 0 ? 'bg-green-600' : 'bg-gray-400'
                                  }`}
                                  style={{ width: `${stepProgress.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {stepProgress.completed}/{stepProgress.total}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                      {/* Fallback progress cell for non-kanban projects */}
                      {(!kanbanProgressData?.hasKanban || !kanbanProgressData?.kanbanSteps?.length) && (
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
                      )}
                      <TableCell className="py-3 text-center">
                        <div className="flex justify-center">
                          {verificationStatus === 'verified' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                          )}
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
