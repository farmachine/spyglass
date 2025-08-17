import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database, Type, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InputParameter {
  id: string;
  name: string;
  type: "text" | "data" | "document";
  description: string;
  multiline?: boolean; // Only applies to text type
}

interface CreateToolDialogProps {
  projectId: string;
}

export default function CreateToolDialog({ projectId }: CreateToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [functionType, setFunctionType] = useState<"SCRIPT" | "AI_ONLY">("SCRIPT");
  const [aiAssistanceRequired, setAiAssistanceRequired] = useState(false);
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    aiAssistancePrompt: ""
  });
  const [copiedSampleData, setCopiedSampleData] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createFunction = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/excel-functions", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      toast({
        title: "Function Created",
        description: "Tool has been created successfully."
      });
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create the tool. Please try again.",
        variant: "destructive"
      });
    }
  });

  const generateCode = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/excel-functions/generate", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (response) => {
      // Use the response to create the function with generated code
      createFunction.mutate(response);
    },
    onError: () => {
      toast({
        title: "Code Generation Failed",
        description: "Failed to generate function code. Please try again.",
        variant: "destructive"
      });
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

  const generateSampleData = (description: string): string => {
    // Generate sample JSON data based on the description
    const sampleData = {
      "Collection Name": [
        { "Column Name": "Column Example" },
        { "Column Name": "Other Column" },
        { "Column Name": "Another Example Column 2" },
        { "Column Name": "Another Example Column 3" },
        { "Column Name": "Another Example Column 4" },
        { "Column Name": "Another Example Column 5" },
        { "Column Name": "Another Example Column 6" },
        { "Column Name": "Another Example Column 7" },
        { "Column Name": "Another Example Column 8" },
        { "Column Name": "Another Example Column 9" },
        { "Column Name": "Another Example Column 10" }
      ]
    };
    
    return JSON.stringify(sampleData, null, 2);
  };

  const copySampleDataToClipboard = async (paramId: string, description: string) => {
    const sampleData = generateSampleData(description);
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      aiAssistancePrompt: ""
    });
    setInputParameters([]);
    setFunctionType("SCRIPT");
    setAiAssistanceRequired(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || inputParameters.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one input.",
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

    const functionData = {
      projectId,
      name: formData.name,
      description: formData.description,
      functionType,
      inputParameters,
      aiAssistanceRequired: functionType === "SCRIPT" ? aiAssistanceRequired : false,
      aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
      tags: [] // Default to empty tags array since we removed the tags field
    };

    generateCode.mutate(functionData);
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
          <DialogTitle className="text-gray-800">Create New Tool</DialogTitle>
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
                  placeholder="Describe what this function does and how to use @-key references for parameters"
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
              <Select value={functionType} onValueChange={(value: "SCRIPT" | "AI_ONLY") => setFunctionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI_ONLY">AI</SelectItem>
                  <SelectItem value="SCRIPT">Code</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 mt-2">
                {functionType === "SCRIPT" 
                  ? "Python script that processes data with optional AI assistance"
                  : "AI-powered function that uses prompts to analyze and extract data"
                }
              </p>
            </CardContent>
          </Card>

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
              {inputParameters.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No inputs defined. Click "Add Input" to start.
                </p>
              ) : (
                inputParameters.map((param) => (
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
                    {param.type === "text" && (
                      <div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`multiline-${param.id}`}
                            checked={param.multiline || false}
                            onCheckedChange={(checked) => updateInputParameter(param.id, "multiline", checked)}
                          />
                          <Label htmlFor={`multiline-${param.id}`} className="text-sm font-medium text-gray-700">
                            Multi-line text input
                          </Label>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-gray-700">Description</Label>
                        {param.type === "data" && param.description && param.description.trim().length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copySampleDataToClipboard(param.id, param.description)}
                            className="text-xs h-7 px-2"
                          >
                            {copiedSampleData === param.id ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy Sample Data
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={param.description}
                        onChange={(e) => updateInputParameter(param.id, "description", e.target.value)}
                        placeholder="Describe what this parameter is used for"
                        rows={2}
                        className="mt-1"
                      />
                      {param.type === "data" && (
                        <p className="text-xs text-gray-500 mt-1">
                          For data type inputs, describe the expected data structure. Use "Copy Sample Data" to generate JSON sample based on your description.
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* AI Assistance (only for SCRIPT functions) */}
          {functionType === "SCRIPT" && (
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
                      placeholder="Describe how AI should process the function results to generate the final output"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={generateCode.isPending || createFunction.isPending}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              {generateCode.isPending ? "Generating..." : "Generate Tool"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}