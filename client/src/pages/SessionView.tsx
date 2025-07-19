import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight } from "lucide-react";
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
  confidenceScore 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  reasoning: string; 
  fieldName: string; 
  confidenceScore: number; 
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
            AI Reasoning - {fieldName}
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
  fieldName 
}: { 
  confidenceScore: number; 
  reasoning?: string; 
  fieldName: string; 
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
      
      {!isVerified && validation.aiReasoning && (
        <div 
          className="text-xs text-gray-500 cursor-help" 
          title={validation.aiReasoning}
        >
          ⓘ
        </div>
      )}
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
    queryKey: ['/api/sessions', sessionId, 'validations'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations`)
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
      // Check if it's the new nested structure or simple flat structure
      if (parsedData.processed_documents && parsedData.processed_documents[0]) {
        extractedData = parsedData.processed_documents[0].extraction_result?.extracted_data || {};
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
    return validations.find(v => v.fieldName === fieldName);
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

  // Get all unverified fields for consolidated reasoning
  const getUnverifiedFields = () => {
    return validations.filter(v => v.validationStatus !== 'valid' && v.validationStatus !== 'verified');
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
      report += `\n${index + 1}. ${validation.fieldName}`;
      
      if (validation.aiReasoning) {
        // Clean up the AI reasoning to remove technical formatting
        let cleanReasoning = validation.aiReasoning;
        
        // Remove technical prefixes and status information
        cleanReasoning = cleanReasoning.replace(/^EXTRACTION ANALYSIS:[\s\S]*?CONFIDENCE CALCULATION:[\s\S]*?RULES COMPLIANCE:[\s\S]*?/m, '');
        cleanReasoning = cleanReasoning.replace(/^SUGGESTED RESOLUTION:[\s\S]*?RECOMMENDED QUESTIONS TO ASK:/m, '');
        cleanReasoning = cleanReasoning.replace(/^MANUAL REVIEW NEEDED:[\s\S]*?$/m, '');
        
        // Clean up bullet points and formatting
        cleanReasoning = cleanReasoning.replace(/^[•\-]\s*/gm, '- ');
        cleanReasoning = cleanReasoning.replace(/^\s*[\-•]\s*/gm, '- ');
        
        // Remove extra whitespace and newlines
        cleanReasoning = cleanReasoning.replace(/\n{3,}/g, '\n\n').trim();
        
        if (cleanReasoning) {
          report += `\n${cleanReasoning}`;
        }
      } else if (validation.validationStatus === 'invalid') {
        report += `\nThis information was not found in the provided document. Please provide the correct value for this field.`;
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
            validationStatus: "pending",
            manuallyVerified: false
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
            validationStatus: "pending",
            manuallyVerified: false
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
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            validationStatus: isVerified ? "valid" : "pending",
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
    
    // Define field type colors matching DefineData component
    const fieldTypeColors = {
      TEXT: "bg-primary/10 text-primary",
      NUMBER: "bg-cyan-100 text-cyan-800", // Changed to turquoise/cyan
      DATE: "bg-purple-100 text-purple-800",
      BOOLEAN: "bg-orange-100 text-orange-800",
    };
    
    return (
      <div key={fieldName} className={`flex items-center gap-3 p-3 border rounded-lg bg-white ${borderClass}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-sm font-medium text-gray-700">{displayName}</Label>
            <Badge className={`text-xs px-2 py-0.5 h-5 ${fieldTypeColors[fieldType as keyof typeof fieldTypeColors] || 'bg-gray-100 text-gray-800'}`}>
              {fieldType}
            </Badge>
          </div>
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
            
            // Check if field was extracted (has confidence score > 0)
            const wasExtracted = validation.confidenceScore > 0;
            
            if (wasManuallyUpdated) {
              return <ManualInputBadge />;
            } else if (!wasExtracted) {
              return <NotExtractedBadge />;
            } else {
              return <ConfidenceBadge confidenceScore={validation.confidenceScore} reasoning={validation.aiReasoning} fieldName={fieldName} />;
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <Link href="/">
                <ExtractlyLogo showText={false} className="!p-0" />
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {session.sessionName}
                </h1>
                {session.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {session.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* User profile placeholder - could add user menu here if needed */}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200">
          <div className="p-6">
            <div className="mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {project.name}
              </div>
              <div className="text-sm text-gray-600">
                {project.description || "Data extraction project"}
              </div>
            </div>

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
            {/* Session Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link href={`/projects/${projectId}?tab=all-data`}>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{project?.name}</h2>

                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          getVerificationProgress().percentage === 100 ? 'bg-green-600' : 
                          getVerificationProgress().percentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                        }`}
                        style={{ width: `${getVerificationProgress().percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 min-w-[36px]">
                      {getVerificationProgress().percentage}%
                    </span>
                  </div>
                  <Badge variant={getSessionStatus() === 'verified' ? 'default' : 'secondary'}>
                    {getSessionStatus() === 'verified' ? 'Verified' : 'In Progress'}
                  </Badge>
                </div>
                <Button onClick={() => setShowReasoningDialog(true)} variant="outline" size="sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request More Info
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <WaveIcon className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

        {/* Unified Data Structure - Fields and Collections */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{session?.sessionName}</span>
            </CardTitle>
            <p className="text-sm text-gray-600">Review and verify extracted data</p>
          </CardHeader>
          <CardContent className="space-y-4">
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
          const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
          
          // Determine how many instances we need to show
          const dataLength = collectionData ? collectionData.length - 1 : -1;
          const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
          const maxRecordIndex = Math.max(dataLength, ...validationIndices, -1);
          
          if (maxRecordIndex < 0) return null;

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
                        <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">
                          LIST
                        </Badge>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {maxRecordIndex + 1} {maxRecordIndex === 0 ? 'item' : 'items'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div>
                {Array.from({ length: maxRecordIndex + 1 }, (_, index) => {
                  const item = collectionData?.[index] || {};
                  
                  return (
                    <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg w-full overflow-hidden">
                      <h4 className="font-medium mb-4">Item {index + 1}</h4>
                      <div className="space-y-4">
                        {collection.properties.map((property) => {
                          const originalValue = item[property.propertyName];
                          const fieldName = `${collection.collectionName}.${property.propertyName}[${index}]`;
                          const validation = validations.find(v => v.fieldName === fieldName);
                          
                          // Show property if it has a value OR if there's a validation for it
                          if (originalValue !== undefined || validation) {
                            // Use validation's extractedValue (which includes manual edits), not the original extracted value
                            let displayValue = validation?.extractedValue ?? originalValue ?? null;
                            if (displayValue === "null" || displayValue === "undefined") {
                              displayValue = null;
                            }
                            return renderFieldWithValidation(fieldName, displayValue);
                          }
                          return null;
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