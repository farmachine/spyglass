import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Edit3, Trash2, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CreateToolDialog from "./CreateToolDialog";

interface ExcelFunction {
  id: string;
  name: string;
  description: string;
  functionType: 'AI_ONLY' | 'SCRIPT';
  functionCode?: string;
  inputParameters: any[];
  outputType: 'single' | 'multiple';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ExcelFunctionToolsProps {
  projectId: string;
}

export default function ExcelFunctionTools({ projectId }: ExcelFunctionToolsProps) {
  const [editingFunction, setEditingFunction] = useState<ExcelFunction | null>(null);
  const [testingFunction, setTestingFunction] = useState<ExcelFunction | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch functions for this project
  const { data: functions, isLoading } = useQuery<ExcelFunction[]>({
    queryKey: ['/api/projects', projectId, 'excel-functions'],
    enabled: !!projectId,
  });

  // Delete function mutation
  const deleteFunction = useMutation({
    mutationFn: async (functionId: string) => {
      return apiRequest(`/api/excel-functions/${functionId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'excel-functions'] });
      toast({
        title: "Success",
        description: "Tool deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tool",
        variant: "destructive",
      });
    }
  });



  const handleEdit = (func: ExcelFunction) => {
    setEditingFunction(func);
  };

  const handleDelete = async (functionId: string) => {
    if (confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      deleteFunction.mutate(functionId);
    }
  };

  const handleTest = (func: ExcelFunction) => {
    setTestingFunction(func);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Tools</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {functions?.length || 0} tools available
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
                    <Brain className="h-5 w-5 text-gray-600" />
                    {func.name}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  {func.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>Used {func.usageCount} times</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {func.functionType === 'AI_ONLY' ? 'AI' : 'Script'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleTest(func)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <Play className="h-4 w-4 mr-1" />
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
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!functions || functions.length === 0) && (
          <Card className="p-8 text-center border-gray-200 bg-gray-50">
            <div className="text-gray-500">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">No Tools Available</h3>
              <p className="text-gray-600">Tools will appear here after they are generated during extraction processes.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Test Function Modal */}
      <Dialog open={!!testingFunction} onOpenChange={() => setTestingFunction(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-gray-800">extrapl <span className="text-blue-600">•</span> Test</DialogTitle>
          </DialogHeader>
          
          {testingFunction && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tool Name
                    </label>
                    <div className="text-gray-900 font-medium">{testingFunction.name}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <div className="text-gray-700 text-sm">{testingFunction.description}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Test Inputs</h3>
                <p className="text-sm text-gray-600">The tool will be tested using the following sample inputs:</p>
                
                <div className="space-y-4">
                  {testingFunction.inputParameters?.map((param: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium text-gray-900">{param.name}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {param.type}
                        </span>
                      </div>
                      
                      {param.type === 'text' && param.sampleText && (
                        <div className="bg-gray-50 p-3 rounded border text-sm text-gray-700">
                          {param.sampleText}
                        </div>
                      )}
                      
                      {param.type === 'document' && param.sampleFile && (
                        <div className="bg-gray-50 p-3 rounded border text-sm text-gray-700">
                          <span className="font-medium">Document:</span> {param.sampleFile}
                        </div>
                      )}
                      
                      {param.type === 'data' && param.sampleData && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Sample Data:</p>
                          <div className="border border-gray-300 rounded overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-300">
                                  {param.sampleData.columns?.map((col: string, colIndex: number) => (
                                    <th key={colIndex} className="text-left p-3 font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                                      {param.sampleData.identifierColumn === col && (
                                        <span className="text-yellow-600 mr-1">🔑</span>
                                      )}
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {param.sampleData.rows?.map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b border-gray-200 last:border-b-0">
                                    {param.sampleData.columns?.map((col: string, colIndex: number) => (
                                      <td key={colIndex} className="p-3 text-gray-600 border-r border-gray-200 last:border-r-0">
                                        {row[col] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {param.description && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                          <p className="text-sm text-gray-600">{param.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center py-6 text-gray-500 border-t border-gray-200">
                <p className="text-sm">Testing functionality will be available soon.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}