import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Code, Edit3, Trash2, Plus, X, FileText, Database, Type, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CreateToolDialog from "./CreateToolDialog";

interface ExcelWizardryFunction {
  id: string;
  name: string;
  description: string;
  functionCode: string;
  functionType: 'SCRIPT' | 'AI_ONLY';
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
  interface InputParameter {
    id: string;
    name: string;
    type: "text" | "data" | "document";
    description: string;
    multiline?: boolean; // Only applies to text type
  }

  const [copiedSampleData, setCopiedSampleData] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    functionCode: "",
    tags: "",
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
  };

  const generateSampleData = (description: string): string => {
    // Generate sample JSON data based on the description
    const sampleData = {
      "example_array": [
        {
          "field_1": "Sample value based on description",
          "field_2": 123,
          "field_3": true,
          "nested_object": {
            "property": "Sample nested data"
          }
        },
        {
          "field_1": "Another sample value",
          "field_2": 456,
          "field_3": false,
          "nested_object": {
            "property": "More nested data"
          }
        }
      ],
      "metadata": {
        "total_records": 2,
        "generated_from": description || "input description",
        "sample_note": "This is sample data structure - replace with actual data matching your input description"
      }
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

  // Fetch Excel wizardry functions for this project
  const { data: functions, isLoading } = useQuery<ExcelWizardryFunction[]>({
    queryKey: [`/api/projects/${projectId}/excel-functions`],
  });

  // Update function mutation
  const updateFunction = useMutation({
    mutationFn: async (data: { id: string; description: string; functionCode: string; tags: string[]; inputParameters?: any[] }) => {
      const updateData: any = {
        description: data.description,
        functionCode: data.functionCode,
        tags: data.tags
      };
      
      if (data.inputParameters) {
        updateData.inputParameters = data.inputParameters;
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
      setFormData({ name: "", description: "", functionCode: "", tags: "", inputParameters: [] });
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



  const handleEdit = (func: ExcelWizardryFunction) => {
    setEditingFunction(func);
    setFormData({
      name: func.name,
      description: func.description,
      functionCode: func.functionCode,
      tags: func.tags?.join(", ") || "",
      inputParameters: Array.isArray((func as any).inputParameters) 
        ? (func as any).inputParameters.map((param: any, index: number) => ({
            id: param.id || `param_${index}`,
            name: param.name || "",
            type: (param.type as "text" | "data" | "document") || "text",
            description: param.description || "",
            multiline: param.multiline || false
          }))
        : []
    });
  };

  const handleSave = () => {
    if (!editingFunction) return;

    const tagsArray = formData.tags
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    updateFunction.mutate({
      id: editingFunction.id,
      description: formData.description,
      functionCode: formData.functionCode,
      tags: tagsArray,
      inputParameters: formData.inputParameters
    });
  };

  const handleCancel = () => {
    setEditingFunction(null);
    setFormData({ name: "", description: "", functionCode: "", tags: "", inputParameters: [] });
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
          <CreateToolDialog projectId={projectId} />
        </div>
      </div>

      <div className="space-y-4">
        {functions?.map((func) => (
          <Card key={func.id} className="border-gray-200 hover:shadow-md transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    {func.name}
                  </CardTitle>
                  {func.tags && func.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {func.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs border-gray-300 text-gray-600">
                          {tag}
                        </Badge>
                      ))}
                      {func.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                          +{func.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
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
                    <div>
                      <Label htmlFor="tags" className="text-sm font-medium">
                        Tags (comma-separated)
                      </Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="date, financial, text_extraction"
                        className="mt-1"
                      />
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
                              onClick={() => handleEdit(func)}
                              className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit Details
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleEdit(func)}
                              className="bg-gray-700 hover:bg-gray-800 text-white"
                            >
                              <Code className="h-4 w-4 mr-1" />
                              {func.functionType === 'AI_ONLY' ? 'Edit Prompt' : 'Edit Code'}
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


    </div>
  );
}