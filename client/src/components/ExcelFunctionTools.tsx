import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Code, Edit3, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CreateToolDialog from "./CreateToolDialog";

interface ExcelWizardryFunction {
  id: string;
  name: string;
  description: string;
  functionCode: string;
  tags: string[] | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ExcelFunctionTools() {
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<ExcelWizardryFunction | null>(null);
  const [editingFunction, setEditingFunction] = useState<ExcelWizardryFunction | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    functionCode: "",
    tags: "",
    inputParameters: [] as Array<{ id?: string; name: string; type: string; description: string }>
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all Excel wizardry functions
  const { data: functions, isLoading } = useQuery<ExcelWizardryFunction[]>({
    queryKey: ["/api/excel-functions"],
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
      
      console.log("=== UPDATING EXCEL FUNCTION ===");
      console.log("Function ID:", data.id);
      console.log("Update Data:", updateData);
      
      const result = await apiRequest(`/api/excel-functions/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData)
      });
      
      console.log("=== FUNCTION UPDATE RESULT ===");
      console.log("Updated Function:", result);
      console.log("=== END FUNCTION UPDATE ===");
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excel-functions"] });
      toast({
        title: "Function Updated",
        description: "Excel function has been updated successfully."
      });
      setEditingFunction(null);
      setCodeModalOpen(false);
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
      return apiRequest(`/api/excel-functions/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excel-functions"] });
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

  const toggleExpanded = (functionId: string) => {
    const newExpanded = new Set(expandedFunctions);
    if (newExpanded.has(functionId)) {
      newExpanded.delete(functionId);
    } else {
      newExpanded.add(functionId);
    }
    setExpandedFunctions(newExpanded);
  };

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
            type: param.type || "text",
            description: param.description || ""
          }))
        : []
    });
  };

  const handleCodeEdit = (func: ExcelWizardryFunction) => {
    setSelectedFunction(func);
    setFormData({
      name: func.name,
      description: func.description,
      functionCode: func.functionCode,
      tags: func.tags?.join(", ") || "",
      inputParameters: Array.isArray((func as any).inputParameters) 
        ? (func as any).inputParameters.map((param: any, index: number) => ({
            id: param.id || `param_${index}`,
            name: param.name || "",
            type: param.type || "text",
            description: param.description || ""
          }))
        : []
    });
    setCodeModalOpen(true);
  };

  const handleSave = () => {
    if (!editingFunction && !selectedFunction) return;
    
    const func = editingFunction || selectedFunction;
    if (!func) return;

    const tagsArray = formData.tags
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    updateFunction.mutate({
      id: func.id,
      description: formData.description,
      functionCode: formData.functionCode,
      tags: tagsArray,
      inputParameters: formData.inputParameters
    });
  };

  const handleCancel = () => {
    setEditingFunction(null);
    setSelectedFunction(null);
    setCodeModalOpen(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Excel Function Tools</h1>
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
          <h1 className="text-3xl font-bold text-gray-800">Tools</h1>
          <p className="text-gray-600 mt-1">Manage reusable extraction functions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {functions?.length || 0} functions available
          </div>
          <CreateToolDialog />
        </div>
      </div>

      <div className="space-y-4">
        {functions?.map((func) => (
          <Card key={func.id} className="border-gray-200 hover:shadow-md transition-shadow bg-white">
            <Collapsible 
              open={expandedFunctions.has(func.id)}
              onOpenChange={() => toggleExpanded(func.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {expandedFunctions.has(func.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        )}
                        <div className="bg-gray-100 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">
                          {func.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-800">
                          {func.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                            Used {func.usageCount} times
                          </Badge>
                          {func.tags && func.tags.length > 0 && (
                            <div className="flex gap-1">
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
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
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
                        
                        {/* Input Parameters Section */}
                        <div>
                          <Label className="text-sm font-medium">Input Parameters</Label>
                          <div className="space-y-3 mt-2">
                            {formData.inputParameters.map((param, index) => (
                              <div key={param.id || index} className="p-3 border rounded-lg bg-gray-50">
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <Input
                                    placeholder="Parameter name"
                                    value={param.name}
                                    onChange={(e) => {
                                      const newParams = [...formData.inputParameters];
                                      newParams[index].name = e.target.value;
                                      setFormData({ ...formData, inputParameters: newParams });
                                    }}
                                  />
                                  <select
                                    className="px-3 py-2 border rounded-md text-sm"
                                    value={param.type}
                                    onChange={(e) => {
                                      const newParams = [...formData.inputParameters];
                                      newParams[index].type = e.target.value;
                                      setFormData({ ...formData, inputParameters: newParams });
                                    }}
                                  >
                                    <option value="text">Text</option>
                                    <option value="document">Document</option>
                                    <option value="number">Number</option>
                                  </select>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newParams = formData.inputParameters.filter((_, i) => i !== index);
                                      setFormData({ ...formData, inputParameters: newParams });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <Input
                                  placeholder="Parameter description"
                                  value={param.description}
                                  onChange={(e) => {
                                    const newParams = [...formData.inputParameters];
                                    newParams[index].description = e.target.value;
                                    setFormData({ ...formData, inputParameters: newParams });
                                  }}
                                />
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newParam = {
                                  id: `param_${Date.now()}`,
                                  name: "",
                                  type: "text",
                                  description: ""
                                };
                                setFormData({ 
                                  ...formData, 
                                  inputParameters: [...formData.inputParameters, newParam]
                                });
                              }}
                              className="w-full"
                            >
                              + Add Parameter
                            </Button>
                          </div>
                        </div>
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
                              onClick={() => handleCodeEdit(func)}
                              className="bg-gray-700 hover:bg-gray-800 text-white"
                            >
                              <Code className="h-4 w-4 mr-1" />
                              Edit Code
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
              </CollapsibleContent>
            </Collapsible>
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

      {/* Code Edit Modal */}
      <Dialog open={codeModalOpen} onOpenChange={setCodeModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Function Code: {selectedFunction?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="modal-description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="modal-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="modal-tags" className="text-sm font-medium">
                Tags (comma-separated)
              </Label>
              <Input
                id="modal-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="date, financial, text_extraction"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="function-code" className="text-sm font-medium">
                Python Function Code
              </Label>
              <Textarea
                id="function-code"
                value={formData.functionCode}
                onChange={(e) => setFormData({ ...formData, functionCode: e.target.value })}
                rows={20}
                className="mt-1 font-mono text-sm"
                placeholder="def extract_function(document_content, target_fields, identifier_references):"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancel} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateFunction.isPending}
                className="bg-gray-700 hover:bg-gray-800 text-white"
              >
                {updateFunction.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}