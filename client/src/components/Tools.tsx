import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { Play, Edit3, Trash2, Brain, Code } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CreateToolDialog from "./CreateToolDialog";

interface ExcelTool {
  id: string;
  name: string;
  description: string;
  toolType: 'AI' | 'CODE';
  functionCode?: string;
  inputParameters: any[];
  outputType: 'single' | 'multiple';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ExcelToolsProps {
  projectId: string;
}

export default function Tools({ projectId }: ExcelToolsProps) {
  const [editingTool, setEditingTool] = useState<ExcelTool | null>(null);
  const [testingTool, setTestingTool] = useState<ExcelTool | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toolToDelete, setToolToDelete] = useState<string | null>(null);
  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [debugText, setDebugText] = useState('');
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugRecommendations, setDebugRecommendations] = useState<string>('');

  const queryClient = useQueryClient();

  // Fetch tools for this project
  const { data: tools, isLoading } = useQuery<ExcelTool[]>({
    queryKey: ['/api/projects', projectId, 'excel-functions'],
    enabled: !!projectId,
  });

  // Delete tool mutation
  const deleteTool = useMutation({
    mutationFn: async (toolId: string) => {
      return apiRequest(`/api/excel-functions/${toolId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'excel-functions'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete tool:', error);
    }
  });



  // Run test tool
  const runTest = async (tool: ExcelTool) => {
    if (!tool.inputParameters || tool.inputParameters.length === 0) {
      console.warn('No test data available for tool:', tool.name);
      return;
    }

    setIsRunningTest(true);
    setTestResults(null);

    try {
      // Prepare inputs from user inputs or sample parameters
      const inputs: Record<string, any> = {};
      tool.inputParameters.forEach((param: any) => {
        const userInput = testInputs[param.name];
        if (param.type === 'text') {
          inputs[param.name] = userInput !== undefined ? userInput : (param.sampleText || '');
        } else if (param.type === 'document') {
          // For document parameters, use sample document IDs if available, otherwise fall back to filename
          if (param.sampleDocumentIds && param.sampleDocumentIds.length > 0) {
            inputs[param.name] = param.sampleDocumentIds;
          } else if (param.sampleFile) {
            inputs[param.name] = param.sampleFile;
          }
        } else if (param.type === 'data' && param.sampleData) {
          inputs[param.name] = param.sampleData;
        }
      });

      const response = await apiRequest(`/api/excel-functions/test`, {
        method: 'POST',
        body: JSON.stringify({
          functionId: tool.id,
          inputs: inputs
        })
      });

      // Log the raw JSON response to console for debugging
      console.log('🧪 Test Results - Raw JSON Response:', JSON.stringify(response, null, 2));
      console.log('🧪 Test Results - Parsed Response:', response);

      setTestResults(response.results || response);
    } catch (error) {
      console.error('Test execution error:', error);
    } finally {
      setIsRunningTest(false);
    }
  };

  const debugTool = async (tool: ExcelTool) => {
    if (!debugText.trim()) {
      return;
    }

    setIsDebugging(true);

    try {
      // Prepare the same inputs used for testing
      const inputs: Record<string, any> = {};
      tool.inputParameters.forEach((param: any) => {
        const userInput = testInputs[param.name];
        if (param.type === 'text') {
          inputs[param.name] = userInput !== undefined ? userInput : (param.sampleText || '');
        } else if (param.type === 'document') {
          // For document parameters, use sample document IDs if available, otherwise fall back to filename
          if (param.sampleDocumentIds && param.sampleDocumentIds.length > 0) {
            inputs[param.name] = param.sampleDocumentIds;
          } else if (param.sampleFile) {
            inputs[param.name] = param.sampleFile;
          }
        } else if (param.type === 'data' && param.sampleData) {
          inputs[param.name] = param.sampleData;
        }
      });

      const response = await apiRequest(`/api/excel-functions/debug`, {
        method: 'POST',
        body: JSON.stringify({
          functionId: tool.id,
          inputs: inputs,
          testResults: testResults,
          debugInstructions: debugText.trim()
        })
      });

      console.log('🔧 Debug Response:', response);
      
      // Clear debug text and scroll to top
      setDebugText('');
      
      // Scroll to top of the modal
      const modalContent = document.querySelector('[aria-describedby="test-dialog-description"]');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }

      // Show success message and store debug recommendations
      if (response.success) {
        console.log('Debug completed successfully');
        console.log('Debug recommendations:', response.debugResponse);
        setDebugRecommendations(response.debugResponse);
      }

    } catch (error) {
      console.error('Debug execution error:', error);
    } finally {
      setIsDebugging(false);
    }
  };

  const applyDebugFixes = async (tool: ExcelTool | null) => {
    if (!tool || !debugRecommendations) return;
    
    setIsDebugging(true);
    
    try {
      console.log('🔧 Applying debug fixes...');
      
      const response = await apiRequest(`/api/excel-functions/apply-debug-fixes`, {
        method: 'POST',
        body: JSON.stringify({
          functionId: tool.id,
          debugRecommendations: debugRecommendations,
          inputs: testInputs,
          testResults: testResults
        })
      });

      if (response.success) {
        console.log('Debug fixes applied successfully');
        // Clear debug state and refresh the tools list
        setDebugRecommendations('');
        setDebugText('');
        setTestResults(null);
        await queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'excel-functions'] });
        console.log('✅ Tool has been updated with the suggested fixes!');
      }

    } catch (error) {
      console.error('Apply debug fixes error:', error);
      console.error('❌ Failed to apply debug fixes. Please try again.');
    } finally {
      setIsDebugging(false);
    }
  };

  const handleEdit = (tool: ExcelTool) => {
    setEditingTool(tool);
  };

  const handleDelete = async (toolId: string) => {
    setToolToDelete(toolId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (toolToDelete) {
      deleteTool.mutate(toolToDelete);
    }
    setShowDeleteDialog(false);
    setToolToDelete(null);
  };

  const handleTest = (tool: ExcelTool) => {
    setTestingTool(tool);
    setTestResults(null); // Clear previous results when opening test dialog
    
    // Initialize test inputs with sample data
    const initialInputs: Record<string, any> = {};
    tool.inputParameters?.forEach((param: any) => {
      if (param.type === 'text') {
        initialInputs[param.name] = param.sampleText || '';
      }
    });
    setTestInputs(initialInputs);
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
            {tools?.length || 0} tools available
          </div>
          <CreateToolDialog 
            projectId={projectId} 
            editingFunction={editingTool} 
            setEditingFunction={setEditingTool} 
          />
        </div>
      </div>

      <div className="space-y-4">
        {tools?.map((tool) => (
          <Card key={tool.id} className="border-gray-200 hover:shadow-md transition-shadow bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    {tool.toolType === 'AI' ? (
                      <Brain className="h-5 w-5 text-gray-600" />
                    ) : (
                      <Code className="h-5 w-5 text-gray-600" />
                    )}
                    {tool.name}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  {tool.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>Used {tool.usageCount} times</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tool.toolType === 'AI' ? 'AI' : 'Code'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleTest(tool)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleEdit(tool)}
                      className="bg-gray-700 hover:bg-gray-800 text-white"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDelete(tool.id)}
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

        {(!tools || tools.length === 0) && (
          <Card className="p-8 text-center border-gray-200 bg-gray-50">
            <div className="text-gray-500">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">No Tools Available</h3>
              <p className="text-gray-600">Tools will appear here after they are generated during extraction processes.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Test Tool Modal */}
      <Dialog open={!!testingTool} onOpenChange={() => {
        setTestingTool(null);
        setTestResults(null);
        setDebugText('');
        setDebugRecommendations('');
        // Note: testInputs are preserved to maintain user's original inputs
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="test-dialog-description">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-gray-800">extrapl <span className="text-blue-600">•</span> Test</DialogTitle>
            <p id="test-dialog-description" className="sr-only">
              Test dialog for running extraction tools with sample data and viewing results
            </p>
          </DialogHeader>
          
          {testingTool && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tool Name
                    </label>
                    <div className="text-gray-900 font-medium">{testingTool.name}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <div className="text-gray-700 text-sm">{testingTool.description}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Test Inputs</h3>
                <p className="text-sm text-gray-600">The tool will be tested using the following sample inputs:</p>
                
                <div className="space-y-4">
                  {testingTool.inputParameters?.map((param: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium text-gray-900">{param.name}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {param.type}
                        </span>
                      </div>
                      
                      {param.type === 'text' && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Input Value
                          </label>
                          {param.multiline ? (
                            <Textarea
                              value={testInputs[param.name] || ''}
                              onChange={(e) => setTestInputs(prev => ({
                                ...prev,
                                [param.name]: e.target.value
                              }))}
                              placeholder="Enter text input..."
                              className="w-full border-gray-300 rounded-lg"
                              rows={4}
                            />
                          ) : (
                            <Input
                              value={testInputs[param.name] || ''}
                              onChange={(e) => setTestInputs(prev => ({
                                ...prev,
                                [param.name]: e.target.value
                              }))}
                              placeholder="Enter text input..."
                              className="w-full border-gray-300 rounded-lg"
                            />
                          )}
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
                                  {param.sampleData.columns?.map((col: any, colIndex: number) => {
                                    const columnName = typeof col === 'string' ? col : col.name;
                                    return (
                                      <th key={colIndex} className="text-left p-3 font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                                        {param.sampleData.identifierColumn === columnName && (
                                          <span className="text-yellow-600 mr-1">🔑</span>
                                        )}
                                        {columnName}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {param.sampleData.rows?.map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b border-gray-200 last:border-b-0">
                                    {param.sampleData.columns?.map((col: any, colIndex: number) => {
                                      const columnName = typeof col === 'string' ? col : col.name;
                                      return (
                                        <td key={colIndex} className="p-3 text-gray-600 border-r border-gray-200 last:border-r-0">
                                          {row[columnName] || '-'}
                                        </td>
                                      );
                                    })}
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

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
                  <Button 
                    onClick={() => runTest(testingTool)}
                    disabled={isRunningTest}
                    className="bg-gray-700 hover:bg-gray-800 text-white flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {isRunningTest ? 'Running Test...' : 'Run Test'}
                  </Button>
                </div>

                {testResults && Array.isArray(testResults) && testResults.length > 0 ? (
                  <div className="space-y-4">
                    {testingTool?.outputType === 'multiple' ? (
                      // Multiple records - display as table
                      (() => {
                        // Get sample data columns from the first data input parameter
                        const dataParam = testingTool?.inputParameters?.find((p: any) => p.type === 'data' && p.sampleData);
                        const sampleColumns = dataParam?.sampleData?.columns || [];
                        const sampleRows = dataParam?.sampleData?.rows || [];
                        
                        return (
                          <div className="border border-gray-300 rounded overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-300">
                                  <th className="text-left p-3 font-medium text-gray-700">#</th>
                                  {sampleColumns.map((column: any, colIndex: number) => {
                                    const columnName = typeof column === 'string' ? column : column.name;
                                    return (
                                      <th key={colIndex} className="text-left p-3 font-medium text-gray-700 border-l border-gray-200">
                                        {columnName}
                                      </th>
                                    );
                                  })}
                                  <th className="text-left p-3 font-medium text-gray-700 border-l border-gray-200">Extracted Value</th>
                                  <th className="text-left p-3 font-medium text-gray-700 border-l border-gray-200">Status</th>
                                  <th className="text-left p-3 font-medium text-gray-700 border-l border-gray-200">Confidence</th>
                                  <th className="text-left p-3 font-medium text-gray-700 border-l border-gray-200">Reasoning</th>
                                </tr>
                              </thead>
                              <tbody>
                                {testResults.map((result: any, rowIndex: number) => {
                                  const sampleRow = sampleRows[rowIndex] || {};
                                  return (
                                    <tr key={rowIndex} className="border-b border-gray-200 last:border-b-0">
                                      <td className="p-3 text-gray-600 font-medium">{rowIndex + 1}</td>
                                      {sampleColumns.map((column: any, colIndex: number) => {
                                        const columnName = typeof column === 'string' ? column : column.name;
                                        return (
                                          <td key={colIndex} className="p-3 text-gray-600 border-l border-gray-200">
                                            {sampleRow[columnName] || '-'}
                                          </td>
                                        );
                                      })}
                                      <td className="p-3 text-gray-600 border-l border-gray-200">
                                        {result.extractedValue || '-'}
                                      </td>
                                      <td className="p-3 border-l border-gray-200">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          result.validationStatus === 'valid' 
                                            ? 'bg-green-100 text-green-800' 
                                            : result.validationStatus === 'invalid'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {result.validationStatus || 'unknown'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-gray-600 border-l border-gray-200">
                                        {result.confidenceScore ? `${result.confidenceScore}%` : '-'}
                                      </td>
                                      <td className="p-3 text-gray-600 border-l border-gray-200 max-w-md">
                                        <div className="whitespace-pre-wrap break-words">
                                          {result.aiReasoning || '-'}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()
                    ) : (
                      // Single record - display as object card
                      <div className="border border-gray-300 rounded-lg p-4 bg-white">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between py-2 border-b border-gray-100">
                            <span className="font-medium text-gray-700">Extracted Value</span>
                            <span className="text-gray-600 ml-4">{testResults[0]?.extractedValue || '-'}</span>
                          </div>
                          <div className="flex items-start justify-between py-2 border-b border-gray-100">
                            <span className="font-medium text-gray-700">Status</span>
                            <span className="ml-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                testResults[0]?.validationStatus === 'valid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : testResults[0]?.validationStatus === 'invalid'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {testResults[0]?.validationStatus || 'unknown'}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-start justify-between py-2 border-b border-gray-100">
                            <span className="font-medium text-gray-700">Confidence</span>
                            <span className="text-gray-600 ml-4">
                              {testResults[0]?.confidenceScore ? `${testResults[0].confidenceScore}%` : '-'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between py-2">
                            <span className="font-medium text-gray-700">Reasoning</span>
                            <span className="text-gray-600 ml-4 text-right max-w-md">
                              {testResults[0]?.aiReasoning || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Click "Run Test" to execute the tool with sample data and see the results.</p>
                  </div>
                )}

                {/* Debug Section - Only show if we have test results */}
                {testResults && Array.isArray(testResults) && testResults.length > 0 && (
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Debug Tool</h3>
                    <p className="text-sm text-gray-600">
                      Having issues with the results? Describe the problem or what you expected, and AI will help debug the tool.
                    </p>
                    
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Debug Instructions
                      </label>
                      <Textarea
                        value={debugText}
                        onChange={(e) => setDebugText(e.target.value)}
                        placeholder="Describe what's wrong with the results or what you expected to see..."
                        className="min-h-[100px] resize-none"
                        disabled={isDebugging}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => debugTool(testingTool)}
                          disabled={isDebugging || !debugText.trim()}
                          className="bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
                        >
                          <Brain className="h-4 w-4" />
                          {isDebugging ? 'Debugging...' : 'Debug Tool'}
                        </Button>
                        <Button
                          onClick={() => setTestingTool(null)}
                          variant="outline"
                          className="text-gray-600 border-gray-300"
                        >
                          Close
                        </Button>
                      </div>
                    </div>

                    {/* Debug Recommendations Section */}
                    {debugRecommendations && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-900 mb-3">AI Debug Analysis</h4>
                        <div className="bg-white p-3 rounded border text-sm text-gray-700 whitespace-pre-wrap mb-4">
                          {debugRecommendations}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-700">
                            Would you like to apply the AI's suggested improvements to this tool?
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setDebugRecommendations('')}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                            >
                              Dismiss
                            </Button>
                            <Button
                              onClick={() => applyDebugFixes(testingTool)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={isDebugging}
                            >
                              Apply Fixes
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tool? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Tool
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}