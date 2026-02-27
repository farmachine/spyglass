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

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home, CheckCircle, AlertTriangle, Info, Copy, X, AlertCircle, FolderOpen, Download, ChevronDown, ChevronRight, RotateCcw, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Check, User, Plus, Trash2, Bug, Wand2, Folder, FileText, FilePlus, Table as TableIcon, Loader2, MoreVertical, Search, RefreshCw, Circle, ExternalLink, Mail, Clock, ChevronsLeft, ChevronsRight } from "lucide-react";
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
import { FieldEditorPopover } from "@/components/FieldEditorPopover";
import AddDocumentsModal from "@/components/AddDocumentsModal";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import SessionLinkingModal from "@/components/SessionLinkingModal";
import SessionPanel, { type PanelTab, panelTabs } from "@/components/SessionPanel";
import RiveLoader from "@/components/RiveLoader";
import DocumentPreview from "@/components/DocumentPreview";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import ExtractWizardModal from "@/components/ExtractWizardModal";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ToolResultModal } from "@/components/ToolResultModal";
import type { ToolDisplayConfig } from "@/components/tool-displays";

import type { 
  ExtractionSession, 
  ProjectWithDetails, 
  FieldValidation,
  ValidationStatus 
} from "@shared/schema";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { formatDateForDisplay } from "@/lib/dateUtils";

// Multi-Select Session Document Component
const MultiSelectSessionDocument = ({
  value = [],
  onChange,
  placeholder,
  sessionDocuments,
  disabled
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  sessionDocuments: any[];
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const selectedDocs = sessionDocuments?.filter(doc => value.includes(doc.id)) || [];
  
  const handleDocumentToggle = (docId: string) => {
    const newValue = value.includes(docId) 
      ? value.filter(id => id !== docId)
      : [...value, docId];
    onChange(newValue);
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className={`min-h-9 p-2 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer bg-white dark:bg-gray-800 flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1 min-h-5 flex-1">
          {selectedDocs.length > 0 ? (
            selectedDocs.map(doc => (
              <Badge key={doc.id} variant="outline" className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs">
                <FileText className="h-3 w-3" />
                {(doc.fileName || doc.name || 'Untitled').length > 20 
                  ? (doc.fileName || doc.name || 'Untitled').substring(0, 20) + '...'
                  : (doc.fileName || doc.name || 'Untitled')}
                {doc.isPrimary && <span className="text-blue-500 ml-1">(Primary)</span>}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDocumentToggle(doc.id);
                  }}
                />
              </Badge>
            ))
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-xs">{placeholder || "Select documents..."}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {sessionDocuments?.map((doc) => {
            const isSelected = value.includes(doc.id);
            return (
              <div
                key={doc.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''
                }`}
                onClick={() => handleDocumentToggle(doc.id)}
              >
                <div className={`w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm flex-1 truncate">{doc.fileName || doc.name || 'Untitled'}</span>
                {doc.isPrimary && <span className="text-xs text-blue-500">(Primary)</span>}
              </div>
            );
          })}
          {(!sessionDocuments || sessionDocuments.length === 0) && (
            <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">No documents available</div>
          )}
        </div>
      )}
    </div>
  );
};

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
  // Initialize with all fields pre-selected
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
    const initialSelection = new Set<string>();
    stepValues.forEach(sv => {
      if (sv.fields && Array.isArray(sv.fields)) {
        // For multi-field values, add each field with format: valueId:fieldIndex
        sv.fields.forEach((field: any, index: number) => {
          initialSelection.add(`${sv.id}:${index}`);
        });
      } else {
        // For single-field values, just add the value id
        initialSelection.add(sv.id);
      }
    });
    return initialSelection;
  });
  // Pre-populate document selection for values that need it
  const [fieldInputs, setFieldInputs] = useState<Record<string, any>>(() => {
    const initialInputs: Record<string, any> = {};
    
    // Check if any step values need document selection and pre-select the first document
    if (sessionDocuments && sessionDocuments.length > 0) {
      stepValues.forEach(stepValue => {
        const needsDoc = stepValue.inputValues && 
          Object.entries(stepValue.inputValues).some(([key, value]) => {
            if (Array.isArray(value)) {
              return value.some(v => typeof v === 'string' && 
                (v.toLowerCase().includes('user_document') || 
                 (v.toLowerCase().includes('user') && v.toLowerCase().includes('document'))));
            }
            return typeof value === 'string' && 
              (value.toLowerCase().includes('user_document') || 
               (value.toLowerCase().includes('user') && value.toLowerCase().includes('document')));
          });
          
        if (needsDoc) {
          // Pre-select the first document for this value
          initialInputs[stepValue.id] = { document: sessionDocuments[0].id };
          console.log(`📌 Pre-selected document ${sessionDocuments[0].fileName} for value ${stepValue.valueName}`);
        }
      });
    }
    
    return initialInputs;
  });

  // Calculate total field count
  const getTotalFieldCount = () => {
    let count = 0;
    stepValues.forEach(sv => {
      if (sv.fields && Array.isArray(sv.fields)) {
        count += sv.fields.length;
      } else {
        count += 1;
      }
    });
    return count;
  };

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
    const totalFields = getTotalFieldCount();
    if (selectedFields.size === totalFields) {
      setSelectedFields(new Set());
    } else {
      const allFields = new Set<string>();
      stepValues.forEach(sv => {
        if (sv.fields && Array.isArray(sv.fields)) {
          sv.fields.forEach((field: any, index: number) => {
            allFields.add(`${sv.id}:${index}`);
          });
        } else {
          allFields.add(sv.id);
        }
      });
      setSelectedFields(allFields);
    }
  };

  const handleExtract = () => {
    console.log('🚀 EXTRACT BUTTON CLICKED');
    console.log('📋 Selected fields:', Array.from(selectedFields));
    console.log('📋 Field inputs (including document selections):', fieldInputs);
    
    if (selectedFields.size > 0) {
      onExtract(Array.from(selectedFields), fieldInputs);
    }
  };

  const handleInputChange = (fieldId: string, inputKey: string, value: any) => {
    console.log(`📝 User selected ${inputKey} for ${fieldId}:`, value);
    
    if (inputKey === 'documents' && Array.isArray(value)) {
      const selectedDocs = sessionDocuments?.filter(d => value.includes(d.id)) || [];
      console.log(`📄 Selected documents:`, selectedDocs.map(d => ({
        id: d.id,
        fileName: d.fileName,
        hasContent: !!d.extractedContent,
        contentLength: d.extractedContent?.length || 0
      })));
    }
    
    setFieldInputs(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [inputKey]: value
      }
    }));
  };

  return (
    <div className="relative">
      {/* Loading overlay during extraction */}
      {isExtracting && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-lg min-h-[400px]">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#4F63A4]" />
            <p className="text-base font-medium text-gray-700 dark:text-gray-300 mt-4">Extracting data...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mt-1">
              Please wait while we process your selected fields
            </p>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="text-xs"
            disabled={isExtracting}
          >
            {selectedFields.size === getTotalFieldCount() ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-gray-500">
            {selectedFields.size} of {getTotalFieldCount()} selected
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

          // Check if this is a multi-field value
          if (stepValue.fields && Array.isArray(stepValue.fields) && stepValue.fields.length > 0) {
            // Render multi-field value with individual field checkboxes and shared document selection
            const anyFieldSelected = stepValue.fields.some((field: any, index: number) => {
              const fieldId = `${stepValue.id}:${index}`;
              return selectedFields.has(fieldId);
            });
            
            return (
              <div key={stepValue.id} className="space-y-2">
                {/* Group header with shared document selection */}
                <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800">
                  <div className="font-medium text-sm mb-2">{stepValue.valueName}</div>
                  
                  {/* Multi-select document selection for all fields in this value */}
                  {needsDocumentSelection && (
                    <div className="mt-3">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">
                        Document Source:
                      </Label>
                      <div className="mt-1">
                        <MultiSelectSessionDocument
                          value={fieldInputs[stepValue.id]?.documents || []}
                          onChange={(docs) => handleInputChange(stepValue.id, 'documents', docs)}
                          placeholder="Select documents..."
                          sessionDocuments={sessionDocuments || []}
                          disabled={!anyFieldSelected}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Individual field checkboxes */}
                <div className="space-y-1 ml-4">
                  {stepValue.fields.map((field: any, index: number) => {
                    const fieldId = `${stepValue.id}:${index}`;
                    return (
                      <div key={fieldId} className="flex items-start space-x-3 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <Checkbox
                          checked={selectedFields.has(fieldId)}
                          onCheckedChange={(checked) => handleFieldSelection(fieldId, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {field.name}
                          </div>
                          {field.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {field.description}
                            </div>
                          )}
                          {field.dataType && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Type: {field.dataType}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            // Render single-field value
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

                  {/* Show multi-select document selection if needed */}
                  {needsDocumentSelection && (
                    <div className="mt-3">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">
                        Document Source:
                      </Label>
                      <div className="mt-1">
                        <MultiSelectSessionDocument
                          value={fieldInputs[stepValue.id]?.documents || []}
                          onChange={(docs) => handleInputChange(stepValue.id, 'documents', docs)}
                          placeholder="Select documents..."
                          sessionDocuments={sessionDocuments || []}
                          disabled={!selectedFields.has(stepValue.id)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
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
    </div>
  );
};

// Helper to render AI reasoning with bold field names
function formatReasoningWithBoldFields(text: string): JSX.Element[] {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Match pattern "FieldName: value" or "--- Section ---"
    const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
    const sectionMatch = line.match(/^---\s*(.+?)\s*---$/);
    
    if (sectionMatch) {
      return (
        <div key={idx} className="font-semibold text-gray-600 dark:text-gray-400 mt-2 mb-1">
          --- {sectionMatch[1]} ---
        </div>
      );
    } else if (fieldMatch) {
      return (
        <div key={idx}>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{fieldMatch[1]}:</span>
          <span className="text-gray-600 dark:text-gray-400"> {fieldMatch[2]}</span>
        </div>
      );
    }
    return <div key={idx}>{line || '\u00A0'}</div>;
  });
}

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
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-3 bg-white border-2 border-[#4F63A4] text-blue-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 max-w-[400px] shadow-lg">
          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
            <div className={`w-2 h-2 rounded-full ${validation?.confidenceScore >= 80 ? 'bg-green-500' : validation?.confidenceScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-semibold">Analysis</span>
          </div>
          <div className="whitespace-pre-line leading-relaxed">
            {reasoning && (
              <div className="mb-2">{reasoning}</div>
            )}
            {validation?.confidenceScore && (
              <div className="mb-2 font-medium">Confidence: {Math.round(validation.confidenceScore)}%</div>
            )}
            <div className="text-xs text-blue-700 dark:text-blue-300">Click icon to {validation?.validationStatus === 'valid' ? 'mark as pending' : 'validate'}</div>
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

// Flatten step values into individual columns — supports multi-field values where each field = column
// For values with fields[] → each field becomes a separate column
// For values without fields → value itself is a column (backward compat)
interface FlatColumn {
  id: string;           // Unique column ID: `${valueId}_field_${idx}` for multi-field, `value.id` for legacy
  valueName: string;    // Display name for column header
  dataType: string;     // TEXT, NUMBER, DATE, etc.
  color?: string;       // Column indicator color
  orderIndex: number;   // Sequential order across all flattened columns
  toolId?: string;      // Parent value's tool (for extraction)
  inputValues?: any;    // Parent value's input config (for extraction)
  description?: string; // Field-level or value-level description
  isIdentifier: boolean; // True for the first column overall
  valueId: string;      // Parent value ID (for grouping during extraction)
  fieldIndex?: number;  // Index within parent value's fields (multi-field only)
  isMultiField: boolean; // Flag: came from a multi-field value
  choiceOptions?: any;  // For dropdown tools
  autoVerificationConfidence?: number;
  valueOrder?: number;  // Parent value's order index
}

const flattenStepValuesToColumns = (values: any[]): FlatColumn[] => {
  if (!values || values.length === 0) return [];

  const columns: FlatColumn[] = [];
  let globalOrderIndex = 0;

  // Sort values by orderIndex first
  const sortedValues = [...values].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  sortedValues.forEach((value: any) => {
    if (value.fields && value.fields.length > 0) {
      // Multi-field value: each field becomes a separate column
      value.fields.forEach((field: any, fieldIdx: number) => {
        columns.push({
          id: `${value.id}_field_${fieldIdx}`,
          valueName: field.name || `Field ${fieldIdx + 1}`,
          dataType: field.dataType || 'TEXT',
          color: field.color || value.color,
          orderIndex: globalOrderIndex++,
          toolId: value.toolId,
          inputValues: {
            ...(value.inputValues || {}),
            _outputColumn: field.outputColumn || (value.inputValues as any)?._outputColumn || ''
          },
          description: field.description || value.description,
          isIdentifier: columns.length === 0, // First column overall is identifier
          valueId: value.id,
          fieldIndex: fieldIdx,
          isMultiField: true,
          choiceOptions: value.choiceOptions,
          autoVerificationConfidence: value.autoVerificationConfidence,
          valueOrder: value.orderIndex
        });
      });
    } else {
      // Legacy single-field value: value itself is the column
      columns.push({
        id: value.id,
        valueName: value.valueName,
        dataType: value.dataType || 'TEXT',
        color: value.color,
        orderIndex: globalOrderIndex++,
        toolId: value.toolId,
        inputValues: value.inputValues,
        description: value.description,
        isIdentifier: columns.length === 0 || value.isIdentifier || false,
        valueId: value.id,
        isMultiField: false,
        choiceOptions: value.choiceOptions,
        autoVerificationConfidence: value.autoVerificationConfidence,
        valueOrder: value.orderIndex
      });
    }
  });

  return columns;
};

// Helper function to convert workflowSteps to collections-like structure for backward compatibility
const convertStepsToCollections = (workflowSteps: any[]) => {
  if (!workflowSteps) return [];

  // Filter for list-type steps (data tables)
  return workflowSteps
    .filter(step => step.stepType === 'list')
    .map(step => {
      const flatColumns = flattenStepValuesToColumns(step.values || []);
      return {
        id: step.id,
        collectionName: step.stepName,
        description: step.description,
        properties: flatColumns.map(col => ({
          id: col.id,
          propertyName: col.valueName,
          propertyType: col.dataType,
          description: col.description,
          isIdentifier: col.isIdentifier,
          orderIndex: col.orderIndex,
          choiceOptions: col.choiceOptions,
          functionId: col.toolId,
          autoVerificationConfidence: col.autoVerificationConfidence,
          color: col.color,
          valueId: col.valueId,
          fieldIndex: col.fieldIndex,
          isMultiField: col.isMultiField
        }))
      };
    });
};

export default function SessionView() {
  const { sessionId } = useParams(); // Remove projectId from params - we'll get it from session data
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingTableField, setEditingTableField] = useState<string | null>(null);
  const [editTableValue, setEditTableValue] = useState("");
  const [dropdownOptionsCache, setDropdownOptionsCache] = useState<Record<string, string[]>>({});
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<PanelTab | null>(null);
  const [openTaskCardId, setOpenTaskCardId] = useState<string | null>(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isSessionInfoCollapsed, setIsSessionInfoCollapsed] = useState(false);
  const navPanelRef = useRef<ImperativePanelHandle>(null);
  const sessionInfoPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const [sessionNameValue, setSessionNameValue] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
  const [editingDisplayNames, setEditingDisplayNames] = useState<Record<string, boolean>>({});
  const [extractingToolId, setExtractingToolId] = useState<string | null>(null);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [currentToolGroup, setCurrentToolGroup] = useState<{toolId: string, stepValues: any[]} | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('documents');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
  
  // Session linking modal state (triggered after document upload)
  const [sessionLinkingModalOpen, setSessionLinkingModalOpen] = useState(false);
  
  
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
    isFirstColumn?: boolean; // Add flag to indicate if this is the first column
    extractionError?: {
      message: string;
      inputJson: string;
      outputJson: string;
    };
  } | null>(null);
  const [isColumnExtracting, setIsColumnExtracting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tool display modal state (generic - supports table, map, etc based on tool's displayConfig)
  const [toolDisplayModal, setToolDisplayModal] = useState<{
    isOpen: boolean;
    validation: FieldValidation | null;
    column: any;
    rowIdentifierId: string | null;
    datasourceData: any[];
    columnMappings: Record<string, string>;
    filters: Array<{column: string; operator: string; inputField: string; fuzziness: number}>;
    outputColumn: string;
    currentInputValues: Record<string, string>;
    fieldName: string;
    collectionName: string;
    recordIndex: number;
    displayConfig: ToolDisplayConfig;
    categoryColumn?: string;
    categoryFilterByValue?: string;
    siblingColumns?: FlatColumn[];
  } | null>(null);

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
  const fetchDropdownOptions = async (toolId: string, valueInputs?: Record<string, any>) => {
    const cacheKey = valueInputs?._dropdownDataSourceId 
      ? `${toolId}_${valueInputs._dropdownDataSourceId}_${valueInputs._dropdownColumn}` 
      : toolId;
    if (dropdownOptionsCache[cacheKey]) return;
    const tool = toolsMap.get(toolId);
    if (!tool || tool.toolType !== 'DATASOURCE_DROPDOWN') return;
    const dsId = valueInputs?._dropdownDataSourceId || tool.dataSourceId || tool.data_source_id;
    const col = valueInputs?._dropdownColumn || (tool.metadata || {}).dropdownColumn;
    if (!dsId || !col) return;
    try {
      const data = await apiRequest(`/api/data-sources/${dsId}/data`);
      if (Array.isArray(data)) {
        const uniqueValues = [...new Set(data.map((row: any) => String(row[col] || '')).filter(Boolean))].sort();
        setDropdownOptionsCache(prev => ({ ...prev, [cacheKey]: uniqueValues }));
      }
    } catch (err) {
      console.error('Failed to fetch dropdown options:', err);
    }
  };

  const handleSaveDropdownValue = async (value: string) => {
    if (!editingTableField) return;
    const validation = validations.find(v => {
      const fk = `${v.collectionName}.${v.fieldName}[${v.recordIndex}]`;
      return fk === editingTableField;
    });
    const match = editingTableField.match(/^(.+)\.([^.]+)\[(\d+)\]$/);
    if (!match) return;
    const [, collectionName, fieldName, indexStr] = match;
    const recordIndex = parseInt(indexStr);
    setEditingTableField(null);
    setEditTableValue("");
    setDropdownFilter("");
    if (validation) {
      await handleSaveFieldEdit(validation.id, value, 'valid');
    } else {
      const workflowStep = project?.workflowSteps?.find(step =>
        ((step.stepType === 'data_table' || step.stepType === 'list') && step.collectionName === collectionName) ||
        ((step.stepType === 'data_table' || step.stepType === 'list') && step.stepName === collectionName)
      );
      // Use flattened columns to support multi-field values
      const flatColumns = flattenStepValuesToColumns(workflowStep?.values || []);
      const matchedColumn = flatColumns.find(col => col.valueName === fieldName);
      const fieldId = matchedColumn?.id;
      if (fieldId && sessionId) {
        try {
          await apiRequest('/api/field-validations', {
            method: 'POST',
            body: JSON.stringify({
              sessionId: parseInt(sessionId),
              fieldId,
              valueId: matchedColumn?.valueId || fieldId,
              collectionName,
              fieldName,
              recordIndex,
              extractedValue: value,
              status: 'valid',
              validationType: 'manual'
            })
          });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'field-validations'] });
        } catch (err) {
          console.error('Failed to save dropdown value:', err);
        }
      }
    }
  };

  const handleEditTableField = (validation: FieldValidation) => {
    const fieldKey = `${validation.collectionName}.${validation.fieldName}[${validation.recordIndex}]`;
    console.log('handleEditTableField called with:', {
      fieldKey,
      validation,
      extractedValue: validation.extractedValue
    });
    setEditingTableField(fieldKey);
    setDropdownFilter("");
    if (validation.extractedValue === null || validation.extractedValue === undefined) {
      setEditTableValue("");
    } else {
      setEditTableValue(validation.extractedValue || "");
    }
  };

  // Handler to save inline table field edit
  const handleSaveTableFieldEdit = async (newValue?: string) => {
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

    // Use provided value or fall back to editTableValue state
    const currentValue = newValue !== undefined ? newValue : editTableValue;

    console.log('Parsed field info:', { collectionName, fieldName, recordIndex });
    console.log('Edit value to save:', currentValue);

    // Clear editing state immediately for responsive UI
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
      
      // Flatten step values to columns (supports multi-field values where each field = column)
      const flatColumns = flattenStepValuesToColumns(workflowStep?.values || []);

      // Find the matching column by name
      const matchedColumn = flatColumns.find(col => col.valueName === fieldName);
      console.log('Found matched column:', matchedColumn);
      console.log('All flat columns for this table:', flatColumns.map(col => col.valueName));

      // Use the flat column ID as the field ID (composite for multi-field, value ID for legacy)
      const fieldId = matchedColumn?.id;

      if (fieldId && workflowStep) {
        console.log('Found field ID from flat column:', fieldId);
        // Find the identifierId from the first column (identifier column) of this row
        const firstColumn = flatColumns.length > 0 ? flatColumns[0] : null;
        let identifierId: string | null = null;

        if (firstColumn) {
          // Find the validation for the first column (identifier) of this row
          const identifierValidation = validations.find(v =>
            v.recordIndex === recordIndex &&
            v.collectionName === collectionName &&
            (v.fieldId === firstColumn.id || v.valueId === firstColumn.valueId || v.fieldId === firstColumn.valueId)
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
        
        // Get the data type from the matched column
        const dataType = matchedColumn?.dataType || 'text';

        const newValidation = {
          validationType: 'collection_property',
          dataType: dataType,
          fieldId: fieldId,
          valueId: matchedColumn?.valueId || fieldId, // Use parent value ID for multi-field, field ID for legacy
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

  // Mark session as viewed when it's loaded
  useEffect(() => {
    if (session && sessionId && !(session as any).isViewed) {
      apiRequest(`/api/sessions/${sessionId}/mark-viewed`, { method: 'POST' })
        .catch((err: Error) => console.error('Failed to mark session as viewed:', err));
    }
  }, [session, sessionId]);

  // Escape key closes document preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewDocumentId) {
        setPreviewDocumentId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDocumentId]);

  // Then get the project using projectId from session data
  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`),
    enabled: !!projectId // Only run this query when we have a projectId
  });

  // Get project tools (Excel Wizardry Functions) to identify DATABASE_LOOKUP tools
  const { data: projectTools = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'excel-functions'],
    queryFn: () => apiRequest(`/api/projects/${projectId}/excel-functions`),
    enabled: !!projectId
  });

  // Create a map of toolId to tool info for quick lookup
  const toolsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (projectTools && Array.isArray(projectTools)) {
      projectTools.forEach(tool => {
        map.set(tool.id, tool);
      });
    }
    return map;
  }, [projectTools]);

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
    refetchInterval: (query) => {
      const docs = query.state.data as any[];
      const expectedCount = session?.documentCount || 0;
      if (expectedCount > 0 && (!docs || docs.length < expectedCount)) {
        return 3000;
      }
      if (session?.source === 'email') {
        if (!docs || docs.length === 0) {
          return 3000;
        }
        const sessionAge = session?.createdAt ? Date.now() - new Date(session.createdAt).getTime() : Infinity;
        if (sessionAge < 2 * 60 * 1000) {
          return 5000;
        }
      }
      return false;
    },
  });

  // Derive the document being previewed
  const previewDocument = previewDocumentId
    ? (sessionDocuments as any[]).find((doc: any) => doc.id === previewDocumentId)
    : null;

  const { data: sourceEmail } = useQuery<{ subject: string | null; fromEmail: string | null; emailBody: string | null; receivedAt: string | null }>({
    queryKey: ['/api/sessions', sessionId, 'source-email'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/source-email`).catch(() => null),
    enabled: !!sessionId,
    retry: false,
    staleTime: 0,
  });

  // Log session documents when they change
  useEffect(() => {
    if (sessionDocuments && sessionDocuments.length > 0) {
      console.log('📚 Session documents loaded:', sessionDocuments.length, 'documents');
      sessionDocuments.forEach((doc, index) => {
        console.log(`📄 Document ${index + 1}:`, {
          id: doc.id,
          fileName: doc.fileName || doc.documentName,
          hasExtractedContent: !!doc.extractedContent,
          extractedContentLength: doc.extractedContent?.length || 0,
          first100Chars: doc.extractedContent?.substring(0, 100) || 'NO CONTENT',
          allProperties: Object.keys(doc)
        });
      });
    }
  }, [sessionDocuments]);

  // Fetch project-level validations for statistics cards
  const { data: projectValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', projectId],
    enabled: !!projectId
  });

  const ctaKanbanStep = useMemo(() => {
    if (!project || !session) return null;
    const statusOptions = (project as any).workflowStatusOptions || [];
    const currentStatus = (session as any)?.workflowStatus || (project as any).defaultWorkflowStatus || statusOptions[0] || '';
    const currentIndex = statusOptions.indexOf(currentStatus);
    const nextIndex = currentIndex + 1;
    const step = project?.workflowSteps?.find((s: any) => {
      const ac = s.actionConfig;
      return ac?.actionStatus && statusOptions.indexOf(ac.actionStatus) === nextIndex;
    });
    return step?.stepType === 'kanban' ? step : null;
  }, [project, session]);

  const { data: ctaKanbanCards = [] } = useQuery<any[]>({
    queryKey: [`/api/sessions/${sessionId}/steps/${ctaKanbanStep?.id}/kanban-cards`],
    enabled: !!sessionId && !!ctaKanbanStep?.id
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

  // Panel open/close helpers
  const openCATPanel = (tab: PanelTab) => {
    setActivePanelTab(tab);
    // Right panel auto-expands via the useEffect below
  };

  const openDocPreview = (docId: string) => {
    setPreviewDocumentId(docId);
    // Right panel auto-expands via the useEffect below
  };

  const expandNav = () => {
    navPanelRef.current?.expand();
  };

  // Auto-collapse/expand right panel based on content state
  useEffect(() => {
    if (!activePanelTab && !previewDocumentId) {
      rightPanelRef.current?.collapse();
    } else if (rightPanelRef.current?.isCollapsed()) {
      rightPanelRef.current?.expand();
    }
  }, [activePanelTab, previewDocumentId]);

  // Refresh session data and check for new emails
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Check for new emails if the project has an inbox
      if (project?.inboxEmailAddress) {
        try {
          const emailResult = await apiRequest(`/api/projects/${projectId}/inbox/process`, { method: "POST" });
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
      
      // Refresh all session-related data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'documents'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] }),
      ]);
      
      toast({
        title: "Refreshed",
        description: "Session data has been updated",
      });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh session data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
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
      if (previewDocumentId === documentId) setPreviewDocumentId(null);
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const processDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/sessions/documents/${documentId}/process`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'documents'] });
      toast({ title: "Document processed", description: "Content has been extracted successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Processing failed", description: error.message || "Could not extract content from this document.", variant: "destructive" });
    }
  });

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
    console.log('🎯🎯🎯 handleRunColumnExtraction called with:');
    console.log('   - stepName:', stepName);
    console.log('   - valueId:', valueId);
    console.log('   - valueName:', valueName);
    
    // Force refresh project data to get latest value IDs
    await queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    await queryClient.refetchQueries({ queryKey: ['/api/projects', projectId] });
    
    // Get the workflow step with fresh data
    const freshProject = queryClient.getQueryData(['/api/projects', projectId]) as ProjectWithDetails;
    const workflowStep = freshProject?.workflowSteps?.find(step => step.stepName === stepName);
    if (!workflowStep) {
      console.error('Workflow step not found:', stepName);
      return;
    }
    console.log('   - Found workflow step:', workflowStep.id, workflowStep.stepName);
    
    // Get the specific value to run - try by ID first, then by name
    console.log('   - Workflow step values:', workflowStep.values?.map(v => ({ id: v.id, name: v.valueName })));
    let valueToRun = workflowStep.values?.find(v => v.id === valueId);
    
    // If not found by ID (stale ID), find by name instead
    if (!valueToRun) {
      console.log(`   ⚠️ Value not found by ID: ${valueId}, trying by name: ${valueName}`);
      valueToRun = workflowStep.values?.find(v => v.valueName === valueName);
      if (valueToRun) {
        console.log(`   ✅ Found value by name, actual ID is: ${valueToRun.id}`);
        // Use the correct ID from the fresh data
        valueId = valueToRun.id;
      }
    }
    
    if (!valueToRun) {
      console.error('Value not found by ID or name:', valueId, valueName);
      console.error('Available values:', workflowStep.values?.map(v => ({ id: v.id, name: v.valueName })));
      return;
    }
    console.log('   - Found value to run:', valueToRun.id, valueToRun.valueName);
    
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
    
    // SIMPLIFIED APPROACH: For any column in a datatable step, automatically fetch all validations 
    // from preceding columns in the same step
    let previousColumnsData: any[] = [];
    
    // Get the current value's order index
    const currentValueIndex = valueToRun.orderIndex || 0;
    console.log(`📊 Current column "${valueName}" is at index ${currentValueIndex}`);
    
    // Get all preceding values in this step (columns that come before this one)
    const precedingValues = workflowStep.values
      ?.filter(v => (v.orderIndex || 0) < currentValueIndex)
      ?.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) || [];
    
    console.log(`📊 Found ${precedingValues.length} preceding columns:`, precedingValues.map(v => v.valueName));
    
    // If there are preceding columns, fetch their validations
    if (precedingValues.length > 0 && workflowStep) {
      console.log(`🔄 Fetching validations for preceding columns in step "${stepName}"`);
      
      // Get all validations for this step
      const stepValidations = validations.filter(v => 
        v.stepId === workflowStep.id || 
        v.collectionName === stepName
      );
      
      console.log(`📊 Found ${stepValidations.length} total validations for step`);
      
      // Group validations by identifierId
      const recordsByIdentifier = new Map<string, any>();
      
      // Get unique identifier IDs
      const uniqueIdentifierIds = [...new Set(stepValidations
        .map(v => v.identifierId)
        .filter(id => id !== null && id !== undefined)
      )];
      
      console.log(`📊 Found ${uniqueIdentifierIds.length} unique records`);
      
      // Build records with data from preceding columns only
      uniqueIdentifierIds.forEach(identifierId => {
        const record: any = { identifierId };
        
        // Add data from each preceding column
        precedingValues.forEach(precedingValue => {
          // Find validation for this identifier and column
          const validation = stepValidations.find(v => 
            v.identifierId === identifierId && 
            v.fieldId === precedingValue.id
          );
          
          if (validation && validation.extractedValue) {
            // Use the column name as the key
            record[precedingValue.valueName] = validation.extractedValue;
          }
        });
        
        // Only add records that have at least one value besides identifierId
        if (Object.keys(record).length > 1) {
          recordsByIdentifier.set(identifierId, record);
        }
      });
      
      previousColumnsData = Array.from(recordsByIdentifier.values());
      console.log(`✅ Compiled ${previousColumnsData.length} records with data from ${precedingValues.length} preceding columns`);
      
      if (previousColumnsData.length > 0) {
        console.log('📊 Sample record:', previousColumnsData[0]);
      }
    } else {
      console.log(`ℹ️ This is the first column in the step - no previous data needed`);
    }
    
    // Check if this value has references to other values (stored as value IDs) for cross-step references
    const referencedValueIds = new Set<string>();
    if (hasColumnReferences && valueToRun.inputValues) {
      console.log(`🔍 Checking for cross-step value ID references in ${valueName}'s inputValues`);
      Object.values(valueToRun.inputValues).forEach(value => {
        if (typeof value === 'string') {
          // Check if it's a UUID (value ID)
          if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            referencedValueIds.add(value);
            console.log(`  - References value ID from another step: "${value}"`);
          }
        } else if (Array.isArray(value)) {
          value.forEach(v => {
            if (typeof v === 'string' && v.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              referencedValueIds.add(v);
              console.log(`  - References value ID from another step: "${v}"`);
            }
          });
        }
      });
      console.log(`🔍 Found ${referencedValueIds.size} cross-step value ID references`);
    }
    
    // If we have cross-step referenced value IDs, handle them separately
    if (referencedValueIds.size > 0) {
      console.log(`📊 Found ${referencedValueIds.size} cross-step value ID references - handling cross-step data`);
      
      // Get all validations that match the referenced value IDs
      const allReferencedValidations = validations.filter(v => {
        // Must have an identifierId
        if (!v.identifierId) return false;
        
        // Check if this validation's valueId is in our referenced value IDs
        return referencedValueIds.has(v.valueId || '');
      });
      
      // Build cross-step data if needed
      if (allReferencedValidations.length > 0) {
        const crossStepRecords = new Map<string, any>();
        
        allReferencedValidations.forEach(v => {
          if (v.identifierId) {
            if (!crossStepRecords.has(v.identifierId)) {
              crossStepRecords.set(v.identifierId, {
                identifierId: v.identifierId
              });
            }
            
            // Find the value name from the project configuration
            const referencedStepValue = project?.workflowSteps?.flatMap(s => s.values || [])
              .find(val => val.id === v.valueId);
            
            if (referencedStepValue && v.extractedValue) {
              crossStepRecords.get(v.identifierId)[referencedStepValue.valueName] = v.extractedValue;
            }
          }
        });
        
        // Merge cross-step data with existing previousColumnsData
        const mergedData = previousColumnsData.map(record => {
          const crossStepData = crossStepRecords.get(record.identifierId);
          if (crossStepData) {
            return { ...record, ...crossStepData };
          }
          return record;
        });
        
        previousColumnsData = mergedData;
        console.log(`📊 Merged cross-step data into ${previousColumnsData.length} records`);
      }
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
    
    // Infer operation type from step context (matches server-side inference)
    const isIdentifierValue = valueToRun.isIdentifier === true || 
      (valueToRun.orderIndex === 0 && workflowStep?.stepType === 'data_table');
    
    let inferredOperationType: string;
    if (workflowStep?.stepType === 'info_page' || workflowStep?.stepType === 'kanban') {
      inferredOperationType = 'updateSingle';
    } else if (isIdentifierValue) {
      inferredOperationType = 'createMultiple';
    } else {
      inferredOperationType = 'updateMultiple';
    }
    console.log(`🔄 Client-side inferred operationType: ${inferredOperationType} (stepType: ${workflowStep?.stepType}, isIdentifier: ${isIdentifierValue})`);
    
    // 🎯 CRITICAL FIX: For UPDATE operations, include existing validation data for this specific column
    if (inferredOperationType === 'updateMultiple' && previousColumnsData.length === 0) {
      console.log(`🔄 UPDATE operation detected with no previous data - fetching existing validation records for column "${valueName}"`);
      
      // Get existing validation records for this specific column
      const currentColumnValidations = validations.filter(v => 
        v.valueId === valueId || (v.fieldId === valueId && v.collectionName === stepName)
      );
      
      console.log(`📊 Found ${currentColumnValidations.length} existing validation records for column "${valueName}"`);
      
      if (currentColumnValidations.length > 0) {
        // Group by identifierId to get unique records
        const existingRecordsByIdentifier = new Map<string, any>();
        
        currentColumnValidations.forEach(validation => {
          if (validation.identifierId) {
            existingRecordsByIdentifier.set(validation.identifierId, {
              identifierId: validation.identifierId,
              [valueName]: validation.extractedValue || null // Include current value
            });
          }
        });
        
        previousColumnsData = Array.from(existingRecordsByIdentifier.values());
        console.log(`✅ Added ${previousColumnsData.length} existing records for UPDATE operation`);
        console.log(`📋 Sample existing record:`, previousColumnsData[0]);
      }
    }
    
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
    
    // Check how many records have already been validated for this specific value
    // Get all identifierIds that already have valid/verified validations
    const validatedIdentifierIds = new Set(
      validations
        .filter(v => 
          v.fieldId === valueId && 
          v.collectionName === stepName &&
          (v.validationStatus === 'valid' || v.validationStatus === 'verified')
        )
        .map(v => v.identifierId)
        .filter(id => id !== null) as string[]
    );
    
    const extractedCount = validatedIdentifierIds.size;
    
    console.log(`🔢 Found ${extractedCount} validated records for value: ${valueName} in collection: ${stepName}`);
    console.log(`📊 Total available records: ${previousColumnsData.length}`);
    
    // Filter out records that already have validated validations
    const remainingData = previousColumnsData.filter(record => 
      !validatedIdentifierIds.has(record.identifierId)
    );
    
    console.log(`📊 Remaining unvalidated records to extract: ${remainingData.length}`);
    console.log(`📊 Will extract records ${extractedCount + 1}-${Math.min(extractedCount + Math.min(remainingData.length, 50), previousColumnsData.length)} of ${previousColumnsData.length}`);
    
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
    let filteredRemainingData = remainingData;
    
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
      
      // Apply the same filtering to remainingData for display
      filteredRemainingData = remainingData.map(record => {
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
    
    // Build a map of field IDs to human-readable names for the referenced input data
    const referenceFieldNames: Record<string, string> = {};
    
    // If we have a tool ID, fetch it first to get parameter names
    if (valueToRun.toolId && valueToRun.inputValues) {
      try {
        // Fetch the tool configuration synchronously before opening modal
        const response = await fetch(`/api/excel-functions/${valueToRun.toolId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const tool = await response.json();
          
          // Map parameter IDs to their names and referenced values
          if (tool.inputParameters) {
            Object.entries(valueToRun.inputValues).forEach(([paramId, value]: [string, any]) => {
              if (!paramId.startsWith('knowledge_document')) {
                // Find the parameter definition
                const param = tool.inputParameters.find((p: any) => p.id === paramId);
                
                if (param) {
                  // Build a descriptive name based on the parameter and its value
                  let displayName = param.name;
                  
                  // If the value is an array of IDs, find what they reference
                  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
                    const firstId = value[0];
                    
                    // Search through all workflow steps to find this value
                    for (const step of project?.workflowSteps || []) {
                      const foundValue = step.values?.find(v => v.id === firstId);
                      if (foundValue) {
                        displayName = `${step.stepName} → ${foundValue.valueName}`;
                        break;
                      }
                    }
                  } else if (typeof value === 'string' && value.includes('@')) {
                    // Parse @-notation references
                    const match = value.match(/@([^.]+)\.(.+)/);
                    if (match) {
                      displayName = `${match[1]} → ${match[2]}`;
                    }
                  }
                  
                  referenceFieldNames[paramId] = displayName;
                } else {
                  // Fallback - try to find the value name from workflowSteps
                  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
                    const firstId = value[0];
                    
                    for (const step of project?.workflowSteps || []) {
                      const foundValue = step.values?.find(v => v.id === firstId);
                      if (foundValue) {
                        referenceFieldNames[paramId] = `${step.stepName} → ${foundValue.valueName}`;
                        break;
                      }
                    }
                  }
                  
                  // If still no name, use the param ID
                  if (!referenceFieldNames[paramId]) {
                    referenceFieldNames[paramId] = paramId;
                  }
                }
              }
            });
          }
        } else {
          console.error('Failed to fetch tool:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching tool:', error);
      }
    }
    
    // If we still don't have names, provide fallback names based on inputValues structure
    if (valueToRun.inputValues && Object.keys(referenceFieldNames).length === 0) {
      Object.entries(valueToRun.inputValues).forEach(([key, value]: [string, any]) => {
        if (!key.startsWith('knowledge_document')) {
          // Try to find the value name from workflowSteps as a fallback
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
            const firstId = value[0];
            
            // Search through all workflow steps to find this value
            for (const step of project?.workflowSteps || []) {
              const foundValue = step.values?.find(v => v.id === firstId);
              if (foundValue) {
                referenceFieldNames[key] = `${step.stepName} → ${foundValue.valueName}`;
                break;
              }
            }
          }
          
          // If still no name, use the key
          if (!referenceFieldNames[key]) {
            referenceFieldNames[key] = key;
          }
        }
      });
    }
    
    // Open the extraction wizard modal with the value's tool configuration
    setColumnExtractionModal({
      isOpen: true,
      stepName: stepName,
      valueId: valueId,
      valueName: valueName,
      previousData: remainingData, // Send only remaining unvalidated records to batch properly
      displayData: filteredRemainingData, // Show filtered columns for remaining unvalidated records
      columnOrder: columnOrder, // Pass the column order
      needsDocument: needsDocument,
      toolType: 'extraction',
      toolDescription: valueToRun.description || '',
      toolId: valueToRun.toolId,
      toolOperationType: inferredOperationType, // Pass the inferred operation type
      inputValues: valueToRun.inputValues,
      knowledgeDocuments: referencedKnowledgeDocs,
      extractedCount: extractedCount,
      totalAvailable: previousColumnsData.length,
      isFirstColumn: isFirstColumn, // Pass the flag to indicate if this is the first column
      referenceFieldNames: referenceFieldNames // Pass the field names mapping
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
    
    // First, find the identifier validation for this row to get the identifierId
    const identifierValidation = validations.find(v => {
      // Match by collectionName and recordIndex for the identifier column
      if (v.collectionName === collectionName && v.recordIndex === recordIndex) {
        // Check if this is the identifier column (first column)
        const collection = collections?.find(c => c.collectionName === collectionName);
        const identifierProperty = collection?.properties?.find(p => p.isIdentifier);
        if (identifierProperty && v.fieldId === identifierProperty.id) {
          return true;
        }
      }
      
      // Fallback: check if fieldName indicates it's an identifier
      if (v.fieldName && v.fieldName.includes(`[${recordIndex}]`)) {
        const parts = v.fieldName.split('.');
        if (parts.length >= 2) {
          const fieldCollectionName = parts[0];
          const fieldNamePart = parts[1].split('[')[0];
          if (fieldCollectionName === collectionName) {
            const collection = collections?.find(c => c.collectionName === collectionName);
            const identifierProperty = collection?.properties?.find(p => p.isIdentifier);
            if (identifierProperty && identifierProperty.propertyName === fieldNamePart) {
              return true;
            }
          }
        }
      }
      
      return false;
    });

    if (!identifierValidation || !identifierValidation.identifierId) {
      console.warn(`No identifier validation found for ${collectionName}[${recordIndex}] - falling back to old method`);
      
      // Fallback to old method if no identifierId found
      const itemValidations = validations.filter(v => {
        if (v.collectionName === collectionName && v.recordIndex === recordIndex) {
          return true;
        }
        if (v.collectionName === null && v.fieldName && v.fieldName.includes(`[${recordIndex}]`)) {
          return v.fieldName.startsWith(`${collectionName}.`);
        }
        return false;
      });
      
      if (itemValidations.length > 0) {
        const deletePromises = itemValidations.map(validation => {
          console.log(`Deleting validation record: ${validation.id} (${validation.fieldName})`);
          return apiRequest(`/api/validations/${validation.id}`, {
            method: 'DELETE'
          });
        });
        await Promise.all(deletePromises);
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      return;
    }

    // Find ALL validations with the same identifierId (across all columns)
    const itemValidations = validations.filter(v => v.identifierId === identifierValidation.identifierId);

    console.log(`Found ${itemValidations.length} validations to delete for identifierId: ${identifierValidation.identifierId}`);

    if (itemValidations.length === 0) {
      console.warn(`No validations found for identifierId ${identifierValidation.identifierId} - nothing to delete`);
      return;
    }

    // Optimistic update: Remove items from cache by identifierId
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      if (!old) return old;
      return old.filter((v: any) => v.identifierId !== identifierValidation.identifierId);
    });
    
    try {
      // Delete all validation records for this identifierId
      const deletePromises = itemValidations.map(validation => {
        console.log(`Deleting validation record: ${validation.id} (${validation.fieldName})`);
        return apiRequest(`/api/validations/${validation.id}`, {
          method: 'DELETE'
        });
      });
      
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted ${itemValidations.length} validation records for identifierId: ${identifierValidation.identifierId}`);
      
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

  const handleDeleteNonValidatedData = async (collectionName: string) => {
    // Non-validated statuses that should be deleted: pending (all others have been consolidated)
    // Validated statuses that should NOT be deleted: valid, verified, manual
    const nonValidatedStatuses = ['pending'];
    
    // Find all non-validated field validations for this collection
    const nonValidatedValidations = validations.filter(v => {
      // First check if it belongs to this collection
      let belongsToCollection = false;
      if (v.collectionName === collectionName) {
        belongsToCollection = true;
      } else if (v.collectionName === null && v.fieldName && v.fieldName.startsWith(`${collectionName}.`)) {
        belongsToCollection = true;
      }
      
      // If it belongs to the collection, check if it's non-validated
      return belongsToCollection && nonValidatedStatuses.includes(v.validationStatus);
    });

    console.log(`Found ${nonValidatedValidations.length} non-validated validations to delete for ${collectionName}`);
    
    // Confirm before deleting non-validated data  
    if (!confirm(`Delete ${nonValidatedValidations.length} non-validated records from "${collectionName}"?\n\nThis will remove only pending data. Verified and manual entries will be preserved.\n\nThis action cannot be undone.`)) {
      return;
    }

    if (nonValidatedValidations.length === 0) {
      console.warn(`No non-validated validations found for ${collectionName} - nothing to delete`);
      return;
    }

    console.log(`Deleting ${nonValidatedValidations.length} non-validated validations from collection: ${collectionName}`);

    // Optimistic update: Remove non-validated items from cache for this collection
    queryClient.setQueryData(['/api/sessions', sessionId, 'validations'], (old: any) => {
      if (!old) return old;
      return old.filter((v: any) => {
        // Keep items that don't belong to this collection
        let belongsToCollection = false;
        if (v.collectionName === collectionName) {
          belongsToCollection = true;
        } else if (v.collectionName === null && v.fieldName && v.fieldName.startsWith(`${collectionName}.`)) {
          belongsToCollection = true;
        }
        
        // If it doesn't belong to this collection, keep it
        if (!belongsToCollection) {
          return true;
        }
        
        // If it belongs to this collection, only keep validated items
        return !nonValidatedStatuses.includes(v.validationStatus);
      });
    });
    
    try {
      // Delete all non-validated validation records for this collection
      const deletePromises = nonValidatedValidations.map(validation => {
        console.log(`Deleting non-validated record: ${validation.id} (${validation.fieldName}) - Status: ${validation.validationStatus}`);
        return apiRequest(`/api/validations/${validation.id}`, {
          method: 'DELETE'
        });
      });
      
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted ${nonValidatedValidations.length} non-validated validation records for ${collectionName}`);
      
      // Force complete cache refresh - remove the query data first, then invalidate
      queryClient.removeQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      // Also refresh the session data
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    } catch (error) {
      console.error('Error deleting non-validated collection data:', error);
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
          <RiveLoader width={300} height={300} />
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
      if (stepValue) return stepValue.id;

      // If no direct value match, check multi-field value fields
      // Multi-field values have fields with their own names that don't match the parent value name
      for (const v of workflowStep?.values || []) {
        if (v.fields) {
          const matchingField = v.fields.find((f: any) => f.name === valueName);
          if (matchingField) {
            return v.id; // Return parent value ID (valid UUID)
          }
        }
      }
      return undefined;
    }

    // Check if this is an InfoPage multi-field (has format "ValueName.FieldName")
    const infoPageMatch = fieldName.match(/^([^.]+)\.([^.]+)$/);
    if (infoPageMatch) {
      const valueName = infoPageMatch[1];

      // Find the InfoPage step value with this valueName
      for (const step of project?.workflowSteps || []) {
        if (step.stepType === 'infoPage') {
          const stepValue = step.values?.find(v => v.valueName === valueName);
          if (stepValue) {
            return stepValue.id;
          }
        }
      }
    }

    // This is a schema field - find by fieldName
    const schemaField = project?.schemaFields?.find(f => f.fieldName === fieldName);
    return schemaField?.id;
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
    // For data table cells: "CollectionName.ColumnName[index]" format with identifierId
    // We need to match by BOTH identifierId (row) AND valueId (column)
    if (fieldName.includes('[') && fieldName.includes(']')) {
      const valueId = getValueIdFromFieldName(fieldName);
      if (!valueId) return undefined;

      // Extract the column name for multi-field disambiguation
      // fieldName format: "StepName.ColumnName[recordIndex]"
      const columnNameMatch = fieldName.match(/^.+\.(.+)\[\d+\]$/);
      const columnName = columnNameMatch?.[1];

      // For data tables, match by both row ID and column ID
      if (identifierId) {
        // Priority 1: Match by identifierId + fieldName pattern (most reliable for multi-field)
        if (columnName) {
          const fieldNameMatch = validations.find(v =>
            v.identifierId === identifierId &&
            v.fieldName?.includes(`.${columnName}[`)
          );
          if (fieldNameMatch) return fieldNameMatch;
        }
        // Priority 2: Fallback to identifierId + valueId matching (for single-field values)
        return validations.find(v =>
          v.identifierId === identifierId &&
          (v.valueId === valueId || v.fieldId === valueId)
        );
      }
      // Fallback to valueId only if no identifierId
      return validations.find(v => (v.valueId === valueId || v.fieldId === valueId));
    }
    
    // Special handling for InfoPage multi-field values (format: "ValueName.FieldName")
    if (fieldName.includes('.') && identifierId && !fieldName.includes('[')) {
      // For InfoPage multi-fields, the identifierId is the field's UUID
      const validation = validations.find(v => 
        v.fieldId === identifierId || 
        v.identifierId === identifierId
      );
      return validation;
    }
    
    // Standard handling for other fields
    const valueId = getValueIdFromFieldName(fieldName);
    if (!valueId) return undefined;
    return getValidation(identifierId || null, valueId);
  };

  // Get session status based on field verification
  const getSessionStatus = () => {
    if (validations.length === 0) return 'in_progress';
    const total = getTotalFieldCount();
    const verified = getVerifiedCount();
    if (total === 0) return 'in_progress';
    return verified >= total ? 'verified' : 'in_progress';
  };

  // Get verification count helpers
  const getVerifiedCount = () => {
    return validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'manual').length;
  };

  const getTotalFieldCount = () => {
    let expectedCount = 0;
    if (project?.workflowSteps) {
      project.workflowSteps.forEach((step: any) => {
        if (step.stepType === 'infoPage' || step.stepType === 'info' || step.stepType === 'page') {
          if (step.values && Array.isArray(step.values)) {
            step.values.forEach((sv: any) => {
              if (sv.fields && Array.isArray(sv.fields) && sv.fields.length > 0) {
                expectedCount += sv.fields.length;
              } else {
                expectedCount += 1;
              }
            });
          }
        } else if (step.stepType === 'list') {
          const stepValidations = validations.filter(v => v.collectionName === step.stepName);
          expectedCount += stepValidations.length;
        }
      });
    }
    return Math.max(expectedCount, validations.length);
  };

  // Get verification progress
  const getVerificationProgress = () => {
    const verified = getVerifiedCount();
    const total = getTotalFieldCount();
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { verified, total, percentage };
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  const scrollToSection = (sectionName: string) => {
    setActiveTab(sectionName);
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.delete(sectionName);
      return next;
    });
    setTimeout(() => {
      sectionRefs.current[sectionName]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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

  // Get verification progress for a specific workflow step (for nav pane indicators)
  const getStepVerificationProgress = (step: { id: string; stepName: string; stepType: string; values?: any[] }) => {
    if (step.stepType === 'list' || step.stepType === 'data_table' || step.stepType === 'data') {
      // Match validations by collectionName, stepId, or fieldName prefix
      const stepValidations = validations.filter((v: any) =>
        v.collectionName === step.stepName ||
        v.stepId === step.id ||
        (v.fieldName && v.fieldName.startsWith(step.stepName + '.'))
      );
      const totalFields = stepValidations.length;
      const verifiedFields = stepValidations.filter((v: any) => v.validationStatus === 'valid' || v.validationStatus === 'manual').length;
      const percentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;
      return { verified: verifiedFields, total: totalFields, percentage };
    }

    if (step.stepType === 'page' || step.stepType === 'info' || step.stepType === 'infoPage') {
      const stepValues = step.values || [];
      let total = 0;
      let verified = 0;

      for (const sv of stepValues) {
        const fields = sv.fields && Array.isArray(sv.fields) ? sv.fields : [];
        if (fields.length > 0) {
          for (const f of fields) {
            total++;
            const fv = validations.find((v: any) =>
              v.identifierId === f.identifierId ||
              v.valueId === f.identifierId ||
              v.fieldId === f.identifierId
            );
            if (fv && (fv.validationStatus === 'valid' || fv.validationStatus === 'manual')) {
              verified++;
            }
          }
        } else {
          total++;
          const vv = validations.find((v: any) =>
            v.valueId === sv.id || v.fieldId === sv.id || v.identifierId === sv.id
          );
          if (vv && (vv.validationStatus === 'valid' || vv.validationStatus === 'manual')) {
            verified++;
          }
        }
      }

      const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
      return { verified, total, percentage };
    }

    return { verified: 0, total: 0, percentage: 0 };
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
    
    // Get step ID from any value in the group
    const stepId = currentToolGroup.stepValues[0]?.stepId;
    
    // Process selected fields - handle both single and multi-field selections
    const fieldsToExtract: any[] = [];
    
    selectedFieldIds.forEach(fieldId => {
      // Check if this is a multi-field selection (format: valueId:fieldIndex)
      if (fieldId.includes(':')) {
        const [valueId, fieldIndexStr] = fieldId.split(':');
        const fieldIndex = parseInt(fieldIndexStr);
        const stepValue = currentToolGroup.stepValues.find(v => v.id === valueId);
        
        if (stepValue && stepValue.fields && stepValue.fields[fieldIndex]) {
          // Add the specific field from the multi-field value
          fieldsToExtract.push({
            ...stepValue,
            fieldToExtract: stepValue.fields[fieldIndex],
            fieldIndex: fieldIndex,
            selectedFieldId: fieldId
          });
        }
      } else {
        // Single field value
        const stepValue = currentToolGroup.stepValues.find(v => v.id === fieldId);
        if (stepValue) {
          fieldsToExtract.push({
            ...stepValue,
            selectedFieldId: fieldId
          });
        }
      }
    });
    
    console.log(`\nSelected ${fieldsToExtract.length} fields for extraction:`);
    
    // Log each selected value object
    fieldsToExtract.forEach((item, index) => {
      console.log(`\n--- Selected Field ${index + 1} ---`);
      console.log('Full stepValue object:', item);
      console.log('ID:', item.id);
      console.log('Name:', item.valueName);
      
      if (item.fieldToExtract) {
        console.log('Specific field to extract:', item.fieldToExtract);
        console.log('Field index:', item.fieldIndex);
      }
      
      console.log('Description:', item.description);
      console.log('Data Type:', item.dataType);
      console.log('Tool ID:', item.toolId);
      console.log('Original inputValues:', item.inputValues);
      console.log('Custom inputs from modal:', fieldInputs[item.selectedFieldId]);
      
      // Get user-selected document for this field
      const userSelectedDoc = fieldInputs[item.selectedFieldId]?.document;
      let documentId = userSelectedDoc;
      
      if (!documentId) {
        // Fall back to primary or first document
        const primaryDoc = sessionDocuments?.find(d => d.isPrimary) || sessionDocuments?.[0];
        documentId = primaryDoc?.id;
      }
      
      console.log('Document ID to use:', documentId);
      console.log('Would extract with params:', {
        stepId,
        valueId: item.id,
        fieldToExtract: item.fieldToExtract,
        documentId,
        customInputs: fieldInputs[item.selectedFieldId]
      });
    });
    
    // Don't close modal yet - keep it open to show loading state
    // setShowFieldSelectionModal(false); // REMOVED - close only after extraction completes
    setExtractingToolId(currentToolGroup.toolId);
    
    try {
      // COPY EXACT SAME APPROACH AS DATA TABLE EXTRACTION
      // Just pass the documentId and let the backend retrieve the content
      
      console.log('📋 Field inputs from modal:', fieldInputs);
      console.log('🔍 Fields to extract:', fieldsToExtract.length);
      
      // Group fields by value ID for multi-field extraction
      const fieldsByValue = new Map<string, any>();
      fieldsToExtract.forEach(field => {
        const valueId = field.id; // The stepValue's id is the value ID
        // Only add each value once, not multiple times for multi-field values
        if (!fieldsByValue.has(valueId)) {
          fieldsByValue.set(valueId, field);
        }
      });

      // Detect if this is a data table step
      const workflowStep = project?.workflowSteps?.find(s => s.id === stepId);
      const isDataTable = workflowStep?.stepType === 'list';

      if (isDataTable) {
        // Data table multi-field: route through /extract-column which handles
        // identifierID chain, previousData building, and __dataTableFields
        console.log(`📊 Data table detected (stepType=${workflowStep?.stepType}) - routing through /extract-column`);

        for (const [valueId, value] of fieldsByValue) {
          console.log(`🎯 Processing data table value ${valueId}: ${value.valueName}`);

          // Get document IDs for this value
          let valueDocumentIds: string[] = [];
          if (fieldInputs[valueId]?.documents && Array.isArray(fieldInputs[valueId].documents)) {
            valueDocumentIds = fieldInputs[valueId].documents;
            console.log(`✅ Using ${valueDocumentIds.length} documents for value ${valueId}`);
          } else if (fieldInputs[valueId]?.document) {
            valueDocumentIds = [fieldInputs[valueId].document];
            console.log(`✅ Using single document for value ${valueId}`);
          }
          if (valueDocumentIds.length === 0 && sessionDocuments?.length > 0) {
            valueDocumentIds = [sessionDocuments[0].id];
            console.log(`⚠️ Fallback to first document for value ${valueId}`);
          }

          await apiRequest(`/api/sessions/${sessionId}/extract-column`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepId,
              valueId,
              documentIds: valueDocumentIds,
              documentId: valueDocumentIds[0],
            }),
          });
        }

        // Refresh validations and show success
        await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', project?.id] });

        toast({
          title: "Extraction Complete",
          description: `Successfully extracted ${fieldsToExtract.length} field${fieldsToExtract.length !== 1 ? 's' : ''}`,
        });
        return; // Exit early — don't fall through to info page flow
      }

      // Info page extraction: use /extract endpoint (existing flow)
      for (const [valueId, value] of fieldsByValue) {
        console.log(`🎯 Processing info page value ${valueId}`);

        // Get document IDs for this specific value (per-value document selection)
        // The valueId here is field.id which is stepValue.id (a UUID, the parent value ID)
        // Documents are stored at fieldInputs[stepValue.id].documents
        let valueDocumentIds: string[] = [];

        // Support both new 'documents' array and legacy 'document' single value
        if (fieldInputs[valueId]?.documents && Array.isArray(fieldInputs[valueId].documents)) {
          valueDocumentIds = fieldInputs[valueId].documents;
          console.log(`✅ Using ${valueDocumentIds.length} documents selected for value ${valueId}:`, valueDocumentIds);
        } else if (fieldInputs[valueId]?.document) {
          valueDocumentIds = [fieldInputs[valueId].document];
          console.log(`✅ Using single document ${valueDocumentIds[0]} selected for value ${valueId}`);
        }

        // If no document selected for this value, use the first available document as fallback
        if (valueDocumentIds.length === 0 && sessionDocuments?.length > 0) {
          valueDocumentIds = [sessionDocuments[0].id];
          console.log(`⚠️ No documents selected for value ${valueId}, using first document: ${valueDocumentIds[0]}`);
        }

        console.log(`📄 Passing document IDs to backend for value ${valueId}:`, valueDocumentIds);

        const requestData = {
          documentIds: valueDocumentIds,  // PASS ARRAY OF DOCUMENT IDs for multi-document extraction
          documentId: valueDocumentIds[0],  // Keep for backward compatibility
          files: [],  // Empty files array - backend will retrieve content using documentIds
          project_data: {
            id: project?.id,
            projectId: project?.id,
            schemaFields: project?.schemaFields || [],
            collections: collections || [],
            workflowSteps: project?.workflowSteps || []
          },
          target_fields: (() => {
            // Check if this is a multi-field value
            if (value.fields && Array.isArray(value.fields)) {
              // Multi-field value - map each field with its own identifierId
              console.log(`📝 Multi-field value ${valueId} has ${value.fields.length} fields`);
              return value.fields.map((field: any, idx: number) => {
                const fieldConfig = {
                  fieldName: field.name,
                  valueName: field.name,
                  dataType: field.dataType || 'TEXT',
                  description: field.description || '',
                  identifierId: field.identifierId || `${valueId}_field_${idx}`, // CRITICAL: This maps AI results back
                  id: field.id || field.identifierId || `${valueId}_field_${idx}`, // Backend looks for 'id'
                  fieldId: field.id || field.identifierId || `${valueId}_field_${idx}`, // Also include as fieldId
                  valueId: valueId
                };
                console.log(`📝 Field ${idx}: ${field.name}, identifierId: ${fieldConfig.identifierId}, fieldId: ${fieldConfig.fieldId}`);
                return fieldConfig;
              });
            } else if (value.fieldToExtract) {
              // Single field with explicit extraction config
              return [{
                ...value.fieldToExtract,
                identifierId: value.fieldToExtract.identifierId || value.identifierId || `${valueId}_field_0`
              }];
            } else {
              // Default single-field value
              return [{
                fieldName: value.valueName,
                valueName: value.valueName,
                fieldType: value.dataType,
                dataType: value.dataType,
                description: value.description,
                identifierId: value.identifierId || `${valueId}_field_0`,
                fieldId: value.id,
                valueId: valueId
              }];
            }
          })(),
          is_workflow_step: true,
          step_id: stepId, // Use the stepId we got at the beginning
          value_id: valueId
        };

        await apiRequest(`/api/sessions/${sessionId}/extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
      }

      // Refresh validations
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', project?.id] });

      toast({
        title: "Extraction Complete",
        description: `Successfully extracted ${fieldsToExtract.length} field${fieldsToExtract.length !== 1 ? 's' : ''}`,
      });
      
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: "An error occurred during extraction. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExtractingToolId(null);
      setCurrentToolGroup(null);
      setShowFieldSelectionModal(false); // Close modal after extraction completes
    }
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
    let fieldInfo = null; // For multi-field values
    
    for (const step of project?.workflowSteps || []) {
      // Check for exact match first (single-field values)
      const found = step.values?.find(v => v.valueName === fieldName);
      if (found) {
        stepValue = found;
        break;
      }
      
      // Check for multi-field values (format: valueName.fieldName)
      for (const value of step.values || []) {
        if (value.fields && Array.isArray(value.fields) && fieldName.startsWith(value.valueName + '.')) {
          const fieldNamePart = fieldName.substring(value.valueName.length + 1);
          const fieldIndex = value.fields.findIndex((f: any) => f.name === fieldNamePart);
          if (fieldIndex !== -1) {
            stepValue = value;
            fieldInfo = {
              field: value.fields[fieldIndex],
              index: fieldIndex
            };
            break;
          }
        }
      }
      if (stepValue) break;
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
    
    // Find the correct validation based on whether it's a multi-field or single-field value
    let validation;
    if (fieldInfo) {
      // Multi-field value - find validation by field identifierId
      const fieldIdentifierId = fieldInfo.field.identifierId || fieldInfo.field.id || `${stepValue.id}_field_${fieldInfo.index}`;
      validation = freshValidations.find(v => 
        v.fieldId === fieldIdentifierId || 
        v.identifierId === fieldIdentifierId
      );
    } else {
      // Single-field value
      validation = freshValidations.find(v => v.fieldId === stepValue.id);
    }
    
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
        
        // For multi-field values, use the field's identifierId as fieldId
        // For single-field values, use the stepValue.id
        let fieldIdToUse = stepValue.id;
        let identifierIdToUse = null;
        
        if (fieldInfo) {
          // Multi-field value - use the field's identifierId
          fieldIdToUse = fieldInfo.field.identifierId || fieldInfo.field.id || `${stepValue.id}_field_${fieldInfo.index}`;
          identifierIdToUse = fieldIdToUse;
        }
        
        const createData: any = {
          sessionId: sessionId,
          validationType: 'schema_field',
          fieldId: fieldIdToUse,
          valueId: stepValue.id, // Always include parent value ID
          fieldName: fieldName,
          extractedValue: valueToStore,
          validationStatus: 'manual',
          manuallyVerified: true,
          manuallyUpdated: true,
          confidenceScore: 100,
          dataType: stepValue.dataType || 'text'
        };
        
        // For multi-field values, also set identifierId
        if (identifierIdToUse) {
          createData.identifierId = identifierIdToUse;
        }
        
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
    
    // Check workflow step values (all step types)
    if (project?.workflowSteps) {
      for (const step of project.workflowSteps) {
        for (const value of step.values || []) {
          if (step.stepType === 'page' || step.stepType === 'info') {
            // Check if this is a multi-field value
            if (value.fields && Array.isArray(value.fields)) {
              if (fieldName.startsWith(value.valueName + '.')) {
                const fieldNamePart = fieldName.substring(value.valueName.length + 1);
                const field = value.fields.find((f: any) => f.name === fieldNamePart);
                if (field) {
                  return field.dataType || 'TEXT';
                }
              }
            } else if (value.valueName === fieldName) {
              return value.dataType || 'TEXT';
            }
          } else if (step.stepType === 'list' || step.stepType === 'data' || step.stepType === 'data_table') {
            // Data table columns - match by valueName
            if (value.valueName === fieldName) {
              return value.dataType || 'TEXT';
            }
            // Also check with step name prefix pattern: stepName.valueName
            const dotFieldName = fieldName.includes('.') ? fieldName.split('.').pop() : null;
            if (dotFieldName && value.valueName === dotFieldName) {
              return value.dataType || 'TEXT';
            }
          }
        }
      }
    }
    
    return 'TEXT'; // Default fallback
  };



  // This function is now replaced by the imported formatDateForDisplay from dateUtils
  // which properly handles European dates (dd/mm/yyyy format)
  const formatDateForDisplayLocal = (value: any) => {
    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Empty';
    }
    
    // Use the imported European date utility function
    const formattedDate = formatDateForDisplay(value);
    return formattedDate || 'Empty';
  };

  const formatValueForDisplay = (value: any, fieldType: string) => {
    // Show clean "Empty" for missing/not-found values
    if (value === 'Not Found') {
      return 'Empty';
    }

    if (!value || value === 'null' || value === 'undefined' || value === null) {
      return 'Empty';
    }
    
    if (fieldType === 'DATE') {
      return formatDateForDisplayLocal(value);
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
      {/* Page Title */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 shadow-sm">
        <div className="w-full px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 mr-6">
              <TrendingUp className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  {isEditingSessionName ? (
                    <Input
                      value={sessionNameValue}
                      onChange={(e) => setSessionNameValue(e.target.value)}
                      onKeyDown={handleSessionNameKeyPress}
                      onBlur={handleSessionNameSave}
                      className="inline-flex h-auto bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 m-0 dark:text-white text-3xl font-bold"
                      style={{
                        width: `${Math.max(sessionNameValue.length * 18, 200)}px`,
                        fontSize: '1.875rem',
                        fontWeight: '700',
                        lineHeight: '2.25rem'
                      }}
                      autoFocus
                    />
                  ) : (
                    <h2 className="text-3xl font-bold dark:text-white truncate">
                      {session?.sessionName || 'Untitled Session'}
                    </h2>
                  )}
                  {!isEditingSessionName && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSessionNameEdit}
                      className="opacity-40 hover:opacity-100 p-1 flex-shrink-0"
                      title="Edit session name"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {session?.createdAt ? `Created ${new Date(session.createdAt).toLocaleString()}` : ''}
                  {session?.originatorName ? ` by ${session.originatorName}` : ''}
                </p>
              </div>
            </div>

            {/* Workflow Status Chain - Shows status progression */}
            {(() => {
              const statusOptions = (project as any).workflowStatusOptions || [];
              const statusColors: string[] = (project as any).workflowStatusColors || [];
              const STATUS_FALLBACK_COLORS = ['#4F63A4', '#5B8DBD', '#4F9A94', '#5EA47B', '#C4A35A', '#C47B5A', '#A45B73'];
              const currentStatus = (session as any)?.workflowStatus || (project as any).defaultWorkflowStatus || statusOptions[0] || '';
              const currentIndex = statusOptions.indexOf(currentStatus);
              
              if (statusOptions.length === 0) {
                // No status workflow configured - show traditional stats
                return project.sessions.length > 0 ? (
                  <div className="flex flex-col items-end flex-shrink-0 ml-auto gap-1.5">
                    <div className="flex gap-3">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-10"
                        title="Refresh data and check for new emails"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportToExcel}
                        className="h-10"
                        title="Export to Excel"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Progress bar below stats */}
                    <div className="flex items-center gap-2 w-full">
                      {getVerificationProgress().percentage === 100 ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            getVerificationProgress().percentage === 100 ? 'bg-green-600 dark:bg-green-500' :
                            getVerificationProgress().percentage > 0 ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
                          }`}
                          style={{ width: `${getVerificationProgress().percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 min-w-[28px] text-right">
                        {getVerificationProgress().percentage}%
                      </span>
                    </div>
                  </div>
                ) : null;
              }
              
              const nextIndex = currentIndex + 1;
              const ctaStep = project?.workflowSteps?.find((step: any) => {
                const ac = step.actionConfig;
                return ac?.actionStatus && statusOptions.indexOf(ac.actionStatus) === nextIndex;
              });
              const ctaActionConfig = (ctaStep as any)?.actionConfig;

              const isCtaStepComplete = (() => {
                if (!ctaStep) return false;
                const stepId = (ctaStep as any).id;

                if ((ctaStep as any).stepType === 'kanban') {
                  const kanbanConfig = (ctaStep as any).kanbanConfig || { statusColumns: ['To Do', 'In Progress', 'Done'] };
                  const statusColumns = kanbanConfig.statusColumns || ['To Do', 'In Progress', 'Done'];
                  const lastColumn = statusColumns[statusColumns.length - 1];
                  if (ctaKanbanCards.length === 0) return false;
                  return ctaKanbanCards.every((card: any) => card.status === lastColumn);
                }

                const stepVals = (ctaStep as any).values || [];
                if (stepVals.length === 0) return true;

                const isValidOrComplete = (v: any) =>
                  v.validationStatus === 'valid' || v.validationStatus === 'manual' || v.manuallyUpdated;

                const result = stepVals.every((sv: any) => {
                  const fields = sv.fields && Array.isArray(sv.fields) ? sv.fields : [];
                  if (fields.length > 0) {
                    return fields.every((f: any) => {
                      const fieldValidation = validations.find((v: any) =>
                        v.identifierId === f.identifierId ||
                        v.valueId === f.identifierId ||
                        v.fieldId === f.identifierId
                      );
                      return fieldValidation && isValidOrComplete(fieldValidation);
                    });
                  }
                  const valueValidations = validations.filter((v: any) =>
                    v.valueId === sv.id || v.fieldId === sv.id || v.identifierId === sv.id
                  );
                  return valueValidations.length > 0 && valueValidations.every(isValidOrComplete);
                });
                return result;
              })();

              const handleChevronCTAClick = async () => {
                if (!ctaActionConfig?.actionStatus || !isCtaStepComplete) return;
                try {
                  await apiRequest(`/api/sessions/${session?.id}/workflow-status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ workflowStatus: ctaActionConfig.actionStatus })
                  });
                  queryClient.invalidateQueries({ queryKey: ['/api/sessions', session?.id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/projects', project?.id, 'sessions'] });
                  toast({
                    title: "Status Updated",
                    description: `Session status changed to "${ctaActionConfig.actionStatus}"`
                  });
                  if (ctaActionConfig.actionLink) {
                    let link = ctaActionConfig.actionLink;
                    const templateMatches = link.match(/\{\{([^}]+)\}\}/g);
                    if (templateMatches) {
                      const allStepValues = project?.workflowSteps?.flatMap((s: any) => s.values || []) || [];
                      const fieldIdentifierMap = new Map<string, string>();
                      allStepValues.forEach((sv: any) => {
                        if (sv.valueName) {
                          fieldIdentifierMap.set(sv.valueName.toLowerCase(), sv.id);
                        }
                        if (sv.fields && Array.isArray(sv.fields)) {
                          sv.fields.forEach((f: any) => {
                            if (f.name && f.identifierId) {
                              fieldIdentifierMap.set(f.name.toLowerCase(), f.identifierId);
                            }
                          });
                        }
                      });

                      for (const match of templateMatches) {
                        const fieldName = match.replace(/\{\{|\}\}/g, '').trim();
                        const identifierId = fieldIdentifierMap.get(fieldName.toLowerCase());
                        let foundValue = '';

                        if (identifierId) {
                          const validation = validations.find((v: any) =>
                            v.identifierId === identifierId || v.valueId === identifierId || v.fieldId === identifierId
                          );
                          if (validation) foundValue = validation.extractedValue || '';
                        }

                        if (!foundValue) {
                          const validation = validations.find((v: any) => {
                            if (v.fieldName === fieldName || v.columnName === fieldName) return true;
                            const svMatch = allStepValues.find((sv: any) =>
                              sv.valueName?.toLowerCase() === fieldName.toLowerCase()
                            );
                            if (svMatch && (v.valueId === svMatch.id || v.fieldId === svMatch.id)) return true;
                            return false;
                          });
                          if (validation) foundValue = validation.extractedValue || '';
                        }

                        link = link.replace(match, encodeURIComponent(String(foundValue)));
                      }
                    }
                    window.open(link, '_blank');
                  }
                } catch (error) {
                  console.error('Error executing CTA action:', error);
                  toast({ title: "Error", description: "Failed to execute action", variant: "destructive" });
                }
              };

              return (
                <div className="flex flex-shrink-0 ml-auto">
                  <div className="flex items-start">
                  {/* Chevrons + progress bar grouped in a column */}
                  <div className="flex flex-col gap-1.5">
                  <div className="flex items-center">
                  {statusOptions.map((status: string, index: number) => {
                    const isLastStatus = index === statusOptions.length - 1;
                    const isCompleted = index === currentIndex && isLastStatus;
                    const isPast = index <= currentIndex || isCompleted;
                    const isCurrent = false;
                    const isCTA = index === nextIndex && !!ctaActionConfig;
                    const isCtaDisabled = isCTA && !isCtaStepComplete;
                    const isFuture = index > currentIndex && !isCTA;
                    const isFirst = index === 0;
                    const isLast = index === statusOptions.length - 1;

                    const chevronPoint = 14;
                    const clipPath = isFirst && isLast
                      ? undefined
                      : isFirst
                        ? `polygon(0 0, calc(100% - ${chevronPoint}px) 0, 100% 50%, calc(100% - ${chevronPoint}px) 100%, 0 100%)`
                        : isLast
                          ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${chevronPoint}px 50%)`
                          : `polygon(0 0, calc(100% - ${chevronPoint}px) 0, 100% 50%, calc(100% - ${chevronPoint}px) 100%, 0 100%, ${chevronPoint}px 50%)`;

                    const statusColor = statusColors[index] || STATUS_FALLBACK_COLORS[index % STATUS_FALLBACK_COLORS.length];
                    const useInlineColor = isPast || (isCTA && !isCtaDisabled);

                    const bgColor = isPast
                      ? ''
                      : isCurrent
                        ? ''
                        : isCTA && !isCtaDisabled
                          ? 'cursor-pointer'
                          : 'bg-gray-200 dark:bg-gray-700';

                    const textColor = isPast || isCurrent || (isCTA && !isCtaDisabled)
                      ? 'text-white'
                      : 'text-gray-400 dark:text-gray-500';

                    return (
                      <div
                        key={status}
                        onClick={isCTA && !isCtaDisabled ? handleChevronCTAClick : undefined}
                        className={`relative flex items-center justify-center gap-1.5 text-sm font-semibold h-10 ${bgColor} ${textColor} transition-all select-none ${
                          isCTA && !isCtaDisabled ? 'cursor-pointer' : ''
                        }`}
                        style={{
                          clipPath,
                          paddingLeft: isFirst ? '16px' : `${chevronPoint + 10}px`,
                          paddingRight: isLast ? '16px' : `${chevronPoint + 6}px`,
                          marginLeft: index > 0 ? '-2px' : '0',
                          minWidth: '110px',
                          ...(isPast ? { backgroundColor: statusColor } : {}),
                          ...(isCTA && !isCtaDisabled ? { backgroundColor: statusColor, opacity: 0.7 } : {}),
                        }}
                        title={isCTA && !isCtaDisabled ? `Click to ${ctaActionConfig.actionName || 'advance'}` : isCTA && isCtaDisabled ? `Complete the step to unlock this action` : status}
                      >
                        {isPast && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                        {isCurrent && <Circle className="h-3 w-3 fill-current flex-shrink-0" />}
                        {isCTA && !isCtaDisabled && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                        <span className="whitespace-nowrap">{isCTA ? (ctaActionConfig.actionName || status) : status}</span>
                      </div>
                    );
                  })}
                  </div>{/* closes chevron items row */}
                  {/* Progress bar — naturally matches chevron width within the same flex-col */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          getVerificationProgress().percentage === 100 ? 'bg-green-600 dark:bg-green-500' :
                          getVerificationProgress().percentage > 0 ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
                        }`}
                        style={{ width: `${getVerificationProgress().percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 min-w-[28px] text-right">
                      {getVerificationProgress().percentage}%
                    </span>
                  </div>
                  </div>{/* closes flex-col (chevrons + progress bar) */}
                  {/* Action buttons — outside the column, to the right */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-10 ml-3"
                    title="Refresh data and check for new emails"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportToExcel}
                    className="h-10"
                    title="Export to Excel"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  </div>{/* closes flex items-center row */}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Nav Panel — collapsible */}
        <ResizablePanel
          ref={navPanelRef}
          id="nav-panel"
          order={1}
          collapsible
          defaultSize={15}
          minSize={10}
          collapsedSize={4}
          onCollapse={() => setIsNavCollapsed(true)}
          onExpand={() => setIsNavCollapsed(false)}
        >
        {isNavCollapsed ? (
          /* Collapsed nav strip — icons only */
          <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 flex flex-col items-center py-3 overflow-y-auto">
            {/* Expand button */}
            <button
              onClick={expandNav}
              className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10 transition-colors mb-3"
              title="Expand navigation"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
            {/* Back arrow */}
            <Link href={`/projects/${projectId}?tab=all-data`}>
              <button
                className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors mb-4"
                title={`Back to All ${project?.mainObjectName || "Session"}s`}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            {/* Section icons */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex flex-col items-center gap-1 w-full">
              <button
                onClick={() => scrollToSection('documents')}
                className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-[#4F63A4]/10 text-[#4F63A4]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                }`}
                title="Documents"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              {(() => {
                const allSteps: Array<{ id: string; name: string; stepType: string; values?: any[] }> = [];
                if (project.workflowSteps) {
                  project.workflowSteps.forEach(step => {
                    if (step.stepName !== 'Documents') {
                      allSteps.push({ id: step.id, name: step.stepName, stepType: step.stepType, values: step.values });
                    }
                  });
                }
                return allSteps.map((item) => {
                  const progress = getStepVerificationProgress(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.name)}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                        activeTab === item.name
                          ? 'bg-[#4F63A4]/10 text-[#4F63A4]'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={item.name}
                    >
                      {progress.total > 0 && progress.percentage === 100 ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : progress.total > 0 && progress.verified > 0 ? (
                        <div className="w-2 h-2 rounded-full bg-[#4F63A4]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
            {/* Settings icon at bottom */}
            {canAccessConfigTabs && (
              <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                <Link href={`/projects/${projectId}/configure`}>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Configure"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Expanded sidebar */
          <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 flex flex-col overflow-hidden">
            {/* Grey bar header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Navigation</span>
              <button
                onClick={() => navPanelRef.current?.collapse()}
                className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10 transition-colors"
                title="Collapse navigation"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Back link */}
            <div className="px-3 pt-2 pb-1">
              <Link href={`/projects/${projectId}?tab=all-data`}>
                <button className="flex items-center gap-1 text-sm text-slate-600 dark:text-gray-300 hover:text-slate-700 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700 px-2 py-1.5 rounded-lg transition-all duration-200 font-normal">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All {project?.mainObjectName || "Session"}s
                </button>
              </Link>
            </div>

            {/* Session Navigation */}
            <div className="px-3 py-2 flex-1 overflow-y-auto">
              <nav className="space-y-0.5">
                <button
                  onClick={() => scrollToSection('documents')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all duration-150 cursor-pointer ${
                    activeTab === 'documents'
                      ? 'bg-[#4F63A4]/10 text-[#4F63A4] dark:bg-[#4F63A4]/20 dark:text-blue-300 font-medium border-l-2 border-[#4F63A4]'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Documents</span>
                </button>

                {(() => {
                  const allSteps: Array<{ id: string; name: string; stepType: string; values?: any[] }> = [];

                  if (project.workflowSteps) {
                    project.workflowSteps.forEach(step => {
                      if (step.stepName !== 'Documents') {
                        allSteps.push({
                          id: step.id,
                          name: step.stepName,
                          stepType: step.stepType,
                          values: step.values
                        });
                      }
                    });
                  }

                  return allSteps.map((item) => {
                    const progress = getStepVerificationProgress(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.name)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all duration-150 cursor-pointer ${
                          activeTab === item.name
                            ? 'bg-[#4F63A4]/10 text-[#4F63A4] dark:bg-[#4F63A4]/20 dark:text-blue-300 font-medium border-l-2 border-[#4F63A4]'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {progress.total > 0 && progress.percentage === 100 ? (
                          <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
                        ) : progress.total > 0 && progress.verified > 0 ? (
                          <div className="w-2 h-2 rounded-full bg-[#4F63A4] flex-shrink-0" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  });
                })()}
              </nav>
            </div>

            {/* Settings Button - Always at the bottom */}
            {canAccessConfigTabs && (
              <div className="p-4 border-t border-gray-300 dark:border-gray-600">
                <Link href={`/projects/${projectId}/configure`}>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 text-slate-600 dark:text-gray-300 hover:text-slate-700 dark:hover:text-gray-100 transition-all duration-200">
                    <Settings className="h-4 w-4" />
                    Configure
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}
        </ResizablePanel>

        <ResizableHandle />

        {/* Session Info Panel — collapsible */}
        <ResizablePanel
          ref={sessionInfoPanelRef}
          id="session-info-panel"
          order={2}
          collapsible
          defaultSize={45}
          minSize={15}
          collapsedSize={2}
          onCollapse={() => setIsSessionInfoCollapsed(true)}
          onExpand={() => setIsSessionInfoCollapsed(false)}
        >
        {isSessionInfoCollapsed ? (
          <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-3">
            <button
              onClick={() => sessionInfoPanelRef.current?.expand()}
              className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10 transition-colors"
              title={`Expand ${project?.mainObjectName || 'Session'} Info`}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-4" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
              {project?.mainObjectName || 'Session'} Info
            </span>
          </div>
        ) : (
          <div className="h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
            {/* Grey bar header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project?.mainObjectName || 'Session'} Info</span>
              <button
                onClick={() => sessionInfoPanelRef.current?.collapse()}
                className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10 transition-colors"
                title={`Collapse ${project?.mainObjectName || 'Session'} Info`}
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-8">
          {/* Session description (if any) */}
          {session?.description && (
            <div ref={el => { sectionRefs.current['session-info'] = el; }} className="mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#4F63A4]/10 flex items-center justify-center">
                  <Info className="h-4 w-4 text-[#4F63A4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{session.description}</p>
                </div>
              </div>
            </div>
          )}

            {/* Documents Section */}
            <div ref={el => { sectionRefs.current['documents'] = el; }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleSection('documents')}>
                  {collapsedSections.has('documents') ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Documents</h3>
                </div>
                <Button
                  onClick={(e) => { e.stopPropagation(); setDocumentUploadModalOpen(true); }}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Add documents to session"
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
              </div>
              {!collapsedSections.has('documents') && (
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
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Document</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Size</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Content</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Processed</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">Details</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionDocuments.map((doc: any, index: number) => (
                                <tr
                                  key={doc.id || index}
                                  className={`border-b border-gray-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                                    previewDocumentId === doc.id ? 'bg-[#4F63A4]/5 dark:bg-[#4F63A4]/10 border-l-2 border-l-[#4F63A4]' : ''
                                  }`}
                                  onClick={() => previewDocumentId === doc.id ? setPreviewDocumentId(null) : openDocPreview(doc.id)}
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
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={doc.fileName}>
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
                                        onClick={(e) => { e.stopPropagation(); processDocumentMutation.mutate(doc.id); }}
                                        disabled={processDocumentMutation.isPending}
                                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        title="Process document (extract content)"
                                      >
                                        {processDocumentMutation.isPending && processDocumentMutation.variables === doc.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => { e.stopPropagation(); handleDownloadDocument(doc.id, doc.fileName); }}
                                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        title="Download extracted content"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
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
            </div>

            {/* Workflow Steps - All rendered as collapsible sections */}
            {project?.workflowSteps?.filter(step => step.stepName !== 'Documents').map((currentStep) => {
              const stepName = currentStep.stepName;
              const isInfoPage = currentStep.stepType === 'page';
              const isKanban = currentStep.stepType === 'kanban';
              const isList = currentStep.stepType === 'list';

              return (
                <div key={currentStep.id} ref={el => { sectionRefs.current[stepName] = el; }} className="mt-6">
                  <hr className="border-gray-300 dark:border-gray-600 mb-6" />
                  <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => toggleSection(stepName)}>
                    <div className="flex items-center gap-2">
                      {collapsedSections.has(stepName) ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{stepName}</h3>
                    </div>
                  </div>

                  {!collapsedSections.has(stepName) && (
                    <>
                      {/* Kanban content */}
                      {isKanban && session && (() => {
                        const kanbanConfig = (currentStep as any).kanbanConfig || {
                          statusColumns: ['To Do', 'In Progress', 'Done'],
                          aiInstructions: '',
                          knowledgeDocumentIds: []
                        };
                        return (
                          <div className="flex flex-col" style={{ minHeight: '500px' }}>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-shrink-0">
                              Task board for managing work items related to this session.
                            </p>
                            <KanbanBoard
                              sessionId={session.id}
                              stepId={currentStep.id}
                              statusColumns={kanbanConfig.statusColumns}
                              columnColors={kanbanConfig.columnColors}
                              stepValues={(currentStep as any).values || []}
                              sessionDocuments={sessionDocuments?.map(doc => ({
                                id: doc.id,
                                fileName: doc.fileName,
                                fileType: doc.fileType
                              })) || []}
                              isLoadingDocuments={documentsLoading}
                              aiInstructions={kanbanConfig.aiInstructions}
                              knowledgeDocumentIds={kanbanConfig.knowledgeDocumentIds}
                              organizationId={user?.organizationId}
                              currentUserId={user?.id}
                              actions={kanbanConfig.actions || []}
                              projectInboxEmail={project?.inboxEmailAddress}
                              openTaskCardId={openTaskCardId}
                              onOpenTaskCardHandled={() => setOpenTaskCardId(null)}
                              onGenerateTasks={async (selectedDocumentIds: string[]) => {
                                await apiRequest(`/api/sessions/${session.id}/steps/${currentStep.id}/generate-tasks`, {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    aiInstructions: kanbanConfig.aiInstructions,
                                    knowledgeDocumentIds: kanbanConfig.knowledgeDocumentIds,
                                    statusColumns: kanbanConfig.statusColumns,
                                    selectedDocumentIds,
                                    includeUserDocuments: kanbanConfig.includeUserDocuments !== false,
                                    referenceStepIds: kanbanConfig.referenceStepIds,
                                    dataSourceId: kanbanConfig.dataSourceId,
                                    dataSourceInstructions: kanbanConfig.dataSourceInstructions
                                  })
                                });
                                queryClient.invalidateQueries({ queryKey: [`/api/sessions/${session.id}/steps/${currentStep.id}/kanban-cards`] });
                              }}
                            />
                          </div>
                        );
                      })()}

                      {/* Info Page content */}
                      {isInfoPage && (
                        <>
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
                            {/* Render fields directly without extra container */}
                            {stepValues.map((stepValue) => {
                                  const fieldName = stepValue.valueName;
                                  
                                  // Check if this value has multiple fields defined
                                  const hasMultipleFields = stepValue.fields && stepValue.fields.length > 0;
                                  
                                  if (hasMultipleFields) {
                                    // Multi-field Info Page value - get all validations for this value
                                    // InfoPage validations may have NULL valueId but have fieldId set
                                    const fieldValidations = validations.filter(v => 
                                      v.valueId === stepValue.id || v.fieldId === stepValue.id
                                    );
                                    
                                    const showValueHeader = fieldName !== stepName;
                                    
                                    return (
                                      <div key={stepValue.id} className="pb-6 mb-6 border-b border-[#4F63A4]/20 last:border-b-0 last:pb-0 last:mb-0">
                                        {showValueHeader ? (
                                        <div className="flex items-center justify-between mb-4">
                                          <h4 className="text-base font-bold text-[#3A4A7C] dark:text-white flex items-center gap-2">
                                            <div 
                                              className="w-2 h-2 rounded-full" 
                                              style={{ 
                                                backgroundColor: (() => {
                                                  const valueValidations = fieldValidations.filter(v => 
                                                    (v.valueId === stepValue.id || v.fieldId === stepValue.id) &&
                                                    v.extractedValue !== null && 
                                                    v.extractedValue !== undefined && 
                                                    v.extractedValue !== "" && 
                                                    v.extractedValue !== "null" && 
                                                    v.extractedValue !== "undefined"
                                                  );
                                                  
                                                  const hasAllFields = stepValue.fields && 
                                                    stepValue.fields.length > 0 && 
                                                    stepValue.fields.length === valueValidations.length;
                                                  
                                                  const allFieldsValid = hasAllFields && 
                                                    valueValidations.every(v => v.validationStatus === 'valid');
                                                  
                                                  return allFieldsValid ? '#10b981' : '#4F63A4';
                                                })() 
                                              }}
                                            />
                                            {fieldName}
                                          </h4>
                                          <button
                                            onClick={() => {
                                              const toolGroup = {
                                                toolId: stepValue.toolId || 'manual',
                                                stepValues: [stepValue]
                                              };
                                              setCurrentToolGroup(toolGroup);
                                              setShowFieldSelectionModal(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            title={`Extract data for ${fieldName}`}
                                          >
                                            <Wand2 className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
                                          </button>
                                        </div>
                                        ) : (
                                        <div className="flex justify-end mb-2">
                                          <button
                                            onClick={() => {
                                              const toolGroup = {
                                                toolId: stepValue.toolId || 'manual',
                                                stepValues: [stepValue]
                                              };
                                              setCurrentToolGroup(toolGroup);
                                              setShowFieldSelectionModal(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            title={`Extract data for ${fieldName}`}
                                          >
                                            <Wand2 className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
                                          </button>
                                        </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {stepValue.fields.map((field: any, fieldIndex: number) => {
                                              // Map validations by field identifierId, NOT by index
                                              // Each field has a unique identifierId that should match the validation's fieldId
                                              const fieldIdentifierId = field.identifierId || field.id || `${stepValue.id}_field_${fieldIndex}`;
                                              const fieldValidation = fieldValidations.find(v => 
                                                v.fieldId === fieldIdentifierId || 
                                                v.identifierId === fieldIdentifierId
                                              );
                                              const fieldFullName = `${fieldName}.${field.name}`;
                                              
                                              
                                              let displayValue = fieldValidation?.extractedValue ?? null;
                                              if (displayValue === "null" || displayValue === "undefined") {
                                                displayValue = null;
                                              }
                                              
                                              
                                              return (
                                                <div key={field.name}>
                              <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                                {field.name}
                              </Label>
                              <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                {(() => {
                                  const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                  const wasManuallyUpdated = fieldValidation && fieldValidation.manuallyUpdated;
                                  const isVerified = fieldValidation?.validationStatus === 'valid' || fieldValidation?.validationStatus === 'manual';
                                  const score = Math.round(fieldValidation?.confidenceScore || 0);

                                  // Render confidence indicator/verification status to the left of field value
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
                                              onClick={() => handleVerificationToggle(fieldFullName, false, fieldIdentifierId)}
                                              className="w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors flex-shrink-0"
                                              aria-label="Click to unverify"
                                            >
                                              <span className="text-xs font-bold">✓</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                              <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                              <span className="text-sm font-semibold">Analysis</span>
                                            </div>
                                            <div className="whitespace-pre-line leading-relaxed">
                                              {fieldValidation?.aiReasoning && (
                                                <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(fieldValidation.aiReasoning)}</div>
                                              )}
                                              <div className="mb-2">Verified with {score}% confidence</div>
                                              <div className="text-xs text-blue-700 dark:text-blue-300">Click to unverify</div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  } else if (hasValue && fieldValidation) {
                                    // Show colored confidence dot when not verified - clicking toggles validation status
                                    const colorClass = score >= 80 ? 'bg-green-500' : 
                                                     score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                    const borderClass = score >= 80 ? 'border-green-500' : 
                                                      score >= 50 ? 'border-yellow-500' : 'border-red-500';
                                    const hoverClass = score >= 80 ? 'hover:bg-green-400 dark:hover:bg-green-800/50' : 
                                                     score >= 50 ? 'hover:bg-yellow-400 dark:hover:bg-yellow-800/50' : 'hover:bg-red-400 dark:hover:bg-red-800/50';
                                    
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => handleVerificationToggle(fieldFullName, true, fieldIdentifierId)}
                                              className={`w-2 h-2 ${colorClass} rounded-full border-2 ${borderClass} cursor-pointer ${hoverClass} transition-colors flex-shrink-0`}
                                              aria-label="Click to validate"
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                              <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                              <span className="text-sm font-semibold">Analysis</span>
                                            </div>
                                            <div className="whitespace-pre-line leading-relaxed">
                                              {fieldValidation.aiReasoning && (
                                                <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(fieldValidation.aiReasoning)}</div>
                                              )}
                                              {fieldValidation.confidenceScore && (
                                                <div className="mb-2 font-medium">Confidence: {Math.round(fieldValidation.confidenceScore)}%</div>
                                              )}
                                              <div className="text-xs text-blue-700 dark:text-blue-300">Click to validate</div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  } else if (!hasValue) {
                                    // Show subtle empty indicator for missing fields
                                    return (
                                      <div className="w-3 h-3 flex items-center justify-center flex-shrink-0" title="Not yet extracted">
                                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                                      </div>
                                    );
                                  }
                                  // Return empty div to maintain consistent spacing
                                  return <div className="w-3 h-3 flex-shrink-0"></div>;
                                })()}
                                {(() => {
                                  const fieldType = field.dataType || stepValue.dataType;
                                  const popoverFieldType = fieldType === 'DATE' ? 'DATE' as const
                                    : fieldType === 'NUMBER' ? 'NUMBER' as const
                                    : fieldType === 'BOOLEAN' ? 'BOOLEAN' as const
                                    : fieldType === 'TEXTAREA' ? 'TEXTAREA' as const
                                    : 'TEXT' as const;

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
                                      <FieldEditorPopover
                                        open={editingField === fieldFullName}
                                        onOpenChange={(isOpen) => {
                                          if (isOpen) {
                                            handleEdit(fieldFullName, displayValue);
                                          } else {
                                            setEditingField(null);
                                          }
                                        }}
                                        fieldName={field.name}
                                        initialValue={displayValue || ""}
                                        fieldType={popoverFieldType}
                                        onSave={(val) => handleSave(fieldFullName, val)}
                                        onCancel={() => setEditingField(null)}
                                      >
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2"
                                        >
                                          <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                        </Button>
                                      </FieldEditorPopover>
                                    </div>
                                  );
                                })()}
                                </div>
                              </div>
                              </div>
                            </div>
                                                  );
                                                })}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                        // Single-field Info Page value (original logic)
                                        const validation = validations.find(v => v.fieldId === stepValue.id || v.valueId === stepValue.id);
                                        const originalValue = extractedData[fieldName];
                                        
                                        let displayValue = validation?.extractedValue ?? originalValue ?? null;
                                        if (displayValue === "null" || displayValue === "undefined") {
                                          displayValue = null;
                                        }
                                        
                                        // Check if this value has a valid/extracted status
                                        const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                        const isVerified = validation?.validationStatus === 'valid' || validation?.validationStatus === 'manual';
                                        const statusColor = hasValue && isVerified ? '#10b981' : '#4F63A4';
                                        const showSingleHeader = fieldName !== stepName;
                                        
                                        return (
                                          <div key={stepValue.id} className="pb-6 mb-6 border-b border-[#4F63A4]/20 last:border-b-0 last:pb-0 last:mb-0">
                                            {showSingleHeader && (
                                            <div className="flex items-center justify-between mb-4">
                                              <h4 className="text-base font-bold text-[#3A4A7C] dark:text-white flex items-center gap-2">
                                                <div 
                                                  className="w-2 h-2 rounded-full" 
                                                  style={{ backgroundColor: statusColor }}
                                                />
                                                {fieldName}
                                              </h4>
                                              <button
                                                onClick={() => {
                                                  const toolGroup = {
                                                    toolId: stepValue.toolId || 'manual',
                                                    stepValues: [stepValue]
                                                  };
                                                  setCurrentToolGroup(toolGroup);
                                                  setShowFieldSelectionModal(true);
                                                }}
                                                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                title={`Extract data for ${fieldName}`}
                                              >
                                                <Wand2 className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
                                              </button>
                                            </div>
                                            )}
                                            <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                                              {fieldName}
                                            </Label>
                                            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                                            <div className="flex-1">
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
                                                            onClick={() => handleVerificationToggle(fieldName, false, null)}
                                                            className="w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors flex-shrink-0"
                                                            aria-label="Click to unverify"
                                                          >
                                                            <span className="text-xs font-bold">✓</span>
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                                          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                            <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                            <span className="text-sm font-semibold">Analysis</span>
                                                          </div>
                                                          <div className="whitespace-pre-line leading-relaxed">
                                                            {validation?.aiReasoning && (
                                                              <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(validation.aiReasoning)}</div>
                                                            )}
                                                            <div className="mb-2">Verified with {score}% confidence</div>
                                                            <div className="text-xs text-blue-700 dark:text-blue-300">Click to unverify</div>
                                                          </div>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  );
                                                } else if (hasValue && validation) {
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
                                                            onClick={() => handleVerificationToggle(fieldName, true, null)}
                                                            className={`w-2 h-2 ${colorClass} rounded-full border-2 ${borderClass} cursor-pointer ${hoverClass} transition-colors flex-shrink-0`}
                                                            aria-label="Click to validate"
                                                          />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                                          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                            <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                            <span className="text-sm font-semibold">Analysis</span>
                                                          </div>
                                                          <div className="whitespace-pre-line leading-relaxed">
                                                            {validation.aiReasoning && (
                                                              <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(validation.aiReasoning)}</div>
                                                            )}
                                                            {validation.confidenceScore && (
                                                              <div className="mb-2 font-medium">Confidence: {Math.round(validation.confidenceScore)}%</div>
                                                            )}
                                                            <div className="text-xs text-blue-700 dark:text-blue-300">Click to validate</div>
                                                          </div>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
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
                                            </div>
                                            <div>
                                              {(() => {
                                                const fieldType = stepValue.dataType;
                                                const popoverFieldType = fieldType === 'DATE' ? 'DATE' as const
                                                  : fieldType === 'NUMBER' ? 'NUMBER' as const
                                                  : fieldType === 'BOOLEAN' ? 'BOOLEAN' as const
                                                  : fieldType === 'TEXTAREA' ? 'TEXTAREA' as const
                                                  : 'TEXT' as const;

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
                                                      {(() => {
                                                        const valueTool = stepValue.toolId ? toolsMap.get(stepValue.toolId) : null;
                                                        const toolDisplayConfig = valueTool?.displayConfig || valueTool?.display_config;
                                                        const hasModalDisplay = (toolDisplayConfig && toolDisplayConfig.modalType && toolDisplayConfig.modalType !== 'none') ||
                                                          valueTool?.toolType === 'DATABASE_LOOKUP' || valueTool?.tool_type === 'DATABASE_LOOKUP';

                                                        if (hasModalDisplay) {
                                                          return (
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={async () => {
                                                                // Get the datasource ID from stepValue inputValues
                                                                const inputValues = stepValue.inputValues || {};
                                                                const dataSourceId = inputValues._dataSourceId || valueTool?.dataSourceId || valueTool?.data_source_id;
                                                                
                                                                console.log('Database lookup manual search clicked:', {
                                                                  valueName: fieldName,
                                                                  tool: valueTool,
                                                                  dataSourceId,
                                                                  inputValues
                                                                });
                                                                
                                                                if (dataSourceId) {
                                                                  try {
                                                                    console.log(`📋 Loading datasource ${dataSourceId} for lookup...`);
                                                                    const [datasourceResponse, datasourceInfo] = await Promise.all([
                                                                      apiRequest(`/api/data-sources/${dataSourceId}/data`),
                                                                      apiRequest(`/api/data-sources/${dataSourceId}`)
                                                                    ]);
                                                                    console.log(`📋 Datasource loaded: ${Array.isArray(datasourceResponse) ? datasourceResponse.length : 0} records`);
                                                                    
                                                                    const rawFilters = inputValues._searchByColumns || [];
                                                                    const outputColumn = inputValues._outputColumn || '';
                                                                    
                                                                    const filters = rawFilters.map((f: any) => 
                                                                      typeof f === 'string' 
                                                                        ? { column: f, operator: 'equals', inputField: '', fuzziness: 0 }
                                                                        : { ...f, fuzziness: f.fuzziness ?? 0 }
                                                                    );
                                                                    
                                                                    const currentInputValues: Record<string, string> = {};
                                                                    if (currentStep?.values) {
                                                                      currentStep.values.forEach((v: any) => {
                                                                        if (v.orderIndex < stepValue.orderIndex) {
                                                                          if (v.fields && v.fields.length > 0) {
                                                                            v.fields.forEach((field: any) => {
                                                                              const fieldId = field.identifierId || field.id;
                                                                              const val = validations.find(vd => 
                                                                                vd.fieldId === fieldId || vd.identifierId === fieldId
                                                                              );
                                                                              if (val?.extractedValue) {
                                                                                currentInputValues[`${v.valueName}.${field.name}`] = val.extractedValue;
                                                                              }
                                                                            });
                                                                          } else {
                                                                            const val = validations.find(vd => 
                                                                              vd.fieldId === v.id || vd.valueId === v.id
                                                                            );
                                                                            if (val?.extractedValue) {
                                                                              currentInputValues[v.valueName] = val.extractedValue;
                                                                            }
                                                                          }
                                                                        }
                                                                      });
                                                                    }
                                                                    
                                                                    console.log('Opening tool display modal with currentInputValues:', currentInputValues);
                                                                    
                                                                    let categoryFilterByValue: string | undefined;
                                                                    const filterValId = inputValues._categoryFilterByValue;
                                                                    if (filterValId && typeof filterValId === 'string') {
                                                                      if (filterValId.includes('::')) {
                                                                        const [valId, fName] = filterValId.split('::');
                                                                        const matchVal = currentStep?.values?.find((v: any) => v.id === valId);
                                                                        if (matchVal) {
                                                                          categoryFilterByValue = currentInputValues[`${matchVal.valueName}.${fName}`] || undefined;
                                                                        }
                                                                      } else {
                                                                        const matchVal = currentStep?.values?.find((v: any) => v.id === filterValId);
                                                                        if (matchVal) {
                                                                          categoryFilterByValue = currentInputValues[matchVal.valueName] || undefined;
                                                                        } else {
                                                                          for (const st of (steps || [])) {
                                                                            const found = st.values?.find((v: any) => v.id === filterValId);
                                                                            if (found) {
                                                                              categoryFilterByValue = currentInputValues[found.valueName] || undefined;
                                                                              break;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    
                                                                    setToolDisplayModal({
                                                                      isOpen: true,
                                                                      validation: validation || null,
                                                                      column: stepValue,
                                                                      rowIdentifierId: null,
                                                                      datasourceData: Array.isArray(datasourceResponse) ? datasourceResponse : [],
                                                                      columnMappings: datasourceInfo?.columnMappings || datasourceInfo?.column_mappings || {},
                                                                      filters,
                                                                      outputColumn,
                                                                      currentInputValues,
                                                                      fieldName: fieldName,
                                                                      collectionName: currentStep?.stepName || '',
                                                                      recordIndex: 0,
                                                                      displayConfig: (toolDisplayConfig || (valueTool?.toolType === 'DATABASE_LOOKUP' || valueTool?.tool_type === 'DATABASE_LOOKUP'
                                                                        ? { modalType: 'table' } : null)) as ToolDisplayConfig,
                                                                      categoryColumn: inputValues._categoryColumn || undefined,
                                                                      categoryFilterByValue
                                                                    });
                                                                  } catch (error: any) {
                                                                    console.error('Error loading datasource:', error);
                                                                    toast({
                                                                      title: "Error",
                                                                      description: `Failed to load database for lookup: ${error?.message || 'Unknown error'}`,
                                                                      variant: "destructive"
                                                                    });
                                                                  }
                                                                } else {
                                                                  console.error('No data source configured for this lookup tool');
                                                                  toast({
                                                                    title: "Configuration Error",
                                                                    description: "No data source is configured for this database lookup",
                                                                    variant: "destructive"
                                                                  });
                                                                }
                                                              }}
                                                              className="h-6 px-2"
                                                              title="Search database for match"
                                                            >
                                                              <Search className="h-3 w-3 text-[#4F63A4]" />
                                                            </Button>
                                                          );
                                                        }
                                                        
                                                        // Regular edit button for non-database-lookup values
                                                        return (
                                                          <FieldEditorPopover
                                                            open={editingField === fieldName}
                                                            onOpenChange={(isOpen) => {
                                                              if (isOpen) {
                                                                handleEdit(fieldName, displayValue);
                                                              } else {
                                                                setEditingField(null);
                                                              }
                                                            }}
                                                            fieldName={fieldName}
                                                            initialValue={displayValue || ""}
                                                            fieldType={popoverFieldType}
                                                            onSave={(val) => handleSave(fieldName, val)}
                                                            onCancel={() => setEditingField(null)}
                                                          >
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              className="h-6 px-2"
                                                            >
                                                              <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                            </Button>
                                                          </FieldEditorPopover>
                                                        );
                                                      })()}
                                                    </div>
                                                  );
                                              })()}
                                              </div>
                                            </div>
                                          </div>
                                          </div>
                                        );
                                      }
                                    })}
                          </div>
                        ));
                      })()}
                    </div>
                  </CardContent>
                </Card>
                        </>
                      )}

                      {/* Data Table / List content */}
                      {isList && (() => {
                const collection = (() => {
                  const existingCollection = collections.find(c => c.collectionName === stepName);
                  if (existingCollection) {
                    return { ...existingCollection, itemType: 'collection', itemName: existingCollection.collectionName };
                  }
                  return {
                    id: currentStep.id,
                    collectionName: stepName,
                    itemType: 'workflow',
                    itemName: stepName,
                    description: `Workflow step for ${stepName}`,
                    properties: currentStep.values?.map(value => ({
                      id: value.id,
                      propertyName: value.valueName,
                      propertyType: value.dataType,
                      orderIndex: value.orderIndex
                    })) || []
                  };
                })();
                  const collectionData = extractedData[stepName];
                  const collectionValidations = validations.filter(v => 
                    v.collectionName === stepName &&
                    (v.validationStatus === 'valid' || v.validationStatus === 'pending')
                  );
                  
                  
                  const validationIndices = collectionValidations.length > 0 ? 
                    collectionValidations.map(v => v.recordIndex).filter(idx => idx !== null && idx !== undefined) : [];
                  const uniqueIndices = [...new Set(validationIndices)].sort((a, b) => a - b);
                  const maxRecordIndex = uniqueIndices.length > 0 ? Math.max(...uniqueIndices) : -1;
                  
                  return (
                  <div className="mt-0 px-0 ml-0">
                    <Card className="rounded-tl-none ml-0 bg-white dark:bg-slate-900 border-[#4F63A4]/30 h-full">
                      <CardContent className="p-0">
                        <div className="session-table-wrapper" style={{ height: 'calc(100vh - 200px)', overflow: 'auto', position: 'relative', paddingBottom: '20px' }}>
                          <Table className="session-table compact" style={{ minWidth: 'max-content' }}>
                            <TableHeader style={{ position: 'sticky', top: 0, zIndex: 50 }} className="[&_tr]:border-0">
                              <TableRow className="border-0">
                              {/* Spacer column for left padding */}
                              <TableHead className="w-1.5 h-8 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 border-r-0" style={{ width: '6px', minWidth: '6px', maxWidth: '6px' }}>
                              </TableHead>

                              {(() => {
                                // Check if we have workflow steps with values
                                const workflowStep = project?.workflowSteps?.find(
                                  step => step.stepName === collection.collectionName
                                );

                                // Use flattened columns if workflow step available (supports multi-field values)
                                const columnsToDisplay = workflowStep
                                  ? flattenStepValuesToColumns(workflowStep.values)
                                  : collection.properties;

                                // See replit.md Section 4: Data Flow Integrity
                                // CRITICAL: Never re-sort data that's already ordered by backend
                                // Backend provides columns sorted by orderIndex - preserve this order

                                const renderedValueIds = new Set<string>();
                                return columnsToDisplay
                                  .map((column: any, index: number) => {
                                    const columnId = column.id;
                                    const columnName = workflowStep ? column.valueName : column.propertyName;
                                    const columnType = workflowStep ? column.dataType : column.propertyType;
                                    const isLastColumn = index === columnsToDisplay.length - 1;
                                    const headerColumnColor = column.color;
                                    const prevColumnColor = index > 0 ? columnsToDisplay[index - 1]?.color : undefined;
                                    const showColorBorder = headerColumnColor && headerColumnColor !== prevColumnColor;
                                    const isFirstOfGroup = !column.isMultiField || !renderedValueIds.has(column.valueId);
                                    if (column.isMultiField && column.valueId) renderedValueIds.add(column.valueId);
                                    const isLastOfGroup = !column.isMultiField ||
                                      index === columnsToDisplay.length - 1 ||
                                      columnsToDisplay[index + 1]?.valueId !== column.valueId;

                                    return (
                                      <TableHead
                                        key={columnId}
                                        className={`relative h-8 py-1.5 px-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${!isLastColumn ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                                        style={{
                                          width: isLastColumn ? 'auto' : `${columnWidths[`${collection.id}-${columnId}`] || (
                                            columnName.toLowerCase().includes('description') ? 180 :
                                            columnName.toLowerCase().includes('summary') ? 180 :
                                            columnName.toLowerCase().includes('remediation') || columnName.toLowerCase().includes('action') ? 200 :
                                            columnType === 'TEXT' && (columnName.toLowerCase().includes('title') || columnName.toLowerCase().includes('name')) ? 200 :
                                            columnType === 'TEXT' ? 160 :
                                            columnType === 'NUMBER' || columnType === 'DATE' ? 120 :
                                            columnName.toLowerCase().includes('status') ? 130 :
                                      160
                                    )}px`,
                                    minWidth: isLastColumn ? '200px' : (columnName.toLowerCase().includes('description') ? '120px' : '100px'),
                                    ...(isLastColumn ? { flex: 1 } : {}),
                                    ...(showColorBorder ? { borderLeft: `2px solid ${headerColumnColor}` } : {})
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
                                              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                              title={!hasValues ?
                                                `No values in ${columnName} column` :
                                                allValid ?
                                                `All ${columnName} fields are valid. Click to set all to pending` :
                                                `Click to validate all ${columnName} fields`}
                                            >
                                              {allValid ? (
                                                <Check className="h-3.5 w-3.5 text-green-600" />
                                              ) : (
                                                <div
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: dotColor }}
                                                />
                                              )}
                                            </button>
                                          );
                                        })()}
                                        <span className="truncate pl-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{columnName.replace(/\b\w+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())}</span>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        {isLastOfGroup && (
                                        <button
                                          onClick={() => {
                                            // Use the same FieldSelectionModal as info page extraction
                                            const workflowStep = project?.workflowSteps?.find(step => step.stepName === collection.collectionName);
                                            const valueToExtract = workflowStep?.values?.find(v => v.id === (column.valueId || columnId));
                                            if (valueToExtract && valueToExtract.toolId) {
                                              handleOpenFieldSelection(valueToExtract.toolId, [valueToExtract]);
                                            }
                                          }}
                                          className="h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center flex-shrink-0"
                                          title={`Run extraction for ${columnName}`}
                                        >
                                          <Wand2 className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                                        </button>
                                        )}
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
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 rounded flex items-center justify-center transition-colors"
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
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteNonValidatedData(collection.collectionName)}
                                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                      >
                                        <AlertTriangle className="h-4 w-4 mr-2 text-gray-600" />
                                        Delete All Non Validated Data
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
                              
                              // Use flattened columns if workflow step available (supports multi-field values)
                              const columnsToDisplay: any[] = workflowStep
                                ? flattenStepValuesToColumns(workflowStep.values)
                                : collection.properties;

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

                                return columnsToDisplay.some((column: any) => {
                                  const columnName = workflowStep ? column.valueName : column.propertyName;
                                  const fieldName = `${collection.collectionName}.${columnName}[${originalIndex}]`;
                                  
                                  // Get the identifierId for this row
                                  const rowIdentifierId = (() => {
                                    // For workflow steps, get the first column (ID column) value
                                    if (workflowStep && columnsToDisplay.length > 0) {
                                      const firstColumn = columnsToDisplay[0];
                                      const idValue = item[firstColumn.valueName];

                                      // Find validation with matching ID value
                                      if (idValue) {
                                        const idValidation = validations.find(v =>
                                          v.collectionName === collection.collectionName &&
                                          v.extractedValue === idValue &&
                                          (v.valueId === firstColumn.valueId || v.valueId === firstColumn.id || v.fieldId === firstColumn.id) &&
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
                                  className="hover:bg-[#4F63A4]/5 dark:hover:bg-[#4F63A4]/10 transition-all duration-150 group/row"
                                  style={{
                                    backgroundColor: displayIndex % 2 === 0 
                                      ? 'transparent' 
                                      : 'rgba(79, 99, 164, 0.03)',
                                    boxShadow: 'inset 0 -1px 0 0 rgba(229, 231, 235, 0.5)'
                                  }}
                                >
                                  {/* Spacer cell for left padding */}
                                  <TableCell className="w-2 py-5 border-r-0" style={{ width: '6px', minWidth: '6px', maxWidth: '6px' }}>
                                  </TableCell>
                                  {(() => {
                                    // Track which multi-field groups have already rendered their magnifying glass in this row
                                    const bodyRenderedValueIds = new Set<string>();
                                    return columnsToDisplay
                                    .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                    .map((column: any, columnIndex: number) => {
                                    const columnId = column.id;
                                    const columnName = workflowStep ? column.valueName : column.propertyName;
                                    const columnType = workflowStep ? column.dataType : column.propertyType;
                                    const fieldName = `${collection.collectionName}.${columnName}[${originalIndex}]`;

                                    // Get the identifierId for this row
                                    const rowIdentifierId = (() => {
                                      // For workflow steps, get the first column (ID column) value
                                      if (workflowStep && columnsToDisplay.length > 0) {
                                        const firstColumn = columnsToDisplay[0];
                                        const idValue = item[firstColumn.valueName];

                                        // Find validation with matching ID value
                                        if (idValue) {
                                          const idValidation = validations.find(v =>
                                            v.collectionName === collection.collectionName &&
                                            v.extractedValue === idValue &&
                                            (v.valueId === firstColumn.valueId || v.valueId === firstColumn.id || v.fieldId === firstColumn.id) &&
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
                                    if (displayValue === "null" || displayValue === "undefined") {
                                      displayValue = null;
                                    } else if (displayValue === "Not Found") {
                                      displayValue = null;
                                    }
                                    
                                    const isLastColumnCell = columnIndex === columnsToDisplay.length - 1;
                                    const columnColor = (column as any).color;
                                    const prevCellColor = columnIndex > 0 ? (columnsToDisplay[columnIndex - 1] as any)?.color : undefined;
                                    const showCellColorBorder = columnColor && columnColor !== prevCellColor;

                                    return (
                                      <TableCell
                                        key={columnId}
                                        className="relative py-5 px-3"
                                        style={{
                                          width: isLastColumnCell ? 'auto' : `${columnWidths[`${collection.id}-${columnId}`] || (
                                            columnName.toLowerCase().includes('description') ? 180 :
                                            columnName.toLowerCase().includes('summary') ? 180 :
                                            columnName.toLowerCase().includes('remediation') || columnName.toLowerCase().includes('action') ? 200 :
                                            columnType === 'TEXT' && (columnName.toLowerCase().includes('title') || columnName.toLowerCase().includes('name')) ? 200 :
                                            columnType === 'TEXT' ? 160 :
                                            columnType === 'NUMBER' || columnType === 'DATE' ? 120 :
                                            columnName.toLowerCase().includes('status') ? 130 :
                                            160
                                          )}px`,
                                          minWidth: isLastColumnCell ? '200px' : (columnName.toLowerCase().includes('description') ? '120px' : '100px'),
                                          ...(isLastColumnCell ? { flex: 1 } : {}),
                                          ...(showCellColorBorder ? { borderLeft: `2px solid ${columnColor}` } : {})
                                        }}
                                      >
                                        <div className="relative w-full h-full">
                                          {/* Content */}
                                          <div className={`table-cell-content w-full pl-6 pr-6 ${
                                            columnType === 'TEXTAREA' ? 'min-h-[40px] py-2' : 'py-1.5'
                                          } break-words whitespace-normal overflow-wrap-anywhere leading-relaxed group relative text-sm dark:text-gray-200`}>
                                            <span className={`
                                              ${formatValueForDisplay(displayValue, columnType) === 'Empty' ? 'text-gray-400 dark:text-gray-500 italic text-xs' : ''}
                                              ${columnIndex === 0 ? 'font-bold text-gray-900 dark:text-white' : ''}
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

                                                const columnTool = column.toolId ? toolsMap.get(column.toolId) : null;
                                                const colDisplayConfig = columnTool?.displayConfig || columnTool?.display_config;
                                                const hasColModalDisplay = (colDisplayConfig && colDisplayConfig.modalType && colDisplayConfig.modalType !== 'none') ||
                                                  columnTool?.toolType === 'DATABASE_LOOKUP' || columnTool?.tool_type === 'DATABASE_LOOKUP';

                                                // For multi-field DB lookups, only show magnifying glass on first column of the group
                                                const isFirstOfGroupInRow = !column.isMultiField || !bodyRenderedValueIds.has(column.valueId);
                                                if (column.isMultiField && column.valueId) bodyRenderedValueIds.add(column.valueId);

                                                if (hasColModalDisplay && isFirstOfGroupInRow) {
                                                  return (
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={async () => {
                                                        // Get the datasource ID from column inputValues (where it's actually stored)
                                                        const inputValues = column.inputValues || column.input_values || {};
                                                        const dataSourceId = inputValues._dataSourceId || columnTool?.dataSourceId || columnTool?.data_source_id;
                                                        
                                                        console.log('Database lookup clicked for:', {
                                                          collectionName: collection.collectionName,
                                                          columnName,
                                                          originalIndex,
                                                          rowIdentifierId,
                                                          tool: columnTool,
                                                          dataSourceId,
                                                          inputValues
                                                        });
                                                        
                                                        // Get the datasource data
                                                        if (dataSourceId) {
                                                          try {
                                                            console.log(`📋 Loading datasource ${dataSourceId} for data table lookup...`);
                                                            const [datasourceResponse, datasourceInfo] = await Promise.all([
                                                              apiRequest(`/api/data-sources/${dataSourceId}/data`),
                                                              apiRequest(`/api/data-sources/${dataSourceId}`)
                                                            ]);
                                                            console.log(`📋 Datasource loaded: ${Array.isArray(datasourceResponse) ? datasourceResponse.length : 0} records`);
                                                            
                                                            const colInputValues = column.inputValues || {};
                                                            const rawFilters = colInputValues._searchByColumns || [];
                                                            const outputColumn = colInputValues._outputColumn || '';
                                                            
                                                            const filters = rawFilters.map((f: any) => 
                                                              typeof f === 'string' 
                                                                ? { column: f, operator: 'equals', inputField: '', fuzziness: 0 }
                                                                : { ...f, fuzziness: f.fuzziness ?? 0 }
                                                            );
                                                            
                                                            const currentInputValues: Record<string, string> = {};
                                                            if (workflowStep?.values) {
                                                              workflowStep.values.forEach((v: any) => {
                                                                if (v.orderIndex < column.orderIndex) {
                                                                  // For multi-field values, populate each field individually
                                                                  if (v.fields && v.fields.length > 0) {
                                                                    const valueValidations = validations.filter(vd =>
                                                                      vd.collectionName === collection.collectionName &&
                                                                      vd.valueId === v.id &&
                                                                      vd.identifierId === rowIdentifierId
                                                                    );
                                                                    valueValidations.forEach((val: any) => {
                                                                      if (val?.extractedValue && val.fieldName) {
                                                                        // Extract individual field name from "StepName.FieldName[idx]"
                                                                        const fieldMatch = val.fieldName.match(/^.+\.(.+)\[\d+\]$/);
                                                                        if (fieldMatch) {
                                                                          currentInputValues[fieldMatch[1]] = val.extractedValue;
                                                                        }
                                                                      }
                                                                    });
                                                                  } else {
                                                                    const val = validations.find(vd =>
                                                                      vd.collectionName === collection.collectionName &&
                                                                      vd.valueId === v.id &&
                                                                      vd.identifierId === rowIdentifierId
                                                                    );
                                                                    if (val?.extractedValue) {
                                                                      currentInputValues[v.valueName] = val.extractedValue;
                                                                    }
                                                                  }
                                                                }
                                                              });
                                                            }
                                                            
                                                            let categoryFilterByValue: string | undefined;
                                                            const filterValId = colInputValues._categoryFilterByValue;
                                                            if (filterValId && typeof filterValId === 'string') {
                                                              if (filterValId.includes('::')) {
                                                                const [valId, fName] = filterValId.split('::');
                                                                const matchV = workflowStep?.values?.find((v: any) => v.id === valId);
                                                                if (matchV) categoryFilterByValue = currentInputValues[`${matchV.valueName}.${fName}`] || undefined;
                                                              } else {
                                                                const matchV = workflowStep?.values?.find((v: any) => v.id === filterValId);
                                                                if (matchV) {
                                                                  categoryFilterByValue = currentInputValues[matchV.valueName] || undefined;
                                                                } else {
                                                                  for (const st of (steps || [])) {
                                                                    const found = st.values?.find((v: any) => v.id === filterValId);
                                                                    if (found) {
                                                                      categoryFilterByValue = currentInputValues[found.valueName] || undefined;
                                                                      break;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            
                                                            // Get sibling columns for multi-field value lookups
                                                            const siblingCols = column.isMultiField && column.valueId
                                                              ? (columnsToDisplay as FlatColumn[]).filter((c: any) => c.valueId === column.valueId)
                                                              : undefined;

                                                            setToolDisplayModal({
                                                              isOpen: true,
                                                              validation: validation || null,
                                                              column,
                                                              rowIdentifierId,
                                                              datasourceData: Array.isArray(datasourceResponse) ? datasourceResponse : [],
                                                              columnMappings: datasourceInfo?.columnMappings || datasourceInfo?.column_mappings || {},
                                                              filters,
                                                              outputColumn,
                                                              currentInputValues,
                                                              fieldName: columnName,
                                                              collectionName: collection.collectionName,
                                                              recordIndex: originalIndex,
                                                              displayConfig: (colDisplayConfig || (columnTool?.toolType === 'DATABASE_LOOKUP' || columnTool?.tool_type === 'DATABASE_LOOKUP'
                                                              ? { modalType: 'table' } : null)) as ToolDisplayConfig,
                                                              categoryColumn: colInputValues._categoryColumn || undefined,
                                                              categoryFilterByValue,
                                                              siblingColumns: siblingCols
                                                            });
                                                          } catch (error: any) {
                                                            console.error('Error loading datasource:', error);
                                                            toast({
                                                              title: "Error",
                                                              description: `Failed to load database for lookup: ${error?.message || 'Unknown error'}`,
                                                              variant: "destructive"
                                                            });
                                                          }
                                                        } else {
                                                          console.error('No data source configured for this lookup tool');
                                                          toast({
                                                            title: "Configuration Error",
                                                            description: "No data source is configured for this database lookup",
                                                            variant: "destructive"
                                                          });
                                                        }
                                                      }}
                                                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      title="Search database for match"
                                                    >
                                                      <Search className="h-3 w-3 text-[#4F63A4]" />
                                                    </Button>
                                                  );
                                                }
                                                
                                                const isDropdownColumn = columnTool?.toolType === 'DATASOURCE_DROPDOWN';

                                                // Dropdown options for DATASOURCE_DROPDOWN columns
                                                const colInputValues = (column as any).inputValues as Record<string, any> | undefined;
                                                const ddCacheKey = colInputValues?._dropdownDataSourceId
                                                  ? `${column.toolId}_${colInputValues._dropdownDataSourceId}_${colInputValues._dropdownColumn}`
                                                  : column.toolId;
                                                const ddOptions = isDropdownColumn ? (dropdownOptionsCache[ddCacheKey] || []) : [];

                                                const handleEditClick = () => {
                                                  if (isDropdownColumn && columnTool?.id) {
                                                    const colIV = (column as any).inputValues as Record<string, any> | undefined;
                                                    fetchDropdownOptions(columnTool.id, colIV);
                                                  }
                                                  if (validation) {
                                                    handleEditTableField(validation);
                                                  } else {
                                                    const tempValidation = {
                                                      id: `temp-${Date.now()}`,
                                                      collectionName: collection.collectionName,
                                                      fieldName: columnName,
                                                      recordIndex: originalIndex,
                                                      extractedValue: null,
                                                      identifierId: rowIdentifierId
                                                    } as FieldValidation;
                                                    handleEditTableField(tempValidation);
                                                  }
                                                };

                                                const popoverFieldType = isDropdownColumn ? 'DROPDOWN' as const
                                                  : columnType === 'TEXTAREA' ? 'TEXTAREA' as const
                                                  : columnType === 'DATE' ? 'DATE' as const
                                                  : columnType === 'NUMBER' ? 'NUMBER' as const
                                                  : 'TEXT' as const;

                                                return (
                                                  <FieldEditorPopover
                                                    open={isEditingThisField}
                                                    onOpenChange={(isOpen) => {
                                                      if (isOpen) {
                                                        handleEditClick();
                                                      } else {
                                                        handleCancelTableFieldEdit();
                                                      }
                                                    }}
                                                    fieldName={columnName.replace(/\b\w+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())}
                                                    initialValue={validation?.extractedValue || ""}
                                                    fieldType={popoverFieldType}
                                                    onSave={(val) => {
                                                      if (isDropdownColumn) {
                                                        handleSaveDropdownValue(val);
                                                      } else {
                                                        handleSaveTableFieldEdit(val);
                                                      }
                                                    }}
                                                    onCancel={handleCancelTableFieldEdit}
                                                    dropdownOptions={ddOptions}
                                                    dropdownLoading={isDropdownColumn && ddOptions.length === 0}
                                                  >
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      title={isDropdownColumn ? "Select from dropdown" : "Edit field value"}
                                                    >
                                                      {isDropdownColumn ? (
                                                        <ChevronDown className="h-3 w-3 text-[#4F63A4]" />
                                                      ) : (
                                                        <Edit3 className="h-3 w-3 text-gray-600 dark:text-blue-200" />
                                                      )}
                                                    </Button>
                                                  </FieldEditorPopover>
                                                );
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
                                                        <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                                          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                            <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                            <span className="text-sm font-semibold">Analysis</span>
                                                          </div>
                                                          <div className="whitespace-pre-line leading-relaxed">
                                                            {validation.aiReasoning && (
                                                              <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(validation.aiReasoning)}</div>
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
                                                          <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                                            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                              <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                              <span className="text-sm font-semibold">Analysis</span>
                                                            </div>
                                                            <div className="whitespace-pre-line leading-relaxed">
                                                              {validation.aiReasoning && (
                                                                <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(validation.aiReasoning)}</div>
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
                                                            <TooltipContent className="bg-white dark:bg-gray-800 border-2 border-[#4F63A4] dark:border-slate-600 text-blue-900 dark:text-blue-200 p-3 max-w-[400px] shadow-lg">
                                                              <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#4F63A4]/20">
                                                                <div className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                                <span className="text-sm font-semibold">Analysis</span>
                                                              </div>
                                                              <div className="whitespace-pre-line leading-relaxed">
                                                                <div className="mb-2 space-y-0.5">{formatReasoningWithBoldFields(validation.aiReasoning)}</div>
                                                                <div className="text-xs font-bold" style={{ color: '#4F63A4' }}>Click indicator to validate</div>
                                                              </div>
                                                            </TooltipContent>
                                                          )}
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    );
                                                  }
                                                } else if (!hasValue) {
                                                  // Show subtle empty indicator for missing fields
                                                  return (
                                                    <div className="absolute top-1 left-1 w-3 h-3 flex items-center justify-center">
                                                      <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
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
                                  });
                                  })()}
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
                  );
              })()}

                    </>
                  )}
                </div>
              );
            })}
        </div>
          </div>
        )}

        </ResizablePanel>

        <ResizableHandle />

        {/* Right Panel — DocPreview / CAT / both / collapsed strip */}
        <ResizablePanel
          ref={rightPanelRef}
          id="right-panel"
          order={3}
          collapsible
          defaultSize={40}
          minSize={10}
          collapsedSize={3}
          onCollapse={() => {
            setActivePanelTab(null);
            setPreviewDocumentId(null);
          }}
          onExpand={() => {
            // If expanded by dragging but nothing is open, default to messenger
            if (!activePanelTab && !previewDocumentId) {
              setActivePanelTab('messenger');
            }
          }}
        >
        {previewDocument && activePanelTab ? (
          /* Both doc-preview and CAT open — nested ResizablePanelGroup */
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel id="doc-preview" order={1} defaultSize={50} minSize={15}>
              <DocumentPreview
                document={previewDocument}
                sessionId={sessionId!}
                onClose={() => setPreviewDocumentId(null)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="cat-panel" order={2} defaultSize={50} minSize={15} collapsible collapsedSize={0} onCollapse={() => setActivePanelTab(null)}>
              <SessionPanel
                sessionId={sessionId!}
                session={session}
                validations={validations}
                project={project}
                activeTab={activePanelTab}
                onTabChange={(tab) => setActivePanelTab(tab)}
                onClose={() => setActivePanelTab(null)}
                onCollapse={() => setActivePanelTab(null)}
                onOpenTask={(cardId) => setOpenTaskCardId(cardId)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : previewDocument ? (
          /* Only doc-preview open */
          <div className="h-full min-w-0">
            <DocumentPreview
              document={previewDocument}
              sessionId={sessionId!}
              onClose={() => setPreviewDocumentId(null)}
            />
          </div>
        ) : activePanelTab ? (
          /* Only CAT panel open */
          <div className="h-full min-w-0">
            <SessionPanel
              sessionId={sessionId!}
              session={session}
              validations={validations}
              project={project}
              activeTab={activePanelTab}
              onTabChange={(tab) => setActivePanelTab(tab)}
              onClose={() => setActivePanelTab(null)}
              onCollapse={() => setActivePanelTab(null)}
              onOpenTask={(cardId) => setOpenTaskCardId(cardId)}
            />
          </div>
        ) : (
          /* Collapsed CAT sidebar strip */
          <div className="h-full bg-white dark:bg-gray-800 border-l border-gray-300 dark:border-gray-600 flex flex-col items-center pt-4 gap-3">
            {/* Expand button */}
            <button
              onClick={() => openCATPanel('messenger')}
              className="h-9 w-9 flex items-center justify-center rounded-md text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10 transition-colors"
              title="Expand panel"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            {panelTabs.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-gray-400 hover:text-[#4F63A4] hover:bg-[#4F63A4]/10"
                onClick={() => openCATPanel(id)}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        )}
        </ResizablePanel>
      </ResizablePanelGroup>{/* closes outer ResizablePanelGroup */}

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
          // Trigger session linking modal to find similar sessions
          setSessionLinkingModalOpen(true);
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
          // Trigger session linking modal to find similar sessions
          setSessionLinkingModalOpen(true);
        }}
      />
      {/* Session Linking Modal (triggered after document upload) */}
      <SessionLinkingModal
        open={sessionLinkingModalOpen}
        onClose={() => setSessionLinkingModalOpen(false)}
        sessionId={sessionId!}
        kanbanStepId={project?.workflowSteps?.find(s => s.stepType === 'kanban')?.id}
        mainObjectName={project?.mainObjectName || "Session"}
        onLinkComplete={() => {
          // Refresh kanban data after linking
          const kanbanStep = project?.workflowSteps?.find(s => s.stepType === 'kanban');
          if (kanbanStep) {
            queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${kanbanStep.id}/kanban-cards`] });
          }
          queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps`] });
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
          isFirstColumn={columnExtractionModal.isFirstColumn}
          referenceFieldNames={columnExtractionModal.referenceFieldNames}
          validations={validations}
          onConfirm={async (documentIds) => {
            if (!columnExtractionModal) return;
            
            const { stepName, valueId, valueName, previousData } = columnExtractionModal;
            
            console.log(`🎯 Running extraction for ${valueName}`);
            console.log(`🎯 Documents: ${documentIds.length} selected`);
            console.log(`🎯 Previous data: ${previousData.length} records`);
            
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
              documentIds: documentIds // Array of selected document IDs
            };
            
            try {
              setIsColumnExtracting(true);
              
              console.log(`🎯 Sending extraction request for: ${valueName} (${valueId})`);
              
              // Call the extraction endpoint
              const response = await apiRequest(`/api/sessions/${sessionId}/extract-column`, {
                method: 'POST',
                body: JSON.stringify(requestPayload)
              });
              
              console.log('Column extraction response:', response);
              
              // Check if the extraction actually failed even with a 200 response
              if (response && response.resultsCount === 0) {
                // Extraction failed - the response indicates no results were processed
                throw new Error(`Extraction failed: ${response.message || 'No values were extracted'}`);
              }
              
              // Refresh validations to check the actual extraction results
              console.log('🔄 Invalidating validation queries...');
              
              // Small delay to ensure backend operations complete
              await new Promise(resolve => setTimeout(resolve, 500));
              
              await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
              await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
              
              // Force refetch to get the latest validation results
              const validationResponse = await queryClient.refetchQueries({ queryKey: ['/api/validations/project', projectId] });
              console.log('✅ Validation queries refreshed');
              
              // Check if the extraction actually produced results
              // The API may report resultsCount > 0 but if results are filtered due to errors, no validations are saved
              const validationsData = validationResponse?.[0]?.data;
              let foundRecentValidations = false;
              let hasActualErrors = false;
              
              if (validationsData && Array.isArray(validationsData)) {
                // Look for any recent validations for this specific value (including successful ones)
                const recentValidations = validationsData.filter((v: any) => v.valueId === valueId);
                foundRecentValidations = recentValidations.length > 0;
                
                // Only check for ACTUAL errors - don't flag successful extractions as errors
                const errorValidations = recentValidations.filter((v: any) => 
                  v.documentSource === 'CODE_ERROR' || 
                  v.documentSource === 'ENGINE_ERROR' ||
                  (v.aiReasoning && v.aiReasoning.toLowerCase().includes('error')) ||
                  (v.aiReasoning && v.aiReasoning.toLowerCase().includes('failed')) ||
                  (v.extractedValue === '' && v.validationStatus !== 'valid')
                );
                
                if (errorValidations.length > 0) {
                  const errorValidation = errorValidations[0];
                  console.log('🚨 Found extraction error in validation results:', errorValidation);
                  hasActualErrors = true;
                  
                  // Throw error with the actual extraction failure details
                  throw new Error(errorValidation.aiReasoning || 'Extraction failed with unknown error');
                }
              }
              
              // Only flag as error if we processed results, have no validations, AND there are no timing issues
              // Give some extra time for database operations to complete
              if (response && response.resultsCount > 0 && !foundRecentValidations && !hasActualErrors) {
                console.log('⚠️ Results processed but validations not found yet - this may be a timing issue');
                // Don't throw error immediately - let the user see the results that may have been saved
                console.log('📝 Error details captured and displayed in modal');
              }
              
              // Close the modal if successful
              setColumnExtractionModal(null);
              
            } catch (error: any) {
              console.error('Error running column extraction:', error);
              
              // Capture input and output JSON for error display
              const inputJson = JSON.stringify(requestPayload, null, 2);
              const outputJson = error?.response ? 
                JSON.stringify(error.response, null, 2) : 
                error?.message || 'No response data available';
              
              // Update the modal state to include the error
              setColumnExtractionModal(prev => prev ? {
                ...prev,
                extractionError: {
                  message: error?.message || "Failed to extract column data. Please try again.",
                  inputJson,
                  outputJson
                }
              } : null);
              
              // Handle 409 Conflict - missing anchor records
              if (error?.status === 409 || error?.message?.includes('base rows') || error?.message?.includes('anchor records')) {
                toast({
                  title: "Cannot Extract Column",
                  description: "The base rows for this extraction have been deleted. Please re-extract the first column before extracting additional columns.",
                  variant: "destructive",
                  duration: 7000
                });
              } else {
                // General error handling - but don't show toast since error is displayed in modal
                console.log('Error details captured and displayed in modal');
              }
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
          extractionError={columnExtractionModal.extractionError}
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

      {/* Generic Tool Display Modal */}
      {toolDisplayModal && (
        <ToolResultModal
          isOpen={toolDisplayModal.isOpen}
          onClose={() => setToolDisplayModal(null)}
          onSelect={async (selectedValue: string, selectedRecord?: any) => {
            if (!toolDisplayModal) return;

            const { validation, fieldName, collectionName, recordIndex, rowIdentifierId, column, siblingColumns } = toolDisplayModal;

            console.log('Database lookup value selected:', {
              selectedValue,
              selectedRecord,
              fieldName,
              collectionName,
              recordIndex,
              rowIdentifierId,
              validationId: validation?.id,
              columnId: column?.id,
              columnValueId: column?.valueId,
              isMultiField: column?.isMultiField,
              siblingCount: siblingColumns?.length
            });

            try {
              // For multi-field values with a selected record, save each sibling field's value
              if (selectedRecord && siblingColumns && siblingColumns.length > 1) {
                console.log('Multi-field save: updating all sibling columns');
                for (const siblingCol of siblingColumns) {
                  const siblingOutputCol = siblingCol.inputValues?._outputColumn || '';
                  const siblingValue = siblingOutputCol ? (selectedRecord[siblingOutputCol]?.toString() || '') : '';
                  const siblingFieldName = `${collectionName}.${siblingCol.valueName}[${recordIndex}]`;

                  console.log(`  Sibling ${siblingCol.valueName}: outputColumn=${siblingOutputCol}, value=${siblingValue}, fieldName=${siblingFieldName}`);

                  // Find existing validation by fieldName pattern (most reliable for multi-field)
                  const siblingValidation = validations.find(v =>
                    v.identifierId === rowIdentifierId &&
                    v.fieldName?.includes(`.${siblingCol.valueName}[`)
                  );

                  if (siblingValidation?.id) {
                    await apiRequest(`/api/validations/${siblingValidation.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        extractedValue: siblingValue,
                        validationStatus: 'valid',
                        manuallyUpdated: true,
                        aiReasoning: 'Manually selected from database lookup',
                        confidenceScore: 100
                      })
                    });
                  } else {
                    const postBody: Record<string, any> = {
                      validationType: 'step_value',
                      dataType: siblingCol.dataType || 'text',
                      fieldId: siblingCol.valueId,
                      fieldName: siblingFieldName,
                      collectionName,
                      recordIndex,
                      identifierId: rowIdentifierId,
                      valueId: siblingCol.valueId,
                      extractedValue: siblingValue,
                      validationStatus: 'valid',
                      manuallyUpdated: true,
                      aiReasoning: 'Manually selected from database lookup',
                      confidenceScore: 100
                    };
                    if (column.stepId) {
                      postBody.stepId = column.stepId;
                    }
                    await apiRequest(`/api/sessions/${sessionId}/validations`, {
                      method: 'POST',
                      body: JSON.stringify(postBody)
                    });
                  }
                }
              } else if (validation?.id) {
                await apiRequest(`/api/validations/${validation.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    extractedValue: selectedValue,
                    validationStatus: 'valid',
                    manuallyUpdated: true,
                    aiReasoning: 'Manually selected from database lookup',
                    confidenceScore: 100
                  })
                });
              } else {
                // Build POST body with proper step-based fields
                const postBody: Record<string, any> = {
                  validationType: 'step_value',
                  dataType: column.dataType || 'text',
                  fieldId: column.valueId,
                  collectionName,
                  recordIndex,
                  identifierId: rowIdentifierId,
                  valueId: column.valueId,
                  extractedValue: selectedValue,
                  validationStatus: 'valid',
                  manuallyUpdated: true,
                  aiReasoning: 'Manually selected from database lookup',
                  confidenceScore: 100
                };
                // Include stepId if available from the column
                if (column.stepId) {
                  postBody.stepId = column.stepId;
                }
                await apiRequest(`/api/sessions/${sessionId}/validations`, {
                  method: 'POST',
                  body: JSON.stringify(postBody)
                });
              }

              // Invalidate validations to refresh the UI
              await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });

              toast({
                title: "Value Updated",
                description: siblingColumns && siblingColumns.length > 1
                  ? `Updated ${siblingColumns.length} fields from selected record`
                  : `Selected: ${selectedValue}`,
              });
            } catch (error: any) {
              console.error('Error saving database lookup value:', error);
              const errorMsg = error?.message || 'Unknown error';
              toast({
                title: "Error",
                description: `Failed to save selected value: ${errorMsg}`,
                variant: "destructive"
              });
              throw error; // Re-throw so the modal knows to stay open
            }
          }}
          datasourceData={toolDisplayModal.datasourceData}
          columnMappings={toolDisplayModal.columnMappings}
          initialFilters={toolDisplayModal.filters}
          outputColumn={toolDisplayModal.outputColumn}
          currentInputValues={toolDisplayModal.currentInputValues}
          displayConfig={toolDisplayModal.displayConfig}
          categoryColumn={toolDisplayModal.categoryColumn}
          categoryFilterByValue={toolDisplayModal.categoryFilterByValue}
        />
      )}


    </div>
  );
}