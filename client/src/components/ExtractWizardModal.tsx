import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  knowledgeDocuments = []
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
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-4">
          {/* Extraction Purpose Section */}
          {toolDescription && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#4F63A4' }} />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">What this extraction will do</h3>
                  <p className="text-sm text-gray-700">{toolDescription}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Your Data Section - Show when there's input data */}
          {inputData && inputData.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Database className="h-4 w-4" style={{ color: '#4F63A4' }} />
                  Your Data Ready for Processing
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  We'll use the <strong>{inputData.length} records</strong> you've prepared to extract the values you need
                </p>
              </div>
              
              <div className="p-4 bg-white">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preview of your data</p>
                <div className="bg-gray-50 rounded border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-white border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Record ID</th>
                          {inputData.length > 0 && Object.keys(inputData[0]).filter(k => k !== 'identifierId').map(key => (
                            <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">
                              {key === 'ID' ? 'Your Column' : key === 'Column Name' ? 'Your Column' : key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {inputData.slice(0, 3).map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                              {record.identifierId ? record.identifierId.substring(0, 8) + '...' : `${index + 1}`}
                            </td>
                            {Object.entries(record).filter(([k]) => k !== 'identifierId').map(([key, value]) => (
                              <td key={key} className="px-3 py-2 text-gray-700">
                                <div className="max-w-[250px] truncate" title={String(value)}>
                                  {value === null || value === undefined ? 
                                    <span className="text-gray-400 italic">empty</span> : 
                                    String(value)
                                  }
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {inputData.length > 3 && (
                    <div className="px-3 py-2 bg-gray-100 text-xs text-gray-600 text-center">
                      <strong>{inputData.length - 3} more records</strong> ready to process
                    </div>
                  )}
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
          
          {/* Your Knowledge Documents Section */}
          {knowledgeDocuments && knowledgeDocuments.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4" style={{ color: '#4F63A4' }} />
                  Your Reference Documents
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  These documents contain the mapping rules and standards we'll use
                </p>
              </div>
              
              <div className="p-4 bg-white">
                {knowledgeDocuments.map((doc, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        {doc.documentName || doc.displayName || doc.fileName || 'Mapping Document'}
                      </Badge>
                      <span className="text-xs text-gray-500">will be used for mapping</span>
                    </div>
                    
                    <div className="mt-2 bg-gray-50 rounded border border-gray-200 p-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Document Preview</p>
                      <div className="text-xs text-gray-700 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap bg-white p-2 rounded border border-gray-200">
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
                                {documentContent.substring(0, 400)}
                                {documentContent.length > 400 && (
                                  <span className="text-gray-400 italic">... (document continues)</span>
                                )}
                              </>
                            );
                          } else {
                            return (
                              <span className="text-gray-500 italic">
                                This document contains your standard field mappings. The extraction will use these mappings to convert your column names to standardized equivalents.
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
          
          {/* Document Selection */}
          {needsDocument && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <Label className="text-sm font-semibold text-gray-900 mb-2 block">
                Select Your Source Document
              </Label>
              <p className="text-xs text-gray-600 mb-3">
                Choose the document that contains the data you want to extract from
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
                        <Badge variant="outline" className="ml-auto text-xs">
                          {doc.type}
                        </Badge>
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
              {selectedDocument && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Document selected and ready</span>
                </div>
              )}
            </div>
          )}
          
          {/* What Happens Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" style={{ color: '#4F63A4' }} />
              What happens when you run this extraction
            </h3>
            <div className="space-y-1.5 text-sm text-gray-700">
              {inputData && inputData.length > 0 ? (
                <>
                  <p>• We'll process all <strong>{inputData.length} records</strong> from your data</p>
                  {knowledgeDocuments && knowledgeDocuments.length > 0 && (
                    <p>• Your reference document will guide the mapping process</p>
                  )}
                  <p>• Each value will be carefully extracted and validated</p>
                  <p>• You'll see the results immediately in the table</p>
                  <p>• You can review and adjust any values if needed</p>
                </>
              ) : (
                <>
                  <p>• The selected document will be analyzed</p>
                  <p>• Data will be extracted based on your configuration</p>
                  <p>• Results will appear in the table for review</p>
                  <p>• You can verify and edit extracted values</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t bg-gray-50 px-6 py-4">
          <div className="text-sm text-gray-600">
            {needsDocument && !selectedDocument ? (
              <span className="text-orange-600 font-medium">Please select a document to continue</span>
            ) : inputData && inputData.length > 0 ? (
              <span className="text-green-700 font-medium">Ready to process {inputData.length} records</span>
            ) : (
              <span>Ready to extract</span>
            )}
          </div>
          
          <div className="flex gap-3">
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
              className="min-w-[160px]"
              style={{ backgroundColor: '#4F63A4' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting Data...
                </>
              ) : (
                <>
                  Start Extraction
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}