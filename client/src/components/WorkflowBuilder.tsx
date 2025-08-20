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
  Edit2
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
import type { 
  ProjectSchemaField, 
  ObjectCollection, 
  CollectionProperty,
  ExcelWizardryFunction,
  KnowledgeDocument 
} from "@shared/schema";
import { useKnowledgeDocuments } from "@/hooks/useKnowledge";

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

  // Convert existing data to workflow steps on mount
  useEffect(() => {
    const workflowSteps: WorkflowStep[] = [];
    let orderIndex = 0;

    // Convert collections to list steps
    collections.forEach(collection => {
      const values: WorkflowValue[] = (collection.properties || []).map((prop: CollectionProperty) => ({
        id: prop.id,
        name: prop.propertyName,
        description: prop.description || '',
        dataType: prop.propertyType as WorkflowValue['dataType'],
        toolId: prop.functionId || '',
        inputValues: (prop as any).functionParameters || {},
        outputDescription: getToolOutputDescription(prop.functionId),
        orderIndex: prop.orderIndex || 0,
        originalId: prop.id
      }));

      workflowSteps.push({
        id: collection.id,
        type: 'list',
        name: collection.collectionName,
        description: collection.description || '',
        values: values.sort((a, b) => a.orderIndex - b.orderIndex),
        isExpanded: true,
        orderIndex: orderIndex++,
        originalId: collection.id,
        originalType: 'collection'
      });
    });

    // Group schema fields into a page step if they exist
    if (schemaFields.length > 0) {
      const values: WorkflowValue[] = schemaFields.map(field => ({
        id: field.id,
        name: field.fieldName,
        description: field.description || '',
        dataType: field.fieldType as WorkflowValue['dataType'],
        toolId: field.functionId || '',
        inputValues: field.functionParameters || {},
        outputDescription: getToolOutputDescription(field.functionId),
        orderIndex: field.orderIndex || 0,
        originalId: field.id
      }));

      workflowSteps.push({
        id: 'schema-page',
        type: 'page',
        name: 'Data Fields',
        description: 'Main data extraction fields',
        values: values.sort((a, b) => a.orderIndex - b.orderIndex),
        isExpanded: true,
        orderIndex: orderIndex++,
        originalId: 'schema-page',
        originalType: 'schema'
      });
    }

    setSteps(workflowSteps.sort((a, b) => a.orderIndex - b.orderIndex));
  }, [schemaFields, collections]);

  function getToolOutputDescription(toolId?: string | null): string {
    if (!toolId) return '';
    const tool = excelFunctions.find(f => f.id === toolId);
    return tool?.description || 'Extracted data';
  }

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: 'list',
      name: '',
      description: '',
      values: [],
      isExpanded: true,
      orderIndex: steps.length
    };
    setSteps([...steps, newStep]);
    setEditingStepId(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const deleteStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId));
  };

  const addValue = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const newValue: WorkflowValue = {
      id: `value-${Date.now()}`,
      name: '',
      description: '',
      dataType: 'TEXT',
      toolId: '',
      inputValues: {},
      orderIndex: step.values.length
    };

    updateStep(stepId, {
      values: [...step.values, newValue]
    });
  };

  const updateValue = (stepId: string, valueId: string, updates: Partial<WorkflowValue>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, {
      values: step.values.map(value => 
        value.id === valueId ? { ...value, ...updates } : value
      )
    });
  };

  const deleteValue = (stepId: string, valueId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, {
      values: step.values.filter(value => value.id !== valueId)
    });
  };

  const toggleStepExpanded = (stepId: string) => {
    updateStep(stepId, {
      isExpanded: !steps.find(s => s.id === stepId)?.isExpanded
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < steps.length) {
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      // Update orderIndex
      newSteps.forEach((step, idx) => {
        step.orderIndex = idx;
      });
      setSteps(newSteps);
    }
  };

  const handleSaveChanges = () => {
    // Log the workflow data as JSON
    const workflowData = {
      steps: steps.map(step => ({
        id: step.id,
        name: step.name,
        type: step.type,
        description: step.description,
        orderIndex: step.orderIndex,
        values: step.values.map(value => ({
          id: value.id,
          name: value.name,
          dataType: value.dataType,
          description: value.description,
          toolId: value.toolId,
          inputValues: value.inputValues
        }))
      }))
    };
    
    console.log('===== UPDATE FLOW - WORKFLOW DATA =====');
    console.log(JSON.stringify(workflowData, null, 2));
    console.log('========================================');
    
    // Collapse all steps
    const collapsedSteps = steps.map(step => ({
      ...step,
      isExpanded: false
    }));
    setSteps(collapsedSteps);
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    collapseAll: handleSaveChanges
  }));

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col items-center">
        {/* Start dot and arrow */}
        {steps.length > 0 && (
          <>
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-8 bg-gray-300"></div>
              <ChevronDown className="h-5 w-5 text-gray-400 -mt-1" />
            </div>
          </>
        )}
        
        {steps.map((step, stepIndex) => (
          <div key={step.id} className="flex flex-col items-center w-3/4">
            <Card className="relative w-full bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
            <CardHeader className="pb-4 relative">
              <div className="flex flex-col items-center">
                {/* Icon and Title - Centered */}
                <div className="flex items-center gap-2 mb-2">
                  {step.type === 'list' ? (
                    <List className="h-5 w-5 text-gray-700" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-700" />
                  )}
                  
                  {editingStepId === step.id ? (
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(step.id, { name: e.target.value })}
                      onBlur={() => setEditingStepId(null)}
                      placeholder="Name..."
                      className="max-w-xs text-center"
                      autoFocus
                    />
                  ) : (
                    <CardTitle 
                      className="text-lg cursor-pointer text-gray-900 hover:text-gray-700"
                      onClick={() => setEditingStepId(step.id)}
                    >
                      {step.name || 'Unnamed'}
                    </CardTitle>
                  )}
                </div>



                {/* Description and Dot - Centered (collapsed only) */}
                {!step.isExpanded && step.description && (
                  <div className="flex flex-col items-center">
                    <p className="text-sm text-gray-600 text-center">{step.description}</p>
                    <div className="mt-2 w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                )}

                {/* Controls - Top right corner */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => toggleStepExpanded(step.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {step.isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-gray-200 rounded">
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white">
                      <DropdownMenuItem 
                        onClick={() => moveStep(stepIndex, 'up')}
                        disabled={stepIndex === 0}
                        className="text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => moveStep(stepIndex, 'down')}
                        disabled={stepIndex === steps.length - 1}
                        className="text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Move Down
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-200" />
                      <DropdownMenuItem 
                        onClick={() => deleteStep(step.id)}
                        className="text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {step.isExpanded && (
                <div className="mt-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Name</Label>
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(step.id, { name: e.target.value })}
                        placeholder="Enter name..."
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={step.type}
                        onValueChange={(value) => updateStep(step.id, { type: value as 'list' | 'page' })}
                      >
                        <SelectTrigger className="w-[130px] mt-2">
                          <SelectValue>
                            {step.type === 'list' ? 'Data Table' : 'Info Page'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="list">Data Table</SelectItem>
                          <SelectItem value="page">Info Page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>

            {step.isExpanded && (
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm text-gray-700">Values</h4>
                </div>

                {step.values.map((value, valueIndex) => (
                  <div key={value.id}>
                    <ValueEditor
                      step={step}
                      value={value}
                      excelFunctions={excelFunctions}
                      knowledgeDocuments={knowledgeDocuments}
                      allSteps={steps}
                      currentValueIndex={valueIndex}
                      onUpdate={(updates) => updateValue(step.id, value.id, updates)}
                      onDelete={() => deleteValue(step.id, value.id)}
                    />
                    {/* Grey line between values */}
                    {valueIndex < step.values.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-0.5 h-4 bg-gray-300"></div>
                      </div>
                    )}
                  </div>
                ))}

                {step.values.length === 0 && (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    No values defined. Click "Add Value" to create one.
                  </div>
                )}

                {/* Dotted line to Add Value button */}
                {step.values.length > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-4 border-l-2 border-dashed border-gray-300"></div>
                  </div>
                )}

                {/* Add Value button below value cards */}
                <div className="flex justify-center pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addValue(step.id)}
                    className="gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Add Value
                  </Button>
                </div>

                {/* Description Section with dot format */}
                <div className="mt-6 p-4 bg-white rounded-lg group relative">
                  <div className="flex flex-col items-center">
                    {editingDescription === step.id ? (
                      <Textarea
                        value={step.description}
                        onChange={(e) => updateStep(step.id, { description: e.target.value })}
                        onBlur={() => setEditingDescription(null)}
                        placeholder="Describe what this extracts..."
                        className="text-sm text-gray-800 text-center resize-none w-full mb-3"
                        rows={2}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="text-sm text-gray-800 text-center w-full mb-3">
                          {step.description || "Click to add description..."}
                        </p>
                        <button
                          onClick={() => setEditingDescription(step.id)}
                          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
                        >
                          <Edit2 className="h-4 w-4 text-gray-600" />
                        </button>
                      </>
                    )}
                    <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
          
          {/* Arrow between steps */}
          {stepIndex < steps.length - 1 && (
            <div className="flex flex-col items-center py-2">
              <div className="w-0.5 h-8 bg-gray-300"></div>
              <ChevronDown className="h-5 w-5 text-gray-400 -mt-1" />
            </div>
          )}
          </div>
        ))}

        {steps.length === 0 ? (
          <>
            {/* Start dot for empty state */}
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-8 bg-gray-300"></div>
              <ChevronDown className="h-5 w-5 text-gray-400 -mt-1" />
            </div>
            
            <Card className="p-12 w-3/4 bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workflow steps yet</h3>
                <p className="text-gray-600 mb-4">Start building your workflow by adding a step</p>
                <Button onClick={addStep} className="gap-2 bg-gray-700 hover:bg-gray-800">
                  <Plus className="h-4 w-4" />
                  Add First Step
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* Dotted line from last card */}
            <div className="flex flex-col items-center py-2">
              <div className="w-0.5 h-8 border-l-2 border-dashed border-gray-400"></div>
              <ChevronDown className="h-5 w-5 text-gray-400 -mt-1" />
            </div>
            
            {/* Add Step button */}
            <Button 
              onClick={addStep} 
              className="gap-2 bg-gray-700 hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

// Value Editor Component
interface ValueEditorProps {
  step: WorkflowStep;
  value: WorkflowValue;
  excelFunctions: ExcelWizardryFunction[];
  knowledgeDocuments: KnowledgeDocument[];
  allSteps: WorkflowStep[];
  currentValueIndex: number;
  onUpdate: (updates: Partial<WorkflowValue>) => void;
  onDelete: () => void;
}

function ValueEditor({
  step,
  value,
  excelFunctions,
  knowledgeDocuments,
  allSteps,
  currentValueIndex,
  onUpdate,
  onDelete
}: ValueEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  
  // Get available values for referencing
  const getAvailableValues = () => {
    const availableValues: Array<{id: string; name: string; stepName: string}> = [];
    
    // Get current step index
    const currentStepIndex = allSteps.findIndex(s => s.id === step.id);
    
    // Add all values from previous steps
    for (let i = 0; i < currentStepIndex; i++) {
      const prevStep = allSteps[i];
      prevStep.values.forEach(v => {
        availableValues.push({
          id: `@${prevStep.name}.${v.name}`,
          name: v.name,
          stepName: prevStep.name
        });
      });
    }
    
    // Add previous values from current step
    for (let i = 0; i < currentValueIndex; i++) {
      const prevValue = step.values[i];
      availableValues.push({
        id: `@${step.name}.${prevValue.name}`,
        name: prevValue.name,
        stepName: step.name
      });
    }
    
    return availableValues;
  };
  
  // Filter tools based on step type
  const filteredTools = excelFunctions.filter(tool => {
    if (step.type === 'list') {
      // Data Table - show tools with multiple output
      return tool.outputType === 'multiple';
    } else {
      // Info Page - show tools with single output
      return tool.outputType === 'single';
    }
  });
  
  const selectedTool = filteredTools.find(f => f.id === value.toolId);
  const [inputParameters, setInputParameters] = useState<any[]>([]);

  // Parse tool input parameters
  useEffect(() => {
    if (selectedTool?.inputParameters) {
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
  }, [selectedTool]);



  // Value icon - matches the tool type
  const getValueIcon = () => {
    if (selectedTool) {
      if (selectedTool.toolType === "AI_ONLY") {
        return <Brain className="h-4 w-4 text-blue-500" />;
      } else {
        return <Code className="h-4 w-4 text-gray-500" />;
      }
    }
    // Default dot when no tool selected
    return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
  };

  return (
    <div className="border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all rounded-lg p-4 space-y-3 bg-white relative">
      <div className="flex flex-col items-center">
        {/* Icon and Name Header - Centered, Non-editable */}
        <div className="flex items-center gap-2 mb-1">
          {/* Value icon */}
          {getValueIcon()}
          
          {/* Name Display Only */}
          <div className="font-medium text-gray-900">
            {value.name || "Untitled Value"}
          </div>
        </div>

        {/* Description - Centered when collapsed */}
        {!isExpanded && value.description && (
          <p className="text-sm text-gray-600 text-center">{value.description}</p>
        )}

        {/* Controls - Top right corner */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Name and Data Type on same row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1">Name</Label>
              <Input
                value={value.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Value name..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Data Type</Label>
              <Select
                value={value.dataType}
                onValueChange={(val) => onUpdate({ dataType: val as WorkflowValue['dataType'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">T</span>
                      <span>Text</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="NUMBER">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span>Number</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DATE">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Date</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="BOOLEAN">
                    <div className="flex items-center gap-2">
                      <ToggleLeft className="h-4 w-4" />
                      <span>Checkbox</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="CHOICE">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <span>Choice</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tool */}
          <div>
            <Label>Tool</Label>
            <Select
              value={value.toolId}
              onValueChange={(val) => onUpdate({ toolId: val })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select tool..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTools.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">
                    No {step.type === 'list' ? 'multiple output' : 'single output'} tools available
                  </div>
                ) : (
                  filteredTools.map((tool) => (
                    <SelectItem 
                      key={tool.id} 
                      value={tool.id}
                      className={tool.toolType === "AI_ONLY" ? "focus:bg-gray-100" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {tool.toolType === "AI_ONLY" ? (
                          <Brain className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Code className="h-4 w-4 text-gray-500" />
                        )}
                        <span>{tool.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Input Parameters - integrated without container */}
          {inputParameters.length > 0 && (
            <div className="space-y-3 mt-4">
              <Label className="text-sm font-medium">Input Values</Label>
              {inputParameters.map((param) => (
                <div key={param.id}>
                  <Label className="text-xs">{param.name}</Label>
                  {param.type === 'data' ? (
                    <div className="mt-1 space-y-2">
                      {/* Selected value badges */}
                      {(() => {
                        // For Data Table steps, the first value is the identifier
                        let identifierRef = null;
                        if (step.type === 'list' && step.values[0]) {
                          identifierRef = `@${step.name}.${step.values[0].name}`;
                        }
                        
                        // Ensure identifier ref is always included if it exists
                        const currentValues = value.inputValues[param.id] || [];
                        const allValues = identifierRef 
                          ? [...new Set([identifierRef, ...currentValues])]
                          : currentValues;
                        
                        if (allValues.length > 0) {
                          return (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {allValues.map((valueRef: string, index: number) => {
                                // Split the reference to display with dot separator
                                const parts = valueRef.replace('@', '').split('.');
                                const isIdentifier = valueRef === identifierRef;
                                
                                return (
                                  <Badge 
                                    key={valueRef} 
                                    className={`flex items-center gap-1.5 ${
                                      isIdentifier 
                                        ? 'bg-gray-700 text-white border-gray-700' 
                                        : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span>{parts[0]}</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      isIdentifier ? 'bg-gray-400' : 'bg-slate-500'
                                    }`} />
                                    <span>{parts[1]}</span>
                                    {!isIdentifier && (
                                      <X 
                                        className="h-3 w-3 cursor-pointer hover:text-red-500 ml-1"
                                        onClick={() => {
                                          const updatedValues = currentValues.filter((v: string) => v !== valueRef);
                                          onUpdate({
                                            inputValues: { ...value.inputValues, [param.id]: updatedValues }
                                          });
                                        }}
                                      />
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Value reference dropdown - only show non-identifier values */}
                      <Select
                        value=""
                        onValueChange={(valueRef) => {
                          const currentValues = value.inputValues[param.id] || [];
                          if (!currentValues.includes(valueRef)) {
                            const updatedValues = [...currentValues, valueRef];
                            onUpdate({
                              inputValues: { ...value.inputValues, [param.id]: updatedValues }
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Add additional values to reference..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            // Filter out the identifier value if this is a Data Table step
                            let identifierRef = null;
                            if (step.type === 'list' && step.values[0]) {
                              identifierRef = `@${step.name}.${step.values[0].name}`;
                            }
                            
                            const currentValues = value.inputValues[param.id] || [];
                            const availableValues = getAvailableValues().filter(av => 
                              av.id !== identifierRef && // Exclude identifier (it's always included)
                              !currentValues.includes(av.id) // Exclude already selected values
                            );
                            
                            if (availableValues.length === 0) {
                              return (
                                <div className="px-2 py-1.5 text-sm text-gray-500">
                                  No additional values available
                                </div>
                              );
                            }
                            
                            return availableValues.map((availableValue) => (
                              <SelectItem key={availableValue.id} value={availableValue.id} className="focus:bg-gray-100">
                                <div className="flex items-center gap-1.5">
                                  <span>{availableValue.stepName}</span>
                                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                                  <span>{availableValue.name}</span>
                                </div>
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : param.type === 'document' ? (
                    <div className="mt-1 space-y-2">
                      {/* Selected badges */}
                      {value.inputValues[param.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {value.inputValues[param.id].map((docId: string) => {
                            const docName = docId === 'user_document' 
                              ? 'User uploaded document'
                              : knowledgeDocuments.find(d => d.id === docId)?.displayName || 'Unknown document';
                            return (
                              <Badge key={docId} className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
                                {docName}
                                <X 
                                  className="h-3 w-3 cursor-pointer hover:text-red-500 ml-1"
                                  onClick={() => {
                                    const updatedDocs = value.inputValues[param.id].filter((d: string) => d !== docId);
                                    onUpdate({
                                      inputValues: { ...value.inputValues, [param.id]: updatedDocs }
                                    });
                                  }}
                                />
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Dropdown - Filter by document type if specified */}
                      <Select
                        value=""
                        onValueChange={(docId) => {
                          const currentDocs = value.inputValues[param.id] || [];
                          if (!currentDocs.includes(docId)) {
                            const updatedDocs = [...currentDocs, docId];
                            onUpdate({
                              inputValues: { ...value.inputValues, [param.id]: updatedDocs }
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select documents..." />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Show user uploaded document if documentType allows it */}
                          {(!param.documentType || param.documentType === 'all' || param.documentType === 'excel') && (
                            <SelectItem value="user_document" className="focus:bg-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-slate-500 rounded-full" />
                                <span>User uploaded document</span>
                              </div>
                            </SelectItem>
                          )}
                          {/* Filter knowledge documents by type */}
                          {knowledgeDocuments
                            .filter((doc) => {
                              // If no filter or 'all', show all documents
                              if (!param.documentType || param.documentType === 'all') return true;
                              
                              // Filter based on file extension
                              const fileName = doc.fileName || doc.displayName || '';
                              const extension = fileName.split('.').pop()?.toLowerCase();
                              
                              switch (param.documentType) {
                                case 'excel':
                                  return extension === 'xlsx' || extension === 'xls';
                                case 'word':
                                  return extension === 'docx' || extension === 'doc';
                                case 'pdf':
                                  return extension === 'pdf';
                                default:
                                  return true;
                              }
                            })
                            .map((doc, index) => (
                              <SelectItem key={doc.id} value={doc.id} className="focus:bg-gray-100">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-600" />
                                  <span>{doc.displayName || `Knowledge document ${index + 1}`}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : param.type === 'textarea' ? (
                    <Textarea
                      value={value.inputValues[param.id] || ''}
                      onChange={(e) => onUpdate({
                        inputValues: { ...value.inputValues, [param.id]: e.target.value }
                      })}
                      placeholder={param.description || `Enter ${param.name}...`}
                      className="mt-1"
                      rows={2}
                    />
                  ) : (
                    <Input
                      value={value.inputValues[param.id] || ''}
                      onChange={(e) => onUpdate({
                        inputValues: { ...value.inputValues, [param.id]: e.target.value }
                      })}
                      placeholder={param.description || `Enter ${param.name}...`}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Value Description - Editable */}
          <div className="mt-4">
            <Label className="text-xs text-gray-500 mb-1">Description</Label>
            <Textarea
              value={value.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe this value..."
              className="w-full resize-none"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}