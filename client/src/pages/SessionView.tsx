/**
 * Session View - Document Processing and Validation Interface
 * 
 * Core interface for document processing sessions where users upload documents,
 * configure extraction workflows, and validate AI-extracted data.
 * 
 * Key Features:
 * - Document upload and management
 * - Multi-step workflow configuration (Info Pages and Data Tables)
 * - AI-powered data extraction with validation interface
 * - Real-time chat for document analysis
 * - Excel export functionality with proper formatting
 * - Field-level validation and manual editing
 * 
 * Components:
 * - Document upload modal with file type validation
 * - Workflow step management with drag-and-drop
 * - Validation table with inline editing
 * - AI chat interface for document queries
 * - Export wizard for Excel generation
 * 
 * Data Flow:
 * 1. User uploads documents → Session documents created
 * 2. Configure workflow steps → Workflow steps and values stored
 * 3. Run extractions → AI processes documents
 * 4. Validate results → Field validations updated
 * 5. Export data → Excel files generated with proper structure
 */

import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight, RotateCcw, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Check, User, Plus, Trash2, Bug, Wand2, Folder, FileText, FilePlus, Table as TableIcon, Loader2, MoreVertical } from "lucide-react";
import { WaveIcon, FlowIcon, TideIcon, ShipIcon } from "@/components/SeaIcons";
import { SiMicrosoft } from "react-icons/si";
import { FaFileExcel, FaFileWord, FaFilePdf } from "react-icons/fa";
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
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import ExtraplLogo from "@/components/ExtraplLogo";
import ValidationIcon from "@/components/ValidationIcon";
import UserProfile from "@/components/UserProfile";
import DarkModeToggle from "@/components/DarkModeToggle";

// import { EditFieldValueDialog } from "@/components/EditFieldValueDialog"; // Replaced with inline editing
import AddDocumentsModal from "@/components/AddDocumentsModal";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import SessionChat from "@/components/SessionChat";
import ExtractWizardModal from "@/components/ExtractWizardModal";

import type { 
  ExtractionSession, 
  ProjectWithDetails, 
  FieldValidation,
  ValidationStatus 
} from "@shared/schema";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";

// Field Selection Modal Content Component
const FieldSelectionModalContent = ({
  stepValues,
  onExtract,
  onCancel,
  isExtracting,
  sessionDocuments
}: {
  stepValues: any[];
  onExtract: (selectedFieldIds: string[], fieldInputs: Record<string, any>) => void;
  onCancel: () => void;
  isExtracting: boolean;
  sessionDocuments?: any[];
}) => {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [fieldInputs, setFieldInputs] = useState<Record<string, any>>({});

  const handleFieldSelection = (fieldId: string, checked: boolean) => {
    const newSelected = new Set(selectedFields);
    if (checked) {
      newSelected.add(fieldId);
    } else {
      newSelected.delete(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFields.size === stepValues.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(stepValues.map(sv => sv.id)));
    }
  };

  const handleExtract = () => {
    if (selectedFields.size > 0) {
      onExtract(Array.from(selectedFields), fieldInputs);
    }
  };

  const handleInputChange = (fieldId: string, inputKey: string, value: any) => {
    setFieldInputs(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [inputKey]: value
      }
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          className="text-xs"
        >
          {selectedFields.size === stepValues.length ? 'Deselect All' : 'Select All'}
        </Button>
        <span className="text-sm text-gray-500">
          {selectedFields.size} of {stepValues.length} selected
        </span>
      </div>

      <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
        {stepValues.map((stepValue) => {
          // Check if this value needs document selection
          const needsDocumentSelection = stepValue.inputValues && 
            Object.entries(stepValue.inputValues).some(([key, value]) => {
              // Handle arrays (like ["user_document"])
              if (Array.isArray(value)) {
                return value.some(v => {
                  if (typeof v === 'string') {
                    const lowerV = v.toLowerCase();
                    return lowerV.includes('user') && lowerV.includes('document') ||
                           lowerV === 'user_document';
                  }
                  return false;
                });
              }
              // Handle strings
              if (typeof value === 'string') {
                const lowerValue = value.toLowerCase();
                return lowerValue.includes('user') && lowerValue.includes('document') ||
                       lowerValue === 'user_document';
              }
              return key.toLowerCase().includes('document');
            });

          return (
            <div key={stepValue.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Checkbox
                checked={selectedFields.has(stepValue.id)}
                onCheckedChange={(checked) => handleFieldSelection(stepValue.id, !!checked)}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <div className="font-medium text-sm">{stepValue.valueName}</div>
                  {stepValue.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {stepValue.description}
                    </div>
                  )}
                  {stepValue.dataType && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Type: {stepValue.dataType}
                    </div>
                  )}
                </div>

                {/* Show document selection if needed */}
                {needsDocumentSelection && (
                  <div className="mt-3">
                    <Label className="text-xs text-gray-600 dark:text-gray-400">
                      Document Source:
                    </Label>
                    <Select
                      value={fieldInputs[stepValue.id]?.document || ''}
                      onValueChange={(value) => handleInputChange(stepValue.id, 'document', value)}
                      disabled={!selectedFields.has(stepValue.id)}
                    >
                      <SelectTrigger className="text-xs h-9 mt-1">
                        <SelectValue placeholder="Choose a document..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionDocuments?.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id} className="text-xs">
                            {doc.fileName || doc.name || 'Untitled'}
                            {doc.isPrimary && <span className="text-blue-500 ml-1">(Primary)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isExtracting}>
          Cancel
        </Button>
        <Button 
          onClick={handleExtract} 
          disabled={selectedFields.size === 0 || isExtracting}
          className="bg-[#4F63A4] hover:bg-[#4F63A4]/90"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Extract {selectedFields.size} Field{selectedFields.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

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
  const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'manual';

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

// Simplified Validation Indicator Component
const ValidationIndicator = ({ 
  validation,
  onToggle,
  fieldName
}: { 
  validation: FieldValidation | undefined;
  onToggle: () => void;
  fieldName: string;
}) => {
  // All fields start as pending, clicking toggles between pending and valid
  const isValid = validation?.validationStatus === 'valid';
  const reasoning = validation?.aiReasoning;
  
  return (
    <div className="relative inline-flex">
      <button
        onClick={onToggle}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        title={reasoning || 'Click to toggle validation status'}
      >
        {isValid ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <div className="w-2 h-2 rounded-full border-2 border-gray-400" />
        )}
      </button>
      {/* Show reasoning on hover */}
      {(reasoning || validation?.confidenceScore) && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white border-2 border-[#4F63A4] text-blue-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 max-w-[400px] shadow-lg">
          <div className="whitespace-pre-line leading-relaxed">
            {reasoning && (
              <div className="mb-2">{reasoning}</div>
            )}
            {validation?.confidenceScore && (
              <div className="mb-2 font-medium">Confidence: {Math.round(validation.confidenceScore)}%</div>
            )}
            <div className="text-xs text-blue-700">Click icon to {validation?.validationStatus === 'valid' ? 'mark as pending' : 'validate'}</div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-[#4F63A4]"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Legacy Badge Components (kept for compatibility but simplified)
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
  // Simply use the new ValidationIndicator
  return (
    <ValidationIndicator 
      validation={validation}
      onToggle={() => onVerificationChange(!isVerified)}
      fieldName={fieldName}
    />
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
                    validation.validationStatus === 'manual';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onToggle(!isVerified)}
        className="flex items-center gap-4 text-sm hover:bg-gray-100 px-2 py-1 rounded"
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
  project
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
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedVerifiedFields, setSelectedVerifiedFields] = useState<string[]>([]);
  const [selectedTargetFields, setSelectedTargetFields] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['schema']));
  const [isExtracting, setIsExtracting] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldDocumentSources, setFieldDocumentSources] = useState<Record<string, string[]>>({});
  const [extractionProgress, setExtractionProgress] = useState<{
    currentFieldIndex: number;
    completedFields: Set<string>;
    totalFields: number;
  }>({ currentFieldIndex: -1, completedFields: new Set(), totalFields: 0 });
  const queryClient = useQueryClient();

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
    const allCollections = collections || [];
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
        for (const collection of collections || []) {
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
    
    // Check if this is a workflow step extraction
    const isWorkflowStep = sectionName && project?.workflowSteps?.find(
      step => step.stepName === sectionName
    );
    
    try {
      // Get document content for the selected documents
      const documentsWithContent = sessionDocuments.filter(doc => 
        documentIds.includes(doc.id)
      ).map(doc => ({
        name: doc.fileName,
        content: doc.extractedContent || '',
        type: doc.mimeType || 'text/plain'
      }));
      
      if (isWorkflowStep) {
        // Process workflow step values sequentially
        console.log('Processing workflow step values sequentially...');
        
        for (let i = 0; i < sortedSelectedFields.length; i++) {
          const field = sortedSelectedFields[i];
          setExtractionProgress(prev => ({ ...prev, currentFieldIndex: i }));
          
          // Get document sources for this specific value
          const fieldSources = fieldDocumentSources[field.id] || [];
          const docsForThisField = fieldSources.length > 0 
            ? documentsWithContent.filter(doc => 
                fieldSources.includes(sessionDocuments.find(sd => sd.fileName === doc.name)?.id || '')
              )
            : documentsWithContent;
          
          // Find the specific target field for this value
          const targetField = targetFieldsWithSources.find(tf => tf.id === field.id);
          
          // Prepare value-specific request data
          const valueRequestData = {
            files: docsForThisField,
            project_data: {
              id: project?.id,
              projectId: project?.id,
              schemaFields: project?.schemaFields || [],
              collections: collections || [],
              workflowSteps: project?.workflowSteps || []
            },
            target_fields: targetField ? [targetField] : [],
            step_id: field.stepId,
            value_id: field.valueId,
            is_workflow_step: true
          };
          
          console.log(`Extracting value ${i + 1}/${sortedSelectedFields.length}: ${field.name}`);
          console.log('Value extraction request:', JSON.stringify(valueRequestData, null, 2));
          
          // Run extraction for this single value
          const response = await apiRequest(`/api/sessions/${sessionId}/extract`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(valueRequestData),
          });
          
          console.log(`Value ${field.name} extraction result:`, response);
          
          // Mark this field as complete
          setExtractionProgress(prev => ({ 
            ...prev, 
            completedFields: new Set([...prev.completedFields, field.id])
          }));
          
          // Small delay before next value
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // Original extraction logic for non-workflow steps
        const requestData = {
          files: documentsWithContent,
          project_data: {
            id: project?.id,
            projectId: project?.id,
            schemaFields: project?.schemaFields || [],
            collections: collections || []
          },
          target_fields: targetFieldsWithSources
        };
        
        console.log('Complete Extraction Request:', JSON.stringify(requestData, null, 2));
        
        const response = await apiRequest(`/api/sessions/${sessionId}/extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
        console.log('Wizardry Result:', response);
        if (response.output) {
          console.log('Python Script Output:');
          console.log(response.output);
        }
        
        // Simulate field-by-field progress for UI feedback
        for (let i = 0; i < sortedSelectedFields.length; i++) {
          setExtractionProgress(prev => ({ ...prev, currentFieldIndex: i }));
          
          // Wait a bit to show the spinner animation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          setExtractionProgress(prev => ({ 
            ...prev, 
            completedFields: new Set([...prev.completedFields, sortedSelectedFields[i].id])
          }));
        }
      }
      
      // Mark extraction as complete
      setExtractionProgress(prev => ({ ...prev, currentFieldIndex: -1 }));
      
    } catch (error) {
      console.error('Error running wizardry:', error);
    } finally {
      setIsExtracting(false);
      setExtractionProgress({ currentFieldIndex: -1, completedFields: new Set(), totalFields: 0 });
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
        const allCollections = collections || [];
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
    if (isOpen && availableFields.length > 0 && collections) {
      const identifierFields: string[] = [];
      
      // Find all identifier fields
      for (const collection of collections) {
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
                const allCollections = collections || [];
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
                              const allCollections = collections || [];
                              
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
            disabled={selectedTargetFields.length === 0 || isExtracting}
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

// Helper function to convert workflowSteps to collections-like structure for backward compatibility
const convertStepsToCollections = (workflowSteps: any[]) => {
  if (!workflowSteps) return [];
  
  // Filter for list-type steps (data tables)
  return workflowSteps
    .filter(step => step.stepType === 'list')
    .map(step => ({
      id: step.id,
      collectionName: step.stepName,
      description: step.description,
      properties: step.values?.map((value: any) => ({
        id: value.id,
        propertyName: value.valueName,
        propertyType: value.dataType,
        description: value.description,
        isIdentifier: value.isIdentifier || false,
        orderIndex: value.orderIndex,
        choiceOptions: value.choiceOptions,
        functionId: value.toolId,
        autoVerificationConfidence: value.autoVerificationConfidence
      })) || []
    }));
};

export default function SessionView() {
  const { sessionId } = useParams(); // Remove projectId from params - we'll get it from session data
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingTableField, setEditingTableField] = useState<string | null>(null);
  const [editTableValue, setEditTableValue] = useState("");
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  
  const [sessionNameValue, setSessionNameValue] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
  const [editingDisplayNames, setEditingDisplayNames] = useState<Record<string, boolean>>({});
  const [extractingToolId, setExtractingToolId] = useState<string | null>(null);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [currentToolGroup, setCurrentToolGroup] = useState<{toolId: string, stepValues: any[]} | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('documents');
  const [selectedReasoning, setSelectedReasoning] = useState<{
    reasoning: string;
    fieldName: string;
    confidenceScore: number;
  } | null>(null);
  
  // Edit field dialog state - removed in favor of inline editing

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
  
  // Column extraction modal state for workflow step values
  const [columnExtractionModal, setColumnExtractionModal] = useState<{
    isOpen: boolean;
    stepName: string;
    valueId: string;
    valueName: string;
    previousData: any[];
    displayData?: any[]; // Data to show in modal (filtered columns)
    columnOrder?: string[]; // Add column order to show columns in correct order
    needsDocument: boolean;
    toolType: string;
    toolDescription: string;
    toolId?: string;
    toolOperationType?: string; // Add operation type
    inputValues?: any;
    knowledgeDocuments?: any[];
    extractedCount?: number;
    totalAvailable?: number;
  } | null>(null);
  const [isColumnExtracting, setIsColumnExtracting] = useState(false);

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
    if (validation.validationType !== 'collection_property' || !collections) return null;
    for (const collection of collections) {
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

  // Modal editing removed - now using inline editing for all fields

  // Handler for inline table field editing
  const handleEditTableField = (validation: FieldValidation) => {
    const fieldKey = `${validation.collectionName}.${validation.fieldName}[${validation.recordIndex}]`;
    console.log('handleEditTableField called with:', {
      fieldKey,
      validation,
      extractedValue: validation.extractedValue
    });
    setEditingTableField(fieldKey);
    // If the value is null/undefined (displayed as "Not Found"), start with empty string
    // so user can enter a new value. If it has "Not Found" as actual text, keep it
    if (validation.extractedValue === null || validation.extractedValue === undefined) {
      setEditTableValue("");
      console.log('Setting edit value to empty string for null/undefined');
    } else {
      setEditTableValue(validation.extractedValue || "");
      console.log('Setting edit value to:', validation.extractedValue);
    }
  };

  // Handler to save inline table field edit
  const handleSaveTableFieldEdit = async () => {
    console.log('handleSaveTableFieldEdit called, editingTableField:', editingTableField);
    if (!editingTableField) {
      console.log('No field being edited, returning');
      return;
    }
    
    // Find the validation that we're editing
    const validation = validations.find(v => {
      const fieldKey = `${v.collectionName}.${v.fieldName}[${v.recordIndex}]`;
      return fieldKey === editingTableField;
    });
    
    console.log('Looking for validation with key:', editingTableField);
    console.log('Found validation:', validation);
    console.log('All validations count:', validations.length);
    
    // Parse the field key to get collection, field, and index
    // Handle collection names with dots (like "Section 5.1") by matching from the end
    const match = editingTableField.match(/^(.+)\.([^.]+)\[(\d+)\]$/);
    if (!match) {
      console.log('Failed to parse field key:', editingTableField);
      return;
    }
    
    const [, collectionName, fieldName, indexStr] = match;
    const recordIndex = parseInt(indexStr);
    
    console.log('Parsed field info:', { collectionName, fieldName, recordIndex });
    console.log('Edit value to save:', editTableValue);
    
    // Clear editing state immediately for responsive UI
    const currentValue = editTableValue;
    setEditingTableField(null);
    setEditTableValue("");
    
    if (validation) {
      console.log('Updating existing validation:', validation);
      // Update existing validation
      await handleSaveFieldEdit(validation.id, currentValue, 'valid');
    } else {
      console.log('No existing validation found, creating new one...');
      // For data tables, we need to find the field ID from the step values, not collection properties
      // The columns in data tables come from workflow_steps/step_values, not the original collection schema
      
      console.log('All workflow steps:', project?.workflowSteps?.map(s => ({ 
        stepName: s.stepName, 
        stepType: s.stepType, 
        collectionName: s.collectionName 
      })));
      
      // Find the workflow step for this collection - check both list and data_table types
      const workflowStep = project?.workflowSteps?.find(step => 
        ((step.stepType === 'data_table' || step.stepType === 'list') && step.collectionName === collectionName) ||
        ((step.stepType === 'data_table' || step.stepType === 'list') && step.stepName === collectionName)
      );
      console.log('Found workflow step:', workflowStep);
      
      // Get step values from the workflow step's values array
      const stepValues = workflowStep?.values || [];
      
      // Find the step value for this field
      const stepValue = stepValues?.find(sv => 
        sv.valueName === fieldName
      );
      console.log('Found step value:', stepValue);
      console.log('All step values for this table:', stepValues?.map(sv => sv.valueName));
      
      // Use the step value ID as the field ID
      const fieldId = stepValue?.id;
      
      if (fieldId && workflowStep) {
        console.log('Found field ID from step value:', fieldId);
        // Find the identifierId from the first column (identifier column) of this row
        // The first step value in the data table is the identifier
        const firstStepValue = stepValues?.find(sv => 
          sv.valueOrder === 0
        );
        let identifierId: string | null = null;
        
        if (firstStepValue) {
          // Find the validation for the first column (identifier) of this row
          const identifierValidation = validations.find(v => 
            v.recordIndex === recordIndex &&
            v.collectionName === collectionName &&
            v.fieldId === firstStepValue.id
          );
          
          if (identifierValidation?.identifierId) {
            identifierId = identifierValidation.identifierId;
            console.log(`Found identifierId from first column: ${identifierId}`);
          }
        }
        
        // If still no identifierId found, try any validation from this row
        if (!identifierId) {
          const rowValidation = validations.find(v => 
            v.recordIndex === recordIndex &&
            v.collectionName === collectionName &&
            v.identifierId
          );
          identifierId = rowValidation?.identifierId || null;
          if (identifierId) {
            console.log(`Found identifierId from any column in row: ${identifierId}`);
          }
        }
        
        // If still no identifierId, generate a new one (for completely new rows)
        if (!identifierId) {
          identifierId = crypto.randomUUID();
          console.log(`Generated new identifierId: ${identifierId}`);
        }
        
        // Get the data type from the step value
        const dataType = stepValue?.valueType || 'text';
        
        const newValidation = {
          validationType: 'collection_property',
          dataType: dataType,
          fieldId: fieldId,
          valueId: fieldId, // Also send as valueId since backend expects this for new architecture
          collectionName: collectionName,
          recordIndex: recordIndex,
          identifierId: identifierId,
          extractedValue: currentValue,
          originalExtractedValue: currentValue,
          originalConfidenceScore: 100,
          originalAiReasoning: 'Manually entered value',
          validationStatus: 'valid',
          aiReasoning: 'Manually entered value',
          manuallyVerified: true,
          manuallyUpdated: true,
          confidenceScore: 100,
          documentSource: 'Manual Entry',
          documentSections: null
        };
        
        console.log('Creating new validation:', newValidation);
        
        try {
          const response = await apiRequest(`/api/sessions/${session?.id}/validations`, {
            method: 'POST',
            body: JSON.stringify(newValidation)
          });
          
          console.log('Created validation response:', response);
          
          // Refetch validations to update the UI
          await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
          await queryClient.refetchQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        } catch (error) {
          console.error('Failed to create validation:', error);
        }
      } else {
        console.error('Could not find workflow step or step value:', { 
          collectionName, 
          fieldName, 
          workflowStepFound: !!workflowStep,
          stepValueFound: !!stepValue,
          fieldId 
        });
      }
    }
  };

  // Handler to cancel inline table field edit
  const handleCancelTableFieldEdit = () => {
    setEditingTableField(null);
    setEditTableValue("");
  };

  // Handler to open AI extraction modal
  const handleOpenAIExtraction = (sectionName: string, availableFields: { id: string; name: string; type: string }[]) => {
    console.log('handleOpenAIExtraction called with:', { sectionName, availableFields });
    
    // Check if this is a workflow step
    const workflowStep = project?.workflowSteps?.find(
      step => step.stepName === sectionName
    );
    
    if (workflowStep) {
      // Use step values as fields
      const stepFields = workflowStep.values?.map(value => ({
        id: value.id,
        name: value.valueName,
        type: value.dataType,
        stepId: workflowStep.id,
        valueId: value.id,
        toolId: value.toolId,
        inputValues: value.inputValues,
        orderIndex: value.orderIndex
      })) || [];
      
      setAiExtractionModal({
        open: true,
        sectionName,
        availableFields: stepFields,
        isWorkflowStep: true,
        workflowStep
      });
    } else {
      setAiExtractionModal({
        open: true,
        sectionName,
        availableFields,
        isWorkflowStep: false
      });
    }
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
    collections?.forEach(collection => {
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
  
  // State for tracking bulk validation per column
  const [bulkValidationState, setBulkValidationState] = useState<Record<string, Set<string>>>({});
  
  // Search state for filtering table data
  const [searchTerm, setSearchTerm] = useState('');
  
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
    
    // Check if we have workflow steps with values
    const workflowStep = project?.workflowSteps?.find(
      step => step.stepName === collection.collectionName
    );
    
    // Find the column/property being sorted
    let property;
    if (workflowStep) {
      // For workflow steps, use valueName
      property = workflowStep.values?.find((v: any) => v.valueName === sortConfig.key);
    } else {
      // For legacy collections, use propertyName
      property = collection.properties.find((p: any) => p.propertyName === sortConfig.key);
    }
    
    if (!property) return itemsWithIndices;
    
    return [...itemsWithIndices].sort((a, b) => {
      // Get identifierIds for both items
      const aIdentifierId = validations.find(v => 
        v.recordIndex === a.originalIndex &&
        v.collectionName === collection.collectionName &&
        v.identifierId
      )?.identifierId || null;
      
      const bIdentifierId = validations.find(v => 
        v.recordIndex === b.originalIndex &&
        v.collectionName === collection.collectionName &&
        v.identifierId
      )?.identifierId || null;
      
      // Get the property name and type based on whether it's a workflow step or legacy collection
      const propertyName = workflowStep ? property.valueName : property.propertyName;
      const propertyType = workflowStep ? property.dataType : property.propertyType;
      
      // Get values for comparison using original indices
      const aValidation = getValidationByFieldName(`${collection.collectionName}.${propertyName}[${a.originalIndex}]`, aIdentifierId);
      const bValidation = getValidationByFieldName(`${collection.collectionName}.${propertyName}[${b.originalIndex}]`, bIdentifierId);
      
      let aValue = aValidation?.extractedValue || a.item[propertyName] || '';
      let bValue = bValidation?.extractedValue || b.item[propertyName] || '';
      
      // Handle different field types
      if (propertyType === 'NUMBER') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (propertyType === 'DATE') {
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

  // Set dynamic page title based on session and project data
  usePageTitle(session?.sessionName && project?.name ? 
    `${session.sessionName} - ${project.name}` : 
    session?.sessionName || project?.name || "Session"
  );
  
  // Convert workflowSteps to collections for backward compatibility
  // This allows us to gradually migrate from the old collections/fields architecture
  // to the new unified steps/values architecture
  const collections = useMemo(() => {
    if (!project?.workflowSteps) return [];
    return convertStepsToCollections(project.workflowSteps);
  }, [project?.workflowSteps]);

  const { data: validations = [], isLoading: validationsLoading } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations`),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  // Query for session documents
  const { data: sessionDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'documents'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/documents`),
    enabled: !!sessionId,
    onSuccess: (data) => {
      console.log('Session documents loaded:', data);
    }
  });

  // Fetch project-level validations for statistics cards
  const { data: projectValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', projectId],
    enabled: !!projectId
  });

  // Initialize collapse state once data is loaded
  useEffect(() => {
    if (collections && validations && session && !hasInitializedCollapsed) {
      const extractedData = session.extractedData ? JSON.parse(session.extractedData) : {};
      const initialExpanded = new Set<string>();
      
      collections.forEach(collection => {
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
  }, [collections, validations, session, hasInitializedCollapsed]);

  const updateValidationMutation = useMutation({
    mutationFn: async (params: { id: string; data: Partial<FieldValidation> }) => {
      return apiRequest(`/api/validations/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(params.data)
      });
    },
    onError: (error: any) => {
      console.error('Failed to update field:', error);
    }
  });

  // Extract single field using existing column extraction endpoint
  const extractField = useMutation({
    mutationFn: async ({ stepId, valueId, documentId }: { stepId: string; valueId: string; documentId?: string }) => {
      return apiRequest(`/api/sessions/${sessionId}/extract-column`, {
        method: "POST",
        body: JSON.stringify({
          stepId,
          valueId,
          documentId,
          previousData: []
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/validations/project", projectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/validations`] });
    },
    onError: (error: any) => {
      console.error('Failed to extract field:', error);
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
  const handleFieldVerification = (fieldName: string, isVerified: boolean, identifierId?: string | null) => {
    // Use the proper handleVerificationToggle function that has complete logic
    handleVerificationToggle(fieldName, isVerified, identifierId);
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
    
    const newStatus: ValidationStatus = isVerified ? 'valid' : 'pending';
    
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
    
    // Check if this is a workflow step
    const workflowStep = project.workflowSteps?.find(step => step.stepName === collectionName);
    const collection = collections.find(c => c.collectionName === collectionName);
    
    // Must be either a workflow step or a collection
    if (!workflowStep && !collection) return;
    
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

    // Generate a new identifierId for this manually created row
    const newIdentifierId = crypto.randomUUID();
    console.log(`📝 Generated new identifierId for manual row: ${newIdentifierId}`);

    // Get properties/values based on whether this is a workflow step or collection
    const itemProperties = workflowStep ? workflowStep.values : (collection?.properties || []);
    
    // Optimistic update: Create temporary validation records
    const tempValidations = itemProperties.map(property => {
      // Handle different property structures for workflow steps vs collections
      const propertyName = workflowStep ? property.valueName : property.propertyName;
      const dataType = workflowStep ? property.dataType : property.propertyType;
      
      return {
        id: `temp-${Date.now()}-${property.id}`,
        sessionId: session.id,
        validationType: 'collection_property' as const,
        dataType: dataType,
        fieldId: property.id,
        fieldName: `${collectionName}.${propertyName}[${newIndex}]`,
        collectionName: collectionName,
        recordIndex: newIndex,
        identifierId: newIdentifierId, // Assign the same identifierId to all fields in this row
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
      };
    });

    // Optimistically update the cache
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      console.log('Adding collection item - current cache:', old);
      console.log('Adding temp validations:', tempValidations);
      const updated = old ? [...old, ...tempValidations] : tempValidations;
      console.log('Updated cache:', updated);
      return updated;
    });
    
    try {
      // Create validation records for each property/value
      const createPromises = itemProperties.map(property => {
        // Handle different property structures for workflow steps vs collections
        const propertyName = workflowStep ? property.valueName : property.propertyName;
        const dataType = workflowStep ? property.dataType : property.propertyType;
        
        const validationData = {
          // sessionId is automatically added by the backend
          validationType: 'collection_property',
          dataType: dataType, // TEXT, NUMBER, DATE, CHOICE
          fieldId: property.id,
          collectionName: collectionName, // Explicitly set the collection name
          recordIndex: newIndex,
          identifierId: newIdentifierId, // Include the identifierId for all fields in this row
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
        
        console.log(`Creating validation for ${collectionName}.${propertyName}[${newIndex}]:`, validationData);
        
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

  // Handler for preparing column extraction and opening modal
  const handleRunColumnExtraction = async (stepName: string, valueId: string, valueName: string) => {
    // Get the workflow step
    const workflowStep = project?.workflowSteps?.find(step => step.stepName === stepName);
    if (!workflowStep) {
      console.error('Workflow step not found:', stepName);
      return;
    }
    
    // Get the specific value to run
    const valueToRun = workflowStep.values?.find(v => v.id === valueId);
    if (!valueToRun) {
      console.error('Value not found:', valueId);
      return;
    }
    
    // Get the value index to determine if this is the first column
    const valueIndex = workflowStep.values?.findIndex(v => v.id === valueId) || 0;
    
    // Check if this tool needs a document
    // A tool needs a document if:
    // 1. It's the first column (ID column) with no previous data AND no @ references
    // 2. It's the Worksheet Name column 
    // 3. Its input values contain document references (not @ references to other columns)
    const isFirstColumn = valueIndex === 0;
    const isWorksheetNameColumn = valueName === "Worksheet Name";
    
    console.log(`🔍 Checking if "${valueName}" needs document:`);
    console.log(`  - isFirstColumn: ${isFirstColumn}`);
    console.log(`  - isWorksheetNameColumn: ${isWorksheetNameColumn}`);
    console.log(`  - inputValues:`, valueToRun.inputValues);
    
    // Check if input values contain @ references (which means it uses data from other columns, not documents)
    const hasColumnReferences = valueToRun.inputValues && 
      Object.values(valueToRun.inputValues).some(value => {
        if (typeof value === 'string' && value.includes('@')) {
          console.log(`  - Found @ reference in string: "${value}"`);
          return true;
        }
        if (Array.isArray(value)) {
          const hasRef = value.some(v => typeof v === 'string' && v.includes('@'));
          if (hasRef) {
            console.log(`  - Found @ reference in array:`, value);
          }
          return hasRef;
        }
        return false;
      });
    
    console.log(`  - hasColumnReferences: ${hasColumnReferences}`);
    
    // Check if tool has a document input parameter
    const hasDocumentInput = valueToRun.inputValues && 
      Object.entries(valueToRun.inputValues).some(([key, value]) => {
        // Handle arrays (like ["user_document"])
        if (Array.isArray(value)) {
          return value.some(v => {
            if (typeof v === 'string') {
              const lowerV = v.toLowerCase();
              return lowerV.includes('user') && lowerV.includes('document') ||
                     lowerV === 'user_document';
            }
            return false;
          });
        }
        // Handle string values
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          return lowerValue.includes('user') && lowerValue.includes('document') ||
                 lowerValue === 'user_document';
        }
        return key.toLowerCase().includes('document');
      });
    
    // A tool needs a document if:
    // - It's the Worksheet Name column (always needs document)
    // - OR it has a document input parameter (like "user_document")
    // - OR it doesn't have @ references (meaning it needs actual document data)
    const needsDocument = isWorksheetNameColumn || hasDocumentInput || !hasColumnReferences;
    console.log(`  - Has document input: ${hasDocumentInput}`);
    console.log(`  - RESULT: needsDocument = ${needsDocument}`);
    
    // Compile previous column data as input
    let previousColumnsData: any[] = [];
    
    // Check if this value has references to other values (stored as value IDs)
    const referencedValueIds = new Set<string>();
    if (hasColumnReferences && valueToRun.inputValues) {
      console.log(`🔍 Checking for value ID references in ${valueName}'s inputValues`);
      Object.values(valueToRun.inputValues).forEach(value => {
        if (typeof value === 'string') {
          // Check if it's a UUID (value ID) or legacy @-notation
          if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            referencedValueIds.add(value);
            console.log(`  - References value ID: "${value}"`);
          } else if (value.includes('@')) {
            // Legacy support for @-notation
            console.log(`  - Legacy @ reference found: "${value}"`);
          }
        } else if (Array.isArray(value)) {
          value.forEach(v => {
            if (typeof v === 'string' && v.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              referencedValueIds.add(v);
              console.log(`  - References value ID: "${v}"`);
            }
          });
        }
      });
    }
    
    // If we have referenced value IDs, get data from those values
    console.log(`📊 Referenced value IDs found: ${Array.from(referencedValueIds).join(', ')} (count: ${referencedValueIds.size})`);
    if (referencedValueIds.size > 0) {
      console.log(`✅ Loading data from ${referencedValueIds.size} referenced value(s) for "${valueName}"`);
      
      // Get all validations that match the referenced value IDs
      const allReferencedValidations = validations.filter(v => {
        // Must have an identifierId
        if (!v.identifierId) return false;
        
        // Check if this validation's valueId is in our referenced value IDs
        return referencedValueIds.has(v.valueId || '');
      });
      
      // Group by identifierId to check if ALL columns are verified
      const verifiedIdentifierIds = new Set<string>();
      const identifierGroups = new Map<string, any[]>();
      
      allReferencedValidations.forEach(v => {
        if (!identifierGroups.has(v.identifierId!)) {
          identifierGroups.set(v.identifierId!, []);
        }
        identifierGroups.get(v.identifierId!)?.push(v);
      });
      
      // Check each identifier group - only include records where ALL values are validated
      identifierGroups.forEach((validationGroup, identifierId) => {
        const allVerified = validationGroup.every(v => {
          const statusValid = v.validationStatus === 'valid' || v.validationStatus === 'manual';
          const valueValid = v.extractedValue !== '' && v.extractedValue !== null && v.extractedValue !== undefined;
          return statusValid && valueValid;
        });
        
        if (allVerified) {
          verifiedIdentifierIds.add(identifierId);
        }
      });
      
      // Compile records from validations
      const recordsByIdentifier = new Map<string, any>();
      
      // First, include first columns from all referenced steps
      const referencedStepIds = new Set(allReferencedValidations.map(v => v.stepId).filter(id => id));
      referencedStepIds.forEach(stepId => {
        const referencedStep = project?.workflowSteps?.find(s => s.id === stepId);
        if (referencedStep && referencedStep.values && referencedStep.values[0]) {
          const firstColumnId = referencedStep.values[0].id;
          const firstColumnName = referencedStep.values[0].valueName;
          console.log(`📝 Including first column "${firstColumnName}" from step "${referencedStep.name}"`);
          
          // Get validations for the first column
          const firstColumnValidations = validations.filter(v => 
            v.valueId === firstColumnId && 
            v.identifierId && 
            verifiedIdentifierIds.has(v.identifierId)
          );
          
          firstColumnValidations.forEach(v => {
            if (!recordsByIdentifier.has(v.identifierId)) {
              recordsByIdentifier.set(v.identifierId, {
                identifierId: v.identifierId
              });
            }
            recordsByIdentifier.get(v.identifierId)[firstColumnName] = v.extractedValue;
          });
        }
      });
      
      // Then add all referenced validations (including any duplicates which will be overwritten)
      allReferencedValidations.forEach(v => {
        if (v.identifierId && verifiedIdentifierIds.has(v.identifierId)) {
          if (!recordsByIdentifier.has(v.identifierId)) {
            recordsByIdentifier.set(v.identifierId, {
              identifierId: v.identifierId
            });
          }
          
          // Find the value name from the project configuration
          const referencedStepValue = project?.workflowSteps?.flatMap(s => s.values || [])
            .find(val => val.id === v.valueId);
          
          if (referencedStepValue) {
            recordsByIdentifier.get(v.identifierId)[referencedStepValue.valueName] = v.extractedValue;
          }
        }
      });
      
      // Convert to array
      previousColumnsData = Array.from(recordsByIdentifier.values());
      console.log(`📊 Found ${recordsByIdentifier.size} records with verified data from referenced values`);
      
    } else if (workflowStep && workflowStep.values) {
      console.log(`❌ No cross-step references found for "${valueName}" - using within-step data compilation`);
      
      // SIMPLIFIED LOGIC: Just group validations by identifierId and build records
      const stepValidations = validations.filter(v => 
        v.stepId === workflowStep.id || 
        v.collectionName === stepName
      );
      
      // Group all validations by identifierId
      const recordsByIdentifier = new Map<string, any>();
      
      // Get all unique identifierIds from step validations
      const uniqueIdentifierIds = [...new Set(stepValidations
        .map(v => v.identifierId)
        .filter(id => id !== null && id !== undefined)
      )];
      
      console.log(`📊 Found ${uniqueIdentifierIds.length} unique identifiers in step "${stepName}"`);
      
      // For each identifierId, build a complete record with all column values
      for (const identifierId of uniqueIdentifierIds) {
        const record: any = { identifierId };
        
        // Get ALL validations for this identifierId (not just from stepValidations)
        const identifierValidations = validations.filter(v => v.identifierId === identifierId);
        
        // Add each column's value to the record
        for (const validation of identifierValidations) {
          // Find which column this validation belongs to (from the SAME step)
          const columnDef = workflowStep.values.find(val => 
            val.id === validation.valueId || val.id === validation.fieldId
          );
          
          if (columnDef && validation.extractedValue !== null && validation.extractedValue !== undefined) {
            record[columnDef.valueName] = validation.extractedValue;
          }
        }
        
        // ALWAYS include the first column (it's the identifier) and all previous columns
        let hasRequiredColumns = true;
        
        // First column MUST always be present (it's the identifier)
        const firstColName = workflowStep.values[0].valueName;
        if (!record[firstColName]) {
          hasRequiredColumns = false;
        }
        
        // Check other previous columns (up to but not including current)
        for (let i = 1; i < valueIndex; i++) {
          const colName = workflowStep.values[i].valueName;
          if (!record[colName]) {
            hasRequiredColumns = false;
            break;
          }
        }
        
        if (hasRequiredColumns) {
          // Ensure the record has columns in the right order
          const orderedRecord: any = { identifierId };
          
          // Always add first column first (Document Name)
          if (record[firstColName]) {
            orderedRecord[firstColName] = record[firstColName];
          }
          
          // Then add other columns in order
          for (let i = 1; i < workflowStep.values.length; i++) {
            const colName = workflowStep.values[i].valueName;
            if (record[colName]) {
              orderedRecord[colName] = record[colName];
            }
          }
          
          recordsByIdentifier.set(identifierId, orderedRecord);
        }
      }
      
      previousColumnsData = Array.from(recordsByIdentifier.values());
      console.log(`📊 Compiled ${previousColumnsData.length} records with data for extraction`);
    }
    
    // Log filtering results
    const totalRecords = validations.filter(v => 
      v.collectionName === stepName || 
      (v.fieldName && v.fieldName.startsWith(`${stepName}.`))
    ).map(v => v.recordIndex).filter(idx => idx !== null);
    const uniqueTotalRecords = [...new Set(totalRecords)].length;
    
    console.log(`📊 Compiled ${previousColumnsData.length} records with complete data from ${uniqueTotalRecords} total records`);
    if (previousColumnsData.length < uniqueTotalRecords) {
      console.log(`📊 Excluded ${uniqueTotalRecords - previousColumnsData.length} records that have incomplete data in previous columns`);
    }
    
    // Filter to only include records where ALL previous step values are validated (not "Not Found", empty, etc.)
    const originalCount = previousColumnsData.length;
    
    // Apply validation-based filtering to ensure only fully validated records proceed
    previousColumnsData = previousColumnsData.filter(record => {
      // Check each field in the record to ensure it's properly validated (verified status)
      const allFieldsValid = Object.entries(record).every(([key, value]) => {
        // Skip meta fields like identifierId and _recordIndex
        if (key === 'identifierId' || key.startsWith('_')) return true;
        
        // Find the validation record for this field and identifier
        // Look for the value in the current step's values to get its ID
        const valueDefinition = workflowStep?.values?.find(v => v.valueName === key);
        if (!valueDefinition) {
          console.log(`No value definition found for ${key}`);
          return false;
        }
        
        // Find validation by value_id (new architecture) or field_id (legacy data)
        const validation = validations.find(v => 
          v.identifierId === record.identifierId &&
          (v.valueId === valueDefinition.id || v.fieldId === valueDefinition.id)
        );
        
        // Field must have a validation record with valid or verified status (green checkmark)
        if (!validation || (validation.validationStatus !== 'valid' && validation.validationStatus !== 'verified')) {
          console.log(`Field ${key} for identifier ${record.identifierId}: status = ${validation?.validationStatus || 'no validation'}`);
          return false;
        }
        
        // Also check that the field has a value (not empty)
        return value !== '' && 
               value !== null && 
               value !== undefined;
      });
      
      return allFieldsValid;
    });
    
    console.log(`✅ ${previousColumnsData.length} records have ALL previous values validated (filtered from ${originalCount})`);
    console.log(`❌ ${originalCount - previousColumnsData.length} records have invalid/missing previous values and were excluded`);
    
    // Log sample data to see what we're actually sending
    console.log(`📋 FINAL DATA being sent to extraction (first 3 records):`, 
      previousColumnsData.slice(0, 3));
    
    // Specifically log what columns are present
    if (previousColumnsData.length > 0) {
      const columns = Object.keys(previousColumnsData[0]).filter(k => k !== 'identifierId');
      console.log(`📋 Columns included in extraction data:`, columns);
      console.log(`📋 First column (${workflowStep?.values[0]?.valueName}) included:`, 
        columns.includes(workflowStep?.values[0]?.valueName || ''));
    }
    
    // Get tool information if available
    // Note: Tools are not part of the project object, so we'll need to fetch them separately
    // For now, we'll determine the operation type from the tool description
    const toolInfo = null; // project?.tools doesn't exist
    
    // Infer operation type from description - if it "finds" or "identifies" something, it's creating new records
    const inferredOperationType = valueToRun.description && 
      (valueToRun.description.toLowerCase().includes('find') || 
       valueToRun.description.toLowerCase().includes('identif') ||
       valueToRun.description.toLowerCase().includes('discover') ||
       valueToRun.description.toLowerCase().includes('detect')) 
      ? 'createMultiple' 
      : 'updateMultiple';
    
    // Create field information that includes the actual tool configuration
    const fieldWithToolConfig = {
      id: valueId,
      name: valueName,
      type: valueToRun.dataType || 'TEXT',
      stepId: workflowStep.id,
      valueId: valueId,
      toolId: valueToRun.toolId,
      inputValues: valueToRun.inputValues,
      orderIndex: valueToRun.orderIndex
    };
    
    // Check if this value actually uses knowledge documents
    let referencedKnowledgeDocs: any[] = [];
    if (valueToRun.inputValues && project?.knowledgeDocuments) {
      // Check if any input values reference knowledge documents
      Object.entries(valueToRun.inputValues).forEach(([key, value]) => {
        // Check for document references in arrays
        if (Array.isArray(value)) {
          value.forEach((v: any) => {
            // Check for UUID references
            if (typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i)) {
              const knowledgeDoc = project.knowledgeDocuments?.find((d: any) => d.id === v);
              if (knowledgeDoc && !referencedKnowledgeDocs.find(d => d.id === knowledgeDoc.id)) {
                referencedKnowledgeDocs.push(knowledgeDoc);
              }
            }
            // Check for @reference_document references
            else if (typeof v === 'string' && v === '@reference_document') {
              // This is a reference to knowledge documents, add all knowledge documents
              project.knowledgeDocuments?.forEach((doc: any) => {
                if (!referencedKnowledgeDocs.find(d => d.id === doc.id)) {
                  referencedKnowledgeDocs.push(doc);
                }
              });
            }
          });
        }
        // Check for single document reference
        else if (typeof value === 'string') {
          if (value.match(/^[a-f0-9-]{36}$/i)) {
            const knowledgeDoc = project.knowledgeDocuments?.find((d: any) => d.id === value);
            if (knowledgeDoc && !referencedKnowledgeDocs.find(d => d.id === knowledgeDoc.id)) {
              referencedKnowledgeDocs.push(knowledgeDoc);
            }
          }
          else if (value === '@reference_document') {
            // This is a reference to knowledge documents, add all knowledge documents
            project.knowledgeDocuments?.forEach((doc: any) => {
              if (!referencedKnowledgeDocs.find(d => d.id === doc.id)) {
                referencedKnowledgeDocs.push(doc);
              }
            });
          }
        }
      });
    }
    
    // Check how many records have already been extracted for this specific value
    // Validations use fieldId, not valueId, and we need to filter by collection name too
    // IMPORTANT: Only count validations that have actual extracted values, not empty placeholders
    const existingValidationsForValue = validations.filter(v => 
      v.fieldId === valueId && 
      v.collectionName === stepName &&
      v.extractedValue !== null && 
      v.extractedValue !== undefined && 
      v.extractedValue !== '' &&
      v.extractedValue !== 'Not Found'  // Don't count "Not Found" as extracted
    );
    const extractedCount = existingValidationsForValue.length;
    
    console.log(`🔢 Found ${extractedCount} existing validations for value: ${valueName} in collection: ${stepName}`);
    console.log(`📊 Total available records: ${previousColumnsData.length}`);
    
    // Filter out already extracted records
    const remainingData = previousColumnsData.slice(extractedCount);
    
    console.log(`📊 Remaining records to extract: ${remainingData.length}`);
    console.log(`📊 Will extract records ${extractedCount + 1}-${Math.min(extractedCount + remainingData.length, extractedCount + 50)} of ${previousColumnsData.length}`);
    
    // Parse inputValues to find which columns are actually needed for this tool
    const neededColumns = new Set<string>();
    
    // For Data Table steps, always include the first column (identifier) by default
    // Check both stepType variations and step.type to ensure we catch it
    if (workflowStep && workflowStep.values && workflowStep.values[0]) {
      // Always add the first column for any multi-value step (Data Tables)
      console.log(`📝 Adding first column by default: ${workflowStep.values[0].valueName}`);
      neededColumns.add(workflowStep.values[0].valueName);
    }
    
    if (valueToRun.inputValues) {
      Object.values(valueToRun.inputValues).forEach(inputValue => {
        if (typeof inputValue === 'string') {
          // Check for UUID value IDs
          if (inputValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Find the value name for this ID
            const referencedValue = workflowStep?.values?.find(v => v.id === inputValue);
            if (referencedValue) {
              neededColumns.add(referencedValue.valueName);
            }
          } else if (inputValue.includes('@')) {
            // Legacy @-notation support
            const match = inputValue.match(/@[^.]+\.(.+)/);
            if (match) {
              neededColumns.add(match[1].trim());
            }
          }
        } else if (Array.isArray(inputValue)) {
          inputValue.forEach(v => {
            if (typeof v === 'string') {
              // Check for UUID value IDs
              if (v.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                // Find the value name for this ID
                const referencedValue = workflowStep?.values?.find(val => val.id === v);
                if (referencedValue) {
                  neededColumns.add(referencedValue.valueName);
                }
              } else if (v.includes('@')) {
                // Legacy @-notation support
                const match = v.match(/@[^.]+\.(.+)/);
                if (match) {
                  neededColumns.add(match[1].trim());
                }
              }
            }
          });
        }
      });
    }
    
    // Filter the display data to only show referenced columns plus identifierId
    let filteredPreviousData = previousColumnsData;
    
    if (neededColumns.size > 0) {
      // Filter each record to only include identifierId and needed columns
      filteredPreviousData = previousColumnsData.map(record => {
        const filteredRecord: any = {
          identifierId: record.identifierId
        };
        
        // Add only the columns that are referenced in inputValues
        neededColumns.forEach(columnName => {
          if (columnName in record) {
            filteredRecord[columnName] = record[columnName];
          }
        });
        
        return filteredRecord;
      });
      
      console.log(`📋 Filtered data to show only referenced columns:`, Array.from(neededColumns));
      console.log(`📊 Records: ${filteredPreviousData.length} rows with ${Array.from(neededColumns).length + 1} columns (${Array.from(neededColumns).join(', ')} + identifierId)`);
    }
    
    // Get the column order from the filtered data
    const columnOrder = filteredPreviousData.length > 0 
      ? Object.keys(filteredPreviousData[0]).filter(k => k !== 'identifierId' && k !== '_recordIndex')
      : [];
    
    // Open the extraction wizard modal with the value's tool configuration
    setColumnExtractionModal({
      isOpen: true,
      stepName: stepName,
      valueId: valueId,
      valueName: valueName,
      previousData: previousColumnsData, // Send FULL data to server for proper extraction
      displayData: filteredPreviousData, // Show filtered columns in modal UI
      columnOrder: columnOrder, // Pass the column order
      needsDocument: needsDocument,
      toolType: 'extraction',
      toolDescription: valueToRun.description || '',
      toolId: valueToRun.toolId,
      toolOperationType: inferredOperationType, // Pass the inferred operation type
      inputValues: valueToRun.inputValues,
      knowledgeDocuments: referencedKnowledgeDocs,
      extractedCount: extractedCount,
      totalAvailable: previousColumnsData.length
    });
    
    console.log('🎯 Session documents available:', sessionDocuments?.length || 0, 'documents');
    if (sessionDocuments && sessionDocuments.length > 0) {
      console.log('🎯 Documents:', sessionDocuments.map(d => ({ id: d.id, fileName: d.fileName })));
      
      // Log document pre-selection info if needed
      if (needsDocument) {
        const primaryDoc = sessionDocuments.find(d => d.isPrimary) || sessionDocuments[0];
        if (primaryDoc) {
          console.log('🎯 Pre-selecting document:', primaryDoc.id, primaryDoc.fileName);
          // The document selection will be handled in the ExtractWizardModal
        }
      }
    } else {
      console.log('🎯 No documents found to pre-select');
    }
  };
  

  // Handler for verifying all items in a collection
  const handleVerifyAllCollectionItems = (collectionName: string, shouldVerify: boolean) => {
    console.log(`${shouldVerify ? 'Verifying' : 'Unverifying'} all items in collection: ${collectionName}`);
    
    // Find the collection
    const collection = collections?.find(c => c.collectionName === collectionName);
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

  const handleDeleteAllCollectionData = async (collectionName: string) => {
    // Confirm before deleting all data
    if (!confirm(`Are you sure you want to delete all data from the "${collectionName}" collection? This action cannot be undone.`)) {
      return;
    }

    console.log(`Deleting all data from collection: ${collectionName}`);
    
    // Find all validations for this collection using improved filtering
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

    console.log(`Found ${collectionValidations.length} validations to delete for ${collectionName}`);

    if (collectionValidations.length === 0) {
      console.warn(`No validations found for ${collectionName} - nothing to delete`);
      return;
    }

    // Optimistic update: Remove all items from cache for this collection
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      if (!old) return old;
      return old.filter((v: any) => {
        // Keep items that don't belong to this collection
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
      
      console.log(`Successfully deleted ${collectionValidations.length} validation records for ${collectionName}`);
      
      // Force complete cache refresh - remove the query data first, then invalidate
      queryClient.removeQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      // Also refresh the session data
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    } catch (error) {
      console.error('Error deleting all collection data:', error);
      // Log more detailed error information
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Force complete refresh on error
      queryClient.removeQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    }
  };

  // Auto-validation removed - validation now occurs only during extraction process

  if (projectLoading || sessionLoading || validationsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading Info</p>
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

  // Helper to get valueId from field name
  const getValueIdFromFieldName = (fieldName: string) => {
    // Check if this is a collection field (has format "Collection.Property[index]")
    const collectionMatch = fieldName.match(/^(.+)\.([^.]+)\[(\d+)\]$/);
    
    if (collectionMatch) {
      const collectionName = collectionMatch[1];
      const valueName = collectionMatch[2];
      
      // Find the step value for this field to get the valueId
      const workflowStep = project?.workflowSteps?.find(step => step.stepName === collectionName);
      const stepValue = workflowStep?.values?.find(v => v.valueName === valueName);
      return stepValue?.id;
    } else {
      // This is a schema field - find by fieldName
      const schemaField = project?.schemaFields?.find(f => f.fieldName === fieldName);
      return schemaField?.id;
    }
  };

  // Get validation for a specific field using pure ID-based matching
  const getValidation = (identifierId: string | null, valueId: string) => {
    // For collection fields: match by identifierId (row) + valueId (column)
    if (identifierId) {
      return validations.find(v => 
        v.identifierId === identifierId &&
        (v.valueId === valueId || v.fieldId === valueId) // Support both new (value_id) and legacy (field_id) data
      );
    }
    
    // For schema fields: match by valueId only (no identifierId for single-row fields)
    return validations.find(v => (v.valueId === valueId || v.fieldId === valueId) && !v.identifierId);
  };

  // Legacy helper for backward compatibility during transition
  const getValidationByFieldName = (fieldName: string, identifierId?: string | null) => {
    const valueId = getValueIdFromFieldName(fieldName);
    if (!valueId) return undefined;
    return getValidation(identifierId || null, valueId);
  };

  // Get session status based on field verification
  const getSessionStatus = () => {
    if (validations.length === 0) return 'in_progress';
    const allVerified = validations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'manual');
    return allVerified ? 'verified' : 'in_progress';
  };

  // Get verification count helpers
  const getVerifiedCount = () => {
    return validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'manual').length;
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
    const verifiedFields = collectionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'manual').length;
    const percentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;
    
    return {
      verified: verifiedFields,
      total: totalFields,
      percentage
    };
  };

  // Get all unverified fields for consolidated reasoning
  const getUnverifiedFields = () => {
    return validations.filter(v => v.validationStatus !== 'valid' && v.validationStatus !== 'manual');
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
    if (collections) {
      collections.forEach(collection => {
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

      // Handle new workflow steps structure
      if (excelData.workflowSteps) {
        // Process each workflow step as a separate sheet
        excelData.workflowSteps.forEach((step: any) => {
          console.log(`Creating Excel sheet for step: ${step.stepName} (${step.stepType})`);
          
          let worksheetData: any[][] = [];
          
          if (step.stepType === 'info' || step.stepType === 'page') {
            // Info page format: field names in column A, values in column B
            worksheetData = [
              ['Field Name', 'Value'],
              ...step.data.map((item: any) => [item.fieldName, item.value])
            ];
          } else if (step.stepType === 'data' || step.stepType === 'list') {
            // Data table format: normal table with headers as columns
            worksheetData = [
              step.data.headers,
              ...step.data.records
            ];
          }
          
          console.log(`Worksheet data for ${step.stepName}:`, worksheetData);
          
          const sheet = XLSX.utils.aoa_to_sheet(worksheetData);
          // Truncate sheet name to 31 characters (Excel limit)
          const sheetName = step.stepName.substring(0, 31);
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        });
      } else if (excelData.collections) {
        // Fallback to old format if server hasn't been updated
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
      }

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

  // Open field selection modal
  const handleOpenFieldSelection = (toolId: string, stepValues: any[]) => {
    setCurrentToolGroup({ toolId, stepValues });
    setShowFieldSelectionModal(true);
  };

  // Handle extraction from modal
  const handleExtractSelectedFields = async (selectedFieldIds: string[], fieldInputs: Record<string, any>) => {
    if (!currentToolGroup || extractingToolId) return;
    
    // DEBUG MODE - Just log the data instead of extracting
    console.log('=== EXTRACTION DEBUG ===');
    console.log('Selected Field IDs:', selectedFieldIds);
    console.log('Field Inputs from modal:', fieldInputs);
    console.log('Current Tool Group:', currentToolGroup);
    
    // Get step ID from any value in the group
    const stepId = currentToolGroup.stepValues[0]?.stepId;
    console.log('Step ID:', stepId);
    
    // Filter to only selected fields
    const fieldsToExtract = currentToolGroup.stepValues.filter(value => 
      selectedFieldIds.includes(value.id)
    );
    
    console.log(`\nSelected ${fieldsToExtract.length} fields for extraction:`);
    
    // Log each selected value object
    fieldsToExtract.forEach((stepValue, index) => {
      console.log(`\n--- Selected Value ${index + 1} ---`);
      console.log('Full stepValue object:', stepValue);
      console.log('ID:', stepValue.id);
      console.log('Name:', stepValue.valueName);
      console.log('Description:', stepValue.description);
      console.log('Data Type:', stepValue.dataType);
      console.log('Tool ID:', stepValue.toolId);
      console.log('Original inputValues:', stepValue.inputValues);
      console.log('Custom inputs from modal:', fieldInputs[stepValue.id]);
      
      // Get user-selected document for this field
      const userSelectedDoc = fieldInputs[stepValue.id]?.document;
      let documentId = userSelectedDoc;
      
      if (!documentId) {
        // Fall back to primary or first document
        const primaryDoc = sessionDocuments?.find(d => d.isPrimary) || sessionDocuments?.[0];
        documentId = primaryDoc?.id;
      }
      
      console.log('Document ID to use:', documentId);
      console.log('Would extract with params:', {
        stepId,
        valueId: stepValue.id,
        documentId,
        customInputs: fieldInputs[stepValue.id]
      });
    });
    
    console.log('\n=== END DEBUG ===\n');
    
    // Close modal and reset state
    setShowFieldSelectionModal(false);
    setExtractingToolId(null);
    setCurrentToolGroup(null);
    
    toast({
      title: "Debug Mode",
      description: `Check console for ${fieldsToExtract.length} selected value objects`,
    });
  };

  const handleDateChange = async (fieldName: string, dateValue: string) => {
    const validation = getValidationByFieldName(fieldName);
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
    if (!sessionId) {
      return;
    }
    
    // Find the step value for this field to get the proper fieldId
    // Look through all workflow steps to find the field
    let stepValue = null;
    for (const step of project?.workflowSteps || []) {
      const found = step.values?.find(v => v.valueName === fieldName);
      if (found) {
        stepValue = found;
        break;
      }
    }
    
    if (!stepValue) {
      console.error('❌ No step value found for:', fieldName);
      return;
    }
    
    // Refresh validations to get current state and avoid stale data
    await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    
    // Get fresh validation data after cache invalidation
    const freshValidations = await queryClient.fetchQuery({
      queryKey: ['/api/sessions', sessionId, 'validations'],
      queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations`)
    });
    
    const validation = freshValidations.find(v => v.fieldId === stepValue.id);
    
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
      if (validation) {
        // Update existing validation
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            extractedValue: valueToStore,
            validationStatus: "manual",
            manuallyVerified: true,
            manuallyUpdated: true
          }
        });
      } else {
        // Create new validation record
        
        const createData = {
          sessionId: sessionId,
          validationType: 'schema_field',
          fieldId: stepValue.id, // Use step value ID directly
          fieldName: fieldName,
          extractedValue: valueToStore,
          validationStatus: 'manual',
          manuallyVerified: true,
          manuallyUpdated: true,
          confidenceScore: 100,
          dataType: stepValue.dataType || 'text'
        };
        
        console.log('🔍 Creating validation with data:', createData);
        
        await apiRequest(`/api/sessions/${sessionId}/validations`, {
          method: 'POST',
          body: JSON.stringify(createData)
        });
      }
      
      // Force immediate UI update by invalidating all related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      
      // Force a refetch to update UI immediately
      await queryClient.refetchQueries({ queryKey: ['/api/validations/project'] });
    } catch (error) {
      console.error('Failed to save field:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
    setEditingField(null);
    setEditValue("");
  };

  // Bulk column validation handler - toggles all fields in column between pending and valid
  const handleBulkColumnValidation = async (collectionName: string, columnName: string, columnId: string) => {
    // Get all validations for this column
    const columnValidations = validations.filter(v => 
      v.fieldName?.includes(`${collectionName}.${columnName}[`) &&
      v.extractedValue !== null && 
      v.extractedValue !== undefined && 
      v.extractedValue !== "" && 
      v.extractedValue !== "null" && 
      v.extractedValue !== "undefined"
    );
    
    if (columnValidations.length === 0) return;
    
    // Check if all fields are currently valid
    const allValid = columnValidations.every(v => v.validationStatus === 'valid');
    
    // Toggle all fields: if all valid -> make pending, otherwise -> make valid
    const targetStatus = allValid ? 'pending' : 'valid';
    
    // OPTIMISTIC UPDATE - immediately update UI
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((validation: any) => {
        const isInColumn = columnValidations.some(cv => cv.id === validation.id);
        if (isInColumn) {
          return { ...validation, validationStatus: targetStatus };
        }
        return validation;
      });
    });
    
    // Fire all server updates simultaneously (not awaiting each one)
    const updatePromises = columnValidations.map(validation => 
      updateValidationMutation.mutateAsync({
        id: validation.id,
        data: { 
          validationStatus: targetStatus
        }
      }).catch(error => {
        console.error(`Failed to update validation ${validation.id}:`, error);
        // On error, the query will be invalidated and data refetched
      })
    );
    
    // Wait for all to complete, but UI already shows the changes
    try {
      await Promise.all(updatePromises);
    } catch (error) {
      // If any updates failed, invalidate and refetch to get correct state
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
    }
  };

  // Simple toggle handler - toggles between pending and valid
  const handleVerificationToggle = async (fieldName: string, isVerified: boolean, identifierId?: string | null) => {
    const validation = getValidationByFieldName(fieldName, identifierId);
    if (validation) {
      // Simple toggle: if valid -> pending, if pending -> valid
      const newStatus: ValidationStatus = validation.validationStatus === 'valid' ? 'pending' : 'valid';
      
      // OPTIMISTIC UPDATE - immediately update UI
      queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((v: any) => {
          if (v.id === validation.id) {
            return { ...v, validationStatus: newStatus };
          }
          return v;
        });
      });
      
      try {
        await updateValidationMutation.mutateAsync({
          id: validation.id,
          data: {
            validationStatus: newStatus
          }
        });
      } catch (error) {
        console.error('Failed to toggle verification:', error);
        // On error, invalidate and refetch to get correct state
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      }
    }
  };



  const handleRevertToAI = async (fieldName: string) => {
    const validation = getValidationByFieldName(fieldName);
    
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
    for (const collection of collections) {
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
    // Special handling for "Not Found" - display it as-is
    if (value === 'Not Found') {
      return 'Not Found';
    }
    
    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Not Found'; // Display null values as "Not Found" in the UI
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
    for (const collection of collections) {
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
    const validation = getValidationByFieldName(fieldName);
    const isEditing = editingField === fieldName;
    const fieldType = getFieldType(fieldName);
    const displayName = getFieldDisplayName(fieldName);
    
    const borderClass = isSchemaField ? "border-l-4 border-l-blue-500" : "";
    
    return (
      <div key={fieldName} className={`flex items-center gap-3 p-3 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 ${borderClass}`}>
        <div className="flex-1">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{displayName}</Label>
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
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {formatValueForDisplay(value, fieldType)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(fieldName, value)}
                className="h-6 px-2"
              >
                <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
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
            

            
            // Simple validation display - just show the ValidationIndicator
            const handleToggle = () => {
              const isValid = validation.validationStatus === 'valid';
              handleVerificationToggle(fieldName, !isValid, validation.identifierId);
            };
            
            return (
              <div className="flex items-center gap-2">
                <ValidationIndicator 
                  validation={validation}
                  onToggle={handleToggle}
                  fieldName={fieldName}
                />
                {validation.originalExtractedValue !== undefined && 
                 validation.originalExtractedValue !== null && 
                 validation.manuallyUpdated && (
                  <button
                    onClick={() => handleRevertToAI(fieldName)}
                    className="inline-flex items-center justify-center w-5 h-5 rounded bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                    title="Revert to original AI extracted value"
                  >
                    <RotateCcw className="h-3 w-3 text-black dark:text-white" />
                  </button>
                )}
              </div>
            );
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
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'manual');
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
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - Match ProjectLayout exactly */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <ExtraplLogo />
            <div className="flex items-center gap-4">
              <DarkModeToggle />
              <UserProfile />
            </div>
          </div>
        </div>
      </div>
      {/* Page Title - Match ProjectLayout exactly */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="w-full px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 mr-6">
              <TrendingUp className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-3xl font-bold dark:text-white">
                        {project.name}
                      </h2>
                      {session?.sessionName && (
                        <>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4F63A4' }}></div>
                          <h2 className="text-3xl font-bold dark:text-white">
                            {isEditingSessionName ? (
                              <Input
                                value={sessionNameValue}
                                onChange={(e) => setSessionNameValue(e.target.value)}
                                onKeyDown={handleSessionNameKeyPress}
                                onBlur={handleSessionNameSave}
                                className="inline-flex h-auto bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 m-0 dark:text-white"
                                style={{ 
                                  width: `${Math.max(sessionNameValue.length * 20, 100)}px`,
                                  fontSize: '1.875rem',
                                  fontWeight: '700',
                                  lineHeight: '2.25rem'
                                }}
                                autoFocus
                              />
                            ) : (
                              session.sessionName
                            )}
                          </h2>
                        </>
                      )}
                    </div>
                    {session?.sessionName && !isEditingSessionName && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSessionNameEdit}
                        className="opacity-60 hover:opacity-100 p-1 ml-2"
                        title="Edit session name"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  {project.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{project.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">No description</p>
                  )}
                </div>
              </div>
            </div>

            {/* Statistics Cards - Match ProjectLayout exactly */}
            {project.sessions.length > 0 && (
              <div className="flex gap-3 flex-shrink-0 ml-auto">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Database className="h-6 w-6 text-slate-700 dark:text-gray-400" />
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{project.sessions.length}</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {verificationStats.in_progress + verificationStats.pending}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {verificationStats.verified}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col overflow-y-auto">
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
                          ? "font-medium text-blue-900 dark:text-blue-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                          : "text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-100 font-normal"
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
          <div className="border-t border-slate-200 dark:border-gray-700 p-4 flex-1">
            {/* Continuous flow starting with Documents */}
            <div className="relative">
              {/* Vertical connecting line */}
              <div className="absolute left-4 top-4 w-0.5 bg-slate-300 dark:bg-gray-600" style={{ 
                height: `${(() => {
                  let count = 1; // Start with 1 for Documents tab
                  
                  // Add all workflow steps (except Documents which is already counted)
                  if (project.workflowSteps) {
                    const otherSteps = project.workflowSteps.filter(step => 
                      step.stepName !== 'Documents'
                    ).length;
                    count += otherSteps;
                  }
                  
                  // Calculate height: 48px per item, but subtract some to stop at the last item's center
                  return (count - 1) * 48 + 12; // Stop at last item's dot
                })()}px` 
              }}></div>
              
              <div className="space-y-3">
                {/* Documents Tab */}
                <div className="relative flex items-center">
                  {/* Horizontal connecting line when selected */}
                  {activeTab === 'documents' && (
                    <div className="absolute left-4 w-6 h-[2px] z-20" style={{ backgroundColor: '#4F63A4' }}></div>
                  )}
                  
                  {/* Circular icon - solid dot without border */}
                  <div className="relative z-10 w-8 h-8 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full ${
                      activeTab === 'documents' ? '' : 'bg-slate-400 dark:bg-gray-500'
                    }`} style={activeTab === 'documents' ? { backgroundColor: '#4F63A4' } : {}}></div>
                  </div>
                  
                  {/* Tab button */}
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`ml-3 flex-1 text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                      activeTab === 'documents' 
                        ? 'font-medium text-blue-900 dark:text-blue-200 hover:bg-slate-100 dark:hover:bg-gray-700' 
                        : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-100 font-normal'
                    }`}
                  >
                    <div className="truncate">Documents</div>
                  </button>
                </div>
                
                {/* Workflow Steps - Both Info Pages and Data Tables */}
                {(() => {
                  // Get all workflow steps (info_page, data_table, list types)
                  const allSteps: Array<{ id: string; name: string; stepType: string }> = [];
                  
                  // Add ALL workflow steps - not just list types
                  if (project.workflowSteps) {
                    project.workflowSteps.forEach(step => {
                      // Skip the Documents step since it's already shown above
                      if (step.stepName !== 'Documents') {
                        allSteps.push({
                          id: step.id,
                          name: step.stepName,
                          stepType: step.stepType
                        });
                      }
                    });
                  }
                  
                  return allSteps.map((item, index) => {
                    const itemValidations = validations.filter(v => 
                      v.collectionName === item.name || 
                      (v.fieldName && v.fieldName.startsWith(item.name + '.'))
                    );
                    const validationIndices = itemValidations.length > 0 ? 
                      itemValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                    const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                    
                    const verifiedCount = itemValidations.filter(v => 
                      v.validationStatus === 'valid' || 
                      v.validationStatus === 'manual'
                    ).length;
                    const totalCount = itemValidations.length;
                    
                    return (
                      <div key={item.id} className="relative flex items-center">
                        {/* Horizontal connecting line when selected */}
                        {activeTab === item.name && (
                          <div className="absolute left-4 w-6 h-[2px] z-20" style={{ backgroundColor: '#4F63A4' }}></div>
                        )}
                        
                        {/* Circular icon - solid dot without border */}
                        <div className="relative z-10 w-8 h-8 flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full ${
                            activeTab === item.name ? '' : 'bg-slate-400 dark:bg-gray-500'
                          }`} style={activeTab === item.name ? { backgroundColor: '#4F63A4' } : {}}></div>
                        </div>
                        
                        {/* Tab button */}
                        <button
                          onClick={() => setActiveTab(item.name)}
                          className={`ml-3 flex-1 text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                            activeTab === item.name 
                              ? 'font-medium text-blue-900 dark:text-blue-200 hover:bg-slate-100 dark:hover:bg-gray-700' 
                              : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-100 font-normal'
                          }`}
                        >
                          <div className="truncate">{item.name}</div>
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          
          {/* Settings Button - Always at the bottom */}
          {canAccessConfigTabs && (
            <div className="p-4 border-t border-slate-200 dark:border-gray-700">
              <Link href={`/projects/${projectId}/configure`}>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 text-slate-600 dark:text-gray-300 hover:text-slate-700 dark:hover:text-gray-100 transition-all duration-200">
                  <Settings className="h-4 w-4" />
                  Configure
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-8 bg-gray-50 dark:bg-gray-900">
          <div className="w-full flex flex-col h-full overflow-hidden">
            {/* Session Review Header - Now styled like page header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-start space-x-3 flex-1 mr-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (() => {
                        // Check if all columns are validated for data table tabs
                        if (activeTab !== 'info' && activeTab !== 'documents') {
                          // Get the workflow step for this collection
                          const workflowStep = project?.workflowSteps?.find(
                            step => step.stepName === activeTab
                          );
                          
                          if (workflowStep?.values) {
                            // Check if all columns have all their values validated
                            const allColumnsValid = workflowStep.values.every(column => {
                              const columnName = column.valueName;
                              
                              // Get all validations for this column
                              const columnValidations = validations.filter(v => 
                                v.fieldName?.includes(`${activeTab}.${columnName}[`) &&
                                v.extractedValue !== null && 
                                v.extractedValue !== undefined && 
                                v.extractedValue !== "" && 
                                v.extractedValue !== "null" && 
                                v.extractedValue !== "undefined"
                              );
                              
                              // Check if column has values and all are valid
                              return columnValidations.length > 0 && 
                                     columnValidations.every(v => v.validationStatus === 'valid');
                            });
                            
                            // Return green if all columns are fully validated, blue otherwise
                            return allColumnsValid ? '#10b981' : '#4F63A4';
                          }
                        }
                        
                        // Default blue for info/documents tabs or when no validation data
                        return '#4F63A4';
                      })() }}></div>
                      <h2 className="text-2xl font-bold dark:text-white">{(() => {
                        // Handle special tabs first
                        if (activeTab === 'documents') return 'Documents';
                        
                        // For all other tabs, display the activeTab name directly
                        // This will work for both collections and workflow steps
                        return activeTab || 'Session Overview';
                      })()}</h2>
                    </div>
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
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        getVerificationProgress().percentage === 100 ? 'bg-green-600 dark:bg-green-500' : 
                        getVerificationProgress().percentage > 0 ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
                      }`}
                      style={{ width: `${getVerificationProgress().percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[28px]">
                    {getVerificationProgress().percentage}%
                  </span>
                </div>
                
                <Button
                  onClick={() => setDocumentUploadModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  title="Add documents to session"
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  variant="ghost"
                  size="sm"
                  className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  title="Export to Excel"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Step Description - positioned below step header */}
            {(() => {
              // Get the active collection's description
              const collectionsList = collections || [];
              const activeCollection = collectionsList.find(c => {
                const stepName = c.collectionName;
                const workflowSteps = project?.workflowSteps || [];
                return workflowSteps.some(step => 
                  step.stepName === stepName && 
                  (step.values?.length > 0 || step.stepName === activeTab)
                );
              });
              
              if (activeCollection && activeTab !== 'info' && activeTab !== 'documents') {
                // Calculate record counts for the counter - use same logic as table
                const getRecordCounts = () => {
                  // Find the collection that matches the current activeTab (same as table logic)
                  const currentCollection = (project?.workflowSteps || []).find(step => step.stepName === activeTab);
                  if (!currentCollection) return { visible: 0, total: 0 };
                  
                  // Use exact same logic as the table to get unique indices
                  const collectionValidations = validations.filter(v => 
                    v.collectionName === activeTab &&  // Use activeTab instead of activeCollection
                    // Include valid and pending validations (exclude invalid) - same as table
                    (v.validationStatus === 'valid' || v.validationStatus === 'pending')
                  );
                  
                  const validationIndices = collectionValidations.length > 0 ? 
                    collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                  const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                  
                  const collectionData = extractedData[activeTab] || [];
                  
                  // If no indices, return 0
                  if (uniqueIndices.length === 0) {
                    return { visible: 0, total: 0 };
                  }
                  
                  // Create items with indices like the table does
                  const itemsWithIndices = uniqueIndices.map(index => ({
                    item: collectionData?.[index] || {},
                    originalIndex: index
                  }));
                  
                  // Apply same sorting as table (reverse to show newest first)
                  const sortedItems = itemsWithIndices.reverse();
                  
                  const totalRecords = sortedItems.length;
                  
                  if (!searchTerm) {
                    return { visible: totalRecords, total: totalRecords };
                  }
                  
                  // Apply same search filtering as table
                  const searchLower = searchTerm.toLowerCase();
                  const workflowStep = currentCollection;
                  const columnsToDisplay = workflowStep?.values || [];
                  
                  const filteredItems = sortedItems.filter(({ item, originalIndex }) => {
                    return columnsToDisplay.some(column => {
                      const columnName = workflowStep ? column.valueName : (column as any).propertyName;
                      const fieldName = `${activeTab}.${columnName}[${originalIndex}]`;
                      
                      // Get the identifierId for this row
                      const rowValidation = validations.find(v => 
                        v.recordIndex === originalIndex &&
                        v.collectionName === activeTab &&
                        v.identifierId
                      );
                      const rowIdentifierId = rowValidation?.identifierId || null;
                      
                      const validation = getValidationByFieldName(fieldName, rowIdentifierId);
                      
                      // Get the display value (same logic as table)
                      const possibleKeys = [
                        columnName,
                        columnName.toLowerCase(),
                        columnName.charAt(0).toLowerCase() + columnName.slice(1),
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
                      
                      return displayValue && 
                             displayValue.toString().toLowerCase().includes(searchLower);
                    });
                  });
                  
                  return { visible: filteredItems.length, total: totalRecords };
                };
                
                const { visible, total } = getRecordCounts();
                
                
                return (
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activeCollection.description}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search table data..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 h-8 text-sm"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                        {searchTerm ? `${visible} of ${total}` : `${total} records`}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Session Data Content - Now controlled by sidebar navigation */}
            <div className="w-full flex-1 overflow-hidden">
              {/* Info Page Content - For page type workflow steps */}
              {(() => {
                const currentStep = project?.workflowSteps?.find(step => step.stepName === activeTab);
                if (currentStep?.stepType !== 'page') return null;
                return (
                  <div className="h-full overflow-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                      Key information and fields extracted from this {(activeTab || "section").toLowerCase()}.
                    </p>
                    <Card className="rounded-tl-none ml-0 bg-white dark:bg-slate-900 border-[#4F63A4]/30">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(() => {
                          // Display the configured values for the current info page step
                          const currentInfoStep = currentStep;
                        
                        
                        if (!currentInfoStep?.values || currentInfoStep.values.length === 0) {
                          return (
                            <div className="col-span-full text-center text-gray-500 py-8">
                              <p>No data fields have been configured for this step.</p>
                              <p className="text-sm mt-2">Configure fields in the project settings to see them here.</p>
                            </div>
                          );
                        }
                        
                        // Group step values by toolId for extraction grouping
                        const groupedValues = currentInfoStep.values
                          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                          .reduce((groups, stepValue) => {
                            const toolId = stepValue.toolId || 'manual';
                            if (!groups[toolId]) {
                              groups[toolId] = [];
                            }
                            groups[toolId].push(stepValue);
                            return groups;
                          }, {} as Record<string, typeof currentInfoStep.values>);

                        return Object.entries(groupedValues).map(([toolId, stepValues]) => (
                          <div key={toolId} className="col-span-full space-y-4">
                            {/* Tool Group Container */}
                            <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/30 dark:bg-gray-800/30">
                              {/* Magic Wand Icon for extraction groups */}
                              {toolId !== 'manual' && (
                                <div className="absolute top-3 right-3">
                                  <button 
                                    className="p-1 text-gray-400 hover:text-[#4F63A4] transition-colors"
                                    title="Select fields to extract"
                                    onClick={() => handleOpenFieldSelection(toolId, stepValues)}
                                  >
                                    <Wand2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                              
                              {/* Fields Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {stepValues.map((stepValue) => {
                                  const fieldName = stepValue.valueName;
                                  
                                  // Check if this value has multiple fields defined
                                  const hasMultipleFields = stepValue.fields && stepValue.fields.length > 0;
                                  
                                  if (hasMultipleFields) {
                                    // Multi-field Info Page value - get all validations for this value
                                    const fieldValidations = validations.filter(v => v.valueId === stepValue.id);
                                    
                                    return (
                                      <div key={stepValue.id} className="col-span-2">
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                                          <div className="mb-3 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-gray-500" />
                                            <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{fieldName}</h4>
                                            {stepValue.description && (
                                              <span className="text-sm text-gray-500 dark:text-gray-400">- {stepValue.description}</span>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {stepValue.fields.map((field: any, fieldIndex: number) => {
                                              // Validations are saved in the same order as fields
                                              // So we can match by index
                                              const fieldValidation = fieldValidations[fieldIndex];
                                              const fieldFullName = `${fieldName}.${field.name}`;
                                              
                                              let displayValue = fieldValidation?.extractedValue ?? null;
                                              if (displayValue === "null" || displayValue === "undefined") {
                                                displayValue = null;
                                              }
                                              
                                              // Debug log to see what we're working with
                                              console.log(`Field ${fieldIndex} (${field.name}):`, {
                                                field,
                                                fieldValidation,
                                                displayValue,
                                                totalValidations: fieldValidations.length
                                              });
                                              
                                              return (
                                                <div key={field.name} className="space-y-2">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                  const wasManuallyUpdated = fieldValidation && fieldValidation.manuallyUpdated;
                                  const isVerified = fieldValidation?.validationStatus === 'valid' || fieldValidation?.validationStatus === 'manual';
                                  const score = Math.round(fieldValidation?.confidenceScore || 0);



                                  // Render confidence indicator/verification status to the left of field name
                                  if (wasManuallyUpdated) {
                                    // Show blue user icon for manually updated fields - highest priority
                                    
                                    return (
                                      <div className="w-3 h-3 flex items-center justify-center">
                                        <User className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                      </div>
                                    );
                                  } else if (isVerified) {
                                    // Show green tick when verified - clicking unverifies
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => handleVerificationToggle(fieldFullName, false)}
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
                                  } else if (hasValue && fieldValidation) {
                                    // Show colored confidence dot when not verified - clicking opens AI analysis modal
                                    const colorClass = score >= 80 ? 'bg-green-500' : 
                                                     score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                    
                                    return (
                                      <button
                                        onClick={() => {
                                          if (fieldValidation.aiReasoning) {
                                            setSelectedReasoning({
                                              reasoning: fieldValidation.aiReasoning,
                                              fieldName: getFieldDisplayName(fieldFullName),
                                              confidenceScore: fieldValidation.confidenceScore || 0,
                                              getFieldDisplayName,
                                              validation: fieldValidation,
                                              onVerificationChange: (isVerified) => handleVerificationToggle(fieldFullName, isVerified),
                                              isVerified: fieldValidation.validationStatus === 'valid' || fieldValidation.validationStatus === 'manual'
                                            });
                                          } else {
                                            // If no reasoning available, just toggle verification
                                            handleVerificationToggle(fieldFullName, true);
                                          }
                                        }}
                                        className={`w-2 h-2 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0`}
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
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {field.name}
                                </Label>
                              </div>
                              <div>
                                {(() => {
                                  const isEditing = editingField === fieldFullName;
                                  const fieldType = field.dataType || stepValue.dataType;
                                  
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
                                        <Button size="sm" onClick={() => handleSave(fieldName)}>
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
                                            <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md min-h-[60px]">
                                              <span className={formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 dark:text-gray-500 italic' : ''}>
                                                {formatValueForDisplay(displayValue, fieldType)}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className={`text-sm ${formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}`}>
                                              {formatValueForDisplay(displayValue, fieldType)}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleEdit(fieldName, displayValue)}
                                          className="h-6 px-2"
                                        >
                                          <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                        </Button>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                              {stepValue.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {stepValue.description}
                                </p>
                              )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // Single-field Info Page value (original logic)
                                        const validation = validations.find(v => v.fieldId === stepValue.id);
                                        const originalValue = extractedData[fieldName];
                                        
                                        let displayValue = validation?.extractedValue ?? originalValue ?? null;
                                        if (displayValue === "null" || displayValue === "undefined") {
                                          displayValue = null;
                                        }
                                        
                                        return (
                                          <div key={stepValue.id} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              {(() => {
                                                const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                                const wasManuallyUpdated = validation && validation.manuallyUpdated;
                                                const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'manual';
                                                const score = Math.round(validation?.confidenceScore || 0);
                                                
                                                if (wasManuallyUpdated) {
                                                  return (
                                                    <div className="w-3 h-3 flex items-center justify-center">
                                                      <User className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                    </div>
                                                  );
                                                } else if (isVerified) {
                                                  return (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            onClick={() => handleVerificationToggle(fieldName, false)}
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
                                                            onVerificationChange: (isVerified) => handleVerificationToggle(fieldName, isVerified),
                                                            isVerified: validation.validationStatus === 'valid' || validation.validationStatus === 'manual'
                                                          });
                                                        } else {
                                                          handleVerificationToggle(fieldName, true);
                                                        }
                                                      }}
                                                      className={`w-2 h-2 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0`}
                                                      title={`${score}% confidence - Click for AI analysis`}
                                                    />
                                                  );
                                                } else if (!hasValue) {
                                                  return (
                                                    <div className="w-3 h-3 flex items-center justify-center text-red-500 font-bold text-xs flex-shrink-0" title="Missing data">
                                                      !
                                                    </div>
                                                  );
                                                }
                                                return <div className="w-3 h-3 flex-shrink-0"></div>;
                                              })()}
                                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {fieldName}
                                              </Label>
                                            </div>
                                            <div>
                                              {(() => {
                                                const isEditing = editingField === fieldName;
                                                const fieldType = stepValue.dataType;
                                                
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
                                                      <Button size="sm" onClick={() => handleSave(fieldName)}>
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
                                                          <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md min-h-[60px]">
                                                            <span className={formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 dark:text-gray-500 italic' : ''}>
                                                              {formatValueForDisplay(displayValue, fieldType)}
                                                            </span>
                                                          </div>
                                                        ) : (
                                                          <span className={`text-sm ${formatValueForDisplay(displayValue, fieldType) === 'Empty' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}`}>
                                                            {formatValueForDisplay(displayValue, fieldType)}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleEdit(fieldName, displayValue)}
                                                        className="h-6 px-2"
                                                      >
                                                        <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                      </Button>
                                                    </div>
                                                  );
                                                }
                                              })()}
                                            </div>
                                            {stepValue.description && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {stepValue.description}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      }
                                    })}
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </CardContent>
                </Card>
                </div>
                );
              })()}

              {/* Documents Tab Content */}
              {activeTab === 'documents' && (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Documents uploaded and processed for this session.
                    </p>
                  </div>
                  <Card className="rounded-tl-none ml-0 bg-white dark:bg-slate-900 border-[#4F63A4]/30">
                    <CardContent className="pt-6">
                      {sessionDocuments && sessionDocuments.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Processed</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionDocuments.map((doc: any, index: number) => (
                                <tr 
                                  key={doc.id || index}
                                  className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0">
                                        {doc.mimeType?.includes('excel') || doc.mimeType?.includes('spreadsheet') || 
                                         doc.fileName?.endsWith('.xlsx') || doc.fileName?.endsWith('.xls') ? (
                                          <FaFileExcel className="w-4 h-4 text-green-600" />
                                        ) : doc.mimeType?.includes('word') || doc.mimeType?.includes('document') ||
                                             doc.fileName?.endsWith('.docx') || doc.fileName?.endsWith('.doc') ? (
                                          <FaFileWord className="w-4 h-4 text-blue-600" />
                                        ) : doc.mimeType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? (
                                          <FaFilePdf className="w-4 h-4 text-red-600" />
                                        ) : (
                                          <FileText className="w-4 h-4 text-gray-400" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate" title={doc.fileName}>
                                          {doc.fileName}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                                    {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Unknown'}
                                  </td>
                                  <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                                    {doc.extractedContent ? `${doc.extractedContent.length} chars` : 'No content'}
                                  </td>
                                  <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                                    {doc.extractedAt ? new Date(doc.extractedAt).toLocaleDateString() : 'Not processed'}
                                  </td>
                                  <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                                    {doc.extractedContent && doc.extractedContent.length > 0 && (
                                      <div className="max-w-xs">
                                        <p className="text-xs line-clamp-2">
                                          {doc.extractedContent.substring(0, 100)}{doc.extractedContent.length > 100 ? '...' : ''}
                                        </p>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        title="Download extracted content"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteDocument(doc.id)}
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        title="Delete document"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                </>
              )}

              {/* Individual Collection and Workflow Step Tabs */}
              {(() => {
                // Combine collections and list-type workflow steps for rendering
                const allListItems: Array<any> = [];
                
                // Add collections
                collections.forEach(collection => {
                  allListItems.push({
                    ...collection,
                    itemType: 'collection',
                    itemName: collection.collectionName
                  });
                });
                
                // Add workflow steps that aren't in collections
                if (project.workflowSteps) {
                  project.workflowSteps
                    .filter(step => step.stepType === 'list')
                    .forEach(step => {
                      // Only add if not already in collections
                      const alreadyExists = allListItems.some(item => item.itemName === step.stepName);
                      if (!alreadyExists) {
                        // Create a collection-like structure for workflow steps
                        allListItems.push({
                          id: step.id,
                          collectionName: step.stepName,
                          itemType: 'workflow',
                          itemName: step.stepName,
                          description: `Workflow step for ${step.stepName}`,
                          properties: step.values?.map(value => ({
                            id: value.id,
                            propertyName: value.valueName,
                            propertyType: value.dataType,
                            orderIndex: value.orderIndex
                          })) || []
                        });
                      }
                    });
                }
                
                return allListItems.map((item) => {
                  const collection = item; // Use item as collection for compatibility
                  const collectionData = extractedData[item.itemName];
                  const collectionValidations = validations.filter(v => 
                    v.collectionName === item.itemName &&
                    // Include valid and pending validations (exclude invalid)
                    (v.validationStatus === 'valid' || v.validationStatus === 'pending')
                  );
                  
                  
                  const validationIndices = collectionValidations.length > 0 ? 
                    collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                  const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                  const maxRecordIndex = uniqueIndices.length > 0 ? Math.max(...uniqueIndices) : -1;
                  
                  // Always show the table even when there are no records, so headers remain visible

                  return activeTab === item.itemName ? (
                  <div key={collection.id} className="mt-0 px-0 ml-0 h-full">
                    <Card className="rounded-tl-none ml-0 bg-white dark:bg-slate-900 border-[#4F63A4]/30 h-full">
                      <CardContent className="p-0">
                        <div className="session-table-wrapper" style={{ height: 'calc(100vh - 200px)', overflow: 'auto', position: 'relative', paddingBottom: '20px' }}>
                          <Table className="session-table compact" style={{ minWidth: 'max-content' }}>
                            <TableHeader style={{ position: 'sticky', top: 0, zIndex: 50 }} className="shadow-sm">
                              <TableRow>
                              {/* Spacer column for left padding */}
                              <TableHead className="w-1.5 h-8 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 border-r-0" style={{ width: '6px', minWidth: '6px', maxWidth: '6px' }}>
                              </TableHead>

                              {(() => {
                                // Check if we have workflow steps with values
                                const workflowStep = project?.workflowSteps?.find(
                                  step => step.stepName === collection.collectionName
                                );
                                
                                // Use step values if available, otherwise fall back to collection properties
                                const columnsToDisplay = workflowStep?.values || collection.properties;
                                
                                const sortedColumns = columnsToDisplay.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                                
                                return sortedColumns
                                  .map((column, index) => {
                                    const columnId = column.id;
                                    const columnName = workflowStep ? column.valueName : (column as any).propertyName;
                                    const columnType = workflowStep ? column.dataType : (column as any).propertyType;
                                    const isLastColumn = index === sortedColumns.length - 1;
                                    
                                    return (
                                      <TableHead 
                                        key={columnId} 
                                        className={`relative h-8 py-1 px-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${!isLastColumn ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                                        style={{ 
                                          width: `${columnWidths[`${collection.id}-${columnId}`] || (
                                            columnType === 'TEXTAREA' ? 500 : 
                                            columnName.toLowerCase().includes('summary') || columnName.toLowerCase().includes('description') ? 450 :
                                            columnName.toLowerCase().includes('remediation') || columnName.toLowerCase().includes('action') ? 350 :
                                            columnType === 'TEXT' && (columnName.toLowerCase().includes('title') || columnName.toLowerCase().includes('name')) ? 250 :
                                            columnType === 'TEXT' ? 200 : 
                                            columnType === 'NUMBER' || columnType === 'DATE' ? 120 :
                                            columnName.toLowerCase().includes('status') ? 150 :
                                      200
                                    )}px`,
                                    minWidth: columnType === 'TEXTAREA' || columnName.toLowerCase().includes('description') ? '400px' : '150px'
                                  }}
                                >
                                  <div className="flex items-center justify-between group">
                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                      <div className="flex items-center">
                                        {(() => {
                                          // Get all validations for this column
                                          const columnValidations = validations.filter(v => 
                                            v.fieldName?.includes(`${collection.collectionName}.${columnName}[`) &&
                                            v.extractedValue !== null && 
                                            v.extractedValue !== undefined && 
                                            v.extractedValue !== "" && 
                                            v.extractedValue !== "null" && 
                                            v.extractedValue !== "undefined"
                                          );
                                          
                                          // Check if column has any values
                                          const hasValues = columnValidations.length > 0;
                                          
                                          // Check if all fields are valid
                                          const allValid = hasValues && 
                                            columnValidations.every(v => v.validationStatus === 'valid');
                                          
                                          // Determine dot color: grey if no values, green if all valid, blue if has values but not all valid
                                          const dotColor = !hasValues ? '#9ca3af' : allValid ? '#10b981' : '#4F63A4';
                                          
                                          return (
                                            <button
                                              onClick={() => handleBulkColumnValidation(collection.collectionName, columnName, columnId)}
                                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                              title={!hasValues ? 
                                                `No values in ${columnName} column` :
                                                allValid ? 
                                                `All ${columnName} fields are valid. Click to set all to pending` : 
                                                `Click to validate all ${columnName} fields`}
                                            >
                                              <div 
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: dotColor }}
                                              />
                                            </button>
                                          );
                                        })()}
                                        <span className="truncate pl-1 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">{columnName}</span>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        <button
                                          onClick={() => handleRunColumnExtraction(collection.collectionName, columnId, columnName)}
                                          className="h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center flex-shrink-0"
                                          title={`Run extraction for ${columnName}`}
                                        >
                                          <Wand2 className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                                        </button>
                                        <button
                                          onClick={() => handleSort(columnName, collection.id)}
                                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                          title={`Sort by ${columnName}`}
                                        >
                                          {getSortIcon(columnName, collection.id)}
                                        </button>
                                      </div>
                                    </div>
                                    <div
                                      className="column-resizer opacity-0 group-hover:opacity-100 transition-opacity"
                                      onMouseDown={(e) => handleMouseDown(e, `${collection.id}-${columnId}`)}
                                    />
                                  </div>
                                </TableHead>
                                    );
                                  });
                              })()}
                              <TableHead className="w-14 h-8 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ width: '56px', minWidth: '56px', maxWidth: '56px' }}>
                                <div className="flex items-center justify-center gap-1 px-2">
                                  <button
                                    onClick={() => handleAddCollectionItem(collection.collectionName)}
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 rounded flex items-center justify-center transition-colors"
                                    title="Add new item"
                                    type="button"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
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
                                        <X className="h-4 w-4 mr-2 text-gray-600" />
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
                              // Check if we have workflow steps with values
                              const workflowStep = project?.workflowSteps?.find(
                                step => step.stepName === collection.collectionName
                              );
                              
                              // Use step values if available, otherwise fall back to collection properties
                              const columnsToDisplay = workflowStep?.values || collection.properties;
                              
                              // Handle empty collections by showing a placeholder row
                              if (uniqueIndices.length === 0) {
                                return (
                                  <TableRow className="border-b border-gray-200 dark:border-gray-700">
                                    <TableCell 
                                      colSpan={columnsToDisplay.length + 2} 
                                      className="text-center text-gray-500 py-6 italic text-sm"
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
                              
                              // Apply search filtering - search across all visible table data
                              const filteredItems = searchTerm ? sortedItems.filter(({ item, originalIndex }) => {
                                const searchLower = searchTerm.toLowerCase();
                                
                                // Search in the actual displayed values from each column
                                const columnsToDisplay = workflowStep?.values || collection.properties;
                                
                                return columnsToDisplay.some(column => {
                                  const columnName = workflowStep ? column.valueName : (column as any).propertyName;
                                  const fieldName = `${collection.collectionName}.${columnName}[${originalIndex}]`;
                                  
                                  // Get the identifierId for this row
                                  const rowIdentifierId = (() => {
                                    // For workflow steps, get the first column (ID column) value
                                    if (workflowStep && workflowStep.values.length > 0) {
                                      const firstColumn = workflowStep.values[0];
                                      const idValue = item[firstColumn.valueName];
                                      
                                      // Find validation with matching ID value
                                      if (idValue) {
                                        const idValidation = validations.find(v => 
                                          v.collectionName === collection.collectionName &&
                                          v.extractedValue === idValue &&
                                          v.valueId === firstColumn.id &&
                                          v.identifierId
                                        );
                                        if (idValidation) {
                                          return idValidation.identifierId;
                                        }
                                      }
                                    }
                                    
                                    // Fallback: Try to find any validation for this row that has an identifierId
                                    const rowValidation = validations.find(v => 
                                      v.recordIndex === originalIndex &&
                                      v.collectionName === collection.collectionName &&
                                      v.identifierId
                                    );
                                    return rowValidation?.identifierId || null;
                                  })();
                                  
                                  const validation = getValidationByFieldName(fieldName, rowIdentifierId);
                                  
                                  // Get the display value (same logic as what's shown in the table)
                                  const possibleKeys = [
                                    columnName,
                                    columnName.toLowerCase(),
                                    columnName.charAt(0).toLowerCase() + columnName.slice(1),
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
                                  
                                  // Check if this column's display value contains the search term
                                  return displayValue && 
                                         displayValue.toString().toLowerCase().includes(searchLower);
                                });
                              }) : sortedItems;
                              
                              // Handle case when search yields no results
                              if (searchTerm && filteredItems.length === 0) {
                                return (
                                  <TableRow className="border-b border-gray-200 dark:border-gray-700">
                                    <TableCell 
                                      colSpan={columnsToDisplay.length + 2} 
                                      className="text-center text-gray-500 py-6 italic text-sm"
                                    >
                                      No items match your search for "{searchTerm}".
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              
                              
                              return filteredItems.map(({ item, originalIndex }, displayIndex) => (
                                <TableRow 
                                  key={originalIndex} 
                                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                                  style={{
                                    backgroundColor: displayIndex % 2 === 0 
                                      ? 'transparent' 
                                      : 'rgba(79, 99, 164, 0.03)'
                                  }}
                                >
                                  {/* Spacer cell for left padding */}
                                  <TableCell className="w-1.5 py-2.5 border-r-0" style={{ width: '6px', minWidth: '6px', maxWidth: '6px' }}>
                                  </TableCell>
                                  {columnsToDisplay
                                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                    .map((column, columnIndex) => {
                                    const columnId = column.id;
                                    const columnName = workflowStep ? column.valueName : (column as any).propertyName;
                                    const columnType = workflowStep ? column.dataType : (column as any).propertyType;
                                    const fieldName = `${collection.collectionName}.${columnName}[${originalIndex}]`;
                                    
                                    // Get the identifierId for this row
                                    const rowIdentifierId = (() => {
                                      // For workflow steps, get the first column (ID column) value
                                      if (workflowStep && workflowStep.values.length > 0) {
                                        const firstColumn = workflowStep.values[0];
                                        const idValue = item[firstColumn.valueName];
                                        
                                        // Find validation with matching ID value
                                        if (idValue) {
                                          const idValidation = validations.find(v => 
                                            v.collectionName === collection.collectionName &&
                                            v.extractedValue === idValue &&
                                            v.valueId === firstColumn.id &&
                                            v.identifierId
                                          );
                                          if (idValidation) {
                                            return idValidation.identifierId;
                                          }
                                        }
                                      }
                                      
                                      // Fallback: Try to find any validation for this row that has an identifierId
                                      const rowValidation = validations.find(v => 
                                        v.recordIndex === originalIndex &&
                                        v.collectionName === collection.collectionName &&
                                        v.identifierId
                                      );
                                      return rowValidation?.identifierId || null;
                                    })();
                                    
                                    const validation = getValidationByFieldName(fieldName, rowIdentifierId);
                                    

                                    
                                    // Try multiple possible property name mappings for extracted data
                                    const possibleKeys = [
                                      columnName,
                                      columnName.toLowerCase(),
                                      columnName.charAt(0).toLowerCase() + columnName.slice(1),
                                    ];
                                    
                                    let originalValue = undefined;
                                    for (const key of possibleKeys) {
                                      if (item[key] !== undefined) {
                                        originalValue = item[key];
                                        break;
                                      }
                                    }
                                    
                                    let displayValue = validation?.extractedValue ?? originalValue ?? null;
                                    // Don't convert "Not Found" to null
                                    if (displayValue === "null" || displayValue === "undefined") {
                                      displayValue = null;
                                    } else if (displayValue === "Not Found") {
                                      // Keep "Not Found" as is
                                      displayValue = "Not Found";
                                    }
                                    
                                    return (
                                      <TableCell 
                                        key={columnId} 
                                        className="relative py-2.5 px-3"
                                        style={{ 
                                          width: `${columnWidths[`${collection.id}-${columnId}`] || (
                                            columnType === 'TEXTAREA' ? 500 : 
                                            columnName.toLowerCase().includes('summary') || columnName.toLowerCase().includes('description') ? 450 :
                                            columnName.toLowerCase().includes('remediation') || columnName.toLowerCase().includes('action') ? 350 :
                                            columnType === 'TEXT' && (columnName.toLowerCase().includes('title') || columnName.toLowerCase().includes('name')) ? 250 :
                                            columnType === 'TEXT' ? 200 : 
                                            columnType === 'NUMBER' || columnType === 'DATE' ? 120 :
                                            columnName.toLowerCase().includes('status') ? 150 :
                                            200
                                          )}px`,
                                          minWidth: columnType === 'TEXTAREA' || columnName.toLowerCase().includes('description') ? '400px' : '150px'
                                        }}
                                      >
                                        <div className="relative w-full h-full">
                                          {/* Content */}
                                          <div className={`table-cell-content w-full pl-6 pr-6 ${
                                            columnType === 'TEXTAREA' ? 'min-h-[40px] py-1' : 'py-0.5'
                                          } break-words whitespace-normal overflow-wrap-anywhere leading-snug group relative text-sm`}>
                                            <span className={`
                                              ${formatValueForDisplay(displayValue, columnType) === 'Not Found' ? 'text-gray-400 italic text-xs' : ''}
                                              ${columnIndex === 0 ? 'font-medium' : ''}
                                            `.trim()}>
                                              {formatValueForDisplay(displayValue, columnType)}
                                            </span>
                                            
                                            {/* Inline editing or edit button */}
                                            {(() => {
                                              // Create a field key even if validation doesn't exist
                                              const fieldKey = validation 
                                                ? `${validation.collectionName}.${validation.fieldName}[${validation.recordIndex}]`
                                                : `${collection.collectionName}.${columnName}[${originalIndex}]`;
                                              const isEditingThisField = editingTableField === fieldKey;
                                              
                                              if (isEditingThisField) {
                                                return (
                                                  <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded z-10 border border-blue-500">
                                                    <div className="relative h-full">
                                                      {columnType === 'TEXTAREA' ? (
                                                        <textarea
                                                          value={editTableValue}
                                                          onChange={(e) => setEditTableValue(e.target.value)}
                                                          className="w-full h-full px-2 py-1 text-sm border-none outline-none resize-none bg-transparent pr-20"
                                                          autoFocus
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && e.ctrlKey) {
                                                              handleSaveTableFieldEdit();
                                                            } else if (e.key === 'Escape') {
                                                              handleCancelTableFieldEdit();
                                                            }
                                                          }}
                                                        />
                                                      ) : (
                                                        <input
                                                          type={columnType === 'NUMBER' ? 'number' : columnType === 'DATE' ? 'date' : 'text'}
                                                          value={editTableValue}
                                                          onChange={(e) => setEditTableValue(e.target.value)}
                                                          className="w-full h-full px-2 py-1 text-sm border-none outline-none bg-transparent pr-20"
                                                          autoFocus
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                              handleSaveTableFieldEdit();
                                                            } else if (e.key === 'Escape') {
                                                              handleCancelTableFieldEdit();
                                                            }
                                                          }}
                                                        />
                                                      )}
                                                      
                                                      {/* Save/Cancel buttons */}
                                                      <div className="absolute top-1/2 right-1 transform -translate-y-1/2 flex gap-1">
                                                        <Button
                                                          size="sm"
                                                          onClick={handleSaveTableFieldEdit}
                                                          className="h-6 px-2 text-xs"
                                                        >
                                                          ✓
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={handleCancelTableFieldEdit}
                                                          className="h-6 px-2 text-xs"
                                                        >
                                                          ×
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              } else {
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                      console.log('Edit button clicked for:', {
                                                        collectionName: collection.collectionName,
                                                        columnName,
                                                        originalIndex,
                                                        rowIdentifierId,
                                                        hasValidation: !!validation
                                                      });
                                                      
                                                      if (validation) {
                                                        console.log('Editing existing validation:', validation);
                                                        handleEditTableField(validation);
                                                      } else {
                                                        // Create a temporary validation object for fields without validation
                                                        const tempValidation = {
                                                          id: `temp-${Date.now()}`,
                                                          collectionName: collection.collectionName,
                                                          fieldName: columnName,
                                                          recordIndex: originalIndex,
                                                          extractedValue: null,
                                                          identifierId: rowIdentifierId
                                                        } as FieldValidation;
                                                        console.log('Creating temp validation for editing:', tempValidation);
                                                        handleEditTableField(tempValidation);
                                                      }
                                                    }}
                                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Edit field value"
                                                  >
                                                    <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                  </Button>
                                                );
                                              }
                                            })()}
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
                                                const isVerified = validation.validationStatus === 'valid';
                                                const score = Math.round(validation.confidenceScore || 0);

                                                if (wasManuallyUpdated) {
                                                  return (
                                                    <div className="absolute top-1 left-1 w-3 h-3 flex items-center justify-center">
                                                      <User className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                    </div>
                                                  );
                                                } else if (isVerified) {
                                                  // Show green tick when verified
                                                  return (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            onClick={() => handleFieldVerification(fieldName, !isVerified, rowIdentifierId)}
                                                            className="absolute top-1 left-1 w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 rounded transition-colors"
                                                            aria-label="Click to unverify"
                                                          >
                                                            <span className="text-xs font-bold">✓</span>
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-white border-2 border-[#4F63A4] text-blue-900 p-3 max-w-[400px] shadow-lg">
                                                          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                            <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                            <span className="text-sm font-semibold">Analysis</span>
                                                          </div>
                                                          <div className="whitespace-pre-line leading-relaxed">
                                                            {validation.aiReasoning && (
                                                              <div className="mb-2">{validation.aiReasoning}</div>
                                                            )}
                                                            <div className="mb-2 font-medium">Confidence: {score}%</div>
                                                            <div className="text-xs text-[#4F63A4]">Click indicator to mark as pending</div>
                                                          </div>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  );
                                                } else if (hasValue) {
                                                  // Show appropriate indicator based on confidence score availability
                                                  if (validation.confidenceScore) {
                                                    // Show colored confidence dot when there's a confidence score
                                                    const colorClass = score >= 80 ? 'bg-green-500' : 
                                                                     score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                                    const borderClass = score >= 80 ? 'border-green-500' : 
                                                                      score >= 50 ? 'border-yellow-500' : 'border-red-500';
                                                    const hoverClass = score >= 80 ? 'hover:bg-green-400' : 
                                                                     score >= 50 ? 'hover:bg-yellow-400' : 'hover:bg-red-400';
                                                    
                                                    return (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <button
                                                              onClick={() => handleFieldVerification(fieldName, !isVerified, rowIdentifierId)}
                                                              className={`absolute top-1 left-1 w-2 h-2 ${colorClass} rounded-full border-2 ${borderClass} cursor-pointer ${hoverClass} transition-colors`}
                                                              aria-label="Click to validate"
                                                            />
                                                          </TooltipTrigger>
                                                          <TooltipContent className="bg-white border-2 border-[#4F63A4] text-blue-900 p-3 max-w-[400px] shadow-lg">
                                                            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                              <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                              <span className="text-sm font-semibold">Analysis</span>
                                                            </div>
                                                            <div className="whitespace-pre-line leading-relaxed">
                                                              {validation.aiReasoning && (
                                                                <div className="mb-2">{validation.aiReasoning}</div>
                                                              )}
                                                              {validation.confidenceScore && (
                                                                <div className="mb-2 font-medium">Confidence: {Math.round(validation.confidenceScore)}%</div>
                                                              )}
                                                              <div className="text-xs font-bold" style={{ color: '#4F63A4' }}>Click indicator to validate</div>
                                                            </div>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    );
                                                  } else {
                                                    // Show gray pending indicator when no confidence score
                                                    return (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <button
                                                              onClick={() => handleFieldVerification(fieldName, !isVerified, rowIdentifierId)}
                                                              className="absolute top-1 left-1 w-2 h-2 bg-gray-400 rounded-full border-2 border-gray-400 cursor-pointer hover:bg-gray-300 transition-colors"
                                                              aria-label="Click to validate"
                                                            />
                                                          </TooltipTrigger>
                                                          {validation.aiReasoning && (
                                                            <TooltipContent className="bg-white border-2 border-[#4F63A4] text-blue-900 p-3 max-w-[400px] shadow-lg">
                                                              <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                                <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                                <span className="text-sm font-semibold">Analysis</span>
                                                              </div>
                                                              <div className="whitespace-pre-line leading-relaxed">
                                                                <div className="mb-2">{validation.aiReasoning}</div>
                                                                <div className="text-xs font-bold" style={{ color: '#4F63A4' }}>Click indicator to validate</div>
                                                              </div>
                                                            </TooltipContent>
                                                          )}
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    );
                                                  }
                                                } else if (!hasValue) {
                                                  // Show red exclamation mark for missing fields
                                                  return (
                                                    <div className="absolute top-1 left-1 w-3 h-3 flex items-center justify-center">
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
                                  <TableCell className="py-2.5 px-2" style={{ width: '56px', minWidth: '56px', maxWidth: '56px' }}>
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
                                            v?.validationStatus === 'manual'
                                          );
                                        
                                        // Removed verbose verification status logging
                                        
                                        return null; // Removed verification button with green tick circle
                                      })()}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteCollectionItem(collection.collectionName, originalIndex)}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Delete this item"
                                      >
                                        <X className="h-4 w-4 text-gray-600" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null;
                });
              })()}
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
                const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'manual';
                
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
      {/* Edit Field Value Dialog - Removed in favor of inline editing */}
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
      {/* Column Extraction Modal for Workflow Step Values */}
      {columnExtractionModal && (
        <ExtractWizardModal
          open={columnExtractionModal.isOpen}
          onClose={() => setColumnExtractionModal(null)}
          extractedCount={columnExtractionModal.extractedCount}
          totalAvailable={columnExtractionModal.totalAvailable}
          columnOrder={columnExtractionModal.columnOrder}
          onConfirm={async (documentId) => {
            if (!columnExtractionModal) return;
            
            const { stepName, valueId, valueName, previousData } = columnExtractionModal;
            
            console.log(`🎯 Running extraction for ${valueName}`);
            console.log(`🎯 Document: ${documentId}`);
            console.log(`🎯 Previous data: ${previousData.length} records`);
            
            try {
              setIsColumnExtracting(true);
              
              // Get the workflow step
              const workflowStep = project?.workflowSteps?.find(step => step.stepName === stepName);
              if (!workflowStep) {
                console.error('Workflow step not found:', stepName);
                return;
              }
              
              // CRITICAL: Send the complete unfiltered data for extraction
              // The server needs all columns, especially the first column for context
              const fullPreviousData = columnExtractionModal.previousData;
              
              const requestPayload = {
                stepId: workflowStep.id,
                valueId: valueId,
                previousData: fullPreviousData, // Send FULL data, not filtered/display data
                documentId: documentId
              };
              
              console.log(`🎯 Sending extraction request for: ${valueName} (${valueId})`);
              
              // Call the extraction endpoint
              const response = await apiRequest(`/api/sessions/${sessionId}/extract-column`, {
                method: 'POST',
                body: JSON.stringify(requestPayload)
              });
              
              console.log('Column extraction response:', response);
              
              // Close the modal
              setColumnExtractionModal(null);
              
              // Refresh validations to show the new extracted data
              console.log('🔄 Invalidating validation queries...');
              
              // Small delay to ensure backend operations complete
              await new Promise(resolve => setTimeout(resolve, 500));
              
              await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
              await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
              
              // Force refetch to ensure UI updates
              await queryClient.refetchQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
              console.log('✅ Validation queries refreshed');
              
            } catch (error) {
              console.error('Error running column extraction:', error);
            } finally {
              setIsColumnExtracting(false);
            }
          }}
          title={`Extract ${columnExtractionModal.valueName}`}
          toolType={columnExtractionModal.toolType}
          toolDescription={columnExtractionModal.toolDescription}
          toolOperationType={columnExtractionModal.toolOperationType}
          documents={sessionDocuments?.map(doc => ({
            id: doc.id,
            name: doc.fileName || doc.name || 'Untitled',
            type: doc.fileType || 'unknown'
          })) || []}
          inputData={columnExtractionModal.displayData || columnExtractionModal.previousData}
          needsDocument={columnExtractionModal.needsDocument}
          isLoading={isColumnExtracting}
          inputValues={columnExtractionModal.inputValues}
          knowledgeDocuments={columnExtractionModal.knowledgeDocuments || []}
        />
      )}
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
      />
      {/* Field Selection Modal */}
      <Dialog open={showFieldSelectionModal} onOpenChange={setShowFieldSelectionModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Fields to Extract</DialogTitle>
            <DialogDescription>
              Choose which fields you want to extract from this tool group.
            </DialogDescription>
          </DialogHeader>
          
          {currentToolGroup && (
            <FieldSelectionModalContent
              stepValues={currentToolGroup.stepValues}
              onExtract={handleExtractSelectedFields}
              onCancel={() => setShowFieldSelectionModal(false)}
              isExtracting={extractingToolId === currentToolGroup.toolId}
              sessionDocuments={sessionDocuments}
            />
          )}
        </DialogContent>
      </Dialog>

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