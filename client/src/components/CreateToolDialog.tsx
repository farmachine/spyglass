import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database } from "lucide-react";
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
  type: "text" | "document";
  description: string;
}

export default function CreateToolDialog() {
  const [open, setOpen] = useState(false);
  const [functionType, setFunctionType] = useState<"SCRIPT" | "AI_ONLY">("SCRIPT");
  const [aiAssistanceRequired, setAiAssistanceRequired] = useState(false);
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    aiAssistancePrompt: "",
    tags: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createFunction = useMutation({
    mutationFn: async (data: any) => {
      console.log("=== CREATING EXCEL FUNCTION ===");
      console.log("Function Data:", data);
      
      const result = await apiRequest("/api/excel-functions", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      console.log("=== FUNCTION CREATION RESULT ===");
      console.log("Created Function:", result);
      console.log("=== END FUNCTION CREATION ===");
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excel-functions"] });
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
      description: ""
    };
    setInputParameters([...inputParameters, newParam]);
  };

  const updateInputParameter = (id: string, field: keyof InputParameter, value: string) => {
    setInputParameters(prev => 
      prev.map(param => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeInputParameter = (id: string) => {
    setInputParameters(prev => prev.filter(param => param.id !== id));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      aiAssistancePrompt: "",
      tags: ""
    });
    setInputParameters([]);
    setFunctionType("SCRIPT");
    setAiAssistanceRequired(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || inputParameters.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one input parameter.",
        variant: "destructive"
      });
      return;
    }

    // Validate input parameters
    const invalidParams = inputParameters.filter(p => !p.name || !p.description);
    if (invalidParams.length > 0) {
      toast({
        title: "Validation Error",
        description: "All input parameters must have a name and description.",
        variant: "destructive"
      });
      return;
    }

    const tagsArray = formData.tags
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const functionData = {
      name: formData.name,
      description: formData.description,
      functionType,
      inputParameters,
      aiAssistanceRequired: functionType === "SCRIPT" ? aiAssistanceRequired : false,
      aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
      tags: tagsArray
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
              <div>
                <Label htmlFor="tags" className="text-sm font-medium text-gray-700">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="financial, data-extraction, excel"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Function Type */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800">Function Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={functionType} onValueChange={(value: "SCRIPT" | "AI_ONLY") => setFunctionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCRIPT">Script Function</SelectItem>
                  <SelectItem value="AI_ONLY">AI-Only Function</SelectItem>
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

          {/* Input Parameters */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800 flex items-center justify-between">
                Input Parameters *
                <Button 
                  size="sm" 
                  onClick={addInputParameter}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Parameter
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputParameters.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No input parameters defined. Click "Add Parameter" to start.
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
                        <Label className="text-sm font-medium text-gray-700">Parameter Name</Label>
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
                          onValueChange={(value: "text" | "document") => updateInputParameter(param.id, "type", value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Text Input
                              </div>
                            </SelectItem>
                            <SelectItem value="document">
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Document Input
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
                        placeholder="Describe what this parameter is used for"
                        rows={2}
                        className="mt-1"
                      />
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
              {generateCode.isPending ? "Generating..." : "Generate Code"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}