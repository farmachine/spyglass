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
            <DialogTitle className="text-gray-800">Test Tool: {testingFunction?.name}</DialogTitle>
          </DialogHeader>
          
          {testingFunction && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Tool Description</h4>
                <p className="text-gray-600">{testingFunction.description}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-4">The tool will be tested using the following inputs:</h4>
                
                <div className="space-y-4">
                  {testingFunction.inputParameters?.map((param: any, index: number) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium text-gray-800">{param.name}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {param.type}
                        </span>
                      </div>
                      
                      {param.type === 'text' && param.sampleText && (
                        <div className="bg-gray-50 p-3 rounded border">
                          <p className="text-sm text-gray-700">{param.sampleText}</p>
                        </div>
                      )}
                      
                      {param.type === 'document' && param.sampleFile && (
                        <div className="bg-gray-50 p-3 rounded border">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Document:</span> {param.sampleFile}
                          </p>
                        </div>
                      )}
                      
                      {param.type === 'data' && param.sampleData && (
                        <div className="bg-gray-50 p-3 rounded border">
                          <p className="text-sm font-medium text-gray-700 mb-2">Sample Data:</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  {param.sampleData.columns?.map((col: string, colIndex: number) => (
                                    <th key={colIndex} className="px-2 py-1 text-left font-medium text-gray-700 border border-gray-200">
                                      {col}
                                      {param.sampleData.identifierColumn === col && (
                                        <span className="ml-1 text-yellow-600">🔑</span>
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {param.sampleData.rows?.slice(0, 3).map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b border-gray-200">
                                    {param.sampleData.columns?.map((col: string, colIndex: number) => (
                                      <td key={colIndex} className="px-2 py-1 text-gray-600 border border-gray-200">
                                        {row[col] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {param.sampleData.rows?.length > 3 && (
                                  <tr>
                                    <td colSpan={param.sampleData.columns?.length} className="px-2 py-1 text-center text-gray-500 italic border border-gray-200">
                                      ... and {param.sampleData.rows.length - 3} more rows
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {param.description && (
                        <p className="text-xs text-gray-500 mt-2">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center py-8 text-gray-500">
                <p>Testing functionality will be available soon.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}