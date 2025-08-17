import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database, Type, Copy, Check, Upload, Loader2 } from "lucide-react";
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

interface InputParameter {
  id: string;
  name: string;
  type: "text" | "data" | "document";
  description: string;
  multiline?: boolean; // Only applies to text type
  sampleFile?: string; // Sample file name for documents/data
  sampleFileURL?: string; // Sample file URL for documents/data
  sampleText?: string; // Sample text for text type
}

interface CreateToolDialogProps {
  projectId: string;
  editingFunction?: any;
  setEditingFunction?: (func: any) => void;
}

export default function CreateToolDialog({ projectId, editingFunction, setEditingFunction }: CreateToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [toolType, setToolType] = useState<"SCRIPT" | "AI_ONLY" | null>(null);
  const [aiAssistanceRequired, setAiAssistanceRequired] = useState(false);
  const [outputType, setOutputType] = useState<"single" | "multiple">("single");
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    aiAssistancePrompt: ""
  });
  const [copiedSampleData, setCopiedSampleData] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTool = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/excel-functions", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      // Process sample documents after tool creation
      if (response.id && data.inputParameters && data.inputParameters.some((p: any) => p.sampleFile || p.sampleText)) {
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
    setInputParameters([...inputParameters, newParam]);
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
          return updatedParam;
        }
        return param;
      })
    );
  };

  const removeInputParameter = (id: string) => {
    setInputParameters(prev => prev.filter(param => param.id !== id));
  };

  const generateSampleData = (description: string, paramName: string): string => {
    // Generate sample JSON data based on the parameter name
    const sampleData = {
      "Collection Name": [
        { [paramName]: "Column Example" },
        { [paramName]: "Other Column" },
        { [paramName]: "Another Example Column 2" },
        { [paramName]: "Another Example Column 3" },
        { [paramName]: "Another Example Column 4" },
        { [paramName]: "Another Example Column 5" },
        { [paramName]: "Another Example Column 6" },
        { [paramName]: "Another Example Column 7" },
        { [paramName]: "Another Example Column 8" },
        { [paramName]: "Another Example Column 9" },
        { [paramName]: "Another Example Column 10" }
      ]
    };
    
    return JSON.stringify(sampleData, null, 2);
  };

  const copySampleDataToClipboard = async (paramId: string, description: string, paramName: string) => {
    const sampleData = generateSampleData(description, paramName);
    try {
      await navigator.clipboard.writeText(sampleData);
      setCopiedSampleData(paramId);
      toast({
        title: "Sample Data Copied",
        description: "Sample JSON data has been copied to your clipboard",
      });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedSampleData(null);
      }, 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy sample data to clipboard",
        variant: "destructive"
      });
    }
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      aiAssistancePrompt: ""
    });
    setInputParameters([]);
    setToolType(null);
    setAiAssistanceRequired(false);
    setOutputType("single");
    setCopiedSampleData(null);
    setLoadingProgress(0);
    setLoadingMessage("");
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
      aiAssistanceRequired: toolType === "SCRIPT" ? aiAssistanceRequired : false,
      aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
      tags: [] // Default to empty tags array since we removed the tags field
    };

    generateToolCode.mutate(toolData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gray-700 hover:bg-gray-800 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-800 flex items-center">
            Create new extrapl
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
              <Select value={toolType || ""} onValueChange={(value: "SCRIPT" | "AI_ONLY") => setToolType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tool type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI_ONLY">AI</SelectItem>
                  <SelectItem value="SCRIPT">Code</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 mt-2">
                {toolType === "SCRIPT" 
                  ? "Python script that processes data with optional AI assistance"
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
                  {inputParameters.map((param, index) => (
                    <div key={param.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="border-gray-300">
                          @{param.name || "parameter-name"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeInputParameter(param.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Input Name</Label>
                          <Input
                            value={param.name}
                            onChange={(e) => updateInputParameter(param.id, "name", e.target.value)}
                            placeholder="parameter_name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Type</Label>
                          <Select 
                            value={param.type} 
                            onValueChange={(value: "text" | "data" | "document") => updateInputParameter(param.id, "type", value)}
                          >
                            <SelectTrigger className="mt-1">
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
                      </div>
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
                          
                          {/* Sample text input */}
                          <div className="p-3 bg-gray-50 rounded border space-y-3">
                            <div className="text-sm text-gray-600">
                              Add sample text to test this parameter.
                            </div>
                            {param.multiline ? (
                              <Textarea
                                value={param.sampleText || ""}
                                onChange={(e) => updateInputParameter(param.id, "sampleText", e.target.value)}
                                placeholder="Enter sample text..."
                                rows={3}
                                className="bg-white"
                              />
                            ) : (
                              <Input
                                value={param.sampleText || ""}
                                onChange={(e) => updateInputParameter(param.id, "sampleText", e.target.value)}
                                placeholder="Enter sample text..."
                                className="bg-white"
                              />
                            )}
                            {param.sampleText && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="inline-flex items-center gap-2 bg-gray-700 text-gray-100 px-3 py-1 rounded text-xs">
                                  <span>Sample text ({param.sampleText.length} chars)</span>
                                  <button
                                    type="button"
                                    onClick={() => updateInputParameter(param.id, "sampleText", "")}
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
                      {param.type !== "text" && (
                        <div className="p-3 bg-gray-50 rounded border space-y-3">
                          <div className="text-sm text-gray-600">
                            Upload a sample {param.type === "document" ? "document" : "data file"} to test this tool.
                          </div>
                          <div className="relative">
                            <Input
                              type="file"
                              accept={param.type === "document" ? ".pdf,.docx,.doc,.txt,.xlsx,.xls" : ".xlsx,.xls,.csv,.json"}
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
                      )}
                      
                      {/* Add Input button after first input */}
                      {index === 0 && inputParameters.length >= 1 && (
                        <div className="text-center py-2 border-t pt-4">
                          <Button 
                            size="sm" 
                            onClick={addInputParameter}
                            className="bg-gray-600 hover:bg-gray-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Input
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Assistance (only for SCRIPT functions) */}
          {toolType === "SCRIPT" && (
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
          {(generateToolCode.isPending || createTool.isPending) && (
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
              disabled={generateToolCode.isPending || createTool.isPending}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={generateToolCode.isPending || createTool.isPending}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {generateToolCode.isPending || createTool.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </div>
              ) : (
                "Generate Tool"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}