import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  X, 
  ChevronDown, 
  ChevronUp,
  List,
  Layers,
  FileText,
  Trash2,
  GripVertical,
  Code,
  LayoutGrid,
  Brain,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Hash,
  Calendar,
  ToggleLeft,
  Edit2,
  Upload,
  Circle,
  ChevronRight,
  Database,
  Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import type { 
  ProjectSchemaField, 
  ObjectCollection, 
  CollectionProperty,
  ExcelWizardryFunction,
  KnowledgeDocument 
} from "@shared/schema";
import { useKnowledgeDocuments } from "@/hooks/useKnowledge";
import { v4 as uuidv4 } from 'uuid';

function StatusNameInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        if (localValue !== value) {
          onChange(localValue);
        }
      }}
      onFocus={() => setIsFocused(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Status name"
      className="h-8 text-sm flex-1"
    />
  );
}

// Color palette for kanban columns - complements the extrapl purple (#4F63A4)
const KANBAN_COLUMN_COLORS = [
  '#4F63A4', // Primary purple
  '#5B8DBD', // Blue
  '#4F9A94', // Teal
  '#5EA47B', // Green
  '#C4A35A', // Gold
  '#C47B5A', // Orange
  '#A45B73', // Rose
];

// Lighter color palette for column indicators - subtle pastel shades
const COLUMN_INDICATOR_COLORS = [
  '#A8B4D4', // Light purple
  '#A3C4DB', // Light blue
  '#9DCDC9', // Light teal
  '#A8D4B8', // Light green
  '#E2D4A8', // Light gold
  '#E2BBA8', // Light orange
  '#D4A8B8', // Light rose
];

// Step action configuration type
interface StepActionConfig {
  actionName: string;
  actionStatus: string;
  actionLink?: string; // Optional URL with field placeholders like {{fieldName}}
}

interface WorkflowStep {
  id: string;
  type: 'list' | 'page' | 'kanban';
  name: string;
  description: string;
  values: WorkflowValue[];
  isExpanded: boolean;
  orderIndex: number;
  // Kanban-specific configuration
  kanbanConfig?: {
    statusColumns: string[];
    columnColors?: string[];
    aiInstructions?: string;
    knowledgeDocumentIds?: string[];
    includeUserDocuments?: boolean;
    referenceStepIds?: string[];
    dataSourceId?: string;
    dataSourceInstructions?: string;
    actions?: Array<{ name: string; applicableStatuses: string[]; link: string }>;
  };
  // Step action configuration (for page/list steps)
  actionConfig?: StepActionConfig;
  // Original data reference
  originalId?: string;
  originalType?: 'collection' | 'schema';
}

interface WorkflowValue {
  id: string;
  name: string;
  description: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CHOICE';
  toolId: string;
  inputValues: Record<string, any>;
  outputDescription?: string;
  orderIndex: number;
  // Multi-field support for Info Page values
  fields?: Array<{name: string; dataType: string; description: string}>;
  // Visual styling
  color?: string; // Optional color for column left edge indicator
  // Original data reference
  originalId?: string;
}

interface ApiDataSource {
  id: string;
  name: string;
  description?: string;
  endpointUrl: string;
  isActive: boolean;
}

interface DocumentType {
  id: string;
  name: string;
  description: string;
}

interface WorkflowBuilderProps {
  projectId: string;
  schemaFields: ProjectSchemaField[];
  collections: any[];  // Collections with properties included
  excelFunctions: ExcelWizardryFunction[];
  knowledgeDocuments: KnowledgeDocument[];
  dataSources?: ApiDataSource[];
  onSave: (steps: WorkflowStep[]) => Promise<void>;
  isLoading?: boolean;
  requiredDocumentTypes?: DocumentType[];
  onDocumentTypesChange?: (documentTypes: DocumentType[]) => void;
  defaultWorkflowStatus?: string;
  workflowStatusOptions?: string[];
  workflowStatusColors?: string[];
  onStatusSettingsChange?: (defaultStatus: string, statusOptions: string[], statusColors: string[]) => void;
  mainObjectName?: string;
  onMainObjectNameChange?: (name: string) => void;
}

export const WorkflowBuilder = forwardRef<any, WorkflowBuilderProps>(({
  projectId,
  schemaFields,
  collections,
  excelFunctions,
  knowledgeDocuments,
  dataSources = [],
  onSave,
  isLoading = false,
  requiredDocumentTypes = [],
  onDocumentTypesChange,
  defaultWorkflowStatus = '',
  workflowStatusOptions = [],
  workflowStatusColors = [],
  onStatusSettingsChange,
  mainObjectName = 'Session',
  onMainObjectNameChange
}, ref) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const { toast } = useToast();

  // Helper function to get tool output description
  function getToolOutputDescription(toolId?: string | null): string {
    if (!toolId) return '';
    const tool = excelFunctions.find(f => f.id === toolId);
    return tool?.description || 'Extracted data';
  }

  // Function to load workflow from server
  const loadWorkflow = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.steps && data.steps.length > 0) {
          // Convert server data to WorkflowStep format
          const loadedSteps = data.steps.map((serverStep: any) => ({
            id: serverStep.id,
            type: serverStep.stepType as 'list' | 'page' | 'kanban',
            name: serverStep.stepName,
            description: serverStep.description || '',
            isExpanded: false,
            orderIndex: serverStep.orderIndex || 0,
            kanbanConfig: serverStep.kanbanConfig || (serverStep.stepType === 'kanban' ? {
              statusColumns: ['To Do', 'In Progress', 'Done'],
              aiInstructions: '',
              knowledgeDocumentIds: []
            } : undefined),
            actionConfig: serverStep.actionConfig || undefined,
            values: serverStep.values ? serverStep.values.map((serverValue: any) => ({
                id: serverValue.id,
                name: serverValue.valueName,
                description: serverValue.description || getToolOutputDescription(serverValue.toolId),
                dataType: serverValue.dataType || 'TEXT',
                toolId: serverValue.toolId || 'manual',
                inputValues: serverValue.inputValues || {},
                orderIndex: serverValue.orderIndex || 0,
                fields: serverValue.fields || (serverStep.stepType === 'page' ? [] : null),
                outputDescription: serverValue.outputDescription,
                color: serverValue.color
            })) : []
          }));
          
          // Sort steps by orderIndex
          loadedSteps.sort((a: WorkflowStep, b: WorkflowStep) => a.orderIndex - b.orderIndex);
          
          // Sort values within each step by orderIndex
          loadedSteps.forEach((step: WorkflowStep) => {
            step.values.sort((a, b) => a.orderIndex - b.orderIndex);
          });
          
          setSteps(loadedSteps);
          
          // Auto-select first step if exists
          if (loadedSteps.length > 0) {
            setSelectedStepId(loadedSteps[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  // Expose save and load functions to parent
  useImperativeHandle(ref, () => ({
    save: () => saveWorkflow(),
    load: () => loadWorkflow()
  }));

  // Load workflow on mount
  useEffect(() => {
    loadWorkflow();
  }, [projectId]);

  const saveWorkflow = async () => {
    try {
      await onSave(steps);
      // Also save document types when saving extraction config
      onDocumentTypesChange?.(documentTypes);
      toast({
        title: "Success",
        description: "Workflow saved successfully"
      });
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive"
      });
    }
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: uuidv4(),
      type: 'list',
      name: `Step ${steps.length + 1}`,
      description: '',
      values: [],
      isExpanded: true,
      orderIndex: steps.length
    };
    setSteps([...steps, newStep]);
    setSelectedStepId(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const deleteStep = (stepId: string) => {
    // Filter and update orderIndex in a single state update
    const remainingSteps = steps
      .filter(step => step.id !== stepId)
      .map((step, index) => ({
        ...step,
        orderIndex: index
      }));
    
    setSteps(remainingSteps);
    
    // Clear selection if deleted step was selected
    if (selectedStepId === stepId) {
      setSelectedStepId(remainingSteps.length > 0 ? remainingSteps[0].id : null);
    }
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (
      (direction === 'up' && stepIndex === 0) ||
      (direction === 'down' && stepIndex === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    [newSteps[stepIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[stepIndex]];
    
    // Update orderIndex
    newSteps.forEach((step, index) => {
      step.orderIndex = index;
    });
    
    setSteps(newSteps);
  };

  const addValue = (stepId: string, insertAt?: number) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const newValue: WorkflowValue = {
      id: uuidv4(),
      name: `Value ${step.values.length + 1}`,
      description: '',
      dataType: 'TEXT',
      toolId: 'manual',
      inputValues: {},
      orderIndex: insertAt !== undefined ? insertAt : step.values.length,
      fields: step.type === 'page' ? [] : undefined
    };

    // If inserting at a specific position, update orderIndex for values after
    if (insertAt !== undefined) {
      step.values.forEach(v => {
        if (v.orderIndex >= insertAt) {
          v.orderIndex++;
        }
      });
    }

    const updatedValues = [...step.values, newValue];
    updatedValues.sort((a, b) => a.orderIndex - b.orderIndex);

    updateStep(stepId, { values: updatedValues });
  };

  const updateValue = (stepId: string, valueId: string, updates: Partial<WorkflowValue>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const updatedValues = step.values.map(v =>
      v.id === valueId ? { ...v, ...updates } : v
    );

    updateStep(stepId, { values: updatedValues });
  };

  const deleteValue = (stepId: string, valueId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const deletedValueIndex = step.values.findIndex(v => v.id === valueId);
    const updatedValues = step.values.filter(v => v.id !== valueId);
    
    // Update orderIndex for remaining values
    updatedValues.forEach((v, index) => {
      if (v.orderIndex > deletedValueIndex) {
        v.orderIndex--;
      }
    });

    updateStep(stepId, { values: updatedValues });
  };

  const addField = (stepId: string, valueId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step || step.type !== 'page') return;

    const value = step.values.find(v => v.id === valueId);
    if (!value) return;

    const currentFields = value.fields || [];
    const newField = {
      name: `Field ${currentFields.length + 1}`,
      dataType: 'TEXT',
      description: ''
    };

    updateValue(stepId, valueId, {
      fields: [...currentFields, newField]
    });
  };

  const updateField = (stepId: string, valueId: string, fieldIndex: number, updates: Partial<{name: string; dataType: string; description: string}>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step || step.type !== 'page') return;

    const value = step.values.find(v => v.id === valueId);
    if (!value || !value.fields) return;

    const updatedFields = [...value.fields];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], ...updates };

    updateValue(stepId, valueId, {
      fields: updatedFields
    });
  };

  const deleteField = (stepId: string, valueId: string, fieldIndex: number) => {
    const step = steps.find(s => s.id === stepId);
    if (!step || step.type !== 'page') return;

    const value = step.values.find(v => v.id === valueId);
    if (!value || !value.fields) return;

    const updatedFields = value.fields.filter((_, index) => index !== fieldIndex);

    updateValue(stepId, valueId, {
      fields: updatedFields
    });
  };

  // Document Types state
  // Local state for document types - only saved when clicking "Save Extraction"
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>(requiredDocumentTypes);
  const [isDocumentTypesExpanded, setIsDocumentTypesExpanded] = useState(requiredDocumentTypes.length > 0);
  const [expandedDocTypes, setExpandedDocTypes] = useState<Set<string>>(new Set());

  // Workflow Status state
  const [localDefaultStatus, setLocalDefaultStatus] = useState(defaultWorkflowStatus);
  const [localStatusOptions, setLocalStatusOptions] = useState<string[]>(workflowStatusOptions);
  const [localStatusColors, setLocalStatusColors] = useState<string[]>(workflowStatusColors);
  const [isStatusSettingsExpanded, setIsStatusSettingsExpanded] = useState(workflowStatusOptions.length > 0);
  
  // Main Object Name state
  const [localMainObjectName, setLocalMainObjectName] = useState(mainObjectName);
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);
  const [tempMainObjectName, setTempMainObjectName] = useState(mainObjectName);
  
  // Track expanded action sections per step
  const [expandedActionSteps, setExpandedActionSteps] = useState<Set<string>>(new Set());

  // Sync from props only on initial load or when props change externally
  useEffect(() => {
    setDocumentTypes(requiredDocumentTypes);
    if (requiredDocumentTypes.length > 0) {
      setIsDocumentTypesExpanded(true);
    }
  }, [requiredDocumentTypes]);

  // Sync status settings from props
  useEffect(() => {
    setLocalDefaultStatus(defaultWorkflowStatus);
    setLocalStatusOptions(workflowStatusOptions);
    setLocalStatusColors(workflowStatusColors);
    if (workflowStatusOptions.length > 0) {
      setIsStatusSettingsExpanded(true);
    }
  }, [defaultWorkflowStatus, workflowStatusOptions, workflowStatusColors]);

  // Sync main object name from props
  useEffect(() => {
    setLocalMainObjectName(mainObjectName);
    setTempMainObjectName(mainObjectName);
  }, [mainObjectName]);

  const handleSaveMainObjectName = () => {
    setLocalMainObjectName(tempMainObjectName);
    setIsEditingMainObjectName(false);
    if (onMainObjectNameChange) {
      onMainObjectNameChange(tempMainObjectName);
    }
  };

  // Notify parent when status settings change
  const handleStatusSettingsChange = (newDefault: string, newOptions: string[], newColors: string[]) => {
    setLocalDefaultStatus(newDefault);
    setLocalStatusOptions(newOptions);
    setLocalStatusColors(newColors);
    if (onStatusSettingsChange) {
      onStatusSettingsChange(newDefault, newOptions, newColors);
    }
  };

  const addStatusOption = () => {
    const newOptions = [...localStatusOptions, 'New Status'];
    const newColors = [...localStatusColors, KANBAN_COLUMN_COLORS[newOptions.length % KANBAN_COLUMN_COLORS.length]];
    handleStatusSettingsChange(localDefaultStatus, newOptions, newColors);
  };

  const updateStatusOption = (index: number, value: string) => {
    const newOptions = [...localStatusOptions];
    const oldValue = newOptions[index];
    newOptions[index] = value;
    const newDefault = localDefaultStatus === oldValue ? value : localDefaultStatus;
    handleStatusSettingsChange(newDefault, newOptions, localStatusColors);
  };

  const updateStatusColor = (index: number, color: string) => {
    const newColors = [...localStatusColors];
    while (newColors.length <= index) {
      newColors.push(KANBAN_COLUMN_COLORS[newColors.length % KANBAN_COLUMN_COLORS.length]);
    }
    newColors[index] = color;
    handleStatusSettingsChange(localDefaultStatus, localStatusOptions, newColors);
  };

  const deleteStatusOption = (index: number) => {
    const deletedValue = localStatusOptions[index];
    const newOptions = localStatusOptions.filter((_, i) => i !== index);
    const newColors = localStatusColors.filter((_, i) => i !== index);
    const newDefault = localDefaultStatus === deletedValue ? '' : localDefaultStatus;
    handleStatusSettingsChange(newDefault, newOptions, newColors);
  };

  const setDefaultStatus = (status: string) => {
    handleStatusSettingsChange(status, localStatusOptions, localStatusColors);
  };

  const addDocumentType = () => {
    const newDocType: DocumentType = {
      id: uuidv4(),
      name: '',
      description: ''
    };
    setDocumentTypes(prev => [...prev, newDocType]);
  };

  const updateDocumentType = (id: string, updates: Partial<DocumentType>) => {
    setDocumentTypes(prev => prev.map(dt => dt.id === id ? { ...dt, ...updates } : dt));
  };

  const deleteDocumentType = (id: string) => {
    setDocumentTypes(prev => prev.filter(dt => dt.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Two Column Layout: Left (1/3) - General Config, Right (2/3) - Extraction Stages */}
      <div className="flex gap-6">
        {/* Left Column - General Config */}
        <div className="w-1/3 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">General Config</h2>
          {/* Main Item Name Field */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-[#4F63A4]/30 p-4 shadow-sm">
            <Label className="text-xs font-medium text-[#4F63A4] dark:text-[#5A70B5] mb-1.5 block">
              Main Item Name
            </Label>
            <Input
              value={tempMainObjectName}
              onChange={(e) => {
                setTempMainObjectName(e.target.value);
                setIsEditingMainObjectName(true);
              }}
              onBlur={handleSaveMainObjectName}
              placeholder="e.g., Claim, Invoice, Contract"
              className="h-10 text-lg font-semibold border-0 border-b-2 border-[#4F63A4]/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#4F63A4]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveMainObjectName();
              }}
            />
          </div>

          {/* Document Types Configuration */}
          <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          <CardHeader 
            className="pb-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-t-lg"
            onClick={() => setIsDocumentTypesExpanded(!isDocumentTypesExpanded)}
          >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                <Upload className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <CardTitle className="text-base">Required Documents</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Documents that must be uploaded when creating a new session
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDocumentTypesExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
        </CardHeader>
        {isDocumentTypesExpanded && (
          <CardContent className="pt-0" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              {documentTypes.map((docType) => {
                const isExpanded = expandedDocTypes.has(docType.id);
                return (
                  <div
                    key={docType.id}
                    className="rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                      onClick={() => {
                        setExpandedDocTypes(prev => {
                          const next = new Set(prev);
                          if (next.has(docType.id)) next.delete(docType.id);
                          else next.add(docType.id);
                          return next;
                        });
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      {isExpanded ? (
                        <Input
                          value={docType.name}
                          onChange={(e) => updateDocumentType(docType.id, { name: e.target.value })}
                          placeholder="Document type name"
                          className="h-8 text-sm font-medium flex-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm font-medium flex-1 truncate">
                          {docType.name || 'Untitled Document Type'}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); deleteDocumentType(docType.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
                        <Textarea
                          value={docType.description}
                          onChange={(e) => updateDocumentType(docType.id, { description: e.target.value })}
                          placeholder="Describe what this document should contain (for AI validation)..."
                          className="text-sm resize-y min-h-[80px]"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDocumentType()}
                className="w-full border-dashed relative z-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Document Type
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Workflow Status Settings Card */}
      <Card 
        className="cursor-pointer hover:border-[#4F63A4]/50 transition-colors border-[#4F63A4]/30 bg-[#4F63A4]/5 dark:bg-[#4F63A4]/10"
        onClick={() => setIsStatusSettingsExpanded(!isStatusSettingsExpanded)}
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#4F63A4]/20 dark:bg-[#4F63A4]/30">
                <ChevronRight className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
              </div>
              <div>
                <CardTitle className="text-base">Workflow Status</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define status progression for sessions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isStatusSettingsExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
        </CardHeader>
        {isStatusSettingsExpanded && (
          <CardContent className="pt-0" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              {localStatusOptions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  No statuses defined. Add statuses to enable workflow tracking.
                </p>
              ) : (
                localStatusOptions.map((status, index) => {
                  const currentColor = localStatusColors[index] || KANBAN_COLUMN_COLORS[index % KANBAN_COLUMN_COLORS.length];
                  return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      localDefaultStatus === status 
                        ? 'bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 border-[#4F63A4]/40' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDefaultStatus(status)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        localDefaultStatus === status
                          ? 'border-[#4F63A4] bg-[#4F63A4]'
                          : 'border-gray-300 dark:border-gray-600 hover:border-[#4F63A4]/50'
                      }`}
                      title="Set as default status for new sessions"
                    >
                      {localDefaultStatus === status && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </button>
                    <div className="relative">
                      <Select
                        value={currentColor}
                        onValueChange={(newColor) => updateStatusColor(index, newColor)}
                      >
                        <SelectTrigger className="w-10 h-8 p-1">
                          <div 
                            className="w-5 h-5 rounded-md border border-gray-300 dark:border-gray-600"
                            style={{ backgroundColor: currentColor }}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="flex gap-1 p-1">
                            {KANBAN_COLUMN_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateStatusColor(index, color)}
                                className={`w-7 h-7 rounded-md border-2 transition-all ${
                                  currentColor === color 
                                    ? 'border-gray-800 dark:border-white scale-110' 
                                    : 'border-transparent hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <StatusNameInput
                      value={status}
                      onChange={(value) => updateStatusOption(index, value)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => deleteStatusOption(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  );
                })
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addStatusOption()}
                className="w-full border-dashed relative z-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Status
              </Button>
              {localStatusOptions.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Click the circle to set the default status for new sessions
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>
        </div>

        {/* Right Column - Extraction Stages */}
        <div className="w-2/3">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Extraction Stages</h2>
        {/* Stages List */}
        <div>
          <div className="space-y-2">
            {steps.map((step, stepIndex) => (
              <div key={step.id} className="relative">
                {/* Stage Card */}
                <div
                  className={`group cursor-pointer rounded-lg border-2 transition-all ${
                    selectedStepId === step.id
                      ? 'border-[#4F63A4] bg-[#4F63A4]/5 dark:border-[#5A70B5] dark:bg-[#5A70B5]/10'
                      : 'border-gray-200 hover:border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedStepId(step.id)}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Step Icon */}
                      <div className={`p-2 rounded-lg ${
                        selectedStepId === step.id 
                          ? 'bg-[#4F63A4]/10 dark:bg-[#5A70B5]/20' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {step.type === 'list' ? (
                          <List className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
                        ) : (
                          <FileText className="h-4 w-4 text-[#4F63A4] dark:text-[#5A70B5]" />
                        )}
                      </div>
                      
                      {/* Stage Name */}
                      <div className="flex-1">
                        {editingStepId === step.id ? (
                          <Input
                            value={step.name}
                            onChange={(e) => updateStep(step.id, { name: e.target.value })}
                            onBlur={() => setEditingStepId(null)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="h-7 px-2 text-sm font-medium"
                          />
                        ) : (
                          <div 
                            className="font-medium text-sm text-gray-900 dark:text-gray-100"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingStepId(step.id);
                            }}
                          >
                            {step.name}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {step.type === 'list' ? 'Data Table' : step.type === 'kanban' ? 'Task Board' : 'Info Page'}
                          {step.type !== 'kanban' && step.values.length > 0 && ` • ${step.values.length} values`}
                          {step.type === 'kanban' && step.kanbanConfig?.statusColumns && ` • ${step.kanbanConfig.statusColumns.length} columns`}
                        </div>
                      </div>
                    </div>

                    {/* Stage Actions */}
                    <div className="flex items-center gap-1">
                      {/* Expand/Collapse Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStepId(expandedStepId === step.id ? null : step.id);
                        }}
                      >
                        {expandedStepId === step.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingStepId(step.id);
                        }}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          updateStep(step.id, { type: step.type === 'list' ? 'page' : 'list' });
                        }}>
                          {step.type === 'list' ? (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Convert to Info Page
                            </>
                          ) : (
                            <>
                              <List className="h-4 w-4 mr-2" />
                              Convert to Data Table
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(step.id, 'up');
                          }}
                          disabled={stepIndex === 0}
                        >
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(step.id, 'down');
                          }}
                          disabled={stepIndex === steps.length - 1}
                        >
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Move Down
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(step.id);
                          }}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Stage
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>

                {/* Expanded Stage Configuration - inside the stage card border */}
                {expandedStepId === step.id && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-4">
                      {/* Stage Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Stage Name
                        </label>
                        <Input
                          value={step.name}
                          onChange={(e) => updateStep(step.id, { name: e.target.value })}
                          placeholder="Enter stage name..."
                          className="w-full"
                        />
                      </div>

                      {/* Step Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <textarea
                          value={step.description || ''}
                          onChange={(e) => updateStep(step.id, { description: e.target.value })}
                          placeholder="Describe what this stage extracts..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                          rows={3}
                        />
                      </div>

                      {/* Stage Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Stage Type
                        </label>
                        <div className="flex gap-4 flex-wrap">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`step-type-${step.id}`}
                              checked={step.type === 'page'}
                              onChange={() => updateStep(step.id, { type: 'page' })}
                              className="mr-2 text-[#4F63A4]"
                            />
                            <FileText className="h-4 w-4 mr-1 text-[#4F63A4]" />
                            <span className="text-sm">Info Page</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`step-type-${step.id}`}
                              checked={step.type === 'list'}
                              onChange={() => updateStep(step.id, { type: 'list' })}
                              className="mr-2 text-[#4F63A4]"
                            />
                            <List className="h-4 w-4 mr-1 text-[#4F63A4]" />
                            <span className="text-sm">Data Table</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`step-type-${step.id}`}
                              checked={step.type === 'kanban'}
                              onChange={() => updateStep(step.id, { 
                                type: 'kanban',
                                kanbanConfig: step.kanbanConfig || {
                                  statusColumns: ['To Do', 'In Progress', 'Done'],
                                  aiInstructions: '',
                                  knowledgeDocumentIds: []
                                }
                              })}
                              className="mr-2 text-[#4F63A4]"
                            />
                            <LayoutGrid className="h-4 w-4 mr-1 text-[#4F63A4]" />
                            <span className="text-sm">Task Board</span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {step.type === 'page' 
                            ? 'Extract single values from documents' 
                            : step.type === 'list'
                            ? 'Extract multiple rows of data'
                            : 'AI-generated task board for tracking work items'}
                        </p>
                      </div>

                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

                    {/* Values Section - Nested inside the step */}
                    <div className="space-y-3">
                      {step.type === 'kanban' ? (
                        /* Kanban Configuration */
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Task Board Configuration
                          </h4>
                          
                          {/* Status Columns */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Status Columns
                            </label>
                            <div className="space-y-2">
                              {(step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done']).map((col, colIndex) => {
                                const currentColors = step.kanbanConfig?.columnColors || [];
                                const currentColor = currentColors[colIndex] || KANBAN_COLUMN_COLORS[colIndex % KANBAN_COLUMN_COLORS.length];
                                return (
                                  <div key={colIndex} className="flex gap-2 items-center">
                                    <div className="relative">
                                      <Select
                                        value={currentColor}
                                        onValueChange={(newColor) => {
                                          const newColors = [...currentColors];
                                          while (newColors.length <= colIndex) {
                                            newColors.push(KANBAN_COLUMN_COLORS[newColors.length % KANBAN_COLUMN_COLORS.length]);
                                          }
                                          newColors[colIndex] = newColor;
                                          updateStep(step.id, {
                                            kanbanConfig: {
                                              ...step.kanbanConfig,
                                              statusColumns: step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done'],
                                              columnColors: newColors
                                            }
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="w-12 h-9 p-1">
                                          <div 
                                            className="w-6 h-6 rounded-md border border-gray-300 dark:border-gray-600"
                                            style={{ backgroundColor: currentColor }}
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <div className="flex gap-1 p-1">
                                            {KANBAN_COLUMN_COLORS.map((color) => (
                                              <button
                                                key={color}
                                                type="button"
                                                onClick={() => {
                                                  const newColors = [...currentColors];
                                                  while (newColors.length <= colIndex) {
                                                    newColors.push(KANBAN_COLUMN_COLORS[newColors.length % KANBAN_COLUMN_COLORS.length]);
                                                  }
                                                  newColors[colIndex] = color;
                                                  updateStep(step.id, {
                                                    kanbanConfig: {
                                                      ...step.kanbanConfig,
                                                      statusColumns: step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done'],
                                                      columnColors: newColors
                                                    }
                                                  });
                                                }}
                                                className={`w-7 h-7 rounded-md border-2 transition-all ${
                                                  currentColor === color 
                                                    ? 'border-gray-800 dark:border-white scale-110' 
                                                    : 'border-transparent hover:border-gray-400'
                                                }`}
                                                style={{ backgroundColor: color }}
                                              />
                                            ))}
                                          </div>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Input
                                      value={col}
                                      onChange={(e) => {
                                        const newColumns = [...(step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done'])];
                                        newColumns[colIndex] = e.target.value;
                                        updateStep(step.id, {
                                          kanbanConfig: {
                                            ...step.kanbanConfig,
                                            statusColumns: newColumns
                                          }
                                        });
                                      }}
                                      placeholder="Column name"
                                      className="flex-1"
                                      style={{ borderLeftColor: currentColor, borderLeftWidth: '3px' }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newColumns = (step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done']).filter((_, i) => i !== colIndex);
                                        const newColors = (step.kanbanConfig?.columnColors || []).filter((_, i) => i !== colIndex);
                                        updateStep(step.id, {
                                          kanbanConfig: {
                                            ...step.kanbanConfig,
                                            statusColumns: newColumns,
                                            columnColors: newColors
                                          }
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                      disabled={(step.kanbanConfig?.statusColumns || []).length <= 2}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentColumns = step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done'];
                                  const currentColors = step.kanbanConfig?.columnColors || [];
                                  const newColumns = [...currentColumns, 'New Status'];
                                  const newColors = [...currentColors, KANBAN_COLUMN_COLORS[newColumns.length % KANBAN_COLUMN_COLORS.length]];
                                  updateStep(step.id, {
                                    kanbanConfig: {
                                      ...step.kanbanConfig,
                                      statusColumns: newColumns,
                                      columnColors: newColors
                                    }
                                  });
                                }}
                                className="w-full"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Column
                              </Button>
                            </div>
                          </div>

                          {/* AI Instructions */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              AI Task Generation Instructions
                            </label>
                            <Textarea
                              value={step.kanbanConfig?.aiInstructions || ''}
                              onChange={(e) => {
                                updateStep(step.id, {
                                  kanbanConfig: {
                                    ...step.kanbanConfig,
                                    statusColumns: step.kanbanConfig?.statusColumns || ['To Do', 'In Progress', 'Done'],
                                    aiInstructions: e.target.value
                                  }
                                });
                              }}
                              placeholder="Describe how the AI should analyze documents to generate tasks..."
                              rows={3}
                            />
                          </div>
                        </div>
                      ) : (
                        /* Values for Info Page / Data Table */
                        <>
                          {step.values.map((value, valueIndex) => (
                            <ValueCard
                              key={value.id}
                              step={step}
                              value={value}
                              excelFunctions={excelFunctions}
                              knowledgeDocuments={knowledgeDocuments}
                              dataSources={dataSources}
                              allSteps={steps}
                              currentValueIndex={valueIndex}
                              onUpdate={(updates) => updateValue(step.id, value.id, updates)}
                              onDelete={() => deleteValue(step.id, value.id)}
                              onAddField={() => addField(step.id, value.id)}
                              onUpdateField={(fieldIndex, updates) => updateField(step.id, value.id, fieldIndex, updates)}
                              onDeleteField={(fieldIndex) => deleteField(step.id, value.id, fieldIndex)}
                            />
                          ))}

                          {/* Add Value Button - only show if no action configured */}
                          {!step.actionConfig && (
                            <button
                              onClick={() => addValue(step.id)}
                              className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#4F63A4] dark:border-gray-600 dark:hover:border-[#5A70B5] flex items-center justify-center gap-2 transition-colors group"
                            >
                              <Plus className="h-4 w-4 text-gray-500 group-hover:text-[#4F63A4] dark:text-gray-400 dark:group-hover:text-[#5A70B5]" />
                              <span className="text-sm font-medium text-gray-600 group-hover:text-[#4F63A4] dark:text-gray-400 dark:group-hover:text-[#5A70B5]">
                                Add Value
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Stage Action Configuration - for all stage types */}
                      {step.actionConfig ? (
                            <div className="rounded-lg overflow-hidden border border-[#4F63A4]/40">
                              {/* Collapsible Header */}
                              <div 
                                className="flex items-center justify-between p-3 bg-[#4F63A4] cursor-pointer"
                                onClick={() => {
                                  const newExpanded = new Set(expandedActionSteps);
                                  if (newExpanded.has(step.id)) {
                                    newExpanded.delete(step.id);
                                  } else {
                                    newExpanded.add(step.id);
                                  }
                                  setExpandedActionSteps(newExpanded);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedActionSteps.has(step.id) ? (
                                    <ChevronDown className="h-4 w-4 text-white" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-white" />
                                  )}
                                  <span className="font-medium text-white">Stage Action</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStep(step.id, { actionConfig: undefined });
                                  }}
                                  className="h-7 px-2 text-red-200 hover:text-white hover:bg-red-500/30"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              
                              {/* Collapsible Content */}
                              {expandedActionSteps.has(step.id) && (
                                <div className="p-4 bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 space-y-3">
                                  <div>
                                    <Label className="text-xs text-gray-600 dark:text-gray-400">Button Text</Label>
                                    <Input
                                      value={step.actionConfig.actionName}
                                      onChange={(e) => updateStep(step.id, { 
                                        actionConfig: { ...step.actionConfig!, actionName: e.target.value }
                                      })}
                                      placeholder="e.g., Submit, Approve, Complete"
                                      className="mt-1 h-8"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label className="text-xs text-gray-600 dark:text-gray-400">Set Status To</Label>
                                    <Select
                                      value={step.actionConfig.actionStatus}
                                      onValueChange={(value) => updateStep(step.id, { 
                                        actionConfig: { ...step.actionConfig!, actionStatus: value }
                                      })}
                                    >
                                      <SelectTrigger className="mt-1 h-8">
                                        <SelectValue placeholder="Select a status..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {localStatusOptions.map((status) => (
                                          <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-xs text-gray-600 dark:text-gray-400">Link (optional)</Label>
                                    <Input
                                      value={step.actionConfig.actionLink || ''}
                                      onChange={(e) => updateStep(step.id, { 
                                        actionConfig: { ...step.actionConfig!, actionLink: e.target.value || undefined }
                                      })}
                                      placeholder="https://example.com?id={{Field Name}}"
                                      className="mt-1 h-8"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      Use {"{{Field Name}}"} to insert field values in the URL
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                updateStep(step.id, { 
                                  actionConfig: { 
                                    actionName: 'Complete', 
                                    actionStatus: 'Complete' 
                                  }
                                });
                                // Auto-expand when adding action
                                const newExpanded = new Set(expandedActionSteps);
                                newExpanded.add(step.id);
                                setExpandedActionSteps(newExpanded);
                              }}
                              className="w-full py-3 rounded-lg border-2 border-dashed border-[#4F63A4]/30 hover:border-[#4F63A4] dark:border-[#4F63A4]/40 dark:hover:border-[#5A70B5] flex items-center justify-center gap-2 transition-colors group bg-[#4F63A4]/5 hover:bg-[#4F63A4]/10"
                            >
                              <ChevronRight className="h-4 w-4 text-[#4F63A4]/60 group-hover:text-[#4F63A4]" />
                              <span className="text-sm font-medium text-[#4F63A4]/70 group-hover:text-[#4F63A4]">
                                Add Action
                              </span>
                            </button>
                      )}
                    </div>
                  </div>
                )}
                </div>

                {/* Connector line to next step */}
                {stepIndex < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                )}


              </div>
            ))}

            {/* Add Stage Button */}
            <div className="pt-2">
              {steps.length > 0 && (
                <div className="flex justify-center pb-2">
                  <div className="w-0.5 h-6 border-l-2 border-dashed border-gray-400 dark:border-gray-600"></div>
                </div>
              )}
              <Button
                onClick={addStep}
                variant="outline"
                className="w-full gap-2 border-2 border-dashed border-gray-300 hover:border-[#4F63A4] dark:border-gray-600 dark:hover:border-[#5A70B5]"
              >
                <Plus className="h-4 w-4" />
                Add Stage
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
});

// Value Card Component
interface ValueCardProps {
  step: WorkflowStep;
  value: WorkflowValue;
  excelFunctions: ExcelWizardryFunction[];
  knowledgeDocuments: KnowledgeDocument[];
  dataSources: ApiDataSource[];
  allSteps: WorkflowStep[];
  currentValueIndex: number;
  onUpdate: (updates: Partial<WorkflowValue>) => void;
  onDelete: () => void;
  onAddField?: () => void;
  onUpdateField?: (fieldIndex: number, updates: Partial<{name: string; dataType: string; description: string}>) => void;
  onDeleteField?: (fieldIndex: number) => void;
}

function ValueCard({
  step,
  value,
  excelFunctions,
  knowledgeDocuments,
  dataSources,
  allSteps,
  currentValueIndex,
  onUpdate,
  onDelete,
  onAddField,
  onUpdateField,
  onDeleteField
}: ValueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  
  const isManual = value.toolId === "manual";
  const selectedTool = !isManual ? excelFunctions.find(f => f.id === value.toolId) : null;
  const [inputParameters, setInputParameters] = useState<any[]>([]);

  // Parse tool input parameters
  useEffect(() => {
    if (!isManual && selectedTool?.inputParameters) {
      try {
        let params = typeof selectedTool.inputParameters === 'string' 
          ? JSON.parse(selectedTool.inputParameters)
          : selectedTool.inputParameters;
        
        // Handle different parameter structures
        if (params && typeof params === 'object' && !Array.isArray(params)) {
          // Convert object format to array format
          params = Object.entries(params).map(([key, param]: [string, any]) => ({
            id: key,
            name: param.name || param.label || key,
            label: param.label || param.name || key,
            type: param.type || 'text',
            placeholder: param.placeholder || param.description || '',
            description: param.description || '',
            required: param.required !== false,
            ...param
          }));
        } else if (Array.isArray(params)) {
          // Ensure each param has proper structure
          params = params.map((param: any) => ({
            id: param.id || param.key || Math.random().toString(),
            name: param.name || param.label || param.id || 'Parameter',
            label: param.label || param.name || param.id || 'Parameter',
            type: param.type || 'text',
            placeholder: param.placeholder || param.description || '',
            description: param.description || '',
            required: param.required !== false,
            ...param
          }));
        }
        
        setInputParameters(Array.isArray(params) ? params : []);
      } catch (error) {
        console.error("Error parsing input parameters:", error);
        setInputParameters([]);
      }
    } else {
      setInputParameters([]);
    }
  }, [selectedTool, value.toolId]);

  // Get available values for referencing
  // When expandInfoPageFields=true, also includes individual fields from info page values
  const getAvailableValues = (expandInfoPageFields: boolean = false) => {
    const availableValues: Array<{id: string; valueId: string; name: string; stepName: string; fieldName?: string}> = [];
    
    // Get current step index
    const currentStepIndex = allSteps.findIndex(s => s.id === step.id);
    
    // Helper to add a value (and optionally its fields)
    const addValue = (v: any, stepName: string, stepType: string) => {
      // Add the value itself
      availableValues.push({
        id: v.id,
        valueId: v.id,
        name: v.name,
        stepName: stepName
      });
      
      // For info page values with fields, also add individual fields
      if (expandInfoPageFields && stepType === 'page' && v.fields && Array.isArray(v.fields)) {
        v.fields.forEach((field: { name: string; type: string }) => {
          if (field.name) {
            availableValues.push({
              id: `${v.id}::${field.name}`,
              valueId: `${v.id}::${field.name}`,
              name: `${v.name}.${field.name}`,
              stepName: stepName,
              fieldName: field.name
            });
          }
        });
      }
    };
    
    // Add all values from previous steps
    for (let i = 0; i < currentStepIndex; i++) {
      const prevStep = allSteps[i];
      prevStep.values.forEach(v => {
        addValue(v, prevStep.name, prevStep.type);
      });
    }
    
    // Add previous values from current step based on orderIndex
    const currentOrderIndex = value.orderIndex !== undefined ? value.orderIndex : currentValueIndex;
    
    step.values.forEach(v => {
      const vOrderIndex = v.orderIndex !== undefined ? v.orderIndex : step.values.indexOf(v);
      if (vOrderIndex < currentOrderIndex && v.id !== value.id) {
        addValue(v, step.name, step.type);
      }
    });
    
    return availableValues;
  };

  // Get value status icon
  const getValueIcon = () => {
    if (selectedTool) {
      return <div className="w-2 h-2 bg-green-500 rounded-full" />;
    }
    return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
  };

  return (
    <div className={`group cursor-pointer rounded-lg border-2 transition-all ${
      isExpanded
        ? 'border-[#4F63A4] bg-[#4F63A4]/5 dark:border-[#5A70B5] dark:bg-[#5A70B5]/10'
        : 'border-gray-200 hover:border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
    }`}>
      <div className="p-4">
        {!isExpanded ? (
          /* Collapsed State - Compact */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Icon */}
              <div className={`p-2 rounded-lg ${
                selectedTool 
                  ? 'bg-green-100 dark:bg-green-900/20' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {getValueIcon()}
              </div>
              
              {/* Name and Description */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {value.name || "Untitled Value"}
                  </span>
                  {selectedTool && (
                    <Badge variant="outline" className="text-xs">
                      {selectedTool.toolType === "AI_ONLY" ? (
                        <>
                          <Brain className="h-3 w-3 mr-1" />
                          {selectedTool.name}
                        </>
                      ) : (
                        <>
                          <Code className="h-3 w-3 mr-1" />
                          {selectedTool.name}
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                {value.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {value.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded State */
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={`p-2 rounded-lg ${
                  selectedTool 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {getValueIcon()}
                </div>
                
                {/* Name */}
                <div>
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {value.name || "Untitled Value"}
                  </span>
                  {selectedTool && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedTool.toolType === "AI_ONLY" ? 'AI Tool' : 'Function Tool'}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
            {/* Name input */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Name</Label>
              <Input
                value={value.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Value name..."
                className="h-8 text-sm"
              />
            </div>

            {/* Per-value AI description/instructions for non-page steps */}
            {step.type !== 'page' && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">AI Instructions</Label>
                <Input
                  value={value.description || ''}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  placeholder="Instructions for AI extraction (e.g. 'The total amount in EUR')"
                  className="h-8 text-sm"
                />
              </div>
            )}
            
            {/* Color picker for Data Table columns */}
            {step.type === 'list' && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Column Color</Label>
                <div className="flex items-center gap-2">
                  <Select value={value.color || 'none'} onValueChange={(v) => onUpdate({ color: v === 'none' ? undefined : v })}>
                    <SelectTrigger className="h-8 w-full text-sm">
                      <div className="flex items-center gap-2">
                        {value.color ? (
                          <>
                            <div 
                              className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600" 
                              style={{ backgroundColor: value.color }}
                            />
                            <span>{value.color}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">No color</span>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-gray-500">No color</span>
                      </SelectItem>
                      <div className="flex gap-1 p-1 flex-wrap">
                        {COLUMN_INDICATOR_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => onUpdate({ color })}
                            className={`w-6 h-6 rounded border-2 transition-all ${value.color === color ? 'border-white ring-2 ring-offset-1 ring-gray-400' : 'border-transparent hover:border-gray-300'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                  {value.color && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ color: undefined })}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Data Type for Data Table */}
            {step.type === 'list' && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Data Type</Label>
                <Select value={value.dataType} onValueChange={(v) => onUpdate({ dataType: v as any })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="DATE">Date</SelectItem>
                    <SelectItem value="BOOLEAN">Boolean</SelectItem>
                    <SelectItem value="CHOICE">Choice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Fields for Info Page */}
            {step.type === 'page' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Fields</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onAddField}
                    className="h-6 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                {value.fields && value.fields.length > 0 ? (
                  <div className="space-y-3">
                    {value.fields.map((field, index) => (
                      <div key={index} className="border rounded-md p-2 bg-gray-50 dark:bg-gray-800 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={field.name}
                            onChange={(e) => onUpdateField?.(index, { name: e.target.value })}
                            placeholder="Field name"
                            className="h-7 text-xs flex-1"
                          />
                          <Select 
                            value={field.dataType} 
                            onValueChange={(v) => onUpdateField?.(index, { dataType: v })}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TEXT">Text</SelectItem>
                              <SelectItem value="NUMBER">Number</SelectItem>
                              <SelectItem value="DATE">Date</SelectItem>
                              <SelectItem value="BOOLEAN">Boolean</SelectItem>
                              <SelectItem value="CHOICE">Choice</SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => onDeleteField?.(index)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <X className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                        <Input
                          value={field.description || ''}
                          onChange={(e) => onUpdateField?.(index, { description: e.target.value })}
                          placeholder="AI instructions for this field (e.g. 'The date the incident occurred')"
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    No fields defined
                  </p>
                )}
              </div>
            )}

            {/* Tool Selection */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Extraction Tool</Label>
              <Select value={value.toolId} onValueChange={(v) => onUpdate({ toolId: v, inputValues: {} })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select tool..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <div className="px-2 py-1 text-xs text-gray-500 font-semibold">AI Tools</div>
                  {excelFunctions.filter(f => f.toolType === "AI_ONLY").map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      <div className="flex items-center gap-2">
                        <Brain className="h-3 w-3 text-purple-500" />
                        <span>{func.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs text-gray-500 font-semibold mt-2">Function Tools</div>
                  {excelFunctions.filter(f => f.toolType !== "AI_ONLY").map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      <div className="flex items-center gap-2">
                        <Code className="h-3 w-3 text-blue-500" />
                        <span>{func.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTool && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTool.description}
                </p>
              )}
            </div>

            {/* Data Source Selector for DATABASE_LOOKUP tools */}
            {selectedTool?.toolType === "DATABASE_LOOKUP" && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Data Source *</Label>
                <Select 
                  value={(value.inputValues as Record<string, any>)?._dataSourceId || ''} 
                  onValueChange={(v) => onUpdate({ 
                    inputValues: { 
                      ...(value.inputValues as Record<string, any> || {}), 
                      _dataSourceId: v 
                    } 
                  })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select data source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.filter(ds => ds.isActive).map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        <div className="flex items-center gap-2">
                          <Database className="h-3 w-3 text-green-500" />
                          <span>{ds.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {dataSources.filter(ds => ds.isActive).length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-500">
                        No data sources configured. Add one in the Connect tab.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Select the external data source to look up values from.
                </p>
                
                {/* Search By Columns - show when data source is selected */}
                {(value.inputValues as Record<string, any>)?._dataSourceId && (() => {
                  const selectedDataSource = dataSources.find(
                    ds => ds.id === (value.inputValues as Record<string, any>)?._dataSourceId
                  ) as any;
                  const cachedData = selectedDataSource?.cachedData;
                  let columns: string[] = [];
                  
                  // Extract columns from cached data
                  if (cachedData) {
                    try {
                      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
                      const dataArray = Array.isArray(parsed) ? parsed : 
                                        parsed?.data?.entries || parsed?.entries || parsed?.data || [];
                      if (dataArray.length > 0) {
                        columns = Object.keys(dataArray[0]);
                      }
                    } catch (e) {
                      console.error('Failed to parse data source columns:', e);
                    }
                  }
                  
                  const columnMappings = (selectedDataSource?.columnMappings as Record<string, string>) || {};
                  const rawSelectedColumns = (value.inputValues as Record<string, any>)?._searchByColumns || [];
                  
                  // Migrate legacy role-based category to _categoryColumn
                  const currentInputValues = (value.inputValues as Record<string, any>) || {};
                  if (!currentInputValues._categoryColumn) {
                    const legacyCat = rawSelectedColumns.find((item: any) => typeof item === 'object' && item.role === 'category');
                    if (legacyCat) {
                      onUpdate({ inputValues: { ...currentInputValues, _categoryColumn: legacyCat.column } });
                    }
                  }
                  
                  // Normalize to new format: {column, operator, inputField, fuzziness}
                  const selectedColumns: Array<{column: string, operator: string, inputField: string, fuzziness: number}> = 
                    rawSelectedColumns
                    .filter((item: any) => !(typeof item === 'object' && item.role === 'category'))
                    .map((item: any) => 
                      typeof item === 'string' 
                        ? { column: item, operator: 'equals', inputField: '', fuzziness: 0 }
                        : { column: item.column, operator: item.operator || 'equals', inputField: item.inputField || '', fuzziness: item.fuzziness ?? 0 }
                    );
                  
                  // Get available input fields from previous values in step (expand info page fields for database lookup)
                  const availableInputFields = getAvailableValues(true);
                  
                  const operators = [
                    { value: 'equals', label: '=' },
                    { value: 'contains', label: 'contains' },
                    { value: 'startsWith', label: 'starts with' },
                    { value: 'endsWith', label: 'ends with' }
                  ];
                  
                  if (columns.length === 0) return null;
                  
                  // Get columns already selected
                  const selectedColumnIds = selectedColumns.map(c => c.column);
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
                        Search By Columns (filter priority order)
                      </Label>
                      
                      {/* Selected columns with order */}
                      {selectedColumns.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {selectedColumns.map((filterConfig, index: number) => {
                            const displayName = columnMappings[filterConfig.column] || filterConfig.column;
                            const fuzzinessLabel = filterConfig.fuzziness === 0 ? 'Exact' : 
                                                   filterConfig.fuzziness <= 30 ? 'Low' :
                                                   filterConfig.fuzziness <= 60 ? 'Medium' : 'High';
                            return (
                              <div key={filterConfig.column} className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4F63A4] text-white text-[10px] flex items-center justify-center font-medium">
                                    {index + 1}
                                  </span>
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[60px]" title={filterConfig.column !== displayName ? `${displayName} (${filterConfig.column})` : filterConfig.column}>
                                    {displayName}
                                    {(() => {
                                      const isMapTool = (selectedTool as any)?.displayConfig?.modalType === 'map' || (selectedTool as any)?.display_config?.modalType === 'map';
                                      if (isMapTool) {
                                        const posLabel = index === 0 ? 'City' : index === 1 ? 'Street' : null;
                                        if (posLabel) return <span className="ml-1 text-[#4F63A4] dark:text-slate-400 text-[10px]">({posLabel})</span>;
                                        return null;
                                      }
                                      if (index === 0) {
                                        return <span className="ml-1 text-[#4F63A4] dark:text-slate-400 text-[10px]">(Primary)</span>;
                                      }
                                      return null;
                                    })()}
                                  </span>
                                  
                                  {/* Operator selector */}
                                  <select
                                    value={filterConfig.operator}
                                    onChange={(e) => {
                                      const newColumns = [...selectedColumns];
                                      newColumns[index] = { ...filterConfig, operator: e.target.value };
                                      onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                    }}
                                    className="text-[10px] px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                  >
                                    {operators.map(op => (
                                      <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                  </select>
                                  
                                  {/* Input field selector */}
                                  <select
                                    value={filterConfig.inputField}
                                    onChange={(e) => {
                                      const newColumns = [...selectedColumns];
                                      newColumns[index] = { ...filterConfig, inputField: e.target.value };
                                      onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                    }}
                                    className="flex-1 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                  >
                                    <option value="">Select input field...</option>
                                    {availableInputFields.map(field => (
                                      <option key={field.id} value={field.name}>{field.name}</option>
                                    ))}
                                  </select>
                                  
                                  <div className="flex gap-0.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => {
                                        if (index > 0) {
                                          const newColumns = [...selectedColumns];
                                          [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
                                          onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                        }
                                      }}
                                      className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 text-xs"
                                      title="Move up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === selectedColumns.length - 1}
                                      onClick={() => {
                                        if (index < selectedColumns.length - 1) {
                                          const newColumns = [...selectedColumns];
                                          [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
                                          onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                        }
                                      }}
                                      className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 text-xs"
                                      title="Move down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newColumns = selectedColumns.filter((_, i) => i !== index);
                                        onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                      }}
                                      className="p-0.5 text-red-500 hover:text-red-700 text-xs"
                                      title="Remove"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Fuzziness slider */}
                                <div className="flex items-center gap-2 mt-1.5 pl-7">
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400 w-[45px]">Fuzziness:</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={filterConfig.fuzziness}
                                    onChange={(e) => {
                                      const newColumns = [...selectedColumns];
                                      newColumns[index] = { ...filterConfig, fuzziness: parseInt(e.target.value) };
                                      onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                                    }}
                                    className="flex-1 h-1 accent-[#4F63A4]"
                                  />
                                  <span className={`text-[10px] min-w-[40px] text-right ${
                                    filterConfig.fuzziness === 0 ? 'text-green-600 dark:text-green-400' :
                                    filterConfig.fuzziness <= 30 ? 'text-blue-600 dark:text-blue-400' :
                                    filterConfig.fuzziness <= 60 ? 'text-yellow-600 dark:text-yellow-400' : 
                                    'text-orange-600 dark:text-orange-400'
                                  }`}>
                                    {fuzzinessLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Available columns to add */}
                      <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto bg-white dark:bg-gray-800 p-2 rounded border">
                        {columns.filter(col => !selectedColumnIds.includes(col)).map((col) => {
                          const displayName = columnMappings[col] || col;
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                const newColumns = [...selectedColumns, { column: col, operator: 'equals', inputField: '', fuzziness: 0 }];
                                onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _searchByColumns: newColumns } });
                              }}
                              className="flex items-center gap-2 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                            >
                              <span className="text-green-500">+</span>
                              <span className="truncate" title={col !== displayName ? `${displayName} (${col})` : col}>
                                {displayName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Click to add columns. First column = primary filter (most restrictive).
                      </p>
                      
                      {/* Categorization Column - only for map tools */}
                      {(() => {
                        const toolDCCat = (selectedTool as any)?.displayConfig || (selectedTool as any)?.display_config;
                        if (toolDCCat?.modalType === 'map') {
                          return (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 block">
                                Categorization Column <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                              </Label>
                              <select
                                value={(value.inputValues as Record<string, any>)?._categoryColumn || ''}
                                onChange={(e) => {
                                  onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _categoryColumn: e.target.value || '' } });
                                }}
                                className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">None</option>
                                {columns.map((col) => {
                                  const displayName = columnMappings[col] || col;
                                  return (
                                    <option key={col} value={col}>
                                      {displayName} {col !== displayName ? `(${col})` : ''}
                                    </option>
                                  );
                                })}
                              </select>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Color-codes map pins by category values.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Output Column Selector */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 block">
                          Output Column
                        </Label>
                        <select
                          value={(value.inputValues as Record<string, any>)?._outputColumn || ''}
                          onChange={(e) => {
                            onUpdate({ inputValues: { ...(value.inputValues as Record<string, any> || {}), _outputColumn: e.target.value } });
                          }}
                          className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Select output column...</option>
                          {columns.map((col) => {
                            const displayName = columnMappings[col] || col;
                            return (
                              <option key={col} value={col}>
                                {displayName} {col !== displayName ? `(${col})` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          The column value to extract when a match is found.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tool Parameters - hidden for map lookup tools since search columns handle the inputs */}
            {selectedTool && inputParameters.length > 0 && !((selectedTool as any)?.displayConfig?.modalType === 'map' || (selectedTool as any)?.display_config?.modalType === 'map') && (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg space-y-3">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tool Parameters</Label>
                {inputParameters.map((param: any) => {
                  // Determine the actual parameter type
                  const paramType = param.type?.toLowerCase() || 'text';
                  const paramName = param.name?.toLowerCase() || '';
                  
                  // For DATABASE_LOOKUP tools, hide AI Instructions and Document parameters
                  // as filtering is now done via the Search By Columns config with fuzziness
                  if (selectedTool.toolType === 'DATABASE_LOOKUP') {
                    if (paramName.includes('instruction') || paramName.includes('prompt') || 
                        paramType === 'document' || paramName.includes('document')) {
                      return null;
                    }
                  }
                  
                  // Check for document types
                  const isUserDocument = paramType === 'document' || paramType.includes('user_document') || 
                                        (paramName.includes('document') && !paramName.includes('reference') && !paramName.includes('input'));
                  const isReferenceDocument = paramType.includes('reference_document') || 
                                             paramType.includes('knowledge') || paramName.includes('knowledge') || 
                                             paramName.includes('reference document');
                  
                  // Check for field/value references - including 'Input Data' parameter
                  const isFieldReference = paramType === 'reference' || paramType === 'field_reference' || 
                                          paramType === 'value_reference' || paramName.includes('referenced') || 
                                          paramName.includes('input data') || paramName === 'input data' ||
                                          (paramName.includes('field') && paramName.includes('reference')) ||
                                          // Additional patterns for data references
                                          paramName.includes('info') || paramName.includes('data') ||
                                          paramType.includes('data') || paramType.includes('info');
                  
                  // Check for text types
                  const isPrompt = paramType === 'text' && (param.multiline === true || paramName.includes('instruction') || 
                                                            paramName.includes('prompt'));
                  const isBoolean = paramType === 'boolean' || paramType === 'bool';
                  
                  return (
                  <div key={param.id} className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-400">
                      {param.name || param.label || param.id}
                      {param.required !== false && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {isFieldReference && !isReferenceDocument ? (
                      <div className="space-y-2">
                        <div className="border rounded-lg p-2 bg-white dark:bg-gray-800 min-h-[32px]">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const selectedValues = value.inputValues?.[param.id] || [];
                              const selectedArray = Array.isArray(selectedValues) ? selectedValues : 
                                                   (selectedValues ? [selectedValues] : []);
                              const availableVals = getAvailableValues();
                              
                              return selectedArray.length > 0 ? (
                                selectedArray.map((valueId: string) => {
                                  const selected = availableVals.find(av => av.valueId === valueId);
                                  return selected ? (
                                    <div key={valueId} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                                      <span>{selected.stepName} → {selected.name}</span>
                                      <button
                                        onClick={() => {
                                          const newValues = selectedArray.filter((v: string) => v !== valueId);
                                          onUpdate({
                                            inputValues: {
                                              ...value.inputValues,
                                              [param.id]: newValues
                                            }
                                          });
                                        }}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : null;
                                })
                              ) : (
                                <span className="text-xs text-gray-400">Select fields to reference...</span>
                              );
                            })()}
                          </div>
                        </div>
                        
                        <Select
                          value=""
                          onValueChange={(v) => {
                            const currentValues = value.inputValues?.[param.id] || [];
                            const currentArray = Array.isArray(currentValues) ? currentValues : 
                                               (currentValues ? [currentValues] : []);
                            if (!currentArray.includes(v)) {
                              onUpdate({
                                inputValues: {
                                  ...value.inputValues,
                                  [param.id]: [...currentArray, v]
                                }
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Add field reference..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableValues().length > 0 ? (
                              <>
                                {/* Group by step for better organization */}
                                {(() => {
                                  const availableVals = getAvailableValues();
                                  const currentValues = value.inputValues?.[param.id] || [];
                                  const currentArray = Array.isArray(currentValues) ? currentValues : 
                                                     (currentValues ? [currentValues] : []);
                                  const groupedValues: Record<string, typeof availableVals> = {};
                                  
                                  availableVals
                                    .filter(av => !currentArray.includes(av.valueId))
                                    .forEach(av => {
                                      if (!groupedValues[av.stepName]) {
                                        groupedValues[av.stepName] = [];
                                      }
                                      groupedValues[av.stepName].push(av);
                                    });
                                  
                                  return Object.entries(groupedValues).map(([stepName, values]) => (
                                    <div key={stepName}>
                                      <div className="px-2 py-1 text-xs text-gray-500 font-semibold">{stepName}</div>
                                      {values.map((av) => (
                                        <SelectItem key={av.id} value={av.valueId}>
                                          <div className="flex items-center gap-2 pl-2">
                                            <Circle className="h-2 w-2 text-gray-400" />
                                            <span>{av.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </div>
                                  ));
                                })()}
                              </>
                            ) : (
                              <div className="px-2 py-1 text-xs text-gray-500">No previous values available</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : isReferenceDocument ? (
                      <Select
                        value={value.inputValues?.[param.id] || ''}
                        onValueChange={(v) => {
                          onUpdate({
                            inputValues: {
                              ...value.inputValues,
                              [param.id]: v
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800">
                          <SelectValue placeholder="Select knowledge document..." />
                        </SelectTrigger>
                        <SelectContent>
                          {knowledgeDocuments.length > 0 ? (
                            knowledgeDocuments.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3 w-3 text-gray-400" />
                                  <span>{doc.displayName || doc.fileName || 'Untitled Document'}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1 text-xs text-gray-500">No knowledge documents available</div>
                          )}
                        </SelectContent>
                      </Select>
                    ) : isUserDocument ? (
                      <Select
                        value={value.inputValues?.[param.id] || ''}
                        onValueChange={(v) => {
                          onUpdate({
                            inputValues: {
                              ...value.inputValues,
                              [param.id]: v
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800">
                          <SelectValue placeholder="Select document source..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user_document">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-blue-500" />
                              <span>User Uploaded Document</span>
                            </div>
                          </SelectItem>
                          {knowledgeDocuments.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-xs text-gray-500 font-semibold">Knowledge Documents</div>
                              {knowledgeDocuments.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3 w-3 text-gray-400" />
                                    <span>{doc.displayName || doc.fileName || 'Untitled Document'}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : isBoolean ? (
                      <Select
                        value={String(value.inputValues?.[param.id] || 'false')}
                        onValueChange={(v) => {
                          onUpdate({
                            inputValues: {
                              ...value.inputValues,
                              [param.id]: v === 'true'
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : isPrompt ? (
                      <Textarea
                        value={value.inputValues?.[param.id] || ''}
                        onChange={(e) => {
                          onUpdate({
                            inputValues: {
                              ...value.inputValues,
                              [param.id]: e.target.value
                            }
                          });
                        }}
                        placeholder={param.placeholder || 'Enter text...'}
                        className="min-h-[60px] text-xs bg-white dark:bg-gray-800 resize-y"
                      />
                    ) : (
                      <Input
                        value={value.inputValues?.[param.id] || ''}
                        onChange={(e) => {
                          onUpdate({
                            inputValues: {
                              ...value.inputValues,
                              [param.id]: e.target.value
                            }
                          });
                        }}
                        placeholder={param.placeholder || `Enter ${param.type || 'value'}...`}
                        className="h-8 text-xs bg-white dark:bg-gray-800"
                      />
                    )}
                    {param.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{param.description}</p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Description */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Description</Label>
              <Textarea
                value={value.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="What does this value extract?"
                className="min-h-[64px] text-xs resize-y"
              />
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

WorkflowBuilder.displayName = 'WorkflowBuilder';