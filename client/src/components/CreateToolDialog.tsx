import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database, Type, Copy, Check, Upload, Loader2, ChevronDown, ChevronRight, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  multiline?: boolean; // Only applies to text type
  sampleFile?: string; // Sample file name for documents/data
  sampleFileURL?: string; // Sample file URL for documents/data
  sampleText?: string; // Sample text for text type
  sampleData?: {
    name?: string;
    columns: string[];
    rows: SampleDataRow[];
    identifierColumn?: string;
  }; // Sample data table for data type
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

  // Add update mutation for editing
  const updateTool = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/excel-functions/${editingFunction.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          functionCode: editingFunction.functionCode, // Keep existing code
          functionType: data.toolType === 'AI_ONLY' ? 'AI_ONLY' : 'SCRIPT',
          inputParameters: data.inputParameters,
          tags: data.tags || []
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({ title: "Tool Updated", description: "Tool has been updated successfully." });
      setEditingFunction?.(null);
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update tool.",
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
          hasMetadata: !!response.metadata,
          response: response
        });
        toast({
          title: "Generation Error",
          description: `AI generation incomplete - missing ${!response.functionCode ? 'functionCode' : 'metadata'}`,
          variant: "destructive"
        });
        setLoadingProgress(0);
        setLoadingMessage("");
        return;
      }
      
      console.log('✅ AI response validation passed, proceeding with tool creation...');
      
      // Use the response to create the tool with generated code
      createTool.mutate(response);
    },
    onError: () => {
      toast({
        title: "Code Generation Failed",
        description: "Failed to generate tool code. Please try again.",
        variant: "destructive"
      });
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  const addInputParameter = () => {
    const newParam: InputParameter = {
      id: Math.random().toString(36),
      name: "",
      type: "text",
      description: "",
      multiline: false
    };
    
    // If this is a data type parameter, initialize empty sample data
    if (newParam.type === "data") {
      newParam.sampleData = {
        name: "",
        columns: [],
        rows: [],
        identifierColumn: undefined
      };
    }
    
    setInputParameters([...inputParameters, newParam]);
    // Default new inputs to expanded
    setExpandedInputs(prev => new Set([...Array.from(prev), newParam.id]));
  };

  const updateInputParameter = (id: string, field: keyof InputParameter, value: string | boolean) => {
    setInputParameters(prev => 
      prev.map(param => {
        if (param.id === id) {
          const updatedParam = { ...param, [field]: value };
          // Reset multiline to false when type changes away from "text"
          if (field === "type" && value !== "text") {
            updatedParam.multiline = false;
          }
          // If changing to data type, initialize empty sample data
          if (field === "type" && value === "data" && !updatedParam.sampleData) {
            updatedParam.sampleData = {
              name: "",
              columns: [],
              rows: [],
              identifierColumn: undefined
            };
          }
          return updatedParam;
        }
        return param;
      })
    );
  };

  const removeInputParameter = (id: string) => {
    setInputParameters(prev => prev.filter(param => param.id !== id));
    setExpandedInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleInputExpanded = (id: string) => {
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



  // Sample data table functions
  const addSampleColumn = (paramId: string, columnName: string) => {
    if (!columnName.trim()) return;
    
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        if (currentData.columns.includes(columnName.trim())) return param;
        
        const newColumns = [...currentData.columns, columnName.trim()];
        
        // Set identifier column if this is the first column being created
        const identifierColumn = currentData.columns.length === 0 ? columnName.trim() : currentData.identifierColumn;
        
        const newRows = currentData.rows.map(row => ({
          ...row,
          [columnName.trim()]: ""
        }));
        
        return {
          ...param,
          sampleData: {
            ...currentData,
            columns: newColumns,
            rows: newRows,
            identifierColumn: identifierColumn
          }
        };
      }
      return param;
    }));
    
    // Hide the column input after adding
    setShowColumnInput(prev => {
      const newSet = new Set(prev);
      newSet.delete(paramId);
      return newSet;
    });
  };

  const updateSampleDataName = (paramId: string, name: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        return {
          ...param,
          sampleData: {
            ...currentData,
            name: name
          }
        };
      }
      return param;
    }));
  };

  const toggleColumnInput = (paramId: string) => {
    setShowColumnInput(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paramId)) {
        newSet.delete(paramId);
      } else {
        newSet.add(paramId);
      }
      return newSet;
    });
  };

  const removeSampleColumn = (paramId: string, columnName: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newColumns = param.sampleData.columns.filter(col => col !== columnName);
        const newRows = param.sampleData.rows.map(row => {
          const { [columnName]: removed, ...rest } = row;
          return rest;
        });
        
        // Update identifier column if we're removing it
        let identifierColumn = param.sampleData.identifierColumn;
        if (identifierColumn === columnName) {
          // Set new identifier to first remaining column, or undefined if no columns left
          identifierColumn = newColumns.length > 0 ? newColumns[0] : undefined;
        }
        
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: newColumns,
            rows: newRows,
            identifierColumn: identifierColumn
          }
        };
      }
      return param;
    }));
  };

  const addSampleRow = (paramId: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        if (currentData.rows.length >= 5) return param; // Max 5 rows
        
        const newRow: SampleDataRow = {};
        currentData.columns.forEach(col => {
          newRow[col] = "";
        });
        
        return {
          ...param,
          sampleData: {
            ...currentData,
            columns: currentData.columns,
            rows: [...currentData.rows, newRow],
            identifierColumn: currentData.identifierColumn
          }
        };
      }
      return param;
    }));
  };

  const removeSampleRow = (paramId: string, rowIndex: number) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newRows = param.sampleData.rows.filter((_, index) => index !== rowIndex);
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: param.sampleData.columns,
            rows: newRows
          }
        };
      }
      return param;
    }));
  };

  const updateSampleCellValue = (paramId: string, rowIndex: number, columnName: string, value: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newRows = param.sampleData.rows.map((row, index) => {
          if (index === rowIndex) {
            return { ...row, [columnName]: value };
          }
          return row;
        });
        
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: param.sampleData.columns,
            rows: newRows
          }
        };
      }
      return param;
    }));
  };

  const processSampleDocuments = async (functionId: string, parameters: InputParameter[]) => {
    for (const param of parameters) {
      try {
        if (param.sampleText) {
          // Process text sample
          await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: param.sampleText
            })
          });
        } else if (param.sampleFileURL && param.sampleFile) {
          // Process file sample using the SAME extraction process as session documents
          await apiRequest("/api/sample-documents/process", {
            method: "POST", 
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              fileName: param.sampleFile,
              fileURL: param.sampleFileURL
            })
          });
        } else if (param.sampleData && param.sampleData.columns.length > 0 && param.sampleData.rows.length > 0) {
          // Process data table sample - convert to array of objects format with identifier column info
          const sampleDataWithIdentifier = {
            data: param.sampleData.rows,
            identifierColumn: param.sampleData.identifierColumn || param.sampleData.columns[0]
          };
          const tableDataAsJSON = JSON.stringify(sampleDataWithIdentifier, null, 2);
          
          await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: tableDataAsJSON
            })
          });
        }
      } catch (error) {
        console.error(`Failed to process sample for parameter ${param.name}:`, error);
        // Don't throw error to prevent function creation failure
      }
    }
  };

  const handleSampleFileUpload = async (paramId: string, file: File | undefined) => {
    if (!file) return;
    
    console.log('📁 Sample file selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    try {
      // Get upload URL for the sample file
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL } = await response.json();

      // Upload the file
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Update the parameter with the uploaded file info temporarily
      updateInputParameter(paramId, "sampleFile", file.name);
      updateInputParameter(paramId, "sampleFileURL", uploadURL.split('?')[0]); // Store the base URL without query params
      
      toast({
        title: "Sample File Uploaded",
        description: `Sample file "${file.name}" has been uploaded and will be processed when the tool is created.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload sample file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const clearSampleFile = (paramId: string) => {
    updateInputParameter(paramId, "sampleFile", "");
    updateInputParameter(paramId, "sampleFileURL", "");
    toast({
      title: "Sample File Removed",
      description: "Sample file has been removed from this parameter."
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || !toolType || inputParameters.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields, select a tool type, and add at least one input.",
        variant: "destructive"
      });
      return;
    }

    // Validate input parameters
    const invalidParams = inputParameters.filter(p => !p.name || !p.description);
    if (invalidParams.length > 0) {
      toast({
        title: "Validation Error",
        description: "All inputs must have a name and description.",
        variant: "destructive"
      });
      return;
    }

    const toolData = {
      projectId,
      name: formData.name,
      description: formData.description,
      toolType,
      outputType,
      inputParameters,
      aiAssistanceRequired: toolType === "CODE" ? aiAssistanceRequired : false,
      aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
      tags: [] // Default to empty tags array since we removed the tags field
    };

    if (editingFunction) {
      updateTool.mutate(toolData);
    } else {
      generateToolCode.mutate(toolData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gray-700 hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Tool
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-800 flex items-center">
            {editingFunction ? 'Edit' : 'Create new'} extrapl
            <span className="w-2 h-2 rounded-full mx-2" style={{ backgroundColor: '#4F63A4' }}></span>
            Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Function Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Extract Financial Data"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description *
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe how this tool works."
                  rows={3}
                  className="mt-1"
                />
              </div>

            </CardContent>
          </Card>

          {/* Tool Type */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800">Tool Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={toolType || ""} onValueChange={(value: "AI_ONLY" | "CODE") => setToolType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tool type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI_ONLY">AI</SelectItem>
                  <SelectItem value="CODE">Code</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 mt-2">
                {toolType === "CODE"
                  ? "User-defined Python code that returns results converted to field_validations format"
                  : "AI-powered tool that uses prompts to analyze and extract data"
                }
              </p>
            </CardContent>
          </Card>

          {/* Inputs */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800">
                  Inputs *
                </CardTitle>
                
                {/* Output Type Toggle - Top Right */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    This tool is to create:
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setOutputType("single")}
                      className={`h-8 px-3 text-xs border transition-colors ${
                        outputType === "single" 
                          ? "bg-gray-800 text-white border-gray-800 hover:bg-gray-700" 
                          : "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                      }`}
                    >
                      Single Value
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setOutputType("multiple")}
                      className={`h-8 px-3 text-xs border transition-colors ${
                        outputType === "multiple" 
                          ? "bg-gray-800 text-white border-gray-800 hover:bg-gray-700" 
                          : "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                      }`}
                    >
                      Multiple Records
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputParameters.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    No inputs defined. Click "Add Input" to start.
                  </p>
                  <Button 
                    size="sm" 
                    onClick={addInputParameter}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Input
                  </Button>
                </div>
              ) : (
                <>
                  {inputParameters.map((param, index) => {
                    const isExpanded = expandedInputs.has(param.id);
                    return (
                      <div key={param.id} className="border border-gray-200 rounded-lg">
                        <div className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Input
                                value={param.name}
                                onChange={(e) => updateInputParameter(param.id, "name", e.target.value)}
                                placeholder="Input name"
                                className="text-sm"
                              />
                            </div>
                            <div className="w-40">
                              <Select 
                                value={param.type} 
                                onValueChange={(value: "text" | "data" | "document") => updateInputParameter(param.id, "type", value)}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">
                                    <div className="flex items-center gap-2">
                                      <Type className="h-4 w-4" />
                                      Text
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="data">
                                    <div className="flex items-center gap-2">
                                      <Database className="h-4 w-4" />
                                      Data
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="document">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Document
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleInputExpanded(param.id)}
                                className="p-1 h-auto text-gray-600 hover:text-gray-800"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeInputParameter(param.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100">
                            <div>
                              <Label className="text-sm font-medium text-gray-700">Description</Label>
                              <Textarea
                                value={param.description}
                                onChange={(e) => updateInputParameter(param.id, "description", e.target.value)}
                                placeholder="Describe this input parameter..."
                                className="mt-1 resize-none"
                                rows={2}
                              />
                            </div>

                            {param.type === "text" && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={param.multiline}
                                    onCheckedChange={(checked) => updateInputParameter(param.id, "multiline", checked)}
                                  />
                                  <Label className="text-sm text-gray-600">Multi-line text input</Label>
                                </div>
                              </div>
                            )}
                            {param.type === "document" && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700">
                                    Upload a sample document to test this tool.
                                  </Label>
                                  <div className="relative">
                                    <input
                                      type="file"
                                      accept=".xlsx,.xls,.docx,.doc,.pdf,.json,.csv,.txt"
                                      onChange={(e) => handleSampleFileUpload(param.id, e.target.files?.[0])}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer">
                                      <Upload className="h-5 w-5 text-gray-400" />
                                    </div>
                                  </div>
                                  {param.sampleFile && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="inline-flex items-center gap-2 bg-gray-700 text-gray-100 px-3 py-1 rounded text-xs">
                                        <span>{param.sampleFile}</span>
                                        <button
                                          type="button"
                                          onClick={() => clearSampleFile(param.id)}
                                          className="hover:bg-gray-600 rounded p-0.5 transition-colors"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {param.type === "data" && (
                              <div className="space-y-3">
                                <Label className="text-sm font-medium text-gray-700">
                                  Create sample data collection (up to 5 rows)
                                </Label>
                                
                                {/* Sample Data Name */}
                                <div>
                                  <Label className="text-xs font-medium text-gray-600">Sample Data Name</Label>
                                  <Input
                                    value={param.sampleData?.name || ''}
                                    onChange={(e) => updateSampleDataName(param.id, e.target.value)}
                                    placeholder="e.g., Customer List, Product Catalog, etc."
                                    className="text-sm mt-1"
                                  />
                                </div>

                                {/* Add Column Button */}
                                {!showColumnInput.has(param.id) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => toggleColumnInput(param.id)}
                                    className="bg-gray-600 hover:bg-gray-700"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Column
                                  </Button>
                                )}

                                {/* Column Input (Hidden until Add Column is clicked) */}
                                {showColumnInput.has(param.id) && (
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Column name"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const input = e.target as HTMLInputElement;
                                          if (input.value.trim()) {
                                            addSampleColumn(param.id, input.value.trim());
                                            input.value = '';
                                          }
                                        }
                                        if (e.key === 'Escape') {
                                          toggleColumnInput(param.id);
                                        }
                                      }}
                                      className="flex-1 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        const input = (e.target as HTMLElement).closest('div')?.querySelector('input') as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                          addSampleColumn(param.id, input.value.trim());
                                          input.value = '';
                                        }
                                      }}
                                      className="bg-gray-600 hover:bg-gray-700 px-3"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleColumnInput(param.id)}
                                      className="px-3"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}

                                {/* Data Table */}
                                {param.sampleData && param.sampleData.columns.length > 0 && (
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Table Header */}
                                    <div className="bg-gray-50 border-b border-gray-200">
                                      <div className="flex">
                                        {param.sampleData.columns.map((column, colIndex) => (
                                          <div key={colIndex} className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0">
                                            <div className="flex items-center justify-between p-2">
                                              <div className="flex items-center gap-1">
                                                {param.sampleData?.identifierColumn === column && (
                                                  <Key className="h-3 w-3 text-amber-500" />
                                                )}
                                                <span className="text-xs font-medium text-gray-700 truncate">{column}</span>
                                              </div>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeSampleColumn(param.id, column)}
                                                className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 ml-1"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                        <div className="w-8"></div> {/* Space for row delete button */}
                                      </div>
                                    </div>

                                    {/* Table Rows */}
                                    <div className="bg-white">
                                      {param.sampleData.rows.map((row, rowIndex) => (
                                        <div key={rowIndex} className="flex border-b border-gray-100 last:border-b-0">
                                          {param.sampleData!.columns.map((column, colIndex) => (
                                            <div key={colIndex} className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0">
                                              <Input
                                                value={row[column] || ''}
                                                onChange={(e) => updateSampleCellValue(param.id, rowIndex, column, e.target.value)}
                                                placeholder={`${column} value`}
                                                className="border-0 rounded-none text-xs h-8 focus:ring-0"
                                              />
                                            </div>
                                          ))}
                                          <div className="w-8 flex items-center justify-center">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => removeSampleRow(param.id, rowIndex)}
                                              className="h-5 w-5 p-0 text-gray-400 hover:text-red-600"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Add Row Button */}
                                    {param.sampleData.rows.length < 5 && (
                                      <div className="bg-gray-50 border-t border-gray-200 p-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => addSampleRow(param.id)}
                                          className="w-full text-xs text-gray-600 hover:text-gray-800"
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add Row ({param.sampleData.rows.length}/5)
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(!param.sampleData || param.sampleData.columns.length === 0) && (
                                  <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    Click "Add Column" to start creating your sample data collection
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Add Input button */}
                  <div className="text-center py-4">
                    <Button 
                      size="sm" 
                      onClick={addInputParameter}
                      className="bg-gray-600 hover:bg-gray-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Input
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Assistance (only for SCRIPT functions) */}
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

          {/* Generated Code Section - Only show when editing and code exists */}
          {editingFunction && editingFunction.functionCode && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-800">Generated Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">
                    {editingFunction.functionCode}
                  </pre>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This code was automatically generated and cannot be edited directly.
                </p>
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
                      Generating function
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