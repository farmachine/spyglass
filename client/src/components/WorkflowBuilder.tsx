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
  ChevronRight
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

interface WorkflowStep {
  id: string;
  type: 'list' | 'page';
  name: string;
  description: string;
  values: WorkflowValue[];
  isExpanded: boolean;
  orderIndex: number;
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
  // Original data reference
  originalId?: string;
}

interface WorkflowBuilderProps {
  projectId: string;
  schemaFields: ProjectSchemaField[];
  collections: any[];  // Collections with properties included
  excelFunctions: ExcelWizardryFunction[];
  knowledgeDocuments: KnowledgeDocument[];
  onSave: (steps: WorkflowStep[]) => Promise<void>;
}

export const WorkflowBuilder = forwardRef<any, WorkflowBuilderProps>(({
  projectId,
  schemaFields,
  collections,
  excelFunctions,
  knowledgeDocuments,
  onSave
}, ref) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
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
            type: serverStep.stepType as 'list' | 'page',
            name: serverStep.stepName,
            description: serverStep.description || '',
            isExpanded: false,
            orderIndex: serverStep.orderIndex || 0,
            values: serverStep.values ? serverStep.values.map((serverValue: any) => ({
              id: serverValue.id,
              name: serverValue.valueName,
              description: serverValue.description || getToolOutputDescription(serverValue.toolId),
              dataType: serverValue.dataType || 'TEXT',
              toolId: serverValue.toolId || 'manual',
              inputValues: serverValue.inputValues || {},
              orderIndex: serverValue.orderIndex || 0,
              fields: serverValue.fields || (serverStep.stepType === 'page' ? [] : null),
              outputDescription: serverValue.outputDescription
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
    setSteps(steps.filter(step => step.id !== stepId));
    // Update orderIndex for remaining steps
    setSteps(prev => prev.map((step, index) => ({
      ...step,
      orderIndex: index
    })));
    
    // Clear selection if deleted step was selected
    if (selectedStepId === stepId) {
      setSelectedStepId(steps.length > 1 ? steps[0].id : null);
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

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#071e54] dark:text-[#5A70B5]">Extraction Steps</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Design your data extraction workflow</p>
        </div>
        <Button 
          onClick={saveWorkflow} 
          className="bg-[#4F63A4] hover:bg-[#3E4F85] text-white"
        >
          Save Extraction Steps
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="flex gap-6">
        {/* Left Column - Steps List */}
        <div className="w-80 flex-shrink-0">
          <div className="space-y-2">
            {steps.map((step, stepIndex) => (
              <div key={step.id} className="relative">
                {/* Step Card */}
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
                      
                      {/* Step Name */}
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
                          {step.type === 'list' ? 'Data Table' : 'Info Page'}
                          {step.values.length > 0 && ` • ${step.values.length} values`}
                        </div>
                      </div>
                    </div>

                    {/* Step Actions */}
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
                          Delete Step
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Connector line to next step */}
                {stepIndex < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                )}

                {/* Connection line to values (only for selected step) */}
                {selectedStepId === step.id && step.values.length > 0 && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 w-8 h-0.5 bg-[#4F63A4] dark:bg-[#5A70B5]"></div>
                )}
              </div>
            ))}

            {/* Add Step Button */}
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
                Add Step
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column - Values for Selected Step */}
        <div className="flex-1 min-w-0">
          {selectedStepId ? (
            <div className="space-y-4">
              {/* Selected Step Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {steps.find(s => s.id === selectedStepId)?.name} Values
                </h3>
                {steps.find(s => s.id === selectedStepId)?.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {steps.find(s => s.id === selectedStepId)?.description}
                  </p>
                )}
              </div>

              {/* Values Stack - Vertical layout for better space */}
              <div className="space-y-4">
                {steps.find(s => s.id === selectedStepId)?.values.map((value, valueIndex) => (
                  <ValueCard
                    key={value.id}
                    step={steps.find(s => s.id === selectedStepId)!}
                    value={value}
                    excelFunctions={excelFunctions}
                    knowledgeDocuments={knowledgeDocuments}
                    allSteps={steps}
                    currentValueIndex={valueIndex}
                    onUpdate={(updates) => updateValue(selectedStepId, value.id, updates)}
                    onDelete={() => deleteValue(selectedStepId, value.id)}
                    onAddField={() => addField(selectedStepId, value.id)}
                    onUpdateField={(fieldIndex, updates) => updateField(selectedStepId, value.id, fieldIndex, updates)}
                    onDeleteField={(fieldIndex) => deleteField(selectedStepId, value.id, fieldIndex)}
                  />
                ))}

                {/* Add Value Button - Below the stacked values */}
                <button
                  onClick={() => addValue(selectedStepId)}
                  className="w-full py-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#4F63A4] dark:border-gray-600 dark:hover:border-[#5A70B5] flex items-center justify-center gap-2 transition-colors group"
                >
                  <Plus className="h-4 w-4 text-gray-500 group-hover:text-[#4F63A4] dark:text-gray-400 dark:group-hover:text-[#5A70B5]" />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-[#4F63A4] dark:text-gray-400 dark:group-hover:text-[#5A70B5]">
                    Add Value
                  </span>
                </button>
              </div>

              {/* Empty State */}
              {steps.find(s => s.id === selectedStepId)?.values.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No values defined for this step</p>
                  <p className="text-sm mt-1">Click "Add Value" to create one</p>
                </div>
              )}
            </div>
          ) : (
            /* No Step Selected */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Layers className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {steps.length === 0 ? 'No steps created yet' : 'Select a step to view its values'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {steps.length === 0 ? 'Click "Add Step" to get started' : 'Click on a step in the left panel'}
                </p>
              </div>
            </div>
          )}
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
        const params = typeof selectedTool.inputParameters === 'string' 
          ? JSON.parse(selectedTool.inputParameters)
          : selectedTool.inputParameters;
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
  const getAvailableValues = () => {
    const availableValues: Array<{id: string; valueId: string; name: string; stepName: string}> = [];
    
    // Get current step index
    const currentStepIndex = allSteps.findIndex(s => s.id === step.id);
    
    // Add all values from previous steps
    for (let i = 0; i < currentStepIndex; i++) {
      const prevStep = allSteps[i];
      prevStep.values.forEach(v => {
        availableValues.push({
          id: v.id,
          valueId: v.id,
          name: v.name,
          stepName: prevStep.name
        });
      });
    }
    
    // Add previous values from current step based on orderIndex
    const currentOrderIndex = value.orderIndex !== undefined ? value.orderIndex : currentValueIndex;
    
    step.values.forEach(v => {
      const vOrderIndex = v.orderIndex !== undefined ? v.orderIndex : step.values.indexOf(v);
      if (vOrderIndex < currentOrderIndex && v.id !== value.id) {
        availableValues.push({
          id: v.id,
          valueId: v.id,
          name: v.name,
          stepName: step.name
        });
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getValueIcon()}
            {selectedTool && (
              selectedTool.toolType === "AI_ONLY" ? 
                <Brain className="h-4 w-4 text-gray-600 dark:text-gray-400" /> :
                <Code className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {value.name || "Untitled"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {!isExpanded ? (
          <div className="space-y-2">
            {value.description && (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {value.description}
              </p>
            )}
            {selectedTool && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {selectedTool.name}
                </Badge>
              </div>
            )}
            {step.type === 'page' && value.fields && value.fields.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {value.fields.length} field{value.fields.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ) : (
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
                  <div className="space-y-2">
                    {value.fields.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
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
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => onDeleteField?.(index)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <X className="h-3 w-3 text-gray-500" />
                        </button>
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
              <Select value={value.toolId} onValueChange={(v) => onUpdate({ toolId: v })}>
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

            {/* Tool Parameters */}
            {selectedTool && inputParameters.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg space-y-3">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tool Parameters</Label>
                {inputParameters.map((param: any) => (
                  <div key={param.id} className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-400">
                      {param.label || param.id}
                      {param.required !== false && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {param.type === 'value_reference' || param.type === 'field_reference' ? (
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
                          <SelectValue placeholder="Select field or value..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableValues().length > 0 ? (
                            getAvailableValues().map((av) => (
                              <SelectItem key={av.id} value={av.valueId}>
                                <div className="flex items-center gap-2">
                                  <Circle className="h-2 w-2 text-gray-400" />
                                  <span>{av.stepName}</span>
                                  <ChevronRight className="h-3 w-3 text-gray-400" />
                                  <span className="font-medium">{av.name}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1 text-xs text-gray-500">No previous values available</div>
                          )}
                        </SelectContent>
                      </Select>
                    ) : param.type === 'knowledge_reference' || param.type === 'knowledge_document' ? (
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
                    ) : param.type === 'boolean' ? (
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
                    ) : param.type === 'text' || param.type === 'prompt' ? (
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
                        className="min-h-[60px] text-xs bg-white dark:bg-gray-800 resize-none"
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
                ))}
              </div>
            )}

            {/* Description */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Description</Label>
              <Textarea
                value={value.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="What does this value extract?"
                className="h-16 text-xs resize-none"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

WorkflowBuilder.displayName = 'WorkflowBuilder';