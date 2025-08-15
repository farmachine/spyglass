import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight, RotateCcw, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Check, User, Plus, Trash2, Bug, Wand2, Folder, FileText, FilePlus, Table as TableIcon, Loader2, MoreVertical } from "lucide-react";
import { WaveIcon, FlowIcon, TideIcon, ShipIcon } from "@/components/SeaIcons";
import * as XLSX from 'xlsx';
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ExtraplLogo from "@/components/ExtraplLogo";
import ValidationIcon from "@/components/ValidationIcon";
import UserProfile from "@/components/UserProfile";

import { EditFieldValueDialog } from "@/components/EditFieldValueDialog";
import AddDocumentsModal from "@/components/AddDocumentsModal";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import SessionChat from "@/components/SessionChat";

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
  const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'verified';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(reasoning);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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

  const isVerified = validation.validationStatus === 'valid' || 
                    validation.validationStatus === 'verified' || 
                    validation.validationStatus === 'manual-verified' ||
                    (validation.validationStatus === 'manual' && validation.manuallyVerified);

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

// AI Extraction Modal Component  
const AIExtractionModal = ({ 
  isOpen, 
  onClose, 
  sectionName,
  availableFields,
  sessionDocuments,
  verifiedFields,
  allProjectFields = [],
  sessionId,
  project,
  onStartProgressivePolling,
  setIsExtractionRunning,
  setExtractingCollection,
  setRefreshTrigger
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  sectionName: string;
  availableFields: { id: string; name: string; type: string; index?: number; orderIndex?: number }[];
  sessionDocuments: any[];
  verifiedFields: { id: string; name: string; value: string }[];
  allProjectFields?: { id: string; name: string; type: string }[];
  sessionId: string;
  project?: any;
  onStartProgressivePolling: (sessionId: string) => void;
  setIsExtractionRunning: (isRunning: boolean) => void;
  setExtractingCollection: (collection: string | null) => void;
  setRefreshTrigger: (fn: (prev: number) => number) => void;
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedVerifiedFields, setSelectedVerifiedFields] = useState<string[]>([]);
  const [selectedTargetFields, setSelectedTargetFields] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['schema']));
  const [isExtracting, setIsExtracting] = useState(false);
  // isExtractionRunning moved to main component scope
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldDocumentSources, setFieldDocumentSources] = useState<Record<string, string[]>>({});
  const [extractionProgress, setExtractionProgress] = useState<{
    currentFieldIndex: number;
    completedFields: Set<string>;
    totalFields: number;
  }>({ currentFieldIndex: -1, completedFields: new Set(), totalFields: 0 });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper function to handle successful extraction completion
  const handleSuccessfulExtraction = async () => {
    console.log('Processing successful extraction - closing modal and starting real-time polling');
    
    // Close the extraction modal immediately (active tab will be preserved)
    onClose();
    
    // Enable background extraction tracking
    setIsExtractionRunning(true);
    // Set the specific collection being extracted
    setExtractingCollection(sectionName === 'General Information' ? 'info' : sectionName);
    
    // Force refresh the validation data to show newly extracted results
    await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    await queryClient.refetchQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    
    // Also refresh session and project data
    queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    queryClient.invalidateQueries({ queryKey: ['/api/projects', project?.id] });
    
    // Wait a brief moment to ensure validation refresh completes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start enhanced real-time polling for progressive updates (column-by-column)
    let pollCount = 0;
    let lastValidationCount = 0;
    let consecutiveNoChangeCount = 0;
    const maxPollCount = 300; // Maximum 300 polls (5 minutes at 1 second intervals)
    const maxConsecutiveNoChanges = 10; // Stop if no changes for 10 consecutive polls (10 seconds)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Column-by-column polling [${pollCount}/${maxPollCount}]: checking for new extraction data...`);
      
      try {
        // Force complete refresh of validation data
        queryClient.removeQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        
        const validationData = await queryClient.fetchQuery({ 
          queryKey: ['/api/sessions', sessionId, 'validations'],
          staleTime: 0 // Always fetch fresh data
        });
        
        // Check if data has changed (new field validations saved)
        const currentValidationCount = Array.isArray(validationData) ? validationData.length : 0;
        
        if (currentValidationCount !== lastValidationCount) {
          // Data changed - new field validation(s) saved!
          consecutiveNoChangeCount = 0; // Reset counter when data changes
          const newFieldsCount = currentValidationCount - lastValidationCount;
          console.log(`✅ NEW FIELD(S) DETECTED: +${newFieldsCount} validations (${lastValidationCount} → ${currentValidationCount})`);
          
          // Trigger immediate UI refresh for new field data
          await queryClient.invalidateQueries({ queryKey: ['/api/projects', project?.id] });
          await queryClient.refetchQueries({ queryKey: ['/api/projects', project?.id] });
          setRefreshTrigger(prev => prev + 1);
          
          // Show toast notification for new field(s)
          if (newFieldsCount === 1) {
            toast({
              title: "New field extracted",
              description: "Field data has been updated and is now visible below.",
              duration: 2000,
            });
          } else {
            toast({
              title: `${newFieldsCount} new fields extracted`,
              description: "Field data has been updated and is now visible below.",
              duration: 2000,
            });
          }
        } else {
          // No data changes detected
          consecutiveNoChangeCount++;
          console.log(`📊 No changes detected (${consecutiveNoChangeCount}/${maxConsecutiveNoChanges}) - ${currentValidationCount} validations`);
        }
        
        lastValidationCount = currentValidationCount;
        
        // Stop polling if no changes for several consecutive attempts (extraction likely complete)
        if (consecutiveNoChangeCount >= maxConsecutiveNoChanges) {
          console.log('🏁 Extraction appears complete (no data changes for 10 seconds) - stopping polling');
          clearInterval(pollInterval);
          setIsExtractionRunning(false);
          setExtractingCollection(null);
          
          toast({
            title: "Extraction completed",
            description: "All data has been processed and is now available below.",
          });
          return;
        }
        
      } catch (error) {
        console.error('Polling error:', error);
        // Continue polling even on errors, but count them as no-change
        consecutiveNoChangeCount++;
      }
      
      // Stop polling after max attempts
      if (pollCount >= maxPollCount) {
        console.log('⏹️ Real-time polling complete (max attempts reached)');
        clearInterval(pollInterval);
        setIsExtractionRunning(false);
        setExtractingCollection(null);
        
        // Fall back to normal progressive polling if it exists
        if (typeof onStartProgressivePolling === 'function') {
          onStartProgressivePolling(sessionId);
        }
      }
    }, 1000); // Poll every 1 second for column-by-column updates
    
    // Backup timeout to ensure spinners stop after 5 minutes
    setTimeout(() => {
      console.log('⏹️ Column-by-column polling complete (timeout)');
      clearInterval(pollInterval);
      setIsExtractionRunning(false);
      setExtractingCollection(null);
    }, 300000); // 5 minutes
    
    // Show completion message with real-time info
    toast({
      title: "Extraction in progress",
      description: "Step 1 completed! Data will appear in real-time below as extraction continues.",
    });
    
    console.log('Modal closed and polling started successfully');
  };

  // Fetch extraction rules for the project
  const { data: extractionRules = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "rules"],
    queryFn: () => apiRequest(`/api/projects/${project?.id}/rules`),
    enabled: !!project?.id
  });

  const handleDocumentToggle = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleVerifiedFieldToggle = (fieldId: string) => {
    setSelectedVerifiedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleTargetFieldToggle = (fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return;
    
    const globalFieldIndex = availableFields.findIndex(f => f.id === fieldId);
    const wasSelected = selectedTargetFields.includes(fieldId);
    
    // Check if this field belongs to a collection by looking for collectionId
    const allCollections = project?.collections || [];
    let fieldCollection = null;
    let isCollectionField = false;
    
    for (const collection of allCollections) {
      const property = collection.properties?.find(p => p.id === fieldId);
      if (property) {
        fieldCollection = collection;
        isCollectionField = true;
        break;
      }
    }
    
    if (isCollectionField && fieldCollection) {
      // Collection field: use sequential selection logic within the collection
      const collectionFields = availableFields
        .filter(f => {
          // Check if this field belongs to the same collection
          for (const collection of allCollections) {
            if (collection.id === fieldCollection.id) {
              return collection.properties?.some(p => p.id === f.id);
            }
          }
          return false;
        })
        .sort((a, b) => (a.orderIndex || a.index || 0) - (b.orderIndex || b.index || 0));
      
      const fieldIndex = collectionFields.findIndex(f => f.id === fieldId);
      
      setSelectedTargetFields(prev => {
        if (prev.includes(fieldId)) {
          // Deselecting: remove this field and all higher-indexed fields in the same collection
          console.log(`Field ${globalFieldIndex + 1}: ${field.name} - deselected`);
          
          // Log additional fields that will be deselected due to sequential logic
          const fieldsToDeselect = collectionFields.filter((f, idx) => idx > fieldIndex && prev.includes(f.id));
          fieldsToDeselect.forEach((f) => {
            const globalIdx = availableFields.findIndex(af => af.id === f.id);
            console.log(`Field ${globalIdx + 1}: ${f.name} - deselected (sequential)`);
          });
          
          return prev.filter(id => {
            // Keep non-collection fields and fields from other collections
            let belongsToSameCollection = false;
            for (const collection of allCollections) {
              if (collection.id === fieldCollection.id) {
                belongsToSameCollection = collection.properties?.some(p => p.id === id) || false;
                break;
              }
            }
            if (!belongsToSameCollection) return true;
            
            const targetIndex = collectionFields.findIndex(f => f.id === id);
            return targetIndex < fieldIndex;
          });
        } else {
          // Selecting: ensure all previous fields in the collection are selected
          console.log(`Field ${globalFieldIndex + 1}: ${field.name} - selected`);
          
          const newSelection = [...prev];
          
          // Add all fields from index 0 up to and including the selected field within the collection
          for (let i = 0; i <= fieldIndex; i++) {
            const requiredField = collectionFields[i];
            if (requiredField && !newSelection.includes(requiredField.id)) {
              const globalIdx = availableFields.findIndex(af => af.id === requiredField.id);
              console.log(`Field ${globalIdx + 1}: ${requiredField.name} - selected (sequential)`);
              newSelection.push(requiredField.id);
            }
          }
          
          return newSelection;
        }
      });
    } else {
      // Non-collection field (schema property): free selection, no sequential constraints
      console.log(`Field ${globalFieldIndex + 1}: ${field.name} - ${wasSelected ? 'deselected' : 'selected'}`);
      
      setSelectedTargetFields(prev => 
        prev.includes(fieldId) 
          ? prev.filter(id => id !== fieldId)
          : [...prev, fieldId]
      );
    }
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(sessionDocuments.map(doc => doc.id));
  };

  const allTargetFields = allProjectFields;
  
  const selectAllVerifiedFields = () => {
    setSelectedVerifiedFields(allTargetFields.map(field => field.id));
  };

  const selectAllTargetFields = () => {
    setSelectedTargetFields(availableFields.map(field => field.id));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleFieldExpansion = (fieldId: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const toggleFieldDocumentSource = (fieldId: string, documentId: string) => {
    setFieldDocumentSources(prev => {
      const currentSources = prev[fieldId] || [];
      const newSources = currentSources.includes(documentId)
        ? currentSources.filter(id => id !== documentId)
        : [...currentSources, documentId];
      
      return {
        ...prev,
        [fieldId]: newSources
      };
    });
  };

  // Log selected documents for testing (no extraction call)
  const handleRunExtraction = async () => {
    // Frontend validation: Ensure project is loaded before extraction
    if (!project?.id) {
      console.error('Cannot run extraction: Project not loaded');
      toast({
        title: "Error",
        description: "Project data is still loading. Please wait and try again.",
        variant: "destructive",
      });
      return;
    }
    
    setIsExtracting(true);
    
    // Initialize extraction progress
    const sortedSelectedFields = selectedTargetFields
      .map(id => availableFields.find(f => f.id === id))
      .filter(Boolean)
      .sort((a, b) => (a!.orderIndex || a!.index || 0) - (b!.orderIndex || b!.index || 0));
    
    setExtractionProgress({
      currentFieldIndex: 0,
      completedFields: new Set(),
      totalFields: sortedSelectedFields.length
    });
    
    // Create field-specific extraction mapping
    const fieldExtractionMapping = selectedTargetFields.map(fieldId => {
      const field = availableFields.find(f => f.id === fieldId);
      const fieldSources = fieldDocumentSources[fieldId] || [];
      
      // If no specific sources selected, use all session documents
      const documentsToUse = fieldSources.length > 0 
        ? fieldSources 
        : sessionDocuments.map(doc => doc.id);
      
      const documentInfo = sessionDocuments
        ?.filter(doc => documentsToUse.includes(doc.id))
        .map(doc => {
          const content = doc.extractedContent || doc.content || doc.extractedText || '';
          const truncatedContent = content.length > 200 
            ? content.substring(0, 200) + '...' 
            : content;
          
          return {
            id: doc.id,
            name: doc.originalName || doc.filename || doc.name || doc.fileName || `Document ${doc.id.slice(0, 8)}`,
            type: doc.mimeType || doc.fileType || 'unknown',
            contentPreview: truncatedContent
          };
        }) || [];

      return {
        fieldId,
        fieldName: field?.name || 'Unknown Field',
        extractionSources: documentInfo,
        sourceCount: documentInfo.length
      };
    });

    console.log('Field-Specific Extraction Mapping:', JSON.stringify(fieldExtractionMapping, null, 2));

    // Log additional instructions
    console.log('Additional Instructions:', additionalInstructions || '(none provided)');

    // Log selected target field objects with full schema details
    const selectedTargetFieldObjects = availableFields
      ?.filter(field => selectedTargetFields.includes(field.id))
      .map(field => {
        // Find the full schema field object with all properties
        const schemaField = project?.schemaFields?.find(sf => sf.id === field.id);
        if (schemaField) {
          return schemaField;
        }
        
        // Check if it's a collection property
        for (const collection of project?.collections || []) {
          const property = collection.properties?.find(p => p.id === field.id);
          if (property) {
            return {
              ...property,
              collectionName: collection.name,
              collectionId: collection.id
            };
          }
        }
        
        // Fallback to basic field info if not found in schema
        return field;
      }) || [];
    
    console.log('Selected Target Field Objects:', JSON.stringify(selectedTargetFieldObjects, null, 2));

    // Find extraction rules that target the selected fields or are global rules
    const matchingRules = extractionRules.filter((rule: any) => {
      const targetField = rule.targetField || '';
      
      // Include global rules (rules with blank/null target field)
      if (!targetField.trim()) {
        return true;
      }
      
      // Check if any selected field matches the rule's target field
      return selectedTargetFieldObjects.some((field: any) => {
        // For schema fields, match by fieldName
        if (field.fieldName && targetField.includes(field.fieldName)) {
          return true;
        }
        // For collection properties, match by propertyName
        if (field.propertyName && targetField.includes(field.propertyName)) {
          return true;
        }
        // Also check by field name from availableFields
        const originalField = availableFields.find(af => af.id === field.id);
        if (originalField && targetField.includes(originalField.name)) {
          return true;
        }
        return false;
      });
    });

    // Separate targeted and global rules for clearer logging
    const targetedRules = matchingRules.filter((rule: any) => rule.targetField?.trim());
    const globalRules = matchingRules.filter((rule: any) => !rule.targetField?.trim());
    
    console.log('Matching Extraction Rules:', JSON.stringify({
      targeted: targetedRules,
      global: globalRules,
      total: matchingRules.length
    }, null, 2));

    // Add field document sources to target fields
    const targetFieldsWithSources = selectedTargetFieldObjects.map(field => ({
      ...field,
      selectedDocumentIds: fieldDocumentSources[field.id] || []
    }));

    // Collect all unique document IDs from field-specific selections
    const allSelectedDocumentIds = new Set<string>();
    selectedTargetFields.forEach(fieldId => {
      const fieldSources = fieldDocumentSources[fieldId] || [];
      // If no specific sources selected for this field, use all session documents
      if (fieldSources.length === 0) {
        sessionDocuments.forEach(doc => allSelectedDocumentIds.add(doc.id));
      } else {
        fieldSources.forEach(docId => allSelectedDocumentIds.add(docId));
      }
    });
    
    const documentIds = Array.from(allSelectedDocumentIds);

    // Log extraction configuration including field document sources
    console.log('=== Extraction Wizard - Starting Extraction ===');
    console.log('Field Document Sources:', JSON.stringify(
      Object.fromEntries(
        Object.entries(fieldDocumentSources).filter(([fieldId]) => 
          selectedTargetFields.includes(fieldId)
        )
      ), 
      null, 
      2
    ));
    console.log('Collected Document IDs for extraction:', documentIds);
    
    // Run the extraction wizardry Python script with document IDs, session ID, project ID, and target fields
    try {
      const requestData = {
        document_ids: documentIds,
        session_id: sessionId,
        project_id: project.id, // Now guaranteed to be present due to validation above
        target_fields: targetFieldsWithSources
      };
      
      console.log('Complete Extraction Request:', JSON.stringify(requestData, null, 2));
      console.log('✅ Frontend - project_id being sent:', project.id);
      
      // Close modal immediately and start real-time updates
      // Don't wait for the full extraction to complete
      console.log('Starting extraction and closing modal for real-time updates...');
      
      // Close modal and start polling immediately so user can see data appearing
      await handleSuccessfulExtraction();
      
      // Make the extraction request in the background (don't await)
      apiRequest('/api/run-wizardry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      }).then(response => {
        console.log('Wizardry Result:', response);
        console.log('✅ Frontend - response.success:', response.success);
        if (response.output) {
          console.log('Python Script Output:');
          console.log(response.output);
        }
        if (response.error) {
          console.log('Python Script Error:');
          console.log(response.error);
        }
        
        if (!response.success) {
          console.warn('Extraction completed with errors, but data may still be appearing');
        }
      }).catch(error => {
        console.error('Extraction request failed:', error);
        // Even if request fails, keep polling in case some data was processed
      });
      
      // No need to simulate progress since modal closes immediately
      // Real data will appear via the polling system
      
    } catch (error) {
      console.error('Error running wizardry:', error);
      
      // Check if this is a 502 error after successful extraction
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('502') && errorMessage.includes('Bad Gateway')) {
        // Refresh validations to check if extraction actually succeeded
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        
        // Show a helpful message about the background processing
        toast({
          title: "Extraction may be continuing",
          description: "The extraction process might be running in the background. Check for new results appearing shortly.",
        });
        
        // Close modal and start polling anyway, in case extraction is actually running
        await handleSuccessfulExtraction();
      } else {
        toast({
          title: "Extraction failed",
          description: "There was an error running the extraction. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsExtracting(false);
      setExtractionProgress({ currentFieldIndex: -1, completedFields: new Set(), totalFields: 0 });
      // Modal is already closed above after successful first step
    }
  };

  // Organize fields by category
  const organizeFields = () => {
    const schemaFields: typeof allProjectFields = [];
    const collectionNames: string[] = [];

    allTargetFields.forEach(field => {
      if (field.id.includes('.')) {
        // Collection field
        const [collectionName] = field.id.split('.');
        if (!collectionNames.includes(collectionName)) {
          collectionNames.push(collectionName);
        }
      } else {
        // Schema field
        schemaFields.push(field);
      }
    });

    return { schemaFields, collectionNames };
  };

  const { schemaFields, collectionNames } = organizeFields();

  // Console log all field schema properties when modal opens
  useEffect(() => {
    if (isOpen && availableFields.length > 0) {
      console.log('=== AI Field Extractor Modal - Field Schema Properties ===');
      
      availableFields.forEach((field, index) => {
        console.log(`--- Field ${index + 1}: ${field.name} ---`);
        
        // Find the collection and property for this field
        const allCollections = project?.collections || [];
        for (const collection of allCollections) {
          const property = collection.properties?.find(p => p.id === field.id);
          if (property) {
            console.log(JSON.stringify({
              id: property.id,
              collectionId: property.collectionId,
              propertyName: property.propertyName,
              propertyType: property.propertyType,
              description: property.description,
              autoVerificationConfidence: property.autoVerificationConfidence,
              choiceOptions: property.choiceOptions,
              isIdentifier: property.isIdentifier,
              orderIndex: property.orderIndex,
              createdAt: property.createdAt
            }, null, 2));
            break;
          }
        }
      });
      
      console.log('=== End Field Schema Properties ===');
    }
  }, [isOpen, availableFields, project]);

  // Auto-select identifier fields when modal opens
  useEffect(() => {
    if (isOpen && availableFields.length > 0 && project?.collections) {
      const identifierFields: string[] = [];
      
      // Find all identifier fields
      for (const collection of project.collections) {
        for (const property of collection.properties || []) {
          if (property.isIdentifier && availableFields.some(f => f.id === property.id)) {
            identifierFields.push(property.id);
          }
        }
      }
      
      // Add identifier fields to selection if not already selected
      if (identifierFields.length > 0) {
        setSelectedTargetFields(prev => {
          const newSelection = [...prev];
          identifierFields.forEach(fieldId => {
            if (!newSelection.includes(fieldId)) {
              newSelection.push(fieldId);
            }
          });
          return newSelection;
        });
      }
    }
  }, [isOpen, availableFields, project]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <Wand2 className="h-7 w-7 text-primary" />
            extrapl Wizard
          </DialogTitle>
          <DialogDescription className="text-lg text-muted-foreground mt-1">
            Extract fields for {sectionName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {availableFields
              .sort((a, b) => (a.orderIndex || a.index || 0) - (b.orderIndex || b.index || 0))
              .map((field) => {
                // Check if this field belongs to a collection and determine if it's selectable
                let isSelectable = true;
                let isFirstInCollection = false;
                let fieldBelongsToCollection = false;
                let fieldCollection = null;
                
                // Check if this field belongs to any collection
                const allCollections = project?.collections || [];
                for (const collection of allCollections) {
                  const property = collection.properties?.find(p => p.id === field.id);
                  if (property) {
                    fieldBelongsToCollection = true;
                    fieldCollection = collection;
                    break;
                  }
                }
                
                if (fieldBelongsToCollection && fieldCollection) {
                  // Collection field: all items are selectable (sequential auto-selection will happen on click)
                  const collectionFields = availableFields
                    .filter(f => {
                      // Check if this field belongs to the same collection
                      return fieldCollection.properties?.some(p => p.id === f.id);
                    })
                    .sort((a, b) => (a.orderIndex || a.index || 0) - (b.orderIndex || b.index || 0));
                  
                  const fieldIndex = collectionFields.findIndex(f => f.id === field.id);
                  isFirstInCollection = fieldIndex === 0;
                  
                  // All collection fields are selectable - selection logic will handle sequential behavior
                  isSelectable = true;
                } else {
                  // Non-collection field (schema property): always selectable (no sequential constraints)
                  isSelectable = true;
                }
                
                // Check if this field is an identifier (mandatory)
                let isIdentifier = false;
                for (const collection of allCollections) {
                  const property = collection.properties?.find(p => p.id === field.id);
                  if (property?.isIdentifier) {
                    isIdentifier = true;
                    break;
                  }
                }
                
                const isSelected = selectedTargetFields.includes(field.id) || isIdentifier;
                const containerClass = `rounded-lg p-4 border transition-all bg-white ${
                  isSelected
                    ? 'border-primary shadow-md cursor-pointer'
                    : isSelectable 
                      ? 'bg-card border-border hover:border-primary/40 hover:shadow-sm cursor-pointer' 
                      : 'bg-muted border-border/50 opacity-50 cursor-not-allowed'
                }`;
                
                const isFieldExpanded = expandedFields.has(field.id);
                const fieldSources = fieldDocumentSources[field.id] || [];

                return (
                  <div 
                    key={field.id} 
                    className={`${containerClass} ${isSelectable && !isIdentifier && !isSelected ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (isSelectable && !isIdentifier && !isSelected) {
                        handleTargetFieldToggle(field.id);
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent container click
                          if (isSelectable && !isIdentifier && isSelected) {
                            handleTargetFieldToggle(field.id); // Only allow deselection via wand
                          } else if (isSelectable && !isIdentifier && !isSelected) {
                            handleTargetFieldToggle(field.id); // Allow selection via wand too
                          }
                        }}
                        disabled={!isSelectable || isIdentifier}
                        className={`p-2 rounded-md transition-all flex-shrink-0 ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/80' 
                            : isSelectable && !isIdentifier
                              ? 'bg-background text-muted-foreground hover:text-primary hover:bg-primary/10'
                              : 'bg-background text-muted-foreground/40 cursor-not-allowed'
                        } ${isIdentifier ? 'opacity-70' : ''}`}
                      >
                        {(() => {
                          // Check if this field is currently being extracted
                          const sortedSelectedFields = selectedTargetFields
                            .map(id => availableFields.find(f => f.id === id))
                            .filter(Boolean)
                            .sort((a, b) => (a!.orderIndex || a!.index || 0) - (b!.orderIndex || b!.index || 0));
                          
                          const fieldIndex = sortedSelectedFields.findIndex(f => f!.id === field.id);
                          const isCurrentlyExtracting = isExtracting && extractionProgress.currentFieldIndex === fieldIndex;
                          const isCompleted = extractionProgress.completedFields.has(field.id);
                          
                          if (isCompleted) {
                            return <CheckCircle className="h-4 w-4 text-green-600" />;
                          } else if (isCurrentlyExtracting) {
                            return <div className="animate-spin"><Loader2 className="h-4 w-4" /></div>;
                          } else {
                            return <Wand2 className="h-4 w-4" />;
                          }
                        })()}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div 
                              className={`text-base font-medium ${
                                isSelectable ? 'text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {field.name}
                            </div>
                            {field.type && (
                              <p className={`text-sm mt-1 ${isSelectable ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                                Type: {field.type}
                              </p>
                            )}
                            {(() => {
                              // Find field description from project collections or schema
                              let fieldDescription = '';
                              const allCollections = project?.collections || [];
                              
                              // Check collections first
                              for (const collection of allCollections) {
                                const property = collection.properties?.find(p => p.id === field.id);
                                if (property && property.description) {
                                  fieldDescription = property.description;
                                  break;
                                }
                              }
                              
                              // Check schema fields if not found in collections
                              if (!fieldDescription && project?.schemaFields) {
                                const schemaField = project.schemaFields.find(sf => sf.id === field.id);
                                if (schemaField && schemaField.description) {
                                  fieldDescription = schemaField.description;
                                }
                              }
                              
                              return fieldDescription && (
                                <p className={`text-sm mt-1 leading-relaxed ${isSelectable ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                                  {fieldDescription}
                                </p>
                              );
                            })()}
                          </div>
                          {isSelected && (
                            <button
                              onClick={() => toggleFieldExpansion(field.id)}
                              className="p-1 hover:bg-muted rounded-md transition-all duration-200 ml-2 flex-shrink-0"
                            >
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                                isFieldExpanded ? 'rotate-0' : '-rotate-90'
                              }`} />
                            </button>
                          )}
                        </div>
                        
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isSelected && isFieldExpanded 
                            ? 'max-h-[400px] opacity-100 mt-4' 
                            : 'max-h-0 opacity-0 mt-0'
                        }`}>
                          <div className="pl-0">
                              <div className="mb-3">
                                <Label className="text-sm font-medium text-foreground">
                                  Extraction Sources
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Select specific documents to extract this field from
                                </p>
                              </div>
                              <div className="bg-card border border-border rounded-md p-4">
                              <div className="space-y-3 max-h-32 overflow-y-auto pr-1">
                                {sessionDocuments.map(doc => {
                                  const isSourceSelected = fieldSources.includes(doc.id);
                                  const fileName = doc.originalName || doc.filename || doc.name || doc.fileName || `Document ${doc.id.slice(0, 8)}`;
                                  const fileType = doc.mimeType || doc.fileType || '';
                                  
                                  // Determine icon and color based on file type
                                  let iconColor = 'text-muted-foreground'; // default
                                  let IconComponent = FileText; // default icon
                                  
                                  if (fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
                                    iconColor = 'text-red-500';
                                    IconComponent = FileText;
                                  } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
                                           fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
                                    iconColor = 'text-green-500';
                                    IconComponent = TableIcon;
                                  } else if (fileType.includes('word') || fileType.includes('document') || 
                                           fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
                                    iconColor = 'text-blue-500';
                                    IconComponent = FileText;
                                  }
                                  
                                  return (
                                    <div key={doc.id} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
                                      <Checkbox
                                        checked={isSourceSelected}
                                        onCheckedChange={() => toggleFieldDocumentSource(field.id, doc.id)}
                                        className="mt-0.5"
                                      />
                                      <IconComponent className={`h-4 w-4 ${iconColor} flex-shrink-0 mt-0.5`} />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm text-foreground font-medium block truncate">
                                          {fileName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {fileType || 'Unknown type'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border bg-background">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            disabled={selectedTargetFields.length === 0 || isExtracting || !project?.id}
            onClick={handleRunExtraction}
          >
            {isExtracting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Extracting...
              </>
            ) : (
              'Start Extraction'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function SessionView() {
  const { sessionId } = useParams(); // Remove projectId from params - we'll get it from session data
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [isExtractionRunning, setIsExtractionRunning] = useState(false); // Track background extraction (moved to main scope)
  const [extractingCollection, setExtractingCollection] = useState<string | null>(null); // Track which specific collection is being extracted
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh counter for real-time updates
  const [sessionNameValue, setSessionNameValue] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
  const [editingDisplayNames, setEditingDisplayNames] = useState<Record<string, boolean>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('info');
  const [selectedReasoning, setSelectedReasoning] = useState<{
    reasoning: string;
    fieldName: string;
    confidenceScore: number;
  } | null>(null);
  
  // Edit field dialog state
  const [editFieldDialog, setEditFieldDialog] = useState<{
    open: boolean;
    validation: FieldValidation | null;
  }>({ open: false, validation: null });

  // Add documents modal state
  const [addDocumentsModalOpen, setAddDocumentsModalOpen] = useState(false);
  
  // Document upload modal state (upload only, no AI processing)
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = useState(false);
  
  // AI extraction modal state
  const [aiExtractionModal, setAiExtractionModal] = useState<{
    open: boolean;
    sectionName: string;
    availableFields: { id: string; name: string; type: string; index?: number; orderIndex?: number }[];
  }>({ open: false, sectionName: '', availableFields: [] });

  // Progressive extraction polling state
  const [progressivePollingActive, setProgressivePollingActive] = useState(false);
  const [lastValidationCount, setLastValidationCount] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Progressive validation polling functions
  const startProgressiveValidationPolling = (sessionId: string) => {
    setProgressivePollingActive(true);
    setLastValidationCount(validations?.length || 0);
    
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Poll every 3 seconds for validation updates
    pollingIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    }, 3000);
    
    // Stop polling after 5 minutes (allowing time for multi-step extraction)
    setTimeout(() => {
      stopProgressiveValidationPolling();
    }, 300000); // 5 minutes
  };

  const stopProgressiveValidationPolling = () => {
    setProgressivePollingActive(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Clean up polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Helper function to find schema field data
  const findSchemaField = (validation: FieldValidation) => {
    if (validation.validationType !== 'schema_field' || !project?.schemaFields) return null;
    const field = project.schemaFields.find(f => f.id === validation.fieldId);
    return field ? {
      fieldType: field.fieldType,
      choiceOptions: field.choiceOptions
    } : null;
  };

  // Helper function to find collection property data
  const findCollectionProperty = (validation: FieldValidation) => {
    if (validation.validationType !== 'collection_property' || !project?.collections) return null;
    for (const collection of project.collections) {
      const property = collection.properties?.find(p => p.id === validation.fieldId);
      if (property) {
        return {
          propertyType: property.propertyType,
          choiceOptions: property.choiceOptions
        };
      }
    }
    return null;
  };

  // Handler to open edit dialog
  const handleEditField = (validation: FieldValidation) => {
    setEditFieldDialog({ open: true, validation });
  };

  // Handler to open AI extraction modal
  const handleOpenAIExtraction = (sectionName: string, availableFields: { id: string; name: string; type: string }[]) => {
    console.log('handleOpenAIExtraction called with:', { sectionName, availableFields });
    setAiExtractionModal({
      open: true,
      sectionName,
      availableFields
    });
  };

  // Handler to close AI extraction modal
  const handleCloseAIExtraction = () => {
    setAiExtractionModal({ open: false, sectionName: '', availableFields: [] });
  };

  // Helper function to get verified fields for the modal (mirrors sidebar structure)
  const getVerifiedFields = () => {
    const verifiedData: { id: string; name: string; value: string }[] = [];
    
    // Add "General Information" if it has data
    const hasSchemaData = project?.schemaFields?.some(field => {
      const originalValue = extractedData[field.fieldName];
      const validation = getValidation(field.fieldName);
      const displayValue = validation?.extractedValue ?? originalValue ?? null;
      return displayValue !== null && displayValue !== undefined && displayValue !== "" && 
             displayValue !== "null" && displayValue !== "undefined";
    });
    
    if (hasSchemaData) {
      verifiedData.push({
        id: 'general-information',
        name: 'General Information',
        value: 'Main schema fields with extracted data'
      });
    }
    
    // Add collection sections that have data (like "Column Name Mapping (60)")
    project?.collections?.forEach(collection => {
      const collectionData = extractedData[collection.collectionName];
      const itemCount = Array.isArray(collectionData) ? collectionData.filter(item => 
        item && Object.values(item || {}).some(value => 
          value !== null && value !== undefined && value !== ""
        )
      ).length : 0;
      

      
      if (itemCount > 0) {
        verifiedData.push({
          id: collection.id,
          name: `${collection.collectionName} (${itemCount})`,
          value: `Collection with ${itemCount} items containing data`
        });
      }
    });
    
    return verifiedData;
  };

  // Handler to save edited field value
  const handleSaveFieldEdit = async (validationId: string, newValue: string, newStatus: string) => {
    // Optimistic update: Update cache immediately
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => 
      old ? old.map((v: any) => 
        v.id === validationId 
          ? { 
              ...v, 
              extractedValue: newValue, 
              validationStatus: newStatus,
              manuallyUpdated: true,
              aiReasoning: `Value manually updated by user to: ${newValue}`
            }
          : v
      ) : []
    );

    try {
      await updateValidationMutation.mutateAsync({
        id: validationId,
        data: {
          extractedValue: newValue,
          validationStatus: newStatus as ValidationStatus,
          manuallyUpdated: true,
          aiReasoning: `Value manually updated by user to: ${newValue}`
        }
      });
    } catch (error) {
      // Revert optimistic update on error
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      console.error('Failed to update field value:', error);
    }
  };
  
  // Column sorting and resizing state
  const [sortConfig, setSortConfig] = useState<{ 
    key: string; 
    direction: 'asc' | 'desc' | null;
    collectionId?: string;
  } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
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
      if (property.propertyType === 'NUMBER') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (property.propertyType === 'DATE') {
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
    refetchInterval: progressivePollingActive ? 3000 : false, // Auto-refetch when polling active
    onSuccess: (data) => {
      console.log(`Session ${sessionId} - Validations loaded:`, data.length);
      if (data.length > 0) {
        console.log('Sample validation:', data[0]);
        console.log('All field names:', data.map(v => v.fieldName));
        console.log('Collection validations:', data.filter(v => v.validationType === 'collection_property').map(v => ({
          fieldName: v.fieldName,
          recordIndex: v.recordIndex,
          collectionName: v.collectionName
        })));
      }
    }
  });

  // Monitor validation changes and show toast notifications for progressive extraction
  useEffect(() => {
    if (progressivePollingActive && validations) {
      const currentCount = validations.length;
      if (currentCount > lastValidationCount && lastValidationCount > 0) {
        const newValidationsCount = currentCount - lastValidationCount;
        toast({
          title: "New extraction results available",
          description: `${newValidationsCount} new field${newValidationsCount > 1 ? 's' : ''} extracted successfully!`,
        });
        setLastValidationCount(currentCount);
      }
    }
  }, [validations, progressivePollingActive, lastValidationCount, toast]);

  // Query for session documents
  const { data: sessionDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'documents'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/documents`),
    enabled: !!sessionId,
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
      

    },
    onError: (error: any) => {
      console.error('Failed to update field:', error);
    }
  });

  // Mutation to update session name
  const updateSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      return apiRequest(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ sessionName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      setIsEditingSessionName(false);
    },
    onError: (error: any) => {
      console.error('Failed to update session name:', error);
    }
  });

  // Initialize session name value when session data loads
  useEffect(() => {
    if (session?.sessionName && !isEditingSessionName) {
      setSessionNameValue(session.sessionName);
    }
  }, [session?.sessionName, isEditingSessionName]);

  // Handlers for session name editing
  const handleSessionNameEdit = () => {
    setIsEditingSessionName(true);
  };

  const handleSessionNameSave = () => {
    if (sessionNameValue.trim() && sessionNameValue !== session?.sessionName) {
      updateSessionMutation.mutate(sessionNameValue.trim());
    } else {
      setIsEditingSessionName(false);
    }
  };

  const handleSessionNameCancel = () => {
    setSessionNameValue(session?.sessionName || '');
    setIsEditingSessionName(false);
  };

  const handleSessionNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSessionNameSave();
    } else if (e.key === 'Escape') {
      handleSessionNameCancel();
    }
  };

  // Batch validation removed - validation now occurs only during extraction process

  // Document action handlers
  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/sessions/documents/${documentId}/download?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName?.replace(/\.[^/.]+$/, "") + '_extracted_content.txt' || 'document.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/sessions/documents/${documentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Invalidate and refetch session documents
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'documents'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete document:', error);
    }
  });

  const handleDeleteDocument = (documentId: string) => {
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  // Handler for field verification changes
  const handleFieldVerification = (fieldName: string, isVerified: boolean) => {
    const validation = getValidation(fieldName);
    if (!validation) return;
    
    const newStatus: ValidationStatus = isVerified ? 'verified' : 'unverified';
    
    // Optimistic update: immediately update the UI
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((v: any) => 
        v.id === validation.id 
          ? { ...v, validationStatus: newStatus }
          : v
      );
    });
    
    updateValidationMutation.mutate({
      id: validation.id,
      data: { validationStatus: newStatus }
    }, {
      onError: () => {
        // Revert optimistic update on error
        queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((v: any) => 
            v.id === validation.id 
              ? { ...v, validationStatus: validation.validationStatus }
              : v
          );
        });
      }
    });
  };

  // Handler for bulk item verification (status column click)
  const handleItemVerification = (collectionName: string, recordIndex: number, isVerified: boolean) => {
    console.log(`handleItemVerification called: ${collectionName}, index ${recordIndex}, verified: ${isVerified}`);
    
    // Find all fields for this collection item using multiple approaches
    // Some records might have collectionName: null, so we use fieldName patterns too
    const itemValidations = validations.filter(v => {
      // Primary approach: match by collectionName and recordIndex
      if (v.collectionName === collectionName && v.recordIndex === recordIndex) {
        return true;
      }
      
      // Fallback approach: match by fieldName pattern for records with null collectionName
      if (v.collectionName === null && v.fieldName && v.fieldName.includes(`[${recordIndex}]`)) {
        // Check if fieldName starts with the collection name
        return v.fieldName.startsWith(`${collectionName}.`);
      }
      
      return false;
    });
    
    console.log(`Found ${itemValidations.length} validations for ${collectionName}[${recordIndex}]:`, 
      itemValidations.map(v => ({ id: v.id, fieldName: v.fieldName, collectionName: v.collectionName, recordIndex: v.recordIndex })));
    
    if (itemValidations.length === 0) {
      console.warn(`No validations found for ${collectionName}[${recordIndex}]`);
      return;
    }
    
    const newStatus: ValidationStatus = isVerified ? 'verified' : 'unverified';
    
    // Optimistic updates for all item validations
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((v: any) => {
        const shouldUpdate = itemValidations.some(iv => iv.id === v.id);
        return shouldUpdate ? { ...v, validationStatus: newStatus, manuallyVerified: isVerified } : v;
      });
    });
    
    // Update all fields for this item
    itemValidations.forEach(validation => {
      console.log(`Updating validation ${validation.id} to status: ${newStatus}`);
      updateValidationMutation.mutate({
        id: validation.id,
        data: { validationStatus: newStatus }
      });
    });
  };

  // Handler for adding new collection item
  const handleAddCollectionItem = async (collectionName: string) => {
    if (!session || !project) return;
    
    // Find the collection
    const collection = project.collections.find(c => c.collectionName === collectionName);
    if (!collection) return;
    
    // Find the highest existing record index for this collection using improved filtering
    const collectionValidations = validations.filter(v => {
      // Primary approach: match by collectionName
      if (v.collectionName === collectionName) {
        return true;
      }
      
      // Fallback approach: match by fieldName pattern for records with null collectionName
      if (v.collectionName === null && v.fieldName && v.fieldName.startsWith(`${collectionName}.`)) {
        return true;
      }
      
      return false;
    });
    
    const existingIndices = collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined);
    const maxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : -1;
    const newIndex = maxIndex + 1;
    
    console.log(`🔍 INDEX CALCULATION for ${collectionName}:`, {
      totalValidations: validations.length,
      collectionValidations: collectionValidations.length,
      existingIndices,
      maxIndex,
      newIndex,
      firstAdd: existingIndices.length === 0
    });

    // Optimistic update: Create temporary validation records
    const tempValidations = collection.properties.map(property => ({
      id: `temp-${Date.now()}-${property.id}`,
      sessionId: session.id,
      validationType: 'collection_property' as const,
      dataType: property.propertyType,
      fieldId: property.id,
      fieldName: `${collectionName}.${property.propertyName}[${newIndex}]`,
      collectionName: collectionName,
      recordIndex: newIndex,
      extractedValue: null,
      originalExtractedValue: null,
      originalConfidenceScore: 0,
      originalAiReasoning: null,
      validationStatus: 'pending' as const,
      aiReasoning: 'New item added by user',
      manuallyVerified: false,
      manuallyUpdated: false, // Don't mark as manually updated until user actually edits
      confidenceScore: 0,
      documentSource: 'Manual Entry',
      documentSections: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Optimistically update the cache
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      console.log('Adding collection item - current cache:', old);
      console.log('Adding temp validations:', tempValidations);
      const updated = old ? [...old, ...tempValidations] : tempValidations;
      console.log('Updated cache:', updated);
      return updated;
    });
    
    try {
      // Create validation records for each property in the collection
      const createPromises = collection.properties.map(property => {
        const validationData = {
          // sessionId is automatically added by the backend
          validationType: 'collection_property',
          dataType: property.propertyType, // TEXT, NUMBER, DATE, CHOICE
          fieldId: property.id,
          collectionName: collectionName, // Explicitly set the collection name
          recordIndex: newIndex,
          extractedValue: null, // Use null instead of empty string for optional fields
          originalExtractedValue: null,
          originalConfidenceScore: 0,
          originalAiReasoning: null,
          validationStatus: 'pending', // Use 'pending' instead of 'unverified'
          aiReasoning: 'New item added by user',
          manuallyVerified: false,
          manuallyUpdated: false, // Don't mark as manually updated until user actually edits
          confidenceScore: 0,
          documentSource: 'Manual Entry',
          documentSections: null
        };
        
        console.log(`Creating validation for ${collectionName}.${property.propertyName}[${newIndex}]:`, validationData);
        
        return apiRequest(`/api/sessions/${session.id}/validations`, {
          method: 'POST',
          body: JSON.stringify(validationData)
        });
      });
      
      await Promise.all(createPromises);
      console.log('All validation records created successfully');
      
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force refetch instead of just invalidating to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      console.log('Cache refetched after creating collection item');
      
      // Double-check by logging the updated cache
      const updatedValidations = queryClient.getQueryData(['/api/sessions', sessionId, 'validations']);
      console.log('Updated validations count after refetch:', updatedValidations?.length);
    } catch (error) {
      // Revert optimistic update on error
      console.error('Failed to add item:', error);
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    }
  };

  // Handler for verifying all items in a collection
  const handleVerifyAllCollectionItems = (collectionName: string, shouldVerify: boolean) => {
    console.log(`${shouldVerify ? 'Verifying' : 'Unverifying'} all items in collection: ${collectionName}`);
    
    // Find the collection
    const collection = project?.collections?.find(c => c.collectionName === collectionName);
    if (!collection) {
      console.error(`Collection not found: ${collectionName}`);
      return;
    }
    
    // Find all validation records for this collection using improved filtering
    const collectionValidations = validations.filter(v => {
      // Primary approach: match by collectionName
      if (v.collectionName === collectionName) {
        return true;
      }
      
      // Fallback approach: match by fieldName pattern for records with null collectionName
      if (v.collectionName === null && v.fieldName && v.fieldName.startsWith(`${collectionName}.`)) {
        return true;
      }
      
      return false;
    });

    console.log(`Found ${collectionValidations.length} validations to ${shouldVerify ? 'verify' : 'unverify'} for collection ${collectionName}:`, 
      collectionValidations.map(v => ({ id: v.id, fieldName: v.fieldName, status: v.validationStatus })));

    if (collectionValidations.length === 0) {
      console.warn(`No validations found for collection: ${collectionName}`);
      return;
    }

    const newStatus: ValidationStatus = shouldVerify ? 'verified' : 'pending';
    
    // Optimistic updates for all collection validations
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((v: any) => {
        const shouldUpdate = collectionValidations.some(cv => cv.id === v.id);
        return shouldUpdate ? { ...v, validationStatus: newStatus, manuallyVerified: shouldVerify } : v;
      });
    });
    
    // Update all validations for this collection
    const updatePromises = collectionValidations.map(validation => {
      console.log(`Updating validation ${validation.id} (${validation.fieldName}) to status: ${newStatus}`);
      return updateValidationMutation.mutateAsync({
        id: validation.id,
        data: { validationStatus: newStatus, manuallyVerified: shouldVerify }
      });
    });

    Promise.all(updatePromises).then(() => {
      console.log(`Successfully ${shouldVerify ? 'verified' : 'unverified'} all ${collectionValidations.length} items in ${collectionName}`);
    }).catch((error) => {
      console.error('Error updating collection verification:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    });
  };

  // Handler for deleting collection item
  const handleDeleteCollectionItem = async (collectionName: string, recordIndex: number) => {
    console.log(`Deleting collection item: ${collectionName}[${recordIndex}]`);
    
    // Find all validations for this collection item using improved filtering
    const itemValidations = validations.filter(v => {
      // Primary approach: match by collectionName and recordIndex
      if (v.collectionName === collectionName && v.recordIndex === recordIndex) {
        return true;
      }
      
      // Fallback approach: match by fieldName pattern for records with null collectionName
      if (v.collectionName === null && v.fieldName && v.fieldName.includes(`[${recordIndex}]`)) {
        // Check if fieldName starts with the collection name
        return v.fieldName.startsWith(`${collectionName}.`);
      }
      
      return false;
    });

    console.log(`Found ${itemValidations.length} validations to delete for ${collectionName}[${recordIndex}]`);

    if (itemValidations.length === 0) {
      console.warn(`No validations found for ${collectionName}[${recordIndex}] - nothing to delete`);
      return;
    }

    // Optimistic update: Remove items from cache using the same filtering logic
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      if (!old) return old;
      return old.filter((v: any) => {
        // Keep items that don't match our delete criteria
        if (v.collectionName === collectionName && v.recordIndex === recordIndex) {
          return false; // Remove this item
        }
        
        if (v.collectionName === null && v.fieldName && v.fieldName.includes(`[${recordIndex}]`)) {
          if (v.fieldName.startsWith(`${collectionName}.`)) {
            return false; // Remove this item
          }
        }
        
        return true; // Keep this item
      });
    });
    
    try {
      // Delete all validation records for this item
      const deletePromises = itemValidations.map(validation => {
        console.log(`Deleting validation record: ${validation.id} (${validation.fieldName})`);
        return apiRequest(`/api/validations/${validation.id}`, {
          method: 'DELETE'
        });
      });
      
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted ${itemValidations.length} validation records for ${collectionName}[${recordIndex}]`);
      
      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    } catch (error) {
      console.error('Error deleting collection item:', error);
      // Revert optimistic update on error
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    }
  };

  // Handler to delete all data for a collection
  const handleDeleteAllCollectionData = async (collectionName: string) => {
    console.log(`Starting delete all data for collection: ${collectionName}`);
    
    // Find all validations for this collection
    const collectionValidations = validations.filter(v => {
      // Match by collectionName
      if (v.collectionName === collectionName) {
        return true;
      }
      
      // Also match by fieldName pattern (for backwards compatibility)
      if (v.collectionName === null && v.fieldName) {
        if (v.fieldName.startsWith(`${collectionName}.`)) {
          return true;
        }
      }
      
      return false;
    });

    console.log(`Found ${collectionValidations.length} validations to delete for collection ${collectionName}`);

    if (collectionValidations.length === 0) {
      console.warn(`No validations found for collection ${collectionName} - nothing to delete`);
      toast({
        title: "No data to delete",
        description: `Collection "${collectionName}" has no data to delete.`,
      });
      return;
    }

    // Optimistic update: Remove all collection items from cache
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      if (!old) return old;
      return old.filter((v: any) => {
        // Keep items that don't match our delete criteria
        if (v.collectionName === collectionName) {
          return false; // Remove this item
        }
        
        if (v.collectionName === null && v.fieldName && v.fieldName.startsWith(`${collectionName}.`)) {
          return false; // Remove this item
        }
        
        return true; // Keep this item
      });
    });
    
    try {
      // Delete all validation records for this collection
      const deletePromises = collectionValidations.map(validation => {
        console.log(`Deleting validation record: ${validation.id} (${validation.fieldName})`);
        return apiRequest(`/api/validations/${validation.id}`, {
          method: 'DELETE'
        });
      });
      
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted ${collectionValidations.length} validation records for collection ${collectionName}`);
      
      toast({
        title: "Data deleted successfully",
        description: `All data for collection "${collectionName}" has been deleted.`,
      });
      
      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    } catch (error) {
      console.error('Error deleting all collection data:', error);
      // Revert optimistic update on error
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      toast({
        title: "Error deleting data",
        description: "Failed to delete collection data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-validation removed - validation now occurs only during extraction process

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

  // Get all project fields for AI extraction modal
  const getAllProjectFields = () => {
    const allFields: { id: string; name: string; type: string; index?: number; orderIndex?: number }[] = [];

    // Add schema fields (General Information fields)
    if (project?.schemaFields) {
      project.schemaFields.forEach(field => {
        allFields.push({
          id: field.fieldName,
          name: field.fieldName,
          type: field.fieldType,
          orderIndex: field.orderIndex || 0
        });
      });
    }

    // Add collection properties (from all collections)
    if (project?.collections) {
      project.collections.forEach(collection => {
        if (collection.properties) {
          collection.properties.forEach(property => {
            allFields.push({
              id: `${collection.collectionName}.${property.propertyName}`,
              name: `${collection.collectionName} - ${property.propertyName}`,
              type: property.propertyType,
              orderIndex: property.orderIndex || 0
            });
          });
        }
      });
    }

    return allFields;
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
      }
    }
    setEditingField(null);
    setEditValue("");
  };

  const handleVerificationToggle = async (fieldName: string, isVerified: boolean) => {
    const validation = getValidation(fieldName);
    if (validation) {
      // Properly handle verification status for different field types
      let newStatus: string;
      
      if (validation.manuallyUpdated) {
        // For manually updated fields, use "manual-verified" when verified, "manual" when unverified
        newStatus = isVerified ? "manual-verified" : "manual";
      } else {
        // For AI-extracted fields, use "verified" when verified, "pending" when unverified
        newStatus = isVerified ? "verified" : "pending";
      }
      
      // Optimistic update
      queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((v: any) => 
          v.id === validation.id 
            ? { ...v, validationStatus: newStatus, manuallyVerified: isVerified }
            : v
        );
      });
      
      // Debug logging to see what we're sending
      console.log(`🔧 VERIFICATION UPDATE - Field: ${fieldName}`, {
        fieldName,
        currentStatus: validation.validationStatus,
        currentManuallyUpdated: validation.manuallyUpdated,
        newStatus,
        isVerified,
        validationId: validation.id
      });
      
      try {
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            validationStatus: newStatus,
            manuallyVerified: isVerified
          }
        });
      } catch (error) {
        // Revert optimistic update on error
        queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((v: any) => 
            v.id === validation.id 
              ? { ...v, validationStatus: validation.validationStatus, manuallyVerified: validation.manuallyVerified }
              : v
          );
        });
        
        console.error('Failed to toggle verification:', error);
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
        
      } catch (error) {
        console.error('Failed to revert to AI value:', error);
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
      return 'Empty';
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
      // If parsing fails, return "Empty" for invalid dates
      return 'Empty';
    }
    
    return 'Empty';
  };

  const formatValueForDisplay = (value: any, fieldType: string) => {
    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Empty';
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
            
            // Check if field is verified (including manually verified fields)
            const isVerified = validation.validationStatus === 'valid' || 
                              validation.validationStatus === 'verified' || 
                              validation.validationStatus === 'manual-verified' ||
                              validation.manuallyVerified === true;
            
            // Check if field has actual value - if it has a value, it should never show "Not Extracted"
            const hasValue = validation.extractedValue !== null && 
                           validation.extractedValue !== undefined && 
                           validation.extractedValue !== "" && 
                           validation.extractedValue !== "null" && 
                           validation.extractedValue !== "undefined";
            
            // Force console logging to debug - this will help us understand the issue
            if (fieldName === 'Document Date') {
              console.log(`🐛 ICON LOGIC DEBUG - Field: ${fieldName}`, {
                wasManuallyUpdated,
                isVerified,
                validationStatus: validation.validationStatus,
                manuallyVerified: validation.manuallyVerified,
                willShowUserIcon: wasManuallyUpdated && !isVerified,
                willShowGreenCheck: wasManuallyUpdated && isVerified,
                currentTime: new Date().toISOString()
              });
            }
            
            // Only show user icon if manually updated AND not verified
            if (wasManuallyUpdated && !isVerified) {
              
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
            } else if (wasManuallyUpdated && isVerified) {
              // Show green checkmark for verified manually updated fields
              return (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
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
    { id: "back", label: `← All ${project?.mainObjectName || "Session"}s`, icon: Database, href: `/projects/${projectId}?tab=all-data` },
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header - Match ProjectLayout exactly */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtraplLogo />
            <UserProfile />
          </div>
        </div>
      </div>
      {/* Page Title - Match ProjectLayout exactly */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 mr-6">
              <TrendingUp className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-3xl font-bold">{project.name}</h2>
                  {progressivePollingActive && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-800">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span className="font-medium">Multi-step extraction in progress</span>
                    </div>
                  )}
                  {isExtractionRunning && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-sm text-green-800">
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span className="font-medium">Real-time data updates active</span>
                    </div>
                  )}
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
              <div className="flex gap-3 flex-shrink-0 ml-auto">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <Database className="h-6 w-6 text-slate-700" />
                  <span className="text-xl font-bold text-gray-900">{project.sessions.length}</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-gray-400" />
                  <span className="text-xl font-bold text-gray-900">
                    {verificationStats.in_progress + verificationStats.pending}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-xl font-bold text-gray-900">
                    {verificationStats.verified}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4">
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = false; // No highlighting since it navigates away
                
                return (
                  <Link key={item.id} href={item.href}>
                    <button
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-primary text-white font-medium shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal"
                      }`}
                    >
                      {item.label}
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Session Navigation - Only visible in session view */}
          <div className="border-t border-slate-200 p-4 flex-1">
            {/* Documents Section - Session-specific */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Folder className="h-5 w-5 text-slate-600 mr-3" />
                
                {/* Tab button */}
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex-1 text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                    activeTab === 'documents' 
                      ? 'bg-primary text-white font-medium shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal'
                  }`}
                >
                  <div className="truncate">Documents</div>
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider">{project?.mainObjectName || "Session"} Information</h3>
            </div>
            <div className="relative">
              {/* Vertical connecting line - stops at last collection */}
              <div className="absolute left-4 top-4 w-0.5 bg-slate-300" style={{ 
                height: `${project.collections.length * 48 + 12}px` 
              }}></div>
              
              <div className="space-y-3">
                {/* General Information Tab */}
                <div className="relative flex items-center">
                  {/* Circular icon */}
                  <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    (() => {
                      const infoValidations = validations.filter(v => !v.collectionName && !v.fieldName.includes('.'));
                      const verifiedCount = infoValidations.filter(v => 
                        v.validationStatus === 'verified' || 
                        (v.validationStatus === 'valid' && v.manuallyVerified === true)
                      ).length;
                      const totalCount = infoValidations.length;
                      
                      if (totalCount > 0 && verifiedCount === totalCount) {
                        return 'bg-white border-green-600';
                      } else {
                        return activeTab === 'info' 
                          ? 'bg-primary border-primary' 
                          : 'bg-white border-slate-300';
                      }
                    })()
                  }`}>
                    {(() => {
                      // Show loading spinner when this specific section is being extracted
                      if (extractingCollection === 'info') {
                        return <Loader2 className="w-4 h-4 text-white animate-spin" />;
                      }
                      
                      const infoValidations = validations.filter(v => !v.collectionName && !v.fieldName.includes('.'));
                      const verifiedCount = infoValidations.filter(v => 
                        v.validationStatus === 'verified' || 
                        (v.validationStatus === 'valid' && v.manuallyVerified === true)
                      ).length;
                      const totalCount = infoValidations.length;
                      
                      if (totalCount > 0 && verifiedCount === totalCount) {
                        return <Check className="w-4 h-4 text-green-600" />;
                      } else {
                        return <div className={`w-3 h-3 rounded-full ${
                          activeTab === 'info' ? 'bg-white' : 'bg-slate-400'
                        }`}></div>;
                      }
                    })()}
                  </div>
                  
                  {/* Tab button */}
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`ml-3 flex-1 text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                      activeTab === 'info' 
                        ? 'bg-primary text-white font-medium shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal'
                    }`}
                  >
                    <div className="truncate">General Information</div>
                  </button>
                </div>
                
                {/* Collection Tabs */}
                {project.collections.map((collection, index) => {
                  const collectionValidations = validations.filter(v => 
                    v.collectionName === collection.collectionName || 
                    (v.fieldName && v.fieldName.startsWith(collection.collectionName + '.'))
                  );
                  const validationIndices = collectionValidations.length > 0 ? 
                    collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                  const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                  
                  const verifiedCount = collectionValidations.filter(v => 
                    v.validationStatus === 'verified' || 
                    (v.validationStatus === 'valid' && v.manuallyVerified === true)
                  ).length;
                  const totalCount = collectionValidations.length;
                  
                  return (
                    <div key={collection.id} className="relative flex items-center">
                      {/* Circular icon */}
                      <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        totalCount > 0 && verifiedCount === totalCount
                          ? 'bg-white border-green-600'
                          : (activeTab === collection.collectionName 
                              ? 'bg-primary border-primary' 
                              : 'bg-white border-slate-300')
                      }`}>
                        {extractingCollection === collection.collectionName ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : totalCount > 0 && verifiedCount === totalCount ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <div className={`w-3 h-3 rounded-full ${
                            activeTab === collection.collectionName ? 'bg-white' : 'bg-slate-400'
                          }`}></div>
                        )}
                      </div>
                      
                      {/* Tab button */}
                      <button
                        onClick={() => setActiveTab(collection.collectionName)}
                        className={`ml-3 flex-1 text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                          activeTab === collection.collectionName 
                            ? 'bg-primary text-white font-medium shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-normal'
                        }`}
                      >
                        <div className="truncate">{collection.collectionName}</div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Settings Button - Always at the bottom */}
          {canAccessConfigTabs && (
            <div className="p-4 border-t border-slate-200">
              <Link href={`/projects/${projectId}/admin`}>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-700 transition-all duration-200 border border-slate-200">
                  <Settings className="h-4 w-4" />
                  Project Admin
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="w-full">
            {/* Session Review Header - Now styled like page header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-start space-x-3 flex-1 mr-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    {isEditingSessionName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={sessionNameValue}
                          onChange={(e) => setSessionNameValue(e.target.value)}
                          onKeyDown={handleSessionNameKeyPress}
                          className="text-3xl font-bold h-auto py-1 px-2 border-2 border-blue-500 focus:ring-2 focus:ring-blue-200"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleSessionNameSave}
                          disabled={updateSessionMutation.isPending}
                          className="shrink-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSessionNameCancel}
                          disabled={updateSessionMutation.isPending}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-bold">{session?.sessionName}</h2>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSessionNameEdit}
                          className="opacity-60 hover:opacity-100 p-1"
                          title="Edit session name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Status and progress bar aligned to right */}
              <div className="flex items-center gap-3">
                {getVerificationProgress().percentage === 100 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                )}
                
                {/* Session Verification Progress */}
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        getVerificationProgress().percentage === 100 ? 'bg-green-600' : 
                        getVerificationProgress().percentage > 0 ? 'bg-green-600' : 'bg-gray-400'
                      }`}
                      style={{ width: `${getVerificationProgress().percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 min-w-[28px]">
                    {getVerificationProgress().percentage}%
                  </span>
                </div>
                
                <Link href={`/sessions/${sessionId}/debug`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2 px-3 py-2"
                    title="View AI debugging data"
                  >
                    <Bug className="h-4 w-4" />
                    Debug
                  </Button>
                </Link>
                
                <Button 
                  onClick={() => setShowReasoningDialog(true)} 
                  variant="outline" 
                  size="sm"
                  className="px-3 py-2"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setDocumentUploadModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="px-3 py-2"
                  title="Add documents to session"
                >
                  <FilePlus className="h-4 w-4" />
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

            {/* Session Data Content - Now controlled by sidebar navigation */}
            <div className="w-full">
              {/* Info Tab Content - Single Object View */}
              {activeTab === 'info' && (
                <Card className="border-t-0 rounded-tl-none ml-0">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">General Information</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAIExtraction(
                          'General Information',
                          project?.schemaFields?.map(field => ({
                            id: field.id,
                            name: field.fieldName,
                            type: field.fieldType
                          })) || []
                        )}
                        className="h-8 w-8 p-0 hover:bg-slate-100 text-[#5065a6]"
                      >
                        <Wand2 className="h-4 w-4" style={{ color: '#4F63A4' }} />
                      </Button>
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



                                  // Render confidence indicator/verification status to the left of field name
                                  if (wasManuallyUpdated) {
                                    // Show blue user icon for manually updated fields - highest priority
                                    
                                    return (
                                      <div className="w-3 h-3 flex items-center justify-center">
                                        <User className="h-3 w-3 text-slate-700" />
                                      </div>
                                    );
                                  } else if (isVerified) {
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
                                              <span className={formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 italic' : ''}>
                                                {formatValueForDisplay(displayValue, fieldType)}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className={`text-sm ${formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                                              {formatValueForDisplay(displayValue, fieldType)}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            const validation = getValidation(field.fieldName);
                                            if (validation) {
                                              handleEditField(validation);
                                            }
                                          }}
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
              )}

              {/* Documents Tab Content */}
              {activeTab === 'documents' && (
                <Card className="border-t-0 rounded-tl-none ml-0">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">Documents</span>
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Documents uploaded and processed for this session.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {sessionDocuments && sessionDocuments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sessionDocuments.map((doc: any, index: number) => (
                          <div 
                            key={doc.id || index} 
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">
                                {doc.mimeType?.includes('excel') || doc.mimeType?.includes('spreadsheet') ? (
                                  <FileText className="w-8 h-8 text-green-600" />
                                ) : doc.mimeType?.includes('word') || doc.mimeType?.includes('document') ? (
                                  <FileText className="w-8 h-8 text-blue-600" />
                                ) : doc.mimeType?.includes('pdf') ? (
                                  <FileText className="w-8 h-8 text-red-600" />
                                ) : (
                                  <FileText className="w-8 h-8 text-gray-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-gray-900 text-sm truncate" title={doc.fileName}>
                                    {doc.fileName}
                                  </h4>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                                      className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                      title="Download extracted content"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Delete document"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-1 space-y-1">
                                  <p className="text-xs text-gray-500">
                                    Size: {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Unknown'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Content: {doc.extractedContent ? `${doc.extractedContent.length} chars` : 'No content'}
                                  </p>
                                  {doc.extractedAt && (
                                    <p className="text-xs text-gray-500">
                                      Processed: {new Date(doc.extractedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {doc.extractedContent && doc.extractedContent.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {doc.extractedContent.substring(0, 100)}{doc.extractedContent.length > 100 ? '...' : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No documents uploaded yet</p>
                        <p className="text-sm text-gray-400 mt-1">Upload documents using the upload button above</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Individual Collection Tabs */}
              {project.collections.map((collection) => {
                const collectionData = extractedData[collection.collectionName];
                const collectionValidations = validations.filter(v => 
                  v.collectionName === collection.collectionName || 
                  (v.fieldName && v.fieldName.startsWith(collection.collectionName + '.'))
                );
                
                console.log(`Collection ${collection.collectionName} - found ${collectionValidations.length} validations:`, 
                  collectionValidations.map(v => ({ fieldName: v.fieldName, recordIndex: v.recordIndex, collectionName: v.collectionName })));
                
                const validationIndices = collectionValidations.length > 0 ? 
                  collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                const maxRecordIndex = uniqueIndices.length > 0 ? Math.max(...uniqueIndices) : -1;
                
                console.log(`Collection ${collection.collectionName} - uniqueIndices:`, uniqueIndices);
                
                // Always show the table even when there are no records, so headers remain visible

                return activeTab === collection.collectionName ? (
                  <div key={collection.id} className="mt-0 px-0 ml-0">
                    <Card className="border-t-0 rounded-tl-none ml-0">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {collection.collectionName}
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {uniqueIndices.length} {uniqueIndices.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAIExtraction(
                              collection.collectionName,
                              collection.properties?.map(prop => ({
                                id: prop.id,
                                name: prop.propertyName,
                                type: prop.propertyType
                              })) || []
                            )}
                            className="h-8 w-8 p-0 hover:bg-slate-100"
                          >
                            <Wand2 className="h-4 w-4" style={{ color: '#4F63A4' }} />
                          </Button>
                        </CardTitle>
                        <p className="text-sm text-gray-600">{collection.description}</p>
                      </CardHeader>
                      <CardContent>
                        <Table className="session-table">
                          <TableHeader>
                            <TableRow>

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
                              <TableHead className="w-24 border-r border-gray-300" style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}>
                                <div className="flex items-center justify-center gap-1 px-1">
                                  {(() => {
                                    // Handle empty collections
                                    if (uniqueIndices.length === 0) {
                                      return (
                                        <button
                                          disabled
                                          className="flex items-center justify-center px-2 py-1 rounded transition-colors opacity-50 cursor-not-allowed"
                                          title="No items to verify"
                                        >
                                          <CheckCircle className="h-5 w-5 text-gray-400" />
                                        </button>
                                      );
                                    }
                                    
                                    // Calculate if all items in this collection are verified (only for existing indices)
                                    const allItemsVerified = uniqueIndices.every(index => {
                                      const itemValidations = collection.properties.map(property => {
                                        const fieldName = `${collection.collectionName}.${property.propertyName}[${index}]`;
                                        return getValidation(fieldName);
                                      }).filter(Boolean);
                                      
                                      return itemValidations.length > 0 && 
                                        itemValidations.every(v => v?.validationStatus === 'valid' || v?.validationStatus === 'verified');
                                    });
                                    
                                    return (
                                      <button
                                        onClick={() => handleVerifyAllCollectionItems(collection.collectionName, !allItemsVerified)}
                                        className="flex items-center justify-center hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                        title={allItemsVerified ? "Click to mark all items as unverified" : "Click to mark all items as verified"}
                                      >
                                        <CheckCircle className={`h-5 w-5 ${allItemsVerified ? 'text-green-600' : 'text-gray-400'}`} />
                                      </button>
                                    );
                                  })()}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAddCollectionItem(collection.collectionName)}
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Add new item"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                        title="More actions"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteAllCollectionData(collection.collectionName)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete all data
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Handle empty collections by showing a placeholder row
                              if (uniqueIndices.length === 0) {
                                return (
                                  <TableRow className="border-b border-gray-300">
                                    <TableCell 
                                      colSpan={collection.properties.length + 1} 
                                      className="text-center text-gray-500 py-8 italic"
                                    >
                                      No items yet. Click the + button to add the first item.
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              
                              // Create array of items only for indices that actually exist
                              const itemsWithIndices = uniqueIndices.map(index => ({
                                item: collectionData?.[index] || {},
                                originalIndex: index
                              }));
                              
                              // Apply sorting if configured, but reverse to show newest (highest index) first
                              const sortedItems = sortConfig && sortConfig.collectionId === collection.id 
                                ? sortCollectionData(itemsWithIndices, collection, sortConfig)
                                : itemsWithIndices.reverse(); // Show newest items first
                              
                              return sortedItems.map(({ item, originalIndex }) => (
                                <TableRow key={originalIndex} className="border-b border-gray-300">
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
                                          <div className={`table-cell-content w-full pl-6 pr-8 ${
                                            property.fieldType === 'TEXTAREA' ? 'min-h-[60px] py-2' : 'py-2'
                                          } break-words whitespace-normal overflow-wrap-anywhere leading-relaxed group relative`}>
                                            <span className={formatValueForDisplay(displayValue, property.fieldType) === 'Empty' ? 'text-gray-400 italic' : ''}>
                                              {formatValueForDisplay(displayValue, property.fieldType)}
                                            </span>
                                            
                                            {/* Edit button */}
                                            {validation && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleEditField(validation)}
                                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Edit field value"
                                              >
                                                <Edit3 className="h-3 w-3" />
                                              </Button>
                                            )}
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
                                                  return (
                                                    <div className="absolute top-2 left-1 w-3 h-3 flex items-center justify-center">
                                                      <User className="h-3 w-3 text-slate-700" />
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
                                                    <div className="absolute top-2 left-1 w-3 h-3 flex items-center justify-center">
                                                      <span className="text-red-500 text-xs font-bold leading-none">!</span>
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
                                    <div className="flex items-center justify-center gap-3 px-2">
                                      {(() => {
                                        // Calculate verification status for this item using improved filtering
                                        const itemValidations = validations.filter(v => {
                                          // Primary approach: match by collectionName and recordIndex
                                          if (v.collectionName === collection.collectionName && v.recordIndex === originalIndex) {
                                            return true;
                                          }
                                          
                                          // Fallback approach: match by fieldName pattern for records with null collectionName
                                          if (v.collectionName === null && v.fieldName && v.fieldName.includes(`[${originalIndex}]`)) {
                                            // Check if fieldName starts with the collection name
                                            return v.fieldName.startsWith(`${collection.collectionName}.`);
                                          }
                                          
                                          return false;
                                        });
                                        
                                        const allVerified = itemValidations.length > 0 && 
                                          itemValidations.every(v => 
                                            v?.validationStatus === 'valid' || 
                                            v?.validationStatus === 'verified' || 
                                            (v?.validationStatus === 'manual' && v?.manuallyVerified)
                                          );
                                        
                                        console.log(`Verification status for ${collection.collectionName}[${originalIndex}]:`, {
                                          itemValidations: itemValidations.length,
                                          allVerified,
                                          validations: itemValidations.map(v => ({ id: v.id, fieldName: v.fieldName, status: v.validationStatus }))
                                        });
                                        
                                        return (
                                          <button
                                            onClick={() => {
                                              console.log(`Button clicked for ${collection.collectionName}[${originalIndex}], currently verified: ${allVerified}`);
                                              handleItemVerification(collection.collectionName, originalIndex, !allVerified);
                                            }}
                                            className="flex items-center justify-center hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                            title={allVerified ? "Click to mark all fields as unverified" : "Click to mark all fields as verified"}
                                          >
                                            {allVerified ? (
                                              <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                              <CheckCircle className="h-5 w-5 text-gray-400" />
                                            )}
                                          </button>
                                        );
                                      })()}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteCollectionItem(collection.collectionName, originalIndex)}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Delete this item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                ) : null;
              })}
            </div>
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
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          handleFieldVerification(selectedReasoning.fieldName, !isVerified);
                          // Short delay to let user see the visual feedback before closing
                          setTimeout(() => {
                            setSelectedReasoning(null);
                          }, 300);
                        }}
                        className="flex items-center justify-center hover:bg-gray-100 px-3 py-2 rounded transition-colors"
                        title={isVerified ? "Click to mark as unverified" : "Click to mark as verified"}
                      >
                        {isVerified ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <CheckCircle className="h-6 w-6 text-gray-400" />
                        )}
                      </button>
                    </div>
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
                } catch (error) {
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
      {/* Validation processing dialog removed - validation now occurs during extraction */}
      {/* Edit Field Value Dialog */}
      {editFieldDialog.validation && (
        <EditFieldValueDialog
          open={editFieldDialog.open}
          validation={editFieldDialog.validation}
          onClose={() => setEditFieldDialog({ open: false, validation: null })}
          onSave={handleSaveFieldEdit}
          schemaField={findSchemaField(editFieldDialog.validation)}
          collectionProperty={findCollectionProperty(editFieldDialog.validation)}
        />
      )}
      {/* Add Documents Modal */}
      <AddDocumentsModal
        open={addDocumentsModalOpen}
        onClose={() => setAddDocumentsModalOpen(false)}
        sessionId={sessionId!}
        projectId={projectId!}
        onSuccess={() => {
          // Refresh session data and validations after successful document upload
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        }}
      />
      {/* Document Upload Modal (upload only, no AI processing) */}
      <DocumentUploadModal
        open={documentUploadModalOpen}
        onClose={() => setDocumentUploadModalOpen(false)}
        sessionId={sessionId!}
        projectId={projectId!}
        onSuccess={() => {
          // Refresh session documents after successful upload
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'documents'] });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
        }}
      />
      {/* AI Extraction Modal */}
      <AIExtractionModal
        isOpen={aiExtractionModal.open}
        onClose={handleCloseAIExtraction}
        sectionName={aiExtractionModal.sectionName}
        availableFields={aiExtractionModal.availableFields}
        sessionDocuments={sessionDocuments || []}
        verifiedFields={getVerifiedFields()}
        allProjectFields={getAllProjectFields()}
        sessionId={sessionId}
        project={project}
        onStartProgressivePolling={startProgressiveValidationPolling}
        setIsExtractionRunning={setIsExtractionRunning}
        setExtractingCollection={setExtractingCollection}
        setRefreshTrigger={setRefreshTrigger}
      />
      {/* Session Chat */}
      {session && validations && (
        <SessionChat
          sessionId={sessionId!}
          session={session}
          validations={validations}
        />
      )}
    </div>
  );
}