import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Code, Edit3, Trash2, Plus, X, FileText, Database, Type, Copy, Check, Brain, Settings, Play, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";


import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CreateToolDialog from "./CreateToolDialog";

interface ExcelWizardryFunction {
  id: string;
  name: string;
  description: string;
  functionCode: string;
  functionType: 'SCRIPT' | 'AI_ONLY' | 'CODE';
  tags: string[] | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ExcelFunctionToolsProps {
  projectId: string;
}

export default function ExcelFunctionTools({ projectId }: ExcelFunctionToolsProps) {

  const [editingFunction, setEditingFunction] = useState<ExcelWizardryFunction | null>(null);
  const [testingFunction, setTestingFunction] = useState<ExcelWizardryFunction | null>(null);
  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testSampleDocuments, setTestSampleDocuments] = useState<any[]>([]);
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


  const [showColumnInput, setShowColumnInput] = useState<Set<string>>(new Set());
  const [expandedInputs, setExpandedInputs] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    functionCode: "",
    inputParameters: [] as InputParameter[]
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper functions for input parameters
  const addInputParameter = () => {
    const newParam: InputParameter = {
      id: Math.random().toString(36),
      name: "",
      type: "text",
      description: "",
      multiline: false
    };
    setFormData(prev => ({ ...prev, inputParameters: [...prev.inputParameters, newParam] }));
  };

  const updateInputParameter = (id: string, field: keyof InputParameter, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
        if (param.id === id) {
          const updatedParam = { ...param, [field]: value };
          // Reset multiline to false when type changes away from "text"
          if (field === "type" && value !== "text") {
            updatedParam.multiline = false;
          }
          return updatedParam;
        }
        return param;
      })
    }));
  };

  const removeInputParameter = (id: string) => {
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.filter(param => param.id !== id)
    }));
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

  // Sample data management functions
  const addSampleColumn = (paramId: string, columnName: string) => {
    if (!columnName.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
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
      })
    }));
    
    // Hide the column input after adding
    setShowColumnInput(prev => {
      const newSet = new Set(prev);
      newSet.delete(paramId);
      return newSet;
    });
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
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
        if (param.id === paramId && param.sampleData) {
          const newColumns = param.sampleData.columns.filter(col => col !== columnName);
          const newRows = param.sampleData.rows.map(row => {
            const newRow = { ...row };
            delete newRow[columnName];
            return newRow;
          });
          
          // Update identifier column if we're removing the current identifier
          let newIdentifierColumn = param.sampleData.identifierColumn;
          if (newIdentifierColumn === columnName) {
            newIdentifierColumn = newColumns.length > 0 ? newColumns[0] : undefined;
          }
          
          return {
            ...param,
            sampleData: {
              ...param.sampleData,
              columns: newColumns,
              rows: newRows,
              identifierColumn: newIdentifierColumn
            }
          };
        }
        return param;
      })
    }));
  };

  const addSampleRow = (paramId: string) => {
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
        if (param.id === paramId && param.sampleData) {
          const newRow: SampleDataRow = {};
          param.sampleData.columns.forEach(col => {
            newRow[col] = "";
          });
          
          return {
            ...param,
            sampleData: {
              ...param.sampleData,
              rows: [...param.sampleData.rows, newRow]
            }
          };
        }
        return param;
      })
    }));
  };

  const removeSampleRow = (paramId: string, rowIndex: number) => {
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
        if (param.id === paramId && param.sampleData) {
          return {
            ...param,
            sampleData: {
              ...param.sampleData,
              rows: param.sampleData.rows.filter((_, index) => index !== rowIndex)
            }
          };
        }
        return param;
      })
    }));
  };

  const updateSampleCellValue = (paramId: string, rowIndex: number, columnName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      inputParameters: prev.inputParameters.map(param => {
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
              rows: newRows
            }
          };
        }
        return param;
      })
    }));
  };



  // Helper functions for sample file management in edit mode
  const handleSampleFileUploadEdit = async (paramId: string, file?: File) => {
    if (!file || !editingFunction) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('functionId', editingFunction.id);
    formData.append('parameterName', paramId);

    try {
      const response = await apiRequest("/api/sample-documents", {
        method: "POST",
        body: formData as any
      });

      // Update the parameter with the uploaded file info
      updateInputParameter(paramId, "sampleFile", file.name);
      updateInputParameter(paramId, "sampleFileURL", response.url || "");

      toast({
        title: "Sample Document Uploaded",
        description: `Successfully uploaded ${file.name}`
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload sample document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const clearSampleFileEdit = async (paramId: string) => {
    if (!editingFunction) return;

    try {
      // Find the parameter to get the file info
      const param = formData.inputParameters.find(p => p.id === paramId);
      if (param?.sampleFile) {
        await apiRequest(`/api/sample-documents/${editingFunction.id}/${encodeURIComponent(param.sampleFile)}`, {
          method: "DELETE"
        });
      }

      // Clear the sample file info from the parameter
      updateInputParameter(paramId, "sampleFile", "");
      updateInputParameter(paramId, "sampleFileURL", "");

      toast({
        title: "Sample Document Removed",
        description: "Sample document has been removed successfully."
      });
    } catch (error) {
      toast({
        title: "Removal Failed",
        description: "Failed to remove sample document. Please try again.",
        variant: "destructive"
      });
    }
  };



  // Fetch Excel wizardry functions for this project
  const { data: functions, isLoading } = useQuery<ExcelWizardryFunction[]>({
    queryKey: [`/api/projects/${projectId}/excel-functions`],
  });

  // Update function mutation
  const updateFunction = useMutation({
    mutationFn: async (data: { id: string; description: string; functionCode: string; inputParameters?: any[]; functionType?: string }) => {
      // Log data input parameters with their JSON arrays for updates
      if (data.inputParameters) {
        const dataInputs = data.inputParameters.filter((p: any) => p.type === 'data' && p.sampleData);
        if (dataInputs.length > 0) {
          console.log("📊 Updated Data Input Parameters with JSON Arrays:");
          dataInputs.forEach((param: any) => {
            console.log(`Parameter: ${param.name}`);
            console.log(`JSON Array:`, JSON.stringify(param.sampleData.rows, null, 2));
          });
        }
      }

      const updateData: any = {
        description: data.description,
        functionCode: data.functionCode
      };
      
      if (data.inputParameters) {
        updateData.inputParameters = data.inputParameters;
      }
      
      if (data.functionType) {
        updateData.functionType = data.functionType;
      }
      
      return apiRequest(`/api/projects/${projectId}/excel-functions/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({
        title: "Function Updated",
        description: "Excel function has been updated successfully."
      });
      setEditingFunction(null);
      setFormData({ name: "", description: "", functionCode: "", inputParameters: [] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the function. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete function mutation
  const deleteFunction = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/projects/${projectId}/excel-functions/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({
        title: "Function Deleted",
        description: "Function has been deleted successfully."
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the function. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Test function mutation
  const testFunction = useMutation({
    mutationFn: async (data: { functionId: string; inputs: Record<string, any> }) => {
      return apiRequest("/api/excel-functions/test", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (response) => {
      console.log("🧪 Tool Test Results:", response.results);
      console.log("📊 Full Test Response:", response);
      setTestResults(response.results);
      setTestLoading(false);
      toast({
        title: "Test Completed",
        description: "Function test completed successfully."
      });
    },
    onError: (error: any) => {
      console.error("❌ Tool Test Failed:", error);
      console.error("📋 Error Details:", error.message || error);
      setTestLoading(false);
      toast({
        title: "Test Failed", 
        description: error.message || "Failed to test the function. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleTest = async (func: ExcelWizardryFunction) => {
    setTestingFunction(func);
    setTestInputs({});
    setTestResults(null);
    
    // Load sample documents for this function
    try {
      const sampleDocuments = await apiRequest(`/api/sample-documents/${func.id}`, {
        method: "GET"
      });
      console.log("📁 Loaded sample documents for testing:", sampleDocuments);
      setTestSampleDocuments(sampleDocuments);
    } catch (error) {
      console.log("No sample documents found for testing:", error);
      setTestSampleDocuments([]);
    }
  };

  const handleRunTest = () => {
    if (!testingFunction) return;
    
    console.log("🚀 Starting tool test for:", testingFunction.name);
    console.log("📥 Test inputs:", testInputs);
    
    setTestLoading(true);
    testFunction.mutate({
      functionId: testingFunction.id,
      inputs: testInputs
    });
  };

  const handleEdit = (func: ExcelWizardryFunction) => {
    setEditingFunction(func);
  };

  const handleSave = () => {
    if (!editingFunction) return;

    updateFunction.mutate({
      id: editingFunction.id,
      description: formData.description,
      functionCode: formData.functionCode,
      inputParameters: formData.inputParameters,
      functionType: editingFunction.functionType
    });
  };

  const handleCancel = () => {
    setEditingFunction(null);
    setFormData({ name: "", description: "", functionCode: "", inputParameters: [] });
  };

  const handleDelete = (functionId: string) => {
    if (confirm("Are you sure you want to delete this function? This action cannot be undone.")) {
      deleteFunction.mutate(functionId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Tools</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">extrapl <span style={{ color: '#4F63A4' }}>•</span> Tools</h1>
          <p className="text-gray-600 mt-1">Manage reusable extraction functions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {functions?.length || 0} functions available
          </div>
          <CreateToolDialog 
            projectId={projectId} 
            editingFunction={editingFunction} 
            setEditingFunction={setEditingFunction} 
          />
        </div>
      </div>

      <div className="space-y-4">
        {functions?.map((func) => (
          <Card key={func.id} className="border-gray-200 hover:shadow-md transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    {func.functionType === 'AI_ONLY' ? (
                      <Brain className="h-5 w-5 text-gray-600" />
                    ) : (
                      <Code className="h-5 w-5 text-gray-600" />
                    )}
                    {func.name}
                  </CardTitle>

                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {editingFunction?.id === func.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description" className="text-sm font-medium">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    {/* Extraction Type */}
                    <div>
                      <Label className="text-sm font-medium">Extraction Type</Label>
                      <Select
                        value={editingFunction?.functionType || 'SCRIPT'}
                        onValueChange={(value: 'AI_ONLY' | 'SCRIPT') => {
                          if (editingFunction) {
                            setEditingFunction({ ...editingFunction, functionType: value });
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SCRIPT">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              Function
                            </div>
                          </SelectItem>
                          <SelectItem value="AI_ONLY">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4" />
                              AI Only
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Inputs */}
                    <Card className="border-gray-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-gray-800 flex items-center justify-between">
                          Inputs *
                          <Button 
                            size="sm" 
                            onClick={addInputParameter}
                            className="bg-gray-600 hover:bg-gray-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Input
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                            {formData.inputParameters.length === 0 ? (
                              <p className="text-gray-500 text-center py-8">
                                No inputs defined. Click "Add Input" to start.
                              </p>
                            ) : (
                              formData.inputParameters.map((param) => (
                                <div key={param.id} className="border border-gray-200 rounded-lg">
                                  <div className="flex items-center gap-3 p-3">
                                    <Input
                                      value={param.name}
                                      onChange={(e) => updateInputParameter(param.id, "name", e.target.value)}
                                      placeholder="Input name"
                                      className="flex-1 border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex items-center gap-1">
                                      <Select 
                                        value={param.type} 
                                        onValueChange={(value: "text" | "data" | "document") => {
                                          updateInputParameter(param.id, "type", value);
                                        }}
                                      >
                                        <SelectTrigger 
                                          className="w-24 h-8 border-none bg-transparent p-1" 
                                          onClick={(e) => e.stopPropagation()}
                                        >
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
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleInputExpanded(param.id)}
                                        className="p-1 hover:bg-gray-100"
                                      >
                                        {expandedInputs.has(param.id) ? (
                                          <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeInputParameter(param.id);
                                        }}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  {expandedInputs.has(param.id) && (
                                    <div className="p-4 border-t border-gray-200 space-y-3">
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-gray-700">Description</Label>
                                    <Textarea
                                      value={param.description}
                                      onChange={(e) => updateInputParameter(param.id, "description", e.target.value)}
                                      placeholder="Describe what this parameter is used for"
                                      rows={2}
                                      className="mt-1"
                                    />
                                    {param.type === "data" && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        For data type inputs, describe the expected data structure and create sample data using the table below.
                                      </p>
                                    )}
                                  </div>

                                  {/* Sample Content Management */}
                                  {param.type === "text" && (
                                    <div>
                                      <Label className="text-sm font-medium text-gray-700">Sample Text</Label>
                                      <Textarea
                                        value={param.sampleText || ""}
                                        onChange={(e) => updateInputParameter(param.id, "sampleText", e.target.value)}
                                        placeholder="Enter sample text for testing..."
                                        rows={param.multiline ? 4 : 2}
                                        className="mt-1"
                                      />
                                    </div>
                                  )}

                                  {param.type === "document" && (
                                    <div className="p-3 bg-gray-50 rounded border space-y-3">
                                      <div className="text-sm text-gray-600">
                                        Upload a sample document to test this tool.
                                      </div>
                                      <div className="relative">
                                        <Input
                                          type="file"
                                          accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
                                          onChange={(e) => handleSampleFileUploadEdit(param.name, e.target.files?.[0])}
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
                                              onClick={() => clearSampleFileEdit(param.name)}
                                              className="hover:bg-gray-600 rounded p-0.5 transition-colors"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {param.type === "data" && (
                                    <div className="p-3 bg-gray-50 rounded border space-y-3">
                                      <div className="text-sm text-gray-600">
                                        Create sample data table for testing.
                                      </div>
                                      
                                      {!param.sampleData || param.sampleData.columns.length === 0 ? (
                                        <div className="text-center py-4">
                                          <p className="text-gray-500 text-sm mb-3">No columns created yet</p>
                                          <Button
                                            size="sm"
                                            onClick={() => toggleColumnInput(param.id)}
                                            className="bg-gray-600 hover:bg-gray-700"
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Column
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {/* Column headers */}
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {param.sampleData.columns.map((column, index) => (
                                              <div key={column} className="flex items-center gap-1 bg-white border rounded px-3 py-1.5">
                                                {param.sampleData?.identifierColumn === column && (
                                                  <span className="text-yellow-600 mr-1" title="Identifier Column">🔑</span>
                                                )}
                                                <span className="text-sm font-medium">{column}</span>
                                                <button
                                                  type="button"
                                                  onClick={() => removeSampleColumn(param.id, column)}
                                                  className="ml-1 text-gray-400 hover:text-red-600 transition-colors"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              </div>
                                            ))}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => toggleColumnInput(param.id)}
                                              className="h-8 px-2 text-xs"
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Add Column
                                            </Button>
                                          </div>

                                          {/* Data rows table */}
                                          {param.sampleData.rows.length > 0 && (
                                            <div className="border rounded-lg overflow-hidden">
                                              <div className="max-h-48 overflow-y-auto">
                                                <table className="w-full text-sm">
                                                  <thead className="bg-gray-100 sticky top-0">
                                                    <tr>
                                                      {param.sampleData.columns.map(column => (
                                                        <th key={column} className="px-3 py-2 text-left font-medium text-gray-700 border-r last:border-r-0">
                                                          {column}
                                                        </th>
                                                      ))}
                                                      <th className="w-10 px-2 py-2"></th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {param.sampleData.rows.map((row, rowIndex) => (
                                                      <tr key={rowIndex} className="border-t">
                                                        {param.sampleData!.columns.map(column => (
                                                          <td key={column} className="px-3 py-2 border-r last:border-r-0">
                                                            <Input
                                                              value={row[column] || ""}
                                                              onChange={(e) => updateSampleCellValue(param.id, rowIndex, column, e.target.value)}
                                                              className="h-8 text-xs border-0 focus:ring-1 focus:ring-blue-500"
                                                              placeholder={`${column} value`}
                                                            />
                                                          </td>
                                                        ))}
                                                        <td className="px-2 py-2">
                                                          <button
                                                            type="button"
                                                            onClick={() => removeSampleRow(param.id, rowIndex)}
                                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                                          >
                                                            <X className="h-4 w-4" />
                                                          </button>
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}

                                          {/* Add row button */}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addSampleRow(param.id)}
                                            disabled={param.sampleData.columns.length === 0}
                                            className="w-full h-8 text-xs"
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Row
                                          </Button>
                                        </div>
                                      )}

                                      {/* Column input */}
                                      {showColumnInput.has(param.id) && (
                                        <div className="flex gap-2">
                                          <Input
                                            placeholder="Column name"
                                            className="flex-1"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const value = (e.target as HTMLInputElement).value;
                                                addSampleColumn(param.id, value);
                                                (e.target as HTMLInputElement).value = '';
                                              }
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            onClick={(e) => {
                                              const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                                              if (input) {
                                                addSampleColumn(param.id, input.value);
                                                input.value = '';
                                              }
                                            }}
                                            className="bg-gray-600 hover:bg-gray-700"
                                          >
                                            Add
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleColumnInput(param.id)}
                                          >
                                            Cancel
                                          </Button>
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
                        
                        {/* Code/Prompt Section */}
                        <Card className="border-gray-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg text-gray-800">
                              {editingFunction?.functionType === 'AI_ONLY' ? 'Prompt' : 'Python Function Code'} *
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Textarea
                              value={formData.functionCode}
                              onChange={(e) => setFormData({ ...formData, functionCode: e.target.value })}
                              rows={20}
                              className="font-mono text-sm"
                              placeholder={
                                editingFunction?.functionType === 'AI_ONLY' 
                                  ? "Enter your AI prompt instructions here..."
                                  : "def extract_function(document_content, target_fields, identifier_references):"
                              }
                            />
                          </CardContent>
                        </Card>
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={handleSave}
                            disabled={updateFunction.isPending}
                            className="bg-gray-700 hover:bg-gray-800 text-white"
                          >
                            Save Changes
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancel} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-700">{func.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Created: {new Date(func.createdAt).toLocaleDateString()} • 
                            Updated: {new Date(func.updatedAt).toLocaleDateString()}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleTest(func)}
                              className="border-gray-400 bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
                            >
                              <Play className="h-4 w-4 mr-1 fill-gray-600" />
                              Test
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleEdit(func)}
                              className="bg-gray-700 hover:bg-gray-800 text-white"
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline" 
                              onClick={() => handleDelete(func.id)}
                              disabled={deleteFunction.isPending}
                              className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
          </Card>
        ))}

        {(!functions || functions.length === 0) && (
          <Card className="p-8 text-center border-gray-200 bg-gray-50">
            <div className="text-gray-500">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">No Functions Available</h3>
              <p className="text-gray-600">Functions will appear here after they are generated during extraction processes.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Test Function Modal */}
      <Dialog open={!!testingFunction} onOpenChange={() => setTestingFunction(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-gray-800">Test Function: {testingFunction?.name}</DialogTitle>
          </DialogHeader>
          
          {testingFunction && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Function Description</h4>
                <p className="text-gray-600">{testingFunction.description}</p>
              </div>

              {/* Input Parameters */}
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-gray-800">Test Inputs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {((testingFunction as any).inputParameters || []).map((param: any) => (
                    <div key={param.id} className="w-full">
                      <Label htmlFor={`test-${param.id}`} className="text-sm font-medium text-gray-700">
                        {param.name} ({param.type})
                      </Label>
                      <p className="text-xs text-gray-500 mb-2 break-words">{param.description}</p>
                      
                      {param.type === "text" ? (
                        param.multiline ? (
                          <Textarea
                            id={`test-${param.id}`}
                            value={testInputs[param.name] || ""}
                            onChange={(e) => setTestInputs(prev => ({ ...prev, [param.name]: e.target.value }))}
                            placeholder={`Enter ${param.name.toLowerCase()}`}
                            rows={4}
                            className="mt-1"
                          />
                        ) : (
                          <Input
                            id={`test-${param.id}`}
                            value={testInputs[param.name] || ""}
                            onChange={(e) => setTestInputs(prev => ({ ...prev, [param.name]: e.target.value }))}
                            placeholder={`Enter ${param.name.toLowerCase()}`}
                            className="mt-1"
                          />
                        )
                      ) : param.type === "data" ? (
                        <Textarea
                          id={`test-${param.id}`}
                          value={testInputs[param.name] || ""}
                          onChange={(e) => setTestInputs(prev => ({ ...prev, [param.name]: e.target.value }))}
                          placeholder="Enter JSON data"
                          rows={6}
                          className="mt-1 font-mono"
                        />
                      ) : (
                        <div className="space-y-2 w-full">
                          <div className="text-sm text-gray-600 mb-2">
                            Select sample documents for testing:
                          </div>
                          <div className="border rounded-lg p-3 max-h-32 overflow-y-auto w-full">
                            {testSampleDocuments.filter(doc => doc.parameterName === param.name).length > 0 ? (
                              testSampleDocuments
                                .filter(doc => doc.parameterName === param.name)
                                .map((doc) => (
                                  <div key={doc.id} className="flex items-center space-x-2 py-1 w-full">
                                    <Checkbox
                                      id={`doc-${doc.id}`}
                                      checked={(testInputs[param.name] as string[])?.includes(doc.id) || false}
                                      onCheckedChange={(checked) => {
                                        setTestInputs(prev => {
                                          const currentSelection = (prev[param.name] as string[]) || [];
                                          if (checked) {
                                            return { ...prev, [param.name]: [...currentSelection, doc.id] };
                                          } else {
                                            return { ...prev, [param.name]: currentSelection.filter(id => id !== doc.id) };
                                          }
                                        });
                                      }}
                                    />
                                    <Label 
                                      htmlFor={`doc-${doc.id}`} 
                                      className="text-sm font-medium cursor-pointer flex-1 truncate"
                                    >
                                      {doc.fileName || `Sample text (${doc.sampleText?.substring(0, 30)}...)`}
                                    </Label>
                                  </div>
                                ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                No sample documents available for this parameter. Upload sample documents when editing the tool.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Run Test Button */}
              <div className="flex justify-center">
                <Button 
                  onClick={handleRunTest}
                  disabled={testLoading}
                  variant="outline"
                  className="border-gray-400 bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
                >
                  {testLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2 fill-gray-600" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>

              {/* Test Results */}
              {testResults && (
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-gray-800">Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg overflow-hidden">
                      <pre className="text-sm overflow-x-auto whitespace-pre-wrap break-words max-w-full">
                        {JSON.stringify(testResults, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}