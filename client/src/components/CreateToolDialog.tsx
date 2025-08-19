import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database, Type, Copy, Check, Upload, Loader2, ChevronDown, ChevronRight, Key, RefreshCw, Brain, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";


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
  sampleDocumentIds?: string[]; // Array of sample document IDs for proper UUID mapping
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
    aiAssistancePrompt: "",
    functionCode: ""
  });

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [expandedInputs, setExpandedInputs] = useState<Set<string>>(new Set());
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [showColumnInput, setShowColumnInput] = useState<Set<string>>(new Set());
  const [processingParams, setProcessingParams] = useState<Set<string>>(new Set());
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditingFunctionId, setCurrentEditingFunctionId] = useState<string | null>(null);

  const queryClient = useQueryClient();


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
    setProcessingParams(new Set());
    setCodeExpanded(false);
    setIsEditMode(false);
    setCurrentEditingFunctionId(null); // Reset current editing function ID
  };

  // Load editing function data when provided
  useEffect(() => {
    if (editingFunction) {
      const functionId = editingFunction.id;
      
      // Only update form state if this is a different function than currently being edited
      // This prevents regeneration from resetting the form state
      if (currentEditingFunctionId !== functionId) {
        setFormData({
          name: editingFunction.name || "",
          description: editingFunction.description || "",
          aiAssistancePrompt: editingFunction.aiAssistancePrompt || "",
          functionCode: editingFunction.functionCode || ""
        });
        setToolType(editingFunction.functionType === 'AI_ONLY' ? 'AI_ONLY' : 'CODE');
        setOutputType(editingFunction.outputType || "single");
        setInputParameters(editingFunction.inputParameters || []);
        setIsEditMode(true);
        setCurrentEditingFunctionId(functionId);
        setOpen(true);
        console.log('🔧 Form loaded for editing function:', functionId, 'Type:', editingFunction.functionType);
      } else {
        console.log('🔧 Same function - preserving current form state:', functionId);
      }
      
      // Always keep code section expanded if there's existing code (for regeneration)
      if (editingFunction.functionCode) {
        setCodeExpanded(true);
      }
    } else {
      setIsEditMode(false);
      setCurrentEditingFunctionId(null);
    }
  }, [editingFunction, currentEditingFunctionId]);

  // Add update mutation for editing
  const updateTool = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔧 Updated Tool Object:', {
        id: editingFunction.id,
        name: data.name,
        description: data.description,
        functionType: data.toolType === 'AI_ONLY' ? 'AI_ONLY' : 'SCRIPT',
        outputType: data.outputType,
        inputParameters: data.inputParameters,
        tags: data.tags || []
      });
      
      return apiRequest(`/api/excel-functions/${editingFunction.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          functionCode: editingFunction.functionCode, // Use current code (may be regenerated)
          functionType: data.toolType === 'AI_ONLY' ? 'AI_ONLY' : 'SCRIPT',
          outputType: data.outputType,
          inputParameters: data.inputParameters,
          tags: data.tags || []
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'excel-functions'] });
      setEditingFunction?.(null);
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Failed to update tool:', error);
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
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'excel-functions'] });
      console.log('Tool created successfully');
      setTimeout(() => {
        setOpen(false);
        resetForm();
        setLoadingProgress(0);
        setLoadingMessage("");
      }, 1500); // Give time to see completion
    },
    onError: (error: any) => {
      console.error('Failed to create tool:', error);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  const generateToolCode = useMutation({
    mutationFn: async (data: any) => {
      setLoadingProgress(25);
      setLoadingMessage("Generating tool");
      console.log('🔧 Creating tool with data:', JSON.stringify(data, null, 2));
      
      setLoadingProgress(50);
      
      const response = await apiRequest("/api/excel-functions/generate", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      setLoadingProgress(75);
      
      return response;
    },
    onSuccess: (response) => {
      setLoadingProgress(100);
      setLoadingMessage("Tool created successfully!");
      
      console.log('🎉 AI generation response:', JSON.stringify(response, null, 2));
      
      // Ensure the response has the required fields from the AI generation
      if (!response.functionCode || !response.metadata) {
        console.error('❌ Missing required fields in AI response:', {
          hasFunctionCode: !!response.functionCode,
          hasMetadata: !!response.metadata,
          response: response
        });
        console.error(`AI generation incomplete - missing ${!response.functionCode ? 'functionCode' : 'metadata'}`);
        setLoadingProgress(0);
        setLoadingMessage("");
        return;
      }
      
      console.log('✅ AI response validation passed, proceeding with tool creation...');
      
      // Use the response to create the tool with generated code
      createTool.mutate(response);
    },
    onError: (error: any) => {
      console.error('Code generation failed:', error);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  // Regenerate function code mutation
  const regenerateToolCode = useMutation({
    mutationFn: async (toolId: string) => {
      return apiRequest(`/api/excel-functions/${toolId}/regenerate`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          inputParameters: inputParameters,
          toolType: toolType,
          outputType: outputType,
          aiAssistanceRequired: formData.aiAssistanceRequired,
          aiAssistancePrompt: formData.aiAssistancePrompt,
          currentCode: editingFunction?.functionCode
        })
      });
    },
    onSuccess: (updatedTool) => {
      console.log('🎯 Regeneration response:', JSON.stringify(updatedTool, null, 2));
      console.log('🎯 Function code from response:', updatedTool?.functionCode);
      
      // Update both the editing function and form data
      if (setEditingFunction) {
        setEditingFunction(updatedTool);
      }
      // Update the form data with the new code
      setFormData(prev => ({ ...prev, functionCode: updatedTool?.functionCode || '' }));
      console.log('✅ Form data updated with new code:', updatedTool?.functionCode?.substring(0, 100) + '...');
      console.log('Tool code regenerated successfully');
    },
    onError: (error: any) => {
      console.error('Failed to regenerate tool code:', error);
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
    // Array to collect updated parameters with sample document IDs
    const updatedParameters: InputParameter[] = [];

    for (const param of parameters) {
      let updatedParam = { ...param };
      
      try {
        if (param.sampleText) {
          // Process text sample
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: param.sampleText
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for text parameter ${param.name}:`, response.document.id);
          }
        } else if (param.sampleFileURL && param.sampleFile) {
          // Process file sample using the SAME extraction process as session documents
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST", 
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              fileName: param.sampleFile,
              fileURL: param.sampleFileURL
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for file parameter ${param.name}:`, response.document.id);
          }
        } else if (param.sampleData && param.sampleData.columns.length > 0 && param.sampleData.rows.length > 0) {
          // Process data table sample - convert to array of objects format with identifier column info
          const sampleDataWithIdentifier = {
            data: param.sampleData.rows,
            identifierColumn: param.sampleData.identifierColumn || param.sampleData.columns[0]
          };
          const tableDataAsJSON = JSON.stringify(sampleDataWithIdentifier, null, 2);
          
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: tableDataAsJSON
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for data parameter ${param.name}:`, response.document.id);
          }
        }
      } catch (error) {
        console.error(`Failed to process sample for parameter ${param.name}:`, error);
        // Don't throw error to prevent function creation failure
      }
      
      updatedParameters.push(updatedParam);
    }

    // Update the function with the sample document IDs
    if (updatedParameters.some(p => p.sampleDocumentIds)) {
      try {
        console.log('🔄 Updating function with sample document IDs...');
        await apiRequest(`/api/excel-functions/${functionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            inputParameters: updatedParameters
          })
        });
        console.log('✅ Function updated with sample document IDs');
      } catch (error) {
        console.error('Failed to update function with sample document IDs:', error);
      }
    }
  };

  const handleSampleFileUpload = async (paramId: string, file: File | undefined) => {
    if (!file) return;
    
    console.log('📁 Sample file selected:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Start processing for this parameter
    setProcessingParams(prev => new Set([...prev, paramId]));

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

      const fileURL = uploadURL.split('?')[0]; // Store the base URL without query params
      
      // Update the parameter with the uploaded file info temporarily
      updateInputParameter(paramId, "sampleFile", file.name);
      updateInputParameter(paramId, "sampleFileURL", fileURL);
      
      // Immediately process the uploaded document for extraction if editing existing function
      const param = inputParameters.find(p => p.id === paramId);
      if (param && editingFunction?.id) {
        try {
          const processResponse = await fetch("/api/sample-documents/process", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({
              functionId: editingFunction.id,
              parameterName: param.name,
              fileName: file.name,
              fileURL: fileURL
            })
          });

          if (!processResponse.ok) {
            throw new Error("Failed to process document for extraction");
          }

          const processResult = await processResponse.json();
          console.log('✅ Sample document processed:', processResult);
          
          // Store the sample document ID in the parameter
          if (processResult.document?.id) {
            updateInputParameter(paramId, "sampleDocumentIds", [processResult.document.id]);
            console.log(`✅ Stored sample document ID ${processResult.document.id} for parameter ${param.name}`);
            
            // Update the function with the new sample document IDs
            try {
              const updatedParams = inputParameters.map(p => 
                p.id === paramId 
                  ? { ...p, sampleDocumentIds: [processResult.document.id] }
                  : p
              );
              
              await apiRequest(`/api/excel-functions/${editingFunction.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  inputParameters: updatedParams
                })
              });
              console.log('✅ Function updated with new sample document ID');
            } catch (updateError) {
              console.error('Failed to update function with sample document ID:', updateError);
            }
          }
          
          console.log(`Sample file "${file.name}" has been uploaded and processed for extraction.`);
        } catch (processError) {
          console.error("Processing error:", processError);
          console.warn(`File uploaded but processing failed. It will be processed when testing the tool.`);
        }
      } else {
        console.log(`Sample file "${file.name}" uploaded. It will be processed when the tool is created.`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Upload Failed: Failed to upload sample file. Please try again.");
    } finally {
      // Stop processing for this parameter
      setProcessingParams(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(paramId);
        return newSet;
      });
    }
  };

  const clearSampleFile = (paramId: string) => {
    updateInputParameter(paramId, "sampleFile", "");
    updateInputParameter(paramId, "sampleFileURL", "");
    console.log("Sample file has been removed from this parameter.");
  };

  const handleRegenerateCode = () => {
    setShowRegenerateDialog(true);
  };

  const confirmRegenerate = () => {
    if (!editingFunction?.id) {
      console.error('No function selected for regeneration');
      return;
    }
    regenerateToolCode.mutate(editingFunction.id);
    setShowRegenerateDialog(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || !toolType || inputParameters.length === 0) {
      console.error("Validation Error: Please fill in all required fields, select a tool type, and add at least one input.");
      return;
    }

    // Validate input parameters
    const invalidParams = inputParameters.filter(p => !p.name || !p.description);
    if (invalidParams.length > 0) {
      console.error("Validation Error: All inputs must have a name and description.");
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="create-tool-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-gray-800 flex items-center">
            {editingFunction ? 'Edit' : 'Create new'} extrapl
            <span className="w-2 h-2 rounded-full mx-2" style={{ backgroundColor: '#4F63A4' }}></span>
            Tool
          </DialogTitle>
          <p id="create-tool-dialog-description" className="sr-only">
            {editingFunction ? 'Edit existing extraction tool configuration and parameters' : 'Create new extraction tool with AI assistance for document processing'}
          </p>
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
                  Tool Name *
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

          {/* Tool Type - Show in both create and edit mode */}
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
                  ? "Data is processed using a coded function"
                  : "Data is processed using AI"
                }
              </p>

            </CardContent>
          </Card>

          {/* Inputs - Only show when tool type is selected */}
          {(toolType || isEditMode) && (
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
                                    {!processingParams.has(param.id) ? (
                                      <>
                                        <input
                                          type="file"
                                          accept=".xlsx,.xls,.docx,.doc,.pdf,.json,.csv,.txt"
                                          onChange={(e) => handleSampleFileUpload(param.id, e.target.files?.[0])}
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer">
                                          <Upload className="h-5 w-5 text-gray-400" />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                                        <Loader2 className="h-5 w-5 text-gray-600 animate-spin mr-2" />
                                        <span className="text-sm text-gray-700">Processing document...</span>
                                      </div>
                                    )}
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
          )}

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

          {/* Code/Prompt Section - Always visible when tool type is selected */}
          {toolType && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-800">
                    {toolType === 'AI_ONLY' ? 'Tool Prompt' : 'Tool Code'}
                  </CardTitle>
                  {editingFunction && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerateCode}
                      disabled={regenerateToolCode.isPending}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${regenerateToolCode.isPending ? 'animate-spin' : ''}`} />
                      {regenerateToolCode.isPending ? 'Generating Code' : 'Generate Code'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.functionCode || ''}
                  onChange={(e) => setFormData({ ...formData, functionCode: e.target.value })}
                  placeholder={toolType === 'AI_ONLY' 
                    ? "Enter your prompt here, or click 'Generate Code' to create automatically..."
                    : "Enter your Python code here, or click 'Generate Code' to create automatically..."
                  }
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-600 mt-2">
                  You can manually enter {toolType === 'AI_ONLY' ? 'your prompt' : 'Python code'} or use the "Generate Code" button to create it automatically based on your inputs.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={createTool.isPending || updateTool.isPending}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createTool.isPending || updateTool.isPending}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {createTool.isPending || updateTool.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingFunction ? "Updating..." : "Creating..."}
                </div>
              ) : (
                editingFunction ? "Update Tool" : "Create Tool"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Code</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate new {toolType === 'AI_ONLY' ? 'prompt' : 'code'} based on current inputs. Any existing {toolType === 'AI_ONLY' ? 'prompt' : 'code'} will be overwritten. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerate} className="bg-gray-700 hover:bg-gray-800">
              Generate Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}