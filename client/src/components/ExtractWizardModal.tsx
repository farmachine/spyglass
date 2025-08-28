import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Info, FileText, Table, Database, FileSearch, ChevronRight, Loader2, AlertCircle, Wand2, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ExtractWizardModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (documentId: string) => void;
  title: string;
  toolType?: string;
  toolDescription?: string;
  documents: Array<{ id: string; name: string; type: string }>;
  inputData: any[];
  isLoading?: boolean;
  needsDocument?: boolean;
  inputValues?: any;
  knowledgeDocuments?: Array<{ id: string; documentName?: string; displayName?: string; fileName?: string; documentContent?: string; content?: string }>;
  extractedCount?: number;
  totalAvailable?: number;
  columnOrder?: string[]; // Array of column names in the correct order
}

// Function type descriptions for user guidance
const functionDescriptions: Record<string, {
  icon: any;
  briefDescription: string;
  detailedDescription: string;
  whatHappens: string[];
  requirements?: string[];
}> = {
  'worksheet_name': {
    icon: Table,
    briefDescription: 'Extract worksheet names from Excel workbook',
    detailedDescription: 'This function will analyze your Excel workbook and extract all worksheet names (tabs) from the file.',
    whatHappens: [
      'Opens the selected Excel file',
      'Reads the workbook structure',
      'Extracts all worksheet names',
      'Returns a list of worksheet names for each input ID'
    ],
    requirements: ['Excel file (.xlsx or .xls)']
  },
  'column_names': {
    icon: FileSearch,
    briefDescription: 'Extract column headers from worksheets',
    detailedDescription: 'This function will extract column headers from specific worksheets in your Excel file.',
    whatHappens: [
      'Opens the selected Excel file',
      'Navigates to each specified worksheet',
      'Reads the header row',
      'Extracts all column names',
      'Returns column names for further processing'
    ],
    requirements: ['Excel file', 'Worksheet names from previous step']
  },
  'data_extraction': {
    icon: Database,
    briefDescription: 'Extract data from specified columns',
    detailedDescription: 'This function will extract actual data values from specific columns in your worksheets.',
    whatHappens: [
      'Opens the Excel file',
      'Locates specified columns',
      'Extracts all data from those columns',
      'Processes and formats the data',
      'Returns structured data for analysis'
    ],
    requirements: ['Excel file', 'Column names', 'Worksheet references']
  },
  'standard_mapping': {
    icon: FileText,
    briefDescription: 'Map to standard field names',
    detailedDescription: 'This function uses AI to map your extracted field names to standardized field names based on a knowledge document.',
    whatHappens: [
      'Analyzes extracted field names',
      'References the knowledge document',
      'Uses AI to determine best matches',
      'Maps each field to standard equivalents',
      'Returns standardized field mappings'
    ],
    requirements: ['Field names', 'Knowledge document']
  },
  'default': {
    icon: FileText,
    briefDescription: 'Process and extract data',
    detailedDescription: 'This function will process your document and extract the requested information.',
    whatHappens: [
      'Opens the selected document',
      'Analyzes the content',
      'Extracts relevant information',
      'Returns processed results'
    ]
  }
};

export default function ExtractWizardModal({
  open,
  onClose,
  onConfirm,
  title,
  toolType = 'default',
  toolDescription,
  documents,
  inputData,
  isLoading = false,
  needsDocument = true,
  inputValues,
  knowledgeDocuments = [],
  extractedCount = 0,
  totalAvailable = 0,
  columnOrder
}: ExtractWizardModalProps) {
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  
  // Parse input values to show configuration
  const getInputConfig = () => {
    if (!inputValues) return [];
    
    const config: Array<{ key: string; value: any; type: string }> = [];
    
    Object.entries(inputValues).forEach(([key, value]) => {
      // Skip internal keys starting with numbers
      if (key.match(/^\d+\./)) {
        // Extract meaningful part from keys like "0.hb25dnz5dmd"
        
        if (Array.isArray(value)) {
          // Check if it contains @ references
          const hasReferences = value.some(v => typeof v === 'string' && v.startsWith('@'));
          if (hasReferences) {
            config.push({
              key: 'Field References',
              value: value.filter(v => typeof v === 'string' && v.startsWith('@')).join(', '),
              type: 'references'
            });
          } else if (value.length > 0) {
            // Check if these are knowledge document IDs and resolve them
            const resolvedValues = value.map((v: string) => {
              // If it's a UUID and we have knowledge documents, try to resolve it
              if (typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i) && knowledgeDocuments.length > 0) {
                const doc = knowledgeDocuments.find(d => d.id === v);
                return doc ? doc.documentName : v;
              }
              return v;
            });
            
            config.push({
              key: 'Source Fields',
              value: resolvedValues.join(', '),
              type: 'array'
            });
          }
        } else if (typeof value === 'string') {
          // Check for prompts or text content
          if (value.length > 100) {
            config.push({
              key: 'Extraction Instructions',
              value: value,
              type: 'prompt'
            });
          } else if (value.startsWith('@')) {
            config.push({
              key: 'Field Reference',
              value: value,
              type: 'reference'
            });
          } else {
            config.push({
              key: key.split('.')[1] || key,
              value: value,
              type: 'text'
            });
          }
        }
      }
    });
    
    return config;
  };
  
  const inputConfig = getInputConfig();
  const hasInputConfig = inputConfig.length > 0;
  
  // Check if this is an AI tool - AI tools typically have prompts/instructions
  const isAITool = inputConfig.some(item => item.type === 'prompt' || item.key === 'Extraction Instructions');
  
  // Determine the function type from the title or tool type
  const getFunctionType = () => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('worksheet')) return 'worksheet_name';
    if (lowerTitle.includes('column')) return 'column_names';
    if (lowerTitle.includes('standard') || lowerTitle.includes('mapping')) return 'standard_mapping';
    if (lowerTitle.includes('data')) return 'data_extraction';
    return 'default';
  };
  
  const functionType = getFunctionType();
  const functionInfo = functionDescriptions[functionType];
  const Icon = functionInfo.icon;
  
  useEffect(() => {
    if (documents.length === 1) {
      setSelectedDocument(documents[0].id);
    }
  }, [documents]);
  
  const handleConfirm = () => {
    if (needsDocument && !selectedDocument) {
      return;
    }
    onConfirm(selectedDocument || '');
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5" style={{ color: '#4F63A4' }} />
            Extract: {title.replace('Extract ', '')}
          </DialogTitle>
        </DialogHeader>
        
        {/* Loading Progress Bar */}
        {isLoading && (
          <div className="px-6 py-4 bg-blue-50 border-b">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#4F63A4' }} />
              <span className="text-sm font-medium text-gray-900">Processing extraction...</span>
            </div>
            <Progress value={75} className="h-2" />
            <p className="text-xs text-gray-600 mt-2">
              {(() => {
                const remainingRecords = inputData.length;
                const startIndex = extractedCount + 1;
                const endIndex = Math.min(extractedCount + (isAITool ? Math.min(remainingRecords, 50) : remainingRecords), totalAvailable || extractedCount + remainingRecords);
                
                if (extractedCount > 0) {
                  return isAITool && remainingRecords > 50 
                    ? `Analyzing records ${startIndex}-${extractedCount + 50} of ${totalAvailable} with AI for optimal performance`
                    : `Processing records ${startIndex}-${endIndex} of ${totalAvailable}`;
                } else {
                  return isAITool && inputData.length > 50 
                    ? `Analyzing first 50 records with AI for optimal performance`
                    : `Processing ${inputData.length} records`;
                }
              })()}
            </p>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 pt-6">
          {/* Extraction Description - Stand alone without header */}
          {toolDescription && (
            <p className="font-medium text-gray-900 px-1">{toolDescription}</p>
          )}
          
          {/* Your Reference Data Section - Show only when there's actual input data with meaningful content */}
          {inputData && inputData.length > 0 && inputData.some(record => 
            Object.keys(record).some(key => key !== 'identifierId' && key !== '_recordIndex')
          ) && (
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Database className="h-4 w-4" style={{ color: '#4F63A4' }} />
                Your Reference Data
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {(() => {
                  const remainingRecords = inputData.length;
                  const startIndex = extractedCount + 1;
                  const endIndex = Math.min(extractedCount + (isAITool ? Math.min(remainingRecords, 50) : remainingRecords), totalAvailable || extractedCount + remainingRecords);
                  
                  if (extractedCount > 0) {
                    const recordsToProcess = isAITool && remainingRecords > 50 ? 50 : remainingRecords;
                    return (
                      <>
                        <strong>Records {startIndex}-{extractedCount + recordsToProcess} of {totalAvailable}</strong> ready for extraction
                        {extractedCount > 0 && (
                          <> <span className="text-green-600">({extractedCount} already extracted)</span></>
                        )}
                      </>
                    );
                  } else {
                    return (
                      <>
                        <strong>{isAITool && inputData.length > 50 ? `50 records (limited from ${inputData.length} for performance)` : `${inputData.length} records`}</strong> available from previous steps
                      </>
                    );
                  }
                })()}
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700">ID</th>
                          {(() => {
                            if (inputData.length === 0) return null;
                            
                            // Use provided column order if available, otherwise fall back to Object.keys
                            const allKeys = Object.keys(inputData[0]).filter(k => k !== 'identifierId');
                            const orderedKeys = columnOrder 
                              ? columnOrder.filter(col => allKeys.includes(col)) // Only include columns that exist in data
                              : allKeys;
                              
                            return orderedKeys.map(key => (
                              <th key={key} className="px-2 py-1.5 text-left font-medium text-gray-700">
                                {key}
                              </th>
                            ));
                          })()}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const dataToShow = isAITool && inputData.length > 50 ? inputData.slice(0, 50) : inputData;
                          return dataToShow.slice(0, 3).map((record, index) => (
                            <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50/50">
                              <td className="px-2 py-1.5 text-gray-600 font-mono">
                                {record.identifierId ? record.identifierId.substring(0, 8) + '...' : `Row ${index + 1}`}
                              </td>
                              {(() => {
                                // Use the same column ordering for data rows
                                const allKeys = Object.keys(record).filter(k => k !== 'identifierId');
                                const orderedKeys = columnOrder 
                                  ? columnOrder.filter(col => allKeys.includes(col)) // Only include columns that exist in data
                                  : allKeys;
                                  
                                return orderedKeys.map(key => {
                                  const value = record[key];
                                  return (
                                    <td key={key} className="px-2 py-1.5 text-gray-700">
                                      <div className="max-w-[200px] truncate" title={String(value)}>
                                        {value === null || value === undefined ? '-' : String(value)}
                                      </div>
                                    </td>
                                  );
                                });
                              })()}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const dataToShow = isAITool && inputData.length > 50 ? inputData.slice(0, 50) : inputData;
                    const remainingCount = dataToShow.length - 3;
                    return remainingCount > 0 && (
                      <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 border-t">
                        ...and {remainingCount} more records
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          
          {/* No Data Warning */}
          {inputData && inputData.length === 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                <p className="font-semibold text-gray-900 mb-1">No data from previous steps</p>
                <p className="text-sm text-gray-700">
                  The previous extraction steps haven't been completed yet. Please run and verify those extractions first to provide data for this step.
                </p>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Your Organization's Reference Documents Section */}
          {knowledgeDocuments && knowledgeDocuments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: '#4F63A4' }} />
                Your Organization's Reference Documents
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                These have been set as reference knowledge for this extraction
              </p>
              
              <div className="bg-slate-50 rounded-lg p-4">
                {knowledgeDocuments.map((doc, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" style={{ backgroundColor: 'rgba(79, 99, 164, 0.1)', color: '#4F63A4' }}>
                        {doc.documentName || doc.displayName || doc.fileName || 'Reference Document'}
                      </Badge>
                    </div>
                    
                    <div className="mt-2 bg-white rounded border border-slate-200 p-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">{doc.documentName || doc.displayName || doc.fileName || 'Reference Document'}:</p>
                      <div className="text-xs text-gray-700 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {(() => {
                          let documentContent = doc.documentContent || doc.content;
                          
                          if (documentContent && documentContent === '@reference_document') {
                            documentContent = null;
                          }
                          
                          if (!documentContent && inputValues) {
                            if (inputValues['Reference Document']) {
                              if (typeof inputValues['Reference Document'] === 'string' && inputValues['Reference Document'] !== '@reference_document') {
                                documentContent = inputValues['Reference Document'];
                              } else if (Array.isArray(inputValues['Reference Document']) && inputValues['Reference Document'].length > 0) {
                                const firstDoc = inputValues['Reference Document'][0];
                                if (typeof firstDoc === 'object' && firstDoc.documentContent && firstDoc.documentContent !== '@reference_document') {
                                  documentContent = firstDoc.documentContent;
                                } else if (typeof firstDoc === 'object' && firstDoc.content && firstDoc.content !== '@reference_document') {
                                  documentContent = firstDoc.content;
                                }
                              }
                            }
                            
                            if (!documentContent && inputValues['document'] && inputValues['document'] !== '@reference_document') {
                              documentContent = inputValues['document'];
                            }
                            
                            if (!documentContent) {
                              const docKeys = Object.keys(inputValues).filter(k => 
                                k.toLowerCase().includes('doc') || 
                                k.toLowerCase().includes('content') ||
                                k.toLowerCase().includes('text')
                              );
                              for (const key of docKeys) {
                                if (typeof inputValues[key] === 'string' && inputValues[key].length > 50 && inputValues[key] !== '@reference_document') {
                                  documentContent = inputValues[key];
                                  break;
                                }
                              }
                            }
                          }
                          
                          if (documentContent && documentContent !== '@reference_document') {
                            return (
                              <>
                                {documentContent.substring(0, 500)}
                                {documentContent.length > 500 && '...'}
                              </>
                            );
                          } else {
                            return (
                              <span className="text-gray-500 italic">
                                This knowledge document contains the standard field mappings that will be used to map your column names to their standard equivalents.
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* User Input Documents Section - Only show if needed */}
          {needsDocument && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select source content for extraction
              </p>
              <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Choose your document..." />
                </SelectTrigger>
                <SelectContent className="w-full" position="popper" sideOffset={4}>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {documents.length === 0 && (
                <Alert className="mt-3 border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm">
                    <strong>No documents uploaded yet</strong> - Please upload your Excel or other documents first to begin extraction.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={(needsDocument && !selectedDocument) || isLoading}
            className="min-w-[140px]"
            style={{ backgroundColor: '#4F63A4' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                Run Extraction
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}