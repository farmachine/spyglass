import React, { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, Trash2, Upload, FileText, Database, X, Loader2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SampleDataRow {
  [key: string]: string;
}

interface InputParameter {
  id: string;
  name: string;
  type: "text" | "data" | "document";
  description: string;
  multiline?: boolean;
  sampleFile?: string;
  sampleFileURL?: string;
  sampleText?: string;
  sampleData?: {
    name?: string;
    columns: string[];
    rows: SampleDataRow[];
    identifierColumn?: string;
  };
}

interface CreateToolDialogProps {
  projectId: string;
  editingFunction?: any;
  setEditingFunction?: (func: any) => void;
  trigger?: React.ReactNode;
}

export default function CreateToolDialog({ projectId, editingFunction, setEditingFunction, trigger }: CreateToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [toolType, setToolType] = useState<"AI_ONLY" | "CODE" | null>(null);
  const [aiAssistanceRequired, setAiAssistanceRequired] = useState(false);
  const [outputType, setOutputType] = useState<"single" | "multiple">("single");
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    aiAssistancePrompt: ""
  });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [expandedInputs, setExpandedInputs] = useState<Set<string>>(new Set());
  const [showColumnInput, setShowColumnInput] = useState<Set<string>>(new Set());
  const [codeExpanded, setCodeExpanded] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resetForm = () => {
    setFormData({ name: "", description: "", aiAssistancePrompt: "" });
    setToolType(null);
    setOutputType("single");
    setInputParameters([]);
    setAiAssistanceRequired(false);
    setLoadingMessage("");
    setLoadingProgress(0);
    setExpandedInputs(new Set());
    setShowColumnInput(new Set());
    setCodeExpanded(false);
  };

  // Load editing function data when provided
  useEffect(() => {
    if (editingFunction) {
      setFormData({
        name: editingFunction.name || "",
        description: editingFunction.description || "",
        aiAssistancePrompt: editingFunction.aiAssistancePrompt || ""
      });
      setToolType(editingFunction.functionType === 'AI_ONLY' ? 'AI_ONLY' : 'CODE');
      setInputParameters(editingFunction.inputParameters || []);
      setOpen(true);
    }
  }, [editingFunction]);

  // Update tool mutation for editing
  const updateTool = useMutation({
    mutationFn: async (data: any) => {
      // Include the edited code if available
      const updateData = {
        name: data.name,
        description: data.description,
        inputParameters: data.inputParameters,
        functionType: data.functionType,
        outputType: data.outputType,
        aiAssistancePrompt: data.aiAssistancePrompt,
        functionCode: editingFunction?.functionCode // Keep existing code unless explicitly changed
      };

      return apiRequest(`/api/excel-functions/${editingFunction.id}`, {
        method: "PUT",
        body: JSON.stringify(updateData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({
        title: "Tool Updated",
        description: "Tool has been updated successfully."
      });
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1000);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the tool. Please try again.",
        variant: "destructive"
      });
    }
  });

  const createTool = useMutation({
    mutationFn: async (data: any) => {
      // Log data input parameters with their JSON arrays
      const dataInputs = data.inputParameters?.filter((p: any) => p.type === 'data' && p.sampleData);
      if (dataInputs && dataInputs.length > 0) {
        console.log("📊 Data Input Parameters with JSON Arrays:");
        dataInputs.forEach((param: any) => {
          console.log(`Parameter: ${param.name}`);
          console.log(`Identifier Column: ${param.sampleData.identifierColumn || param.sampleData.columns[0]}`);
          console.log(`JSON Array:`, JSON.stringify(param.sampleData.rows, null, 2));
        });
      }

      const response = await apiRequest("/api/excel-functions", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      // Process sample documents after tool creation
      if (response.id && data.inputParameters && data.inputParameters.some((p: any) => p.sampleFile || p.sampleText || p.sampleData)) {
        await processSampleDocuments(response.id, data.inputParameters);
      }
      
      setLoadingProgress(100);
      setLoadingMessage("Tool creation complete!");
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({
        title: "Tool Created",
        description: "Tool has been created successfully with sample documents processed."
      });
      setTimeout(() => {
        setOpen(false);
        resetForm();
        setLoadingProgress(0);
        setLoadingMessage("");
      }, 1000);
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create the tool. Please try again.",
        variant: "destructive"
      });
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  const generateToolCode = useMutation({
    mutationFn: async (data: any) => {
      setLoadingProgress(10);
      setLoadingMessage("Initializing tool generation...");
      console.log('🔧 Creating tool with data:', JSON.stringify(data, null, 2));
      
      setLoadingProgress(30);
      setLoadingMessage("Sending data to AI system...");
      
      const response = await apiRequest("/api/excel-functions/generate", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      setLoadingProgress(70);
      setLoadingMessage("Processing sample documents...");
      
      return response;
    },
    onSuccess: (response) => {
      setLoadingProgress(90);
      setLoadingMessage("Finalizing tool creation...");
      
      console.log('🎉 AI generation response:', JSON.stringify(response, null, 2));
      
      // Ensure the response has the required fields from the AI generation
      if (!response.functionCode || !response.metadata) {
        console.error('❌ Missing required fields in AI response:', {
          hasFunctionCode: !!response.functionCode,
          hasMetadata: !!response.metadata
        });
        throw new Error('Invalid AI response: missing required fields');
      }

      // Prepare the data for tool creation
      const toolData = {
        projectId,
        name: formData.name,
        description: formData.description,
        functionType: toolType,
        outputType,
        functionCode: response.functionCode,
        metadata: response.metadata,
        inputParameters,
        aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null
      };

      // Create the tool with the generated code
      createTool.mutate(toolData);
    },
    onError: (error: any) => {
      console.error('❌ AI generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate the tool. Please try again.",
        variant: "destructive"
      });
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  const processSampleDocuments = async (functionId: string, parameters: InputParameter[]) => {
    for (const param of parameters) {
      if (param.sampleFile || param.sampleText || param.sampleData) {
        try {
          const sampleData = {
            functionId,
            parameterId: param.id,
            parameterName: param.name,
            parameterType: param.type,
            sampleFile: param.sampleFile,
            sampleText: param.sampleText,
            sampleData: param.sampleData
          };

          await apiRequest('/api/sample-documents', {
            method: 'POST',
            body: JSON.stringify(sampleData)
          });

          console.log(`✅ Sample document processed for parameter: ${param.name}`);
        } catch (error) {
          console.error(`❌ Failed to process sample for parameter ${param.name}:`, error);
        }
      }
    }
  };

  const addInputParameter = () => {
    const newParam: InputParameter = {
      id: Math.random().toString(36).substr(2, 9),
      name: "",
      type: "text",
      description: ""
    };
    setInputParameters([...inputParameters, newParam]);
  };

  const removeInputParameter = (id: string) => {
    setInputParameters(inputParameters.filter(p => p.id !== id));
    setExpandedInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const updateInputParameter = (id: string, field: string, value: any) => {
    setInputParameters(inputParameters.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const toggleExpanded = (id: string) => {
    setExpandedInputs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleFileUpload = async (file: File, paramId: string) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        updateInputParameter(paramId, 'sampleFile', result.filename);
        updateInputParameter(paramId, 'sampleFileURL', result.url);
        toast({
          title: "File Uploaded",
          description: `${file.name} uploaded successfully`
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload Failed", 
        description: "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || !toolType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (editingFunction) {
      updateTool.mutate({
        name: formData.name,
        description: formData.description,
        inputParameters,
        functionType: toolType,
        outputType,
        aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null
      });
    } else {
      // Generate new tool
      const toolData = {
        projectId,
        name: formData.name,
        description: formData.description,
        functionType: toolType,
        outputType,
        inputParameters,
        aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null
      };

      if (toolType === "AI_ONLY") {
        createTool.mutate(toolData);
      } else {
        generateToolCode.mutate(toolData);
      }
    }
  };

  const addSampleDataColumn = (paramId: string) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData) {
      const newColumn = `Column ${param.sampleData.columns.length + 1}`;
      const updatedSampleData = {
        ...param.sampleData,
        columns: [...param.sampleData.columns, newColumn]
      };
      
      // Add empty value for new column in all existing rows
      updatedSampleData.rows = updatedSampleData.rows.map(row => ({
        ...row,
        [newColumn]: ""
      }));

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const addSampleDataRow = (paramId: string) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData) {
      const newRow: SampleDataRow = {};
      param.sampleData.columns.forEach(col => {
        newRow[col] = "";
      });
      
      const updatedSampleData = {
        ...param.sampleData,
        rows: [...param.sampleData.rows, newRow]
      };

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const removeSampleDataColumn = (paramId: string, columnIndex: number) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData && param.sampleData.columns.length > 1) {
      const columnToRemove = param.sampleData.columns[columnIndex];
      const updatedColumns = param.sampleData.columns.filter((_, index) => index !== columnIndex);
      
      // Remove the column from all rows
      const updatedRows = param.sampleData.rows.map(row => {
        const newRow = { ...row };
        delete newRow[columnToRemove];
        return newRow;
      });

      const updatedSampleData = {
        ...param.sampleData,
        columns: updatedColumns,
        rows: updatedRows
      };

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const removeSampleDataRow = (paramId: string, rowIndex: number) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData && param.sampleData.rows.length > 1) {
      const updatedSampleData = {
        ...param.sampleData,
        rows: param.sampleData.rows.filter((_, index) => index !== rowIndex)
      };

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const updateSampleDataCell = (paramId: string, rowIndex: number, column: string, value: string) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData) {
      const updatedRows = param.sampleData.rows.map((row, index) => 
        index === rowIndex ? { ...row, [column]: value } : row
      );
      
      const updatedSampleData = {
        ...param.sampleData,
        rows: updatedRows
      };

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const updateSampleDataColumnName = (paramId: string, oldName: string, newName: string) => {
    const param = inputParameters.find(p => p.id === paramId);
    if (param?.sampleData) {
      const updatedColumns = param.sampleData.columns.map(col => col === oldName ? newName : col);
      const updatedRows = param.sampleData.rows.map(row => {
        const newRow = { ...row };
        if (row.hasOwnProperty(oldName)) {
          newRow[newName] = row[oldName];
          delete newRow[oldName];
        }
        return newRow;
      });

      const updatedSampleData = {
        ...param.sampleData,
        columns: updatedColumns,
        rows: updatedRows
      };

      updateInputParameter(paramId, 'sampleData', updatedSampleData);
    }
  };

  const initializeSampleData = (paramId: string) => {
    const sampleData = {
      name: "Sample Data",
      columns: ["Column 1"],
      rows: [{ "Column 1": "" }],
      identifierColumn: "Column 1"
    };
    updateInputParameter(paramId, 'sampleData', sampleData);
    setShowColumnInput(prev => new Set(prev).add(paramId));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {editingFunction ? "Edit Tool" : "Create New Tool"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Basic Information */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tool-name" className="text-sm font-medium text-gray-700">Tool Name</Label>
                <Input
                  id="tool-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter tool name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tool-description" className="text-sm font-medium text-gray-700">Description</Label>
                <Textarea
                  id="tool-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this tool does"
                  rows={3}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tool Configuration */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800">Tool Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Tool Type</Label>
                <RadioGroup
                  value={toolType || ""}
                  onValueChange={(value) => setToolType(value as "AI_ONLY" | "CODE")}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="AI_ONLY" id="ai-only" />
                    <Label htmlFor="ai-only" className="text-sm">AI Only (Prompt-based)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CODE" id="code" />
                    <Label htmlFor="code" className="text-sm">Generated Code (Python)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Output Type</Label>
                <RadioGroup
                  value={outputType}
                  onValueChange={(value) => setOutputType(value as "single" | "multiple")}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="text-sm">Single Result</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multiple" id="multiple" />
                    <Label htmlFor="multiple" className="text-sm">Multiple Results (List)</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Code Section - Collapsible when editing */}
          {editingFunction?.functionCode && (
            <Collapsible open={codeExpanded} onOpenChange={setCodeExpanded}>
              <Card className="border-gray-200">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-gray-800">
                        {editingFunction.functionType === 'AI_ONLY' ? 'Prompt' : 'Code'}
                      </CardTitle>
                      {codeExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <Textarea
                      value={editingFunction.functionCode || ""}
                      onChange={(e) => {
                        if (setEditingFunction) {
                          setEditingFunction({
                            ...editingFunction,
                            functionCode: e.target.value
                          });
                        }
                      }}
                      rows={15}
                      className="font-mono text-sm w-full"
                      placeholder={
                        editingFunction.functionType === 'AI_ONLY' 
                          ? "Enter your AI prompt instructions here..."
                          : "def extract_function(document_content, target_fields, identifier_references):"
                      }
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Input Parameters */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800">Input Parameters</CardTitle>
                <Button
                  size="sm"
                  onClick={addInputParameter}
                  className="h-8 px-3 bg-gray-700 hover:bg-gray-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Parameter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputParameters.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No input parameters defined</p>
              ) : (
                inputParameters.map((param) => (
                  <div key={param.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => toggleExpanded(param.id)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        {expandedInputs.has(param.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {param.name || "New Parameter"}
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeInputParameter(param.id)}
                        className="h-7 w-7 p-0 border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {expandedInputs.has(param.id) && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-medium text-gray-600">Parameter Name</Label>
                            <Input
                              value={param.name}
                              onChange={(e) => updateInputParameter(param.id, 'name', e.target.value)}
                              placeholder="Parameter name"
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-600">Type</Label>
                            <select
                              value={param.type}
                              onChange={(e) => updateInputParameter(param.id, 'type', e.target.value)}
                              className="w-full mt-1 h-8 text-sm border border-gray-300 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="text">Text</option>
                              <option value="document">Document</option>
                              <option value="data">Data</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-600">Description</Label>
                          <Textarea
                            value={param.description}
                            onChange={(e) => updateInputParameter(param.id, 'description', e.target.value)}
                            placeholder="Describe this parameter"
                            rows={2}
                            className="mt-1 text-sm"
                          />
                        </div>

                        {param.type === "text" && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={param.multiline || false}
                                onCheckedChange={(checked) => updateInputParameter(param.id, 'multiline', checked)}
                              />
                              <Label className="text-xs font-medium text-gray-600">Multi-line text</Label>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Sample Text</Label>
                              {param.multiline ? (
                                <Textarea
                                  value={param.sampleText || ""}
                                  onChange={(e) => updateInputParameter(param.id, 'sampleText', e.target.value)}
                                  placeholder="Enter sample text content"
                                  rows={3}
                                  className="mt-1 text-sm"
                                />
                              ) : (
                                <Input
                                  value={param.sampleText || ""}
                                  onChange={(e) => updateInputParameter(param.id, 'sampleText', e.target.value)}
                                  placeholder="Enter sample text"
                                  className="mt-1 h-8 text-sm"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {param.type === "document" && (
                          <div>
                            <Label className="text-xs font-medium text-gray-600">Sample Document</Label>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(file, param.id);
                                }}
                                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.json"
                                className="hidden"
                                id={`file-${param.id}`}
                              />
                              <label htmlFor={`file-${param.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  asChild
                                >
                                  <span>
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload File
                                  </span>
                                </Button>
                              </label>
                              {param.sampleFile && (
                                <span className="text-xs text-gray-600 flex items-center">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {param.sampleFile}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {param.type === "data" && (
                          <div>
                            <Label className="text-xs font-medium text-gray-600">Sample Data</Label>
                            {!param.sampleData ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => initializeSampleData(param.id)}
                                className="mt-1 h-8 text-xs"
                              >
                                <Database className="h-3 w-3 mr-1" />
                                Create Data Table
                              </Button>
                            ) : (
                              <div className="mt-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Input
                                    value={param.sampleData.name || ""}
                                    onChange={(e) => updateInputParameter(param.id, 'sampleData', { ...param.sampleData, name: e.target.value })}
                                    placeholder="Table name"
                                    className="h-7 text-xs flex-1 mr-2"
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addSampleDataColumn(param.id)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      + Column
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addSampleDataRow(param.id)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      + Row
                                    </Button>
                                  </div>
                                </div>

                                <div className="border border-gray-200 rounded-md overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        {param.sampleData.columns.map((column, colIndex) => (
                                          <th key={colIndex} className="p-2 text-left border-r border-gray-200 last:border-r-0 relative group">
                                            <div className="flex items-center justify-between">
                                              <Input
                                                value={column}
                                                onChange={(e) => updateSampleDataColumnName(param.id, column, e.target.value)}
                                                className="h-6 text-xs border-none p-0 bg-transparent focus:bg-white focus:border focus:border-gray-300"
                                              />
                                              {colIndex === 0 && <span className="text-yellow-600 ml-1" title="Identifier Column">🔑</span>}
                                              {param.sampleData!.columns.length > 1 && (
                                                <button
                                                  onClick={() => removeSampleDataColumn(param.id, colIndex)}
                                                  className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-700"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              )}
                                            </div>
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {param.sampleData.rows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="border-t border-gray-200 group">
                                          {param.sampleData!.columns.map((column, colIndex) => (
                                            <td key={colIndex} className="p-2 border-r border-gray-200 last:border-r-0">
                                              <Input
                                                value={row[column] || ""}
                                                onChange={(e) => updateSampleDataCell(param.id, rowIndex, column, e.target.value)}
                                                className="h-6 text-xs border-none p-0 bg-transparent focus:bg-white focus:border focus:border-gray-300"
                                                placeholder={`${column} value`}
                                              />
                                            </td>
                                          ))}
                                          {param.sampleData!.rows.length > 1 && (
                                            <td className="p-1">
                                              <button
                                                onClick={() => removeSampleDataRow(param.id, rowIndex)}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                              >
                                                <X className="h-3 w-3" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* AI Assistance (only for CODE functions) */}
          {toolType === "CODE" && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-800">AI Assistance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ai-assistance"
                    checked={aiAssistanceRequired}
                    onCheckedChange={setAiAssistanceRequired}
                  />
                  <Label htmlFor="ai-assistance" className="text-sm font-medium text-gray-700">
                    Require AI assistance for final output processing
                  </Label>
                </div>
                {aiAssistanceRequired && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      AI Assistance Instructions
                    </Label>
                    <Textarea
                      value={formData.aiAssistancePrompt}
                      onChange={(e) => setFormData({ ...formData, aiAssistancePrompt: e.target.value })}
                      placeholder="Describe how AI should process the tool results to generate the final output"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Loading Progress */}
          {(generateToolCode.isPending || createTool.isPending || updateTool.isPending) && (
            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {loadingMessage || "Processing..."}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className="h-full bg-gray-600 transition-all duration-300 ease-out" 
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-700">
                    {loadingProgress}% complete
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={generateToolCode.isPending || createTool.isPending || updateTool.isPending}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={generateToolCode.isPending || createTool.isPending || updateTool.isPending}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {generateToolCode.isPending || createTool.isPending || updateTool.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingFunction ? "Updating..." : "Generating..."}
                </div>
              ) : (
                editingFunction ? "Update Tool" : "Generate Tool"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}