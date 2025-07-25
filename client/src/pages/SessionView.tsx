import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight, RotateCcw, FileText, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Check, User } from "lucide-react";
import { WaveIcon, FlowIcon, TideIcon, ShipIcon } from "@/components/SeaIcons";
import * as XLSX from 'xlsx';
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import ValidationIcon from "@/components/ValidationIcon";
import UserProfile from "@/components/UserProfile";
import ValidationProcessingDialog from "@/components/ValidationProcessingDialog";

import type { 
  ExtractionSession, 
  ProjectWithDetails, 
  FieldValidation,
  ValidationStatus 
} from "@shared/schema";

// AI Reasoning and Verification Modal Component
const AIReasoningModal = ({ 
  isOpen, 
  onClose, 
  reasoning, 
  fieldName, 
  confidenceScore,
  getFieldDisplayName,
  validation,
  onVerificationChange
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  reasoning: string; 
  fieldName: string; 
  confidenceScore: number;
  getFieldDisplayName: (fieldName: string) => string;
  validation: FieldValidation | undefined;
  onVerificationChange: (isVerified: boolean) => void;
}) => {
  const { toast } = useToast();
  const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'verified';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(reasoning);
      toast({
        title: "Copied to clipboard",
        description: "AI reasoning has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard. Please try selecting the text manually.",
        variant: "destructive"
      });
    }
  };

  const handleVerificationToggle = (verified: boolean) => {
    onVerificationChange(verified);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            AI Analysis - {getFieldDisplayName(fieldName)}
          </DialogTitle>
          <DialogDescription>
            Confidence Score: {confidenceScore}% - Detailed analysis and verification options
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm">
            {reasoning}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            <Button 
              variant={isVerified ? "secondary" : "default"}
              onClick={() => handleVerificationToggle(true)}
              className="flex items-center gap-2"
              disabled={isVerified}
            >
              <CheckCircle className="h-4 w-4" />
              {isVerified ? "Verified" : "Verify Field"}
            </Button>
            <Button 
              variant={!isVerified ? "secondary" : "outline"}
              onClick={() => handleVerificationToggle(false)}
              className="flex items-center gap-2"
              disabled={!isVerified}
            >
              <AlertTriangle className="h-4 w-4" />
              {!isVerified ? "Unverified" : "Unverify Field"}
            </Button>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={copyToClipboard} className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button onClick={onClose} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Badge Components
const ConfidenceBadge = ({ 
  confidenceScore, 
  reasoning, 
  fieldName,
  getFieldDisplayName,
  validation,
  onVerificationChange,
  isVerified
}: { 
  confidenceScore: number; 
  reasoning?: string; 
  fieldName: string;
  getFieldDisplayName: (fieldName: string) => string;
  validation: FieldValidation | undefined;
  onVerificationChange: (isVerified: boolean) => void;
  isVerified: boolean;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) {
      return { level: "high", color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200", description: "High confidence" };
    } else if (score >= 50) {
      return { level: "medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200", description: "Medium confidence" };
    } else {
      return { level: "low", color: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200", description: "Low confidence" };
    }
  };

  const confidence = getConfidenceLevel(confidenceScore);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${confidence.color}`}
        title={`${confidence.description} - Click for AI analysis and verification`}
      >
        Confidence: {confidenceScore}%
      </button>
      
      {/* Verification indicator - green tick in bottom right */}
      {isVerified && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
          <CheckCircle className="h-3 w-3 text-white" />
        </div>
      )}
      
      {reasoning && (
        <AIReasoningModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          reasoning={reasoning}
          fieldName={fieldName}
          confidenceScore={confidenceScore}
          getFieldDisplayName={getFieldDisplayName}
          validation={validation}
          onVerificationChange={onVerificationChange}
        />
      )}
    </div>
  );
};

const NotExtractedBadge = () => (
  <span 
    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20"
    title="This field was not extracted from the document"
  >
    Not Extracted
  </span>
);

const ManualInputBadge = () => (
  <span 
    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
    title="This field has been manually updated"
  >
    Manual Input
  </span>
);

// Custom validation toggle component for SessionView
const ValidationToggle = ({ fieldName, validation, onToggle }: { 
  fieldName: string; 
  validation: FieldValidation | undefined; 
  onToggle: (isVerified: boolean) => void;
}) => {
  if (!validation) {
    return <div className="text-xs text-gray-400">No validation data</div>;
  }

  const isVerified = validation.validationStatus === 'valid' || validation.validationStatus === 'verified';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onToggle(!isVerified)}
        className="flex items-center gap-1 text-sm hover:bg-gray-100 px-2 py-1 rounded"
        title={isVerified ? "Click to mark as unverified" : "Click to mark as verified"}
      >
        {isVerified ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-600 font-medium">Verified</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-red-600 font-medium">Unverified</span>
          </>
        )}
      </button>
    </div>
  );
};

export default function SessionView() {
  const { sessionId } = useParams(); // Remove projectId from params - we'll get it from session data
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
  const [hasRunAutoValidation, setHasRunAutoValidation] = useState(false);
  const [editingDisplayNames, setEditingDisplayNames] = useState<Record<string, boolean>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationStep, setValidationStep] = useState<'validating' | 'complete'>('validating');
  const [validationProgress, setValidationProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('all-data');
  const [selectedReasoning, setSelectedReasoning] = useState<{
    reasoning: string;
    fieldName: string;
    confidenceScore: number;
  } | null>(null);
  
  // Column sorting and resizing state
  const [sortConfig, setSortConfig] = useState<{ 
    key: string; 
    direction: 'asc' | 'desc' | null;
    collectionId?: string;
  } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const toggleCollectionExpansion = (collectionName: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionName)) {
        newSet.delete(collectionName);
      } else {
        newSet.add(collectionName);
      }
      return newSet;
    });
  };

  // Sorting functions
  const handleSort = (key: string, collectionId?: string) => {
    setSortConfig(prev => {
      if (prev?.key === key && prev?.collectionId === collectionId) {
        // Cycle through: null -> asc -> desc -> null
        if (prev.direction === null) return { key, direction: 'asc', collectionId };
        if (prev.direction === 'asc') return { key, direction: 'desc', collectionId };
        return null;
      }
      return { key, direction: 'asc', collectionId };
    });
  };

  const getSortIcon = (key: string, collectionId?: string) => {
    if (sortConfig?.key === key && sortConfig?.collectionId === collectionId) {
      if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4" />;
      if (sortConfig.direction === 'desc') return <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  };

  // Column resizing functions
  const handleMouseDown = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const element = e.currentTarget.closest('th') as HTMLElement;
    const startWidth = element ? element.offsetWidth : 150;
    
    setResizing({ columnId, startX, startWidth });
    
    // Add global dragging class for consistent cursor behavior
    document.body.classList.add('column-resizing');
    (e.currentTarget as HTMLElement).classList.add('dragging');
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizing) return;
    
    e.preventDefault();
    
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(80, resizing.startWidth + diff); // Minimum width of 80px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing.columnId]: newWidth
    }));
  };

  const handleMouseUp = () => {
    setResizing(null);
    
    // Remove global dragging classes
    document.body.classList.remove('column-resizing');
    document.querySelectorAll('.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
  };

  // Add event listeners for resizing
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing]);

  // Sort data function
  const sortCollectionData = (itemsWithIndices: any[], collection: any, sortConfig: any) => {
    if (!sortConfig || sortConfig.collectionId !== collection.id) return itemsWithIndices;
    
    const property = collection.properties.find((p: any) => p.propertyName === sortConfig.key);
    if (!property) return itemsWithIndices;
    
    return [...itemsWithIndices].sort((a, b) => {
      // Get values for comparison using original indices
      const aValidation = getValidation(`${collection.collectionName}.${property.propertyName}[${a.originalIndex}]`);
      const bValidation = getValidation(`${collection.collectionName}.${property.propertyName}[${b.originalIndex}]`);
      
      let aValue = aValidation?.extractedValue || a.item[property.propertyName] || '';
      let bValue = bValidation?.extractedValue || b.item[property.propertyName] || '';
      
      // Handle different field types
      if (property.fieldType === 'NUMBER') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (property.fieldType === 'DATE') {
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }
      
      // Compare values
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // First get the session to obtain the projectId
  const { data: session, isLoading: sessionLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}`)
  });

  // Extract projectId from session data
  const projectId = session?.projectId;

  // Then get the project using projectId from session data
  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`),
    enabled: !!projectId // Only run this query when we have a projectId
  });

  const { data: validations = [], isLoading: validationsLoading } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations`),
    onSuccess: (data) => {
      console.log(`Session ${sessionId} - Validations loaded:`, data.length);
      if (data.length > 0) {
        console.log('Sample validation:', data[0]);
        console.log('All field names:', data.map(v => v.fieldName));
        console.log('Validations with extracted values:', data.filter(v => v.extractedValue).map(v => ({
          fieldName: v.fieldName, 
          extractedValue: v.extractedValue, 
          confidenceScore: v.confidenceScore
        })));
      }
    }
  });

  // Fetch project-level validations for statistics cards
  const { data: projectValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', projectId],
    enabled: !!projectId
  });

  // Initialize collapse state once data is loaded
  useEffect(() => {
    if (project?.collections && validations && session && !hasInitializedCollapsed) {
      const extractedData = session.extractedData ? JSON.parse(session.extractedData) : {};
      const initialExpanded = new Set<string>();
      
      project.collections.forEach(collection => {
        // Check if collection has data
        const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
        const hasData = collectionValidations.length > 0 || 
          (extractedData && extractedData[collection.collectionName] && 
           Array.isArray(extractedData[collection.collectionName]) && 
           extractedData[collection.collectionName].length > 0);
        
        // Empty lists start expanded, lists with data start collapsed
        if (!hasData) {
          initialExpanded.add(collection.collectionName);
        }
      });
      
      setExpandedCollections(initialExpanded);
      setHasInitializedCollapsed(true);
    }
  }, [project?.collections, validations, session, hasInitializedCollapsed]);

  const updateValidationMutation = useMutation({
    mutationFn: async (params: { id: string; data: Partial<FieldValidation> }) => {
      return apiRequest(`/api/validations/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(params.data)
      });
    },
    onSuccess: async () => {
      // First invalidate and wait for the validations to update
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      // Also invalidate the AllData project-level validation query
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Force refetch of the AllData query
      await queryClient.refetchQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Small delay to ensure query cache is updated
      setTimeout(async () => {
        const updatedValidations = queryClient.getQueryData<FieldValidation[]>(['/api/sessions', sessionId, 'validations']);
        if (updatedValidations && updatedValidations.length > 0) {
          const allVerified = updatedValidations.every(v => v.validationStatus === 'valid');
          const newStatus = allVerified ? 'verified' : 'in_progress';
          
          // Update session status in database
          await apiRequest(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          
          // Invalidate session query to update UI
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          
          // Invalidate project query to update AllData component
          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
        }
      }, 100);
      
      toast({
        title: "Field updated",
        description: "The field verification has been updated.",
      });
    },
    onError: (error: any) => {
      console.error('Failed to update field:', error);
      toast({
        title: "Failed to update field",
        description: error?.message || "An error occurred while updating the field.",
        variant: "destructive"
      });
    }
  });

  // Batch validation mutation for applying extraction rules post-extraction (silent background operation)
  const batchValidationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/sessions/${sessionId}/batch-validate`, {
        method: 'POST'
      });
    },
    onSuccess: async (result) => {
      // Complete validation progress and show completion briefly
      setValidationProgress(100);
      setValidationStep('complete');
      
      // Invalidate and refetch validation queries to update UI
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Hide dialog after showing completion for 1 second
      setTimeout(() => {
        setShowValidationDialog(false);
        setValidationProgress(0);
        setValidationStep('validating');
      }, 1000);
      
      console.log(`✅ Batch validation completed: ${result.fields_processed} fields processed`);
    },
    onError: (error: any) => {
      console.error('Batch validation failed:', error);
      setShowValidationDialog(false);
      setValidationProgress(0);
      setValidationStep('validating');
      toast({
        title: "Validation processing error",
        description: "Some validation rules may not have been applied correctly.",
        variant: "destructive"
      });
    }
  });

  // Handler for field verification changes
  const handleFieldVerification = (fieldName: string, isVerified: boolean) => {
    const validation = getValidation(fieldName);
    if (!validation) return;
    
    const newStatus: ValidationStatus = isVerified ? 'verified' : 'unverified';
    updateValidationMutation.mutate({
      id: validation.id,
      data: { validationStatus: newStatus }
    });
  };

  // Handler for bulk item verification (status column click)
  const handleItemVerification = (collectionName: string, recordIndex: number, isVerified: boolean) => {
    // Find all fields for this collection item
    const itemValidations = validations.filter(v => 
      v.collectionName === collectionName && 
      v.fieldName.includes(`[${recordIndex}]`)
    );
    
    const newStatus: ValidationStatus = isVerified ? 'verified' : 'unverified';
    
    // Update all fields for this item
    itemValidations.forEach(validation => {
      updateValidationMutation.mutate({
        id: validation.id,
        data: { validationStatus: newStatus }
      });
    });
  };

  // Auto-run batch validation after extraction redirect
  useEffect(() => {
    if (session && validations.length > 0 && !hasRunAutoValidation && !batchValidationMutation.isPending) {
      // Check if this session was recently created (within last 5 minutes) to determine if we just extracted
      const sessionCreatedAt = new Date(session.createdAt);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - sessionCreatedAt.getTime()) / (1000 * 60);
      
      // Only auto-validate for recently created sessions
      if (timeDiffMinutes <= 5) {
        console.log('🚀 Auto-running batch validation for new session');
        setHasRunAutoValidation(true);
        batchValidationMutation.mutate();
      } else {
        // Mark as already processed for older sessions
        setHasRunAutoValidation(true);
      }
    }
  }, [session, validations, hasRunAutoValidation, batchValidationMutation]);

  if (projectLoading || sessionLoading || validationsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {projectLoading && "Loading project..."}
            {sessionLoading && "Loading session..."}
            {validationsLoading && "Loading validation data..."}
          </p>
        </div>
      </div>
    );
  }

  if (!project || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h1>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline">Back to Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Parse extracted data from the session
  let extractedData: any = {};
  try {
    if (session.extractedData) {
      const parsedData = JSON.parse(session.extractedData);
      // Check for new aggregated multi-document structure first
      if (parsedData.aggregated_extraction?.extracted_data) {
        extractedData = parsedData.aggregated_extraction.extracted_data;
        console.log('Using aggregated multi-document data:', extractedData);
      } else if (parsedData.processed_documents && parsedData.processed_documents[0]) {
        // Fall back to first document's data for single-document sessions
        extractedData = parsedData.processed_documents[0].extraction_result?.extracted_data || {};
        console.log('Using first document data:', extractedData);
      } else if (parsedData.extracted_data) {
        // Handle structure where extracted_data is a direct property
        extractedData = parsedData.extracted_data;
      } else {
        // Simple flat structure for sample/legacy data
        extractedData = parsedData;
      }
    }
  } catch (error) {
    console.error('Failed to parse extracted data:', error);
  }

  // Get validation for a specific field
  const getValidation = (fieldName: string) => {
    // Filter all validations for this field name
    const fieldValidations = validations.filter(v => v.fieldName === fieldName);
    
    if (fieldValidations.length === 0) {
      console.log(`No validation found for ${fieldName}, available validations:`, validations.map(v => v.fieldName));
      return undefined;
    }
    
    // If there are multiple validation records, prioritize by:
    // 1. Records with actual extracted values (not null/empty)
    // 2. Most recent records (by createdAt)
    if (fieldValidations.length > 1) {
      console.log(`Multiple validations found for ${fieldName}:`, fieldValidations.map(v => ({ id: v.id, extractedValue: v.extractedValue, createdAt: v.createdAt })));
      
      // First priority: records with actual extracted values
      const validationsWithValues = fieldValidations.filter(v => 
        v.extractedValue !== null && 
        v.extractedValue !== undefined && 
        v.extractedValue !== "" && 
        v.extractedValue !== "null" && 
        v.extractedValue !== "undefined"
      );
      
      if (validationsWithValues.length > 0) {
        // Sort by createdAt descending (most recent first) and return the first one
        const bestValidation = validationsWithValues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        console.log(`Selected validation with value for ${fieldName}:`, bestValidation.extractedValue);
        
        // Debug logging for MSA field specifically
        if (fieldName === 'MSA ID/Number') {
          console.log(`MSA Field Debug - ExtractedValue: ${bestValidation.extractedValue}, ManuallyUpdated: ${bestValidation.manuallyUpdated}, ValidationStatus: ${bestValidation.validationStatus}`);
        }
        
        return bestValidation;
      }
      
      // Fallback: most recent record even if no value
      const mostRecent = fieldValidations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      console.log(`Selected most recent validation for ${fieldName}:`, mostRecent.extractedValue);
      return mostRecent;
    }
    
    return fieldValidations[0];
  };

  // Get session status based on field verification
  const getSessionStatus = () => {
    if (validations.length === 0) return 'in_progress';
    const allVerified = validations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    return allVerified ? 'verified' : 'in_progress';
  };

  // Get verification count helpers
  const getVerifiedCount = () => {
    return validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
  };

  const getTotalFieldCount = () => {
    return validations.length;
  };

  // Get verification progress
  const getVerificationProgress = () => {
    const verified = getVerifiedCount();
    const total = getTotalFieldCount();
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { verified, total, percentage };
  };

  // Function to get verification progress for a specific collection
  const getCollectionVerificationProgress = (collectionName: string) => {
    const collectionValidations = validations.filter(v => v.collectionName === collectionName);
    const totalFields = collectionValidations.length;
    const verifiedFields = collectionValidations.filter(v => v.validationStatus === 'verified' || v.validationStatus === 'valid').length;
    const percentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;
    
    return {
      verified: verifiedFields,
      total: totalFields,
      percentage
    };
  };

  // Get all unverified fields for consolidated reasoning
  const getUnverifiedFields = () => {
    return validations.filter(v => v.validationStatus !== 'valid' && v.validationStatus !== 'verified');
  };

  // Generate human-readable field names for reports, using meaningful identifiers for list items  
  const getHumanReadableFieldName = (validation: FieldValidation): string => {
    // For schema fields, use the field name directly
    if (!validation.fieldName.includes('.')) {
      return validation.fieldName;
    }
    
    // For collection properties, try to find a more meaningful identifier
    const parts = validation.fieldName.split('.');
    const collectionName = parts[0];
    const propertyPart = parts[1]; // e.g., "Country[0]"
    const basePropertyName = propertyPart.split('[')[0];
    const indexMatch = propertyPart.match(/\[(\d+)\]/);
    
    if (!indexMatch) {
      return `${collectionName} - ${basePropertyName}`;
    }
    
    const index = parseInt(indexMatch[1]);
    
    // Try to find a name field for this collection item to create a better identifier
    const nameFields = ['Name', 'name', 'Title', 'title', 'Description', 'description'];
    for (const nameField of nameFields) {
      const nameValidation = validations.find(v => 
        v.fieldName === `${collectionName}.${nameField}[${index}]` && 
        v.extractedValue && 
        v.extractedValue.trim() !== ''
      );
      
      if (nameValidation) {
        return `${nameValidation.extractedValue} - ${basePropertyName}`;
      }
    }
    
    // Fallback to item number if no name found
    return `${collectionName} ${index + 1} - ${basePropertyName}`;
  };

  // Generate data report text for email
  const generateDataReport = () => {
    const unverifiedFields = getUnverifiedFields();
    const sessionName = session.sessionName;
    const projectName = project.name;
    
    if (unverifiedFields.length === 0) {
      return `Data Verification Report - ${sessionName}

All data fields have been successfully verified for ${sessionName} in project ${projectName}. No additional information is required at this time.

Total Fields: ${getTotalFieldCount()}
Verified Fields: ${getVerifiedCount()}
Status: Complete`;
    }

    let report = `Data Verification Report - ${sessionName}

We are reviewing the extracted data for ${sessionName} and require additional information or clarification for the following fields:

MISSING OR UNVERIFIED INFORMATION:
`;

    unverifiedFields.forEach((validation, index) => {
      const displayName = getHumanReadableFieldName(validation);
      report += `\n${index + 1}. ${displayName}`;
      
      // Handle different types of unverified fields
      if (validation.validationStatus === 'invalid') {
        // Missing/not extracted fields
        report += `\nThis information was not found in the provided document. Please provide the correct value for this field.`;
      } else if (validation.validationStatus === 'manual') {
        // Manually entered fields
        report += `\nWe have recorded '${validation.extractedValue}' for this field based on manual input. Please confirm this value is accurate.`;
      } else if (validation.aiReasoning && validation.aiReasoning.includes('IDENTIFIED CONCERNS:')) {
        // Fields with AI reasoning (confidence issues, rule conflicts, etc.) - remove individual thank you messages
        const cleanedReasoning = validation.aiReasoning.replace(/\n*Thank you for your assistance\.\s*$/i, '');
        report += `\n${cleanedReasoning}`;
      } else if (validation.confidenceScore && validation.confidenceScore < 80) {
        // Fields with low confidence but no detailed reasoning
        report += `\nWe extracted '${validation.extractedValue}' for this field with ${validation.confidenceScore}% confidence. Please verify this information is accurate and complete.`;
      } else {
        // Fallback for any other unverified fields
        report += `\nPlease review and verify the extracted value: '${validation.extractedValue || 'No value found'}'`;
      }
      
      report += '\n';
    });

    report += `
Please review the above items and provide the missing information or confirm the accuracy of the extracted values. This will help us complete the data verification process.

Thank you for your assistance.`;

    return report;
  };

  const handleExportToExcel = async () => {
    try {
      if (!session?.id) {
        console.error('No session ID available for export');
        return;
      }

      console.log('Starting DIRECT database Excel export for session:', session.id);

      // Use the new direct API endpoint that bypasses frontend filtering
      const response = await fetch(`/api/sessions/${session.id}/direct-excel-data`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const excelData = await response.json();
      console.log('Received Excel data from server:', excelData);

      // Create Excel workbook using server data
      const workbook = XLSX.utils.book_new();

      // First, create main object sheet using server data
      const mainObjectSheetData = [
        ['Property', 'Value'],
        ...excelData.mainObject.map((item: any) => [item.property, item.value])
      ];
      
      const mainObjectSheet = XLSX.utils.aoa_to_sheet(mainObjectSheetData);
      XLSX.utils.book_append_sheet(workbook, mainObjectSheet, excelData.mainObjectName);

      // Create collection sheets using server data
      Object.entries(excelData.collections).forEach(([collectionName, collectionData]: [string, any]) => {
        console.log(`Creating Excel sheet for ${collectionName}:`, collectionData);
        
        // Build worksheet data with headers and records
        const worksheetData = [
          collectionData.headers,
          ...collectionData.records
        ];
        
        console.log(`Worksheet data for ${collectionName}:`, worksheetData);
        
        const collectionSheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, collectionSheet, collectionName);
      });

      // Generate filename with session name and timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

      console.log('Exporting Excel file:', filename);
      
      // Export the file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  const handleEdit = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName);
    
    // Handle date field formatting
    const fieldType = getFieldType(fieldName);
    if (fieldType === 'DATE') {
      // For date fields, always start with empty string if no valid date
      if (!currentValue || currentValue === 'null' || currentValue === 'undefined' || currentValue === null) {
        setEditValue('');
      } else {
        // Try to parse and format the date properly
        try {
          const date = new Date(currentValue);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD for date input
            const formattedDate = date.toISOString().split('T')[0];
            setEditValue(formattedDate);
          } else {
            setEditValue('');
          }
        } catch (error) {
          setEditValue('');
        }
      }
    } else {
      // For non-date fields, handle null/undefined values
      setEditValue(!currentValue || currentValue === 'null' || currentValue === 'undefined' ? '' : String(currentValue));
    }
  };

  const handleDateChange = async (fieldName: string, dateValue: string) => {
    const validation = getValidation(fieldName);
    if (validation) {
      let valueToStore = dateValue;
      
      // Handle empty date
      if (!dateValue || dateValue.trim() === '') {
        valueToStore = null;
      } else {
        // Validate the date format
        const dateObj = new Date(dateValue);
        if (!isNaN(dateObj.getTime())) {
          // Store as ISO date string for consistency
          valueToStore = dateObj.toISOString().split('T')[0];
        } else {
          valueToStore = null;
        }
      }
      
      try {
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            extractedValue: valueToStore,
            validationStatus: "manual",
            manuallyVerified: true,
            manuallyUpdated: true  // Mark as manually updated when user edits date
          }
        });
      } catch (error) {
        console.error('Failed to update date:', error);
        toast({
          title: "Failed to update date",
          description: "An error occurred while updating the date value.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSave = async (fieldName: string, newValue?: string) => {
    const validation = getValidation(fieldName);
    
    if (validation) {
      // Use provided value or current edit value
      const valueToUse = newValue !== undefined ? newValue : editValue;
      let valueToStore = valueToUse;
      const fieldType = getFieldType(fieldName);
      
      if (fieldType === 'DATE') {
        if (!valueToUse || valueToUse.trim() === '') {
          valueToStore = null;
        } else {
          // Validate the date format
          const dateObj = new Date(valueToUse);
          if (!isNaN(dateObj.getTime())) {
            // Store as ISO date string for consistency
            valueToStore = dateObj.toISOString().split('T')[0];
          } else {
            valueToStore = null;
          }
        }
      }
      
      try {
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            extractedValue: valueToStore,
            validationStatus: "manual",
            manuallyVerified: true,
            manuallyUpdated: true  // Mark as manually updated when user edits field
          }
        });
        
        // Force immediate UI update by invalidating all related queries
        await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
        
        // Force a refetch to update UI immediately
        await queryClient.refetchQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      } catch (error) {
        console.error('Failed to save field:', error);
        toast({
          title: "Failed to save field",
          description: "An error occurred while saving the field value.",
          variant: "destructive"
        });
      }
    }
    setEditingField(null);
    setEditValue("");
  };

  const handleVerificationToggle = async (fieldName: string, isVerified: boolean) => {
    const validation = getValidation(fieldName);
    if (validation) {
      try {
        // Preserve manual status when verifying manually entered fields
        const wasManuallyEntered = validation.validationStatus === 'manual';
        
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            validationStatus: wasManuallyEntered ? "manual" : (isVerified ? "valid" : "pending"),
            manuallyVerified: isVerified
          }
        });
      } catch (error) {
        console.error('Failed to toggle verification:', error);
        toast({
          title: "Failed to update verification",
          description: "An error occurred while updating field verification.",
          variant: "destructive"
        });
      }
    }
  };



  const handleRevertToAI = async (fieldName: string) => {
    const validation = getValidation(fieldName);
    
    if (validation && validation.originalExtractedValue !== undefined && validation.originalExtractedValue !== null) {
      try {
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            extractedValue: validation.originalExtractedValue,
            validationStatus: "pending", // Reset to pending since it's the original AI value
            aiReasoning: validation.originalAiReasoning,
            confidenceScore: validation.originalConfidenceScore,
            manuallyVerified: false
          }
        });
        
        toast({
          title: "Reverted to AI value",
          description: `${getFieldDisplayName(fieldName)} has been reverted to the original AI extracted value.`,
        });
      } catch (error) {
        console.error('Failed to revert to AI value:', error);
        toast({
          title: "Failed to revert",
          description: "An error occurred while reverting to the AI value.",
          variant: "destructive"
        });
      }
    }
  };

  const getFieldType = (fieldName: string) => {
    // Check schema fields first
    for (const field of project.schemaFields) {
      if (field.fieldName === fieldName) {
        return field.fieldType;
      }
    }
    
    // Check collection properties
    for (const collection of project.collections) {
      if (fieldName.startsWith(collection.collectionName + '.')) {
        const propertyName = fieldName.split('.')[1].split('[')[0]; // Remove [index] if present
        const property = collection.properties.find(p => p.propertyName === propertyName);
        if (property) {
          return property.propertyType;
        }
      }
    }
    
    return 'TEXT'; // Default fallback
  };



  const formatDateForDisplay = (value: any) => {
    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Not set';
    }
    
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // Format as a readable date
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (error) {
      // If parsing fails, return "Not set" for invalid dates
      return 'Not set';
    }
    
    return 'Not set';
  };

  const formatValueForDisplay = (value: any, fieldType: string) => {
    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Not set';
    }
    
    if (fieldType === 'DATE') {
      return formatDateForDisplay(value);
    } else if (fieldType === 'BOOLEAN') {
      // Handle boolean values properly
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      } else if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'yes') {
          return 'Yes';
        } else if (lowerValue === 'false' || lowerValue === 'no') {
          return 'No';
        }
      }
      return String(value);
    } else {
      return String(value);
    }
  };

  const getFieldDisplayName = (fieldName: string) => {
    // Check schema fields first
    for (const field of project.schemaFields) {
      if (field.fieldName === fieldName) {
        return field.fieldName; // Use the actual field name as display name
      }
    }
    
    // Check collection properties
    for (const collection of project.collections) {
      if (fieldName.startsWith(collection.collectionName + '.')) {
        const parts = fieldName.split('.');
        const propertyPart = parts[1]; // e.g., "Name[0]" or "Name"
        const basePropertyName = propertyPart.split('[')[0]; // Remove [index] if present
        const indexMatch = propertyPart.match(/\[(\d+)\]/);
        const index = indexMatch ? parseInt(indexMatch[1]) : null;
        
        if (index !== null) {
          return `${basePropertyName} (Item ${index + 1})`;
        } else {
          return `${basePropertyName}`;
        }
      }
    }
    
    return fieldName; // Fallback to original name
  };

  const renderFieldWithValidation = (fieldName: string, value: any, isSchemaField = false) => {
    const validation = getValidation(fieldName);
    const isEditing = editingField === fieldName;
    const fieldType = getFieldType(fieldName);
    const displayName = getFieldDisplayName(fieldName);
    
    const borderClass = isSchemaField ? "border-l-4 border-l-blue-500" : "";
    
    return (
      <div key={fieldName} className={`flex items-center gap-3 p-3 border rounded-lg bg-white ${borderClass}`}>
        <div className="flex-1">
          <Label className="text-sm font-medium text-gray-700 mb-1 block">{displayName}</Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              {fieldType === 'DATE' ? (
                <Input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              ) : fieldType === 'NUMBER' ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              ) : fieldType === 'BOOLEAN' ? (
                <Select value={editValue} onValueChange={setEditValue}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              )}
              <Button size="sm" onClick={() => handleSave(fieldName)}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-900">
                {formatValueForDisplay(value, fieldType)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(fieldName, value)}
                className="h-6 px-2"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <ValidationToggle 
            fieldName={fieldName}
            validation={validation}
            onToggle={(isVerified) => handleVerificationToggle(fieldName, isVerified)}
          />
          {validation && (() => {
            // Get original extracted value - handle both simple fields and collection fields
            let originalValue;
            if (fieldName.includes('.')) {
              // Collection field - get from nested structure
              const [collectionName, propertyPath] = fieldName.split('.');
              const collectionData = extractedData[collectionName];
              if (Array.isArray(collectionData) && propertyPath.includes('[')) {
                const propertyName = propertyPath.split('[')[0];
                const indexMatch = propertyPath.match(/\[(\d+)\]/);
                const index = indexMatch ? parseInt(indexMatch[1]) : 0;
                originalValue = collectionData[index] ? collectionData[index][propertyName] : undefined;
              }
            } else {
              // Simple field
              originalValue = extractedData[fieldName];
            }
            
            const currentValue = validation.extractedValue;
            
            // Handle type mismatches for comparison (e.g., boolean true vs string "true", number 2 vs string "2")
            const normalizeValue = (val: any) => {
              if (val === null || val === undefined || val === "null" || val === "undefined") return null;
              if (typeof val === 'boolean') return val;
              if (typeof val === 'string') {
                const lower = val.toLowerCase();
                if (lower === 'true') return true;
                if (lower === 'false') return false;
                // Try to convert numeric strings to numbers for comparison
                if (!isNaN(Number(val)) && val.trim() !== '') {
                  return Number(val);
                }
                // For date strings, normalize to consistent format for comparison
                if (val.match(/^\d{4}-\d{2}-\d{2}/) || val.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || val.match(/\w+ \d{1,2}, \d{4}/)) {
                  try {
                    const date = new Date(val);
                    if (!isNaN(date.getTime())) {
                      return date.toISOString().split('T')[0]; // Normalize to YYYY-MM-DD
                    }
                  } catch (e) {
                    // If date parsing fails, return original value
                  }
                }
              }
              return val;
            };
            
            const normalizedOriginal = normalizeValue(originalValue);
            const normalizedCurrent = normalizeValue(currentValue);
            

            
            // Check if field was manually updated by user (uses dedicated manually_updated flag)
            const wasManuallyUpdated = validation.manuallyUpdated;
            
            // Debug logging for MSA field specifically
            if (fieldName === 'MSA ID/Number') {
              console.log(`INFO VIEW RENDER CHECK - Field: ${fieldName}, ManuallyUpdated: ${validation.manuallyUpdated}, WasManuallyUpdated: ${wasManuallyUpdated}, ValidationID: ${validation.id}, ExtractedValue: ${validation.extractedValue}`);
            }
            
            // Check if field has actual value - if it has a value, it should never show "Not Extracted"
            const hasValue = validation.extractedValue !== null && 
                           validation.extractedValue !== undefined && 
                           validation.extractedValue !== "" && 
                           validation.extractedValue !== "null" && 
                           validation.extractedValue !== "undefined";
            
            if (wasManuallyUpdated) {
              // Debug logging for MSA field
              if (fieldName === 'MSA ID/Number') {
                console.log(`INFO VIEW - MSA Field Rendering Blue User Icon - wasManuallyUpdated: ${wasManuallyUpdated}, validation:`, validation);
              }
              
              return (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="h-2 w-2 text-white" />
                  </div>
                  {validation.originalExtractedValue !== undefined && validation.originalExtractedValue !== null && (
                    <button
                      onClick={() => handleRevertToAI(fieldName)}
                      className="inline-flex items-center justify-center w-5 h-5 rounded bg-white hover:bg-gray-50 transition-colors border border-gray-200"
                      title="Revert to original AI extracted value"
                    >
                      <RotateCcw className="h-3 w-3 text-black" />
                    </button>
                  )}
                </div>
              );
            } else {
              // Always show confidence badge - use 0% for null/empty values, otherwise use validation confidence
              const effectiveConfidence = hasValue ? validation.confidenceScore : 0;
              return <ConfidenceBadge confidenceScore={effectiveConfidence} reasoning={validation.aiReasoning} fieldName={fieldName} getFieldDisplayName={getFieldDisplayName} />;
            }
          })()}
        </div>
      </div>
    );
  };

  // Check user role for access control (same logic as ProjectLayout)
  const isAdmin = user?.role === 'admin';
  const isPrimaryOrgAdmin = isAdmin && user?.organization?.type === 'primary';
  const canAccessConfigTabs = isAdmin;
  const canAccessPublishing = isPrimaryOrgAdmin;

  // Calculate verification stats for statistics cards (same logic as ProjectLayout)
  const getVerificationStatusForProject = (sessionId: string): 'verified' | 'in_progress' | 'pending' => {
    const sessionValidations = projectValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    return allVerified ? 'verified' : 'in_progress';
  };

  const getVerificationStatsForProject = () => {
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    for (const projectSession of project.sessions) {
      const status = getVerificationStatusForProject(projectSession.id);
      stats[status]++;
    }
    
    return stats;
  };

  const verificationStats = getVerificationStatsForProject();

  const navItems = [
    { id: "upload", label: `New ${project?.mainObjectName || "Session"}`, icon: Upload, href: `/projects/${projectId}?tab=upload` },
    { id: "data", label: `All ${project?.mainObjectName || "Session"}s`, icon: Database, href: `/projects/${projectId}?tab=all-data` },
    ...(canAccessConfigTabs ? [
      { id: "knowledge", label: "Knowledge/Rules", icon: Brain, href: `/projects/${projectId}?tab=knowledge` },
      { id: "define", label: "Define Data", icon: Settings, href: `/projects/${projectId}?tab=define` },
    ] : []),
    ...(canAccessPublishing ? [
      { id: "publishing", label: "Publishing", icon: FolderOpen, href: `/projects/${projectId}?tab=publishing` },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Match ProjectLayout exactly */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtractlyLogo />
            <UserProfile />
          </div>
        </div>
      </div>

      {/* Page Title - Match ProjectLayout exactly */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 mr-6">
              <FileText className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-3xl font-bold">{project.name}</h2>
                </div>
                <div className="flex items-start space-x-2">
                  {project.description ? (
                    <p className="text-sm text-gray-600">{project.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400">No description</p>
                  )}
                </div>
              </div>
            </div>

            {/* Statistics Cards - Match ProjectLayout exactly */}
            {project.sessions.length > 0 && (
              <div className="flex gap-4 flex-shrink-0">
                <Card className="min-w-[140px]">
                  <CardContent className="pt-1 pb-4">
                    <div className="flex items-start">
                      <Database className="h-7 w-7 text-blue-600 mt-1" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Total {project.mainObjectName || "Session"}s</p>
                        <p className="text-2xl font-bold text-gray-900">{project.sessions.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-[140px]">
                  <CardContent className="pt-1 pb-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-7 w-7 text-red-600 mt-1" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Unverified</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {verificationStats.in_progress + verificationStats.pending}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-[140px]">
                  <CardContent className="pt-1 pb-4">
                    <div className="flex items-start">
                      <CheckCircle className="h-7 w-7 text-green-600 mt-1" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Verified</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {verificationStats.verified}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-160px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200">
          <div className="p-6">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === 'data'; // Highlight "All Data" since we're in session view
                
                return (
                  <Link key={item.id} href={item.href}>
                    <button
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-primary text-white font-bold"
                          : "text-gray-700 hover:bg-gray-50 font-medium"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-400"}`} />
                      {item.label}
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-x-hidden">
          <div className="w-full">
            {/* Session Review Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link href={`/projects/${projectId}?tab=all-data`}>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h3 className="text-xl font-bold text-gray-900">{project.mainObjectName || "Session"}: {session?.sessionName}</h3>
              </div>
              
              {/* Status and progress bar aligned to right */}
              <div className="flex items-center gap-3">
                {getVerificationProgress().percentage === 100 ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-medium text-sm">Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-red-600 font-medium text-sm">Unverified</span>
                  </div>
                )}
                
                {/* Session Verification Progress */}
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        getVerificationProgress().percentage === 100 ? 'bg-green-600' : 
                        getVerificationProgress().percentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                      }`}
                      style={{ width: `${getVerificationProgress().percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 min-w-[28px]">
                    {getVerificationProgress().percentage}%
                  </span>
                </div>
                
                <Button 
                  onClick={() => setShowReasoningDialog(true)} 
                  variant="outline" 
                  size="sm"
                  className="px-3 py-2"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  variant="outline"
                  size="sm"
                  className="px-3 py-2"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Session Data Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${1 + project.collections.filter(collection => {
                const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
                const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
                const maxRecordIndex = validationIndices.length > 0 ? Math.max(...validationIndices) : -1;
                return maxRecordIndex >= 0;
              }).length}, 1fr)` }}>
                <TabsTrigger value="info">{project.mainObjectName || "Session"} Info</TabsTrigger>
                {project.collections.map((collection) => {
                  const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
                  const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
                  const maxRecordIndex = validationIndices.length > 0 ? Math.max(...validationIndices) : -1;
                  
                  if (maxRecordIndex < 0) return null;
                  
                  return (
                    <TabsTrigger key={collection.id} value={collection.collectionName}>
                      {collection.collectionName}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {/* Info Tab Content - Single Object View */}
              <TabsContent value="info" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {project.mainObjectName || "Session"} Information
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Core information and fields extracted from this {(project.mainObjectName || "session").toLowerCase()}.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {project.schemaFields
                        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                        .map((field) => {
                        const originalValue = extractedData[field.fieldName];
                        const validation = getValidation(field.fieldName);
                        
                        // Show field if it has a value OR if there's a validation for it
                        if (originalValue !== undefined || validation) {
                          // Use validation's extractedValue (which includes manual edits), not the original extracted value
                          let displayValue = validation?.extractedValue ?? originalValue ?? null;
                          if (displayValue === "null" || displayValue === "undefined") {
                            displayValue = null;
                          }
                          
                          return (
                            <div key={field.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const fieldName = field.fieldName;
                                  const validation = getValidation(fieldName);
                                  const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                  const wasManuallyUpdated = validation && validation.manuallyUpdated;
                                  const isVerified = validation?.validationStatus === 'verified' || validation?.validationStatus === 'valid';
                                  const score = Math.round(validation?.confidenceScore || 0);

                                  // Debug logging for MSA field in Info view
                                  if (fieldName === 'MSA ID/Number') {
                                    console.log(`INFO VIEW INDICATOR - Field: ${fieldName}, ValidationExists: ${!!validation}, WasManuallyUpdated: ${wasManuallyUpdated}, HasValue: ${hasValue}, IsVerified: ${isVerified}, DisplayValue: ${displayValue}`);
                                  }

                                  // Render confidence indicator/verification status to the left of field name
                                  if (isVerified) {
                                    // Show green tick when verified - clicking unverifies
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => handleFieldVerification(fieldName, false)}
                                              className="w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                                              aria-label="Click to unverify"
                                            >
                                              <span className="text-xs font-bold">✓</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Verified with {score}% confidence
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  } else if (hasValue && validation) {
                                    // Show colored confidence dot when not verified - clicking opens AI analysis modal
                                    const colorClass = score >= 80 ? 'bg-green-500' : 
                                                     score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                    
                                    return (
                                      <button
                                        onClick={() => {
                                          if (validation.aiReasoning) {
                                            setSelectedReasoning({
                                              reasoning: validation.aiReasoning,
                                              fieldName: getFieldDisplayName(fieldName),
                                              confidenceScore: validation.confidenceScore || 0,
                                              getFieldDisplayName,
                                              validation,
                                              onVerificationChange: (isVerified) => handleFieldVerification(fieldName, isVerified),
                                              isVerified: validation.validationStatus === 'verified' || validation.validationStatus === 'valid'
                                            });
                                          }
                                        }}
                                        className={`w-3 h-3 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0`}
                                        title={`${score}% confidence - Click for AI analysis`}
                                      />
                                    );
                                  } else if (!hasValue) {
                                    // Show red exclamation mark for missing fields
                                    return (
                                      <div className="w-3 h-3 flex items-center justify-center text-red-500 font-bold text-xs flex-shrink-0" title="Missing data">
                                        !
                                      </div>
                                    );
                                  }
                                  // Return empty div to maintain consistent spacing
                                  return <div className="w-3 h-3 flex-shrink-0"></div>;
                                })()}
                                <Label className="text-sm font-medium text-gray-700">
                                  {field.fieldName}
                                </Label>
                              </div>
                              <div>
                                {(() => {
                                  const validation = getValidation(field.fieldName);
                                  const isEditing = editingField === field.fieldName;
                                  const fieldType = field.fieldType;
                                  
                                  if (isEditing) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        {fieldType === 'DATE' ? (
                                          <Input
                                            type="date"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="flex-1"
                                          />
                                        ) : fieldType === 'NUMBER' ? (
                                          <Input
                                            type="number"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="flex-1"
                                          />
                                        ) : fieldType === 'BOOLEAN' ? (
                                          <Select value={editValue} onValueChange={setEditValue}>
                                            <SelectTrigger className="flex-1">
                                              <SelectValue placeholder="Select value" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="true">True</SelectItem>
                                              <SelectItem value="false">False</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        ) : fieldType === 'TEXTAREA' ? (
                                          <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-full min-h-[100px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            rows={4}
                                          />
                                        ) : (
                                          <Input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="flex-1"
                                          />
                                        )}
                                        <Button size="sm" onClick={() => handleSave(field.fieldName)}>
                                          Save
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                          {fieldType === 'TEXTAREA' ? (
                                            <div className="whitespace-pre-wrap text-sm text-gray-900 p-2 bg-gray-50 border rounded-md min-h-[60px]">
                                              {formatValueForDisplay(displayValue, fieldType)}
                                            </div>
                                          ) : (
                                            <span className="text-sm text-gray-900">
                                              {formatValueForDisplay(displayValue, fieldType)}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleEdit(field.fieldName, displayValue)}
                                          className="h-6 px-2"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                              
                              {field.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {field.description}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Individual Collection Tabs */}
              {project.collections.map((collection) => {
                const collectionData = extractedData[collection.collectionName];
                const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
                const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
                const maxRecordIndex = validationIndices.length > 0 ? Math.max(...validationIndices) : -1;
                
                if (maxRecordIndex < 0) return null;

                return (
                  <TabsContent key={collection.id} value={collection.collectionName} className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {collection.collectionName}
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {maxRecordIndex + 1} {maxRecordIndex === 0 ? 'item' : 'items'}
                          </span>
                        </CardTitle>
                        <p className="text-sm text-gray-600">{collection.description}</p>
                      </CardHeader>
                      <CardContent>
                        <Table className="session-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24 border-r border-gray-300">Item #</TableHead>
                              {collection.properties
                                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                .map((property) => (
                                <TableHead 
                                  key={property.id} 
                                  className="relative border-r border-gray-300"
                                  style={{ 
                                    width: `${columnWidths[`${collection.id}-${property.id}`] || (
                                      property.fieldType === 'TEXTAREA' ? 400 : 
                                      property.propertyName.toLowerCase().includes('summary') || property.propertyName.toLowerCase().includes('description') ? 300 :
                                      property.propertyName.toLowerCase().includes('remediation') || property.propertyName.toLowerCase().includes('action') ? 280 :
                                      property.fieldType === 'TEXT' && (property.propertyName.toLowerCase().includes('title') || property.propertyName.toLowerCase().includes('name')) ? 200 :
                                      property.fieldType === 'TEXT' ? 120 : 
                                      property.fieldType === 'NUMBER' || property.fieldType === 'DATE' ? 80 :
                                      property.propertyName.toLowerCase().includes('status') ? 100 :
                                      100
                                    )}px`,
                                    minWidth: '80px'
                                  }}
                                >
                                  <div className="flex items-center justify-between group">
                                    <button
                                      onClick={() => handleSort(property.propertyName, collection.id)}
                                      className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded flex-1 min-w-0"
                                    >
                                      <span className="truncate">{property.propertyName}</span>
                                      {getSortIcon(property.propertyName, collection.id)}
                                    </button>
                                    <div
                                      className="column-resizer opacity-0 group-hover:opacity-100 transition-opacity"
                                      onMouseDown={(e) => handleMouseDown(e, `${collection.id}-${property.id}`)}
                                    />
                                  </div>
                                </TableHead>
                              ))}
                              <TableHead className="w-32 border-r border-gray-300">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Create array of items with original indices
                              const itemsWithIndices = Array.from({ length: maxRecordIndex + 1 }, (_, index) => ({
                                item: collectionData?.[index] || {},
                                originalIndex: index
                              }));
                              
                              // Apply sorting if configured
                              const sortedItems = sortConfig && sortConfig.collectionId === collection.id 
                                ? sortCollectionData(itemsWithIndices, collection, sortConfig)
                                : itemsWithIndices;
                              
                              return sortedItems.map(({ item, originalIndex }, displayIndex) => (
                                <TableRow key={originalIndex} className="border-b border-gray-300">
                                  <TableCell className="font-medium border-r border-gray-300">{displayIndex + 1}</TableCell>
                                  {collection.properties
                                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                    .map((property) => {
                                    const fieldName = `${collection.collectionName}.${property.propertyName}[${originalIndex}]`;
                                    const validation = getValidation(fieldName);
                                    
                                    // Try multiple possible property name mappings for extracted data
                                    const possibleKeys = [
                                      property.propertyName,
                                      property.propertyName.toLowerCase(),
                                      property.propertyName.charAt(0).toLowerCase() + property.propertyName.slice(1),
                                    ];
                                    
                                    let originalValue = undefined;
                                    for (const key of possibleKeys) {
                                      if (item[key] !== undefined) {
                                        originalValue = item[key];
                                        break;
                                      }
                                    }
                                    
                                    let displayValue = validation?.extractedValue ?? originalValue ?? null;
                                    if (displayValue === "null" || displayValue === "undefined") {
                                      displayValue = null;
                                    }
                                    
                                    return (
                                      <TableCell 
                                        key={property.id} 
                                        className="relative border-r border-gray-300"
                                        style={{ 
                                          width: `${columnWidths[`${collection.id}-${property.id}`] || (
                                            property.fieldType === 'TEXTAREA' ? 400 : 
                                            property.propertyName.toLowerCase().includes('summary') || property.propertyName.toLowerCase().includes('description') ? 300 :
                                            property.propertyName.toLowerCase().includes('remediation') || property.propertyName.toLowerCase().includes('action') ? 280 :
                                            property.fieldType === 'TEXT' && (property.propertyName.toLowerCase().includes('title') || property.propertyName.toLowerCase().includes('name')) ? 200 :
                                            property.fieldType === 'TEXT' ? 120 : 
                                            property.fieldType === 'NUMBER' || property.fieldType === 'DATE' ? 80 :
                                            property.propertyName.toLowerCase().includes('status') ? 100 :
                                            100
                                          )}px`,
                                          minWidth: '80px'
                                        }}
                                      >
                                        <div className="relative w-full">
                                          {/* Content */}
                                          <div className={`table-cell-content w-full pl-6 pr-2 ${
                                            property.fieldType === 'TEXTAREA' ? 'min-h-[60px] py-2' : 'py-2'
                                          } break-words whitespace-normal overflow-wrap-anywhere leading-relaxed`}>
                                            {formatValueForDisplay(displayValue, property.fieldType)}
                                          </div>
                                          
                                          {/* Combined confidence/verification indicator on top-left corner */}
                                          {validation && (
                                            <>
                                              {(() => {
                                                const wasManuallyUpdated = validation.manuallyUpdated;
                                                const hasValue = validation.extractedValue !== null && 
                                                               validation.extractedValue !== undefined && 
                                                               validation.extractedValue !== "" && 
                                                               validation.extractedValue !== "null" && 
                                                               validation.extractedValue !== "undefined";
                                                const isVerified = validation.validationStatus === 'verified' || validation.validationStatus === 'valid';
                                                const score = Math.round(validation.confidenceScore || 0);

                                                if (wasManuallyUpdated) {
                                                  // Debug logging for MSA field
                                                  if (fieldName.includes('MSA')) {
                                                    console.log(`TABLE VIEW - MSA Field Rendering Blue User Icon - wasManuallyUpdated: ${wasManuallyUpdated}, fieldName: ${fieldName}, validation:`, validation);
                                                  }
                                                  
                                                  return (
                                                    <div className="absolute top-2 left-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                                      <User className="h-2 w-2 text-white" />
                                                    </div>
                                                  );
                                                } else if (isVerified) {
                                                  // Show green tick when verified
                                                  return (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            onClick={() => handleFieldVerification(fieldName, false)}
                                                            className="absolute top-2 left-1 w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 rounded transition-colors"
                                                            aria-label="Click to unverify"
                                                          >
                                                            <span className="text-xs font-bold">✓</span>
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          Verified with {score}% confidence
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  );
                                                } else if (hasValue && validation.confidenceScore) {
                                                  // Show colored confidence dot when not verified
                                                  const colorClass = score >= 80 ? 'bg-green-500' : 
                                                                   score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                                  
                                                  return (
                                                    <button
                                                      onClick={() => {
                                                        if (validation.aiReasoning) {
                                                          setSelectedReasoning({
                                                            reasoning: validation.aiReasoning,
                                                            fieldName,
                                                            confidenceScore: validation.confidenceScore || 0
                                                          });
                                                        }
                                                      }}
                                                      className={`absolute top-2 left-1 w-3 h-3 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity`}
                                                      title={`${score}% confidence - Click for AI analysis`}
                                                    />
                                                  );
                                                } else if (!hasValue) {
                                                  // Show red exclamation mark for missing fields
                                                  return (
                                                    <div className="absolute top-2 left-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                                      <span className="text-white text-xs font-bold leading-none">!</span>
                                                    </div>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="border-r border-gray-300">
                                    {(() => {
                                      // Calculate verification status for this item
                                      const itemValidations = collection.properties.map(property => {
                                        const fieldName = `${collection.collectionName}.${property.propertyName}[${originalIndex}]`;
                                        return getValidation(fieldName);
                                      }).filter(Boolean);
                                      
                                      const allVerified = itemValidations.length > 0 && 
                                        itemValidations.every(v => v?.validationStatus === 'valid' || v?.validationStatus === 'verified');
                                      
                                      return (
                                        <button
                                          onClick={() => handleItemVerification(collection.collectionName, originalIndex, !allVerified)}
                                          className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                          title={allVerified ? "Click to mark all fields as unverified" : "Click to mark all fields as verified"}
                                        >
                                          {allVerified ? (
                                            <>
                                              <CheckCircle className="h-4 w-4 text-green-600" />
                                              <span className="text-green-600 font-medium text-sm">Verified</span>
                                            </>
                                          ) : (
                                            <>
                                              <AlertTriangle className="h-4 w-4 text-red-600" />
                                              <span className="text-red-600 font-medium text-sm">Unverified</span>
                                            </>
                                          )}
                                        </button>
                                      );
                                    })()}
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>
      </div>

      {/* AI Reasoning Modal */}
      {selectedReasoning && (
        <Dialog open={!!selectedReasoning} onOpenChange={() => setSelectedReasoning(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                AI Analysis - {getFieldDisplayName(selectedReasoning.fieldName)}
              </DialogTitle>
              <DialogDescription>
                Confidence: {Math.round(selectedReasoning.confidenceScore)}%
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">AI Reasoning</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                  {selectedReasoning.reasoning}
                </div>
              </div>
              
              {(() => {
                const validation = getValidation(selectedReasoning.fieldName);
                const isVerified = validation?.validationStatus === 'verified' || validation?.validationStatus === 'valid';
                
                return (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => {
                        handleFieldVerification(selectedReasoning.fieldName, !isVerified);
                        setSelectedReasoning(null);
                      }}
                      variant={isVerified ? "outline" : "default"}
                      className="flex items-center gap-2"
                    >
                      {isVerified ? (
                        <>
                          <X className="h-4 w-4" />
                          Mark as Unverified
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Mark as Verified
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setSelectedReasoning(null)}
                      variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Data Report Dialog */}
      <Dialog open={showReasoningDialog} onOpenChange={setShowReasoningDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Request More Info Draft
            </DialogTitle>
            <DialogDescription>
              Email-ready report for requesting missing information from data providers
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <Label htmlFor="report-text" className="text-sm font-medium">
              Report Content (ready to copy and paste into email)
            </Label>
            <textarea
              id="report-text"
              value={generateDataReport()}
              readOnly
              className="w-full h-80 mt-2 p-3 border rounded-md bg-gray-50 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generateDataReport());
                  toast({
                    title: "Copied to clipboard",
                    description: "Data report has been copied to your clipboard.",
                  });
                } catch (error) {
                  toast({
                    title: "Copy failed",
                    description: "Failed to copy to clipboard. Please select and copy the text manually.",
                    variant: "destructive"
                  });
                }
              }}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button onClick={() => setShowReasoningDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Processing Dialog */}
      <ValidationProcessingDialog
        open={showValidationDialog}
        processingStep={validationStep}
        processingProgress={validationProgress}
      />
    </div>
  );
}