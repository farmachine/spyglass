import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight, RotateCcw, FileText } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import ValidationIcon from "@/components/ValidationIcon";
import UserProfile from "@/components/UserProfile";

import type { 
  ExtractionSession, 
  ProjectWithDetails, 
  FieldValidation,
  ValidationStatus 
} from "@shared/schema";

// AI Reasoning Modal Component
const AIReasoningModal = ({ 
  isOpen, 
  onClose, 
  reasoning, 
  fieldName, 
  confidenceScore,
  getFieldDisplayName
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  reasoning: string; 
  fieldName: string; 
  confidenceScore: number;
  getFieldDisplayName: (fieldName: string) => string;
}) => {
  const { toast } = useToast();

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            AI Reasoning - {getFieldDisplayName(fieldName)}
          </DialogTitle>
          <DialogDescription>
            Confidence Score: {confidenceScore}% - Detailed analysis and suggested resolution
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm">
            {reasoning}
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={copyToClipboard} className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </Button>
          <Button onClick={onClose} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
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
  getFieldDisplayName
}: { 
  confidenceScore: number; 
  reasoning?: string; 
  fieldName: string;
  getFieldDisplayName: (fieldName: string) => string;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) {
      return { level: "high", color: "bg-green-100 text-green-800 border-green-200", description: "High confidence" };
    } else if (score >= 50) {
      return { level: "medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200", description: "Medium confidence" };
    } else {
      return { level: "low", color: "bg-red-100 text-red-800 border-red-200", description: "Low confidence" };
    }
  };

  const confidence = getConfidenceLevel(confidenceScore);
  
  return (
    <div className="flex items-center gap-2">
      <span 
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${confidence.color}`}
        title={confidence.description}
      >
        Confidence: {confidenceScore}%
      </span>
      
      {reasoning && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label="Click to view detailed AI reasoning"
                title="Click for detailed AI analysis"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Click to view detailed AI reasoning and analysis</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {reasoning && (
        <AIReasoningModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          reasoning={reasoning}
          fieldName={fieldName}
          confidenceScore={confidenceScore}
          getFieldDisplayName={getFieldDisplayName}
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

const MissingInfoBadge = () => (
  <span 
    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200"
    title="This field is missing or empty"
  >
    Missing Info
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
  const { projectId, sessionId } = useParams();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
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

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`)
  });

  const { data: session, isLoading: sessionLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}`)
  });

  const { data: validations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations-consolidated'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations-consolidated`),
    onSuccess: (data) => {
      console.log(`🚀 CONSOLIDATED_FRONTEND: Session ${sessionId} - Consolidated validations loaded:`, data.length);
      console.log(`🚀 CONSOLIDATED_FRONTEND RAW DATA:`, data);
      if (data.length > 0) {
        console.log('🚀 Sample consolidated validation:', data[0]);
        console.log('🚀 All field names:', data.map(v => v.fieldName));
        console.log('🚀 Schema fields:', data.filter(v => v.fieldType === 'schema_field').length);
        console.log('🚀 Collection properties:', data.filter(v => v.fieldType === 'collection_property').length);
      } else {
        console.log('🚀 CONSOLIDATED_FRONTEND: No consolidated validations received');
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
      // Invalidate and refetch validation queries to update UI
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Silent success - no popup or toast since validation was handled in processing dialog
      console.log(`✅ Batch validation completed: ${result.fields_processed} fields processed`);
    },
    onError: (error: any) => {
      console.error('Batch validation failed:', error);
      toast({
        title: "Validation processing error",
        description: "Some validation rules may not have been applied correctly.",
        variant: "destructive"
      });
    }
  });

  // Note: Batch validation now runs during the processing phase in NewUpload component
  // No automatic validation needed on session load

  if (projectLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
    // WORKAROUND: Try direct match first
    const directMatch = validations.find(v => v.fieldName === fieldName);
    if (directMatch) return directMatch;
    
    // For schema fields that don't contain brackets or dots, try the shifted version with [1]
    if (!fieldName.includes('[') && !fieldName.includes('.')) {
      const shiftedFieldName = `${fieldName}[1]`;
      const shiftedMatch = validations.find(v => v.fieldName === shiftedFieldName);
      if (shiftedMatch) return shiftedMatch;
    }
    
    // Log if no validation found for debugging
    console.log(`No validation found for ${fieldName}, available validations:`, validations.map(v => v.fieldName));
    return undefined;
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

  const handleExportToExcel = () => {
    if (!session) return;

    const workbook = XLSX.utils.book_new();
    
    // Separate schema fields and collection validations
    const schemaFieldValidations = validations.filter(v => !v.fieldName.includes('.'));
    const collectionValidations = validations.filter(v => v.fieldName.includes('.'));
    
    // Group collection validations by collection name
    const collectionGroups: Record<string, FieldValidation[]> = {};
    collectionValidations.forEach(validation => {
      const collectionName = validation.fieldName.split('.')[0];
      if (!collectionGroups[collectionName]) {
        collectionGroups[collectionName] = [];
      }
      collectionGroups[collectionName].push(validation);
    });
    
    // Sheet 1: Main Object Info (Schema Fields)
    const mainObjectData = schemaFieldValidations.map(validation => [
      validation.fieldName,
      validation.extractedValue || ''
    ]);
    
    const mainObjectSheet = XLSX.utils.aoa_to_sheet([
      ['Property Name', 'Property Value'],
      ...mainObjectData
    ]);
    
    XLSX.utils.book_append_sheet(workbook, mainObjectSheet, project.mainObjectName || 'Main Object');

    // Sheets 2+: Collection Data
    Object.entries(collectionGroups).forEach(([collectionName, collectionValidations]) => {
      // Group validations by record index to create rows
      const recordGroups: Record<number, FieldValidation[]> = {};
      
      collectionValidations.forEach(validation => {
        const recordIndex = validation.recordIndex || 0;
        if (!recordGroups[recordIndex]) recordGroups[recordIndex] = [];
        recordGroups[recordIndex].push(validation);
      });

      // Get property names in the same order as displayed in the UI
      const collection = project.collections.find(c => c.collectionName === collectionName);
      const propertyNames = collection ? 
        collection.properties.map(p => p.propertyName) :
        [...new Set(collectionValidations.map(v => 
          v.fieldName.split('.')[1]?.replace(/\[\d+\]$/, '') || v.fieldName
        ))].sort();

      // Create header row
      const headers = propertyNames;
      
      // Create data rows
      const dataRows = Object.keys(recordGroups)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(recordIndex => {
          const recordValidations = recordGroups[parseInt(recordIndex)];
          return propertyNames.map(propertyName => {
            const validation = recordValidations.find(v => 
              v.fieldName.includes(`.${propertyName}`)
            );
            return validation?.extractedValue || '';
          });
        });

      // Create worksheet
      const collectionSheet = XLSX.utils.aoa_to_sheet([
        headers,
        ...dataRows
      ]);

      XLSX.utils.book_append_sheet(workbook, collectionSheet, collectionName);
    });

    // Generate filename with session name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

    // Export the file
    XLSX.writeFile(workbook, filename);
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
            manuallyVerified: true
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
            manuallyVerified: true
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
    if (validation && validation.originalExtractedValue !== undefined) {
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
            

            
            // Only consider it manually updated if it was explicitly marked as manual status
            // The validation status 'manual' is set when user actually edits a field
            const wasManuallyUpdated = validation.validationStatus === 'manual';
            
            // Check if AI could not extract any value at all (truly missing)
            const extractedValue = validation.extractedValue;
            const isTrulyMissing = extractedValue === null || extractedValue === undefined || extractedValue === "" || extractedValue === "null";
            
            if (wasManuallyUpdated) {
              return (
                <div className="flex items-center gap-2">
                  <ManualInputBadge />
                  {validation.originalExtractedValue && (
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
            } else if (isTrulyMissing) {
              // Only show Missing Info when AI literally found nothing
              return <MissingInfoBadge />;
            } else if (validation.confidenceScore === 0) {
              // Show Not Extracted for technical issues (confidence = 0 but has value)
              return <NotExtractedBadge />;
            } else {
              // Show confidence badge for all extracted values regardless of confidence level
              return <ConfidenceBadge confidenceScore={validation.confidenceScore} reasoning={validation.aiReasoning} fieldName={fieldName} getFieldDisplayName={getFieldDisplayName} />;
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
          <div className="max-w-4xl mx-auto w-full">
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
                <Button
                  onClick={() => batchValidationMutation.mutate()}
                  variant="outline"
                  size="sm"
                  className="px-3 py-2"
                  disabled={batchValidationMutation.isPending}
                >
                  {batchValidationMutation.isPending ? (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

        {/* Unified Data Structure - Fields and Collections */}
        <Card className="mb-8">
          <CardContent className="space-y-4 pt-4">
            {/* Project Schema Fields */}
            {project.schemaFields.map((field) => {
              const originalValue = extractedData[field.fieldName];
              const validation = validations.find(v => v.fieldName === field.fieldName);
              
              // Show field if it has a value OR if there's a validation for it
              if (originalValue !== undefined || validation) {
                // Use validation's extractedValue (which includes manual edits), not the original extracted value
                let displayValue = validation?.extractedValue ?? originalValue ?? null;
                if (displayValue === "null" || displayValue === "undefined") {
                  displayValue = null;
                }
                return renderFieldWithValidation(field.fieldName, displayValue, true);
              }
              return null;
            })}

            {/* Collections */}
        {project.collections.map((collection) => {
          const collectionData = extractedData[collection.collectionName];
          
          // Get all validations for this collection
          const collectionValidations = validations.filter(v => 
            v.collectionName === collection.collectionName || 
            (v.fieldName && v.fieldName.startsWith(`${collection.collectionName}.`))
          );
          
          console.log(`🔍 Collection ${collection.collectionName}: Found ${collectionValidations.length} validations`);
          
          // Determine how many instances we need to show
          // WORKAROUND: Filter out dummy validation records at index -1
          const realValidations = collectionValidations.filter(v => v.recordIndex >= 0);
          const dataLength = collectionData ? collectionData.length : 0;
          const validationIndices = realValidations.length > 0 ? realValidations.map(v => v.recordIndex) : [];
          const maxRecordIndex = Math.max(dataLength, ...validationIndices, 0);
          
          if (maxRecordIndex < 1) return null;

          const isExpanded = expandedCollections.has(collection.collectionName);

          return (
            <div key={collection.id} className="border border-gray-200 rounded-lg border-l-4 border-l-green-500 bg-white">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCollectionExpansion(collection.collectionName)}
                      className="p-1 h-auto"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{collection.collectionName}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {maxRecordIndex} {maxRecordIndex === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                    </div>
                  </div>
                  {/* Collection Verification Status - positioned like field validation icons */}
                  <div className="flex items-center gap-3">
                    {getCollectionVerificationProgress(collection.collectionName).percentage === 100 ? (
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
                    
                    {/* Collection Verification Progress */}
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            getCollectionVerificationProgress(collection.collectionName).percentage === 100 ? 'bg-green-600' : 
                            getCollectionVerificationProgress(collection.collectionName).percentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                          }`}
                          style={{ width: `${getCollectionVerificationProgress(collection.collectionName).percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 min-w-[28px]">
                        {getCollectionVerificationProgress(collection.collectionName).percentage}%
                      </span>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div>
                {Array.from({ length: maxRecordIndex }, (_, arrayIndex) => {
                  // WORKAROUND: Map display index to validation index (arrayIndex 0 -> validationIndex 1)
                  const validationIndex = arrayIndex + 1;
                  const item = collectionData?.[arrayIndex] || {};
                  
                  // Try to get a meaningful name for this item
                  const getItemDisplayName = (item: any, collection: any, index: number) => {
                    // Look for common name fields
                    const nameFields = ['name', 'Name', 'title', 'Title', 'companyName', 'Company Name'];
                    for (const field of nameFields) {
                      if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
                        return item[field].trim();
                      }
                    }
                    
                    // Look for any property that's marked as a name field
                    const nameProperty = collection.properties.find((p: any) => 
                      p.propertyName.toLowerCase().includes('name') || 
                      p.propertyName.toLowerCase().includes('title')
                    );
                    if (nameProperty && item[nameProperty.propertyName]) {
                      return item[nameProperty.propertyName];
                    }
                    
                    // Fall back to generic "Item X"
                    return `Item ${index + 1}`;
                  };
                  
                  const itemDisplayName = getItemDisplayName(item, collection, arrayIndex);
                  
                  return (
                    <div key={arrayIndex} className="mb-6 p-4 bg-gray-50 rounded-lg w-full overflow-hidden">
                      <h4 className="font-medium mb-4">{itemDisplayName}</h4>
                      <div className="space-y-4">
                        {collection.properties
                          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                          .map((property) => {
                          // Try multiple possible property name mappings for extracted data
                          const possibleKeys = [
                            property.propertyName, // exact match
                            property.propertyName.toLowerCase(), // lowercase
                            property.propertyName.charAt(0).toLowerCase() + property.propertyName.slice(1), // camelCase
                          ];
                          
                          let originalValue = undefined;
                          for (const key of possibleKeys) {
                            if (item[key] !== undefined) {
                              originalValue = item[key];
                              break;
                            }
                          }
                          
                          const fieldName = `${collection.collectionName}.${property.propertyName}[${validationIndex}]`;
                          const validation = validations.find(v => v.fieldName === fieldName);
                          
                          // Debug logging for validation matching
                          if (!validation && originalValue !== undefined && originalValue !== null) {
                            console.log(`No validation found for ${fieldName}, available validations:`, validations.map(v => v.fieldName));
                          }
                          
                          // Always show the property, even if no value is extracted
                          // Use validation's extractedValue (which includes manual edits), not the original extracted value
                          let displayValue = validation?.extractedValue ?? originalValue ?? null;
                          if (displayValue === "null" || displayValue === "undefined") {
                            displayValue = null;
                          }
                          return renderFieldWithValidation(fieldName, displayValue);
                        })}
                      </div>
                    </div>
                  );
                })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
          </CardContent>
        </Card>
          </div>
        </div>
      </div>

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


    </div>
  );
}