import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, FileText, Table, Database, FileSearch, ChevronRight, Loader2, AlertCircle, Wand2 } from "lucide-react";
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
  knowledgeDocuments?: Array<{ id: string; documentName: string }>;
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
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5" style={{ color: '#4F63A4' }} />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Show Tool Configuration if available */}
          {hasInputConfig ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" style={{ color: '#4F63A4' }} />
                Tool Configuration
              </h3>
              
              <div className="space-y-3">
                {inputConfig.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700">
                      {item.key}:
                    </Label>
                    {item.type === 'prompt' ? (
                      <div className="bg-white rounded border border-gray-200 p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                          {item.value.substring(0, 200)}
                          {item.value.length > 200 && '...'}
                        </p>
                      </div>
                    ) : item.type === 'references' || item.type === 'reference' ? (
                      <div className="flex flex-wrap gap-2">
                        {item.value.split(', ').map((ref: string, i: number) => (
                          <Badge key={i} variant="secondary" style={{ backgroundColor: 'rgba(79, 99, 164, 0.1)', color: '#4F63A4' }}>
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    ) : item.type === 'array' ? (
                      <div className="flex flex-wrap gap-2">
                        {item.value.split(', ').map((val: string, i: number) => (
                          <Badge key={i} variant="outline">
                            {val}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded border border-gray-200 px-3 py-1.5">
                        <p className="text-sm text-gray-800">{item.value}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          
          {/* Show value description if available - Always show this above Referenced Data */}
          {toolDescription && (
            <Alert className="border-slate-200 bg-slate-50">
              <Info className="h-4 w-4" style={{ color: '#4F63A4' }} />
              <AlertDescription>
                <div>
                  <p className="font-medium text-gray-900 mb-1">What this does:</p>
                  <p className="text-gray-700">{toolDescription}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Input Data Preview - Show when there's input data */}
          {inputData && inputData.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                Referenced Data Preview
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {inputData.length} record{inputData.length !== 1 ? 's' : ''} available from previous steps
              </p>
              
              {/* Show sample records in table format */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Sample records (first 3):</p>
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700">ID</th>
                          {inputData.length > 0 && Object.keys(inputData[0]).filter(k => k !== 'identifierId').map(key => (
                            <th key={key} className="px-2 py-1.5 text-left font-medium text-gray-700">
                              {key === 'ID' ? 'Column Name' : key === 'Worksheet Name' ? 'Worksheet' : key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {inputData.slice(0, 3).map((record, index) => (
                          <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50/50">
                            <td className="px-2 py-1.5 text-gray-600 font-mono">
                              {record.identifierId ? record.identifierId.substring(0, 8) + '...' : `Row ${index + 1}`}
                            </td>
                            {Object.entries(record).filter(([k]) => k !== 'identifierId').map(([key, value]) => (
                              <td key={key} className="px-2 py-1.5 text-gray-700">
                                <div className="max-w-[200px] truncate" title={String(value)}>
                                  {value === null || value === undefined ? '-' : String(value)}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {inputData.length > 3 && (
                    <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 border-t">
                      ...and {inputData.length - 3} more records
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : inputData && inputData.length === 0 ? (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                <p className="font-medium mb-1">No data available from referenced steps</p>
                <p className="text-xs text-gray-600">
                  The referenced columns may not have any verified data yet. Please extract and verify data in the "Column Name Mapping" step first.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
          
          {/* Reference Document Preview - Show when knowledge documents are available */}
          {knowledgeDocuments && knowledgeDocuments.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: '#4F63A4' }} />
                Reference Document
              </h3>
              {knowledgeDocuments.map((doc, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" style={{ backgroundColor: 'rgba(79, 99, 164, 0.1)', color: '#4F63A4' }}>
                      {doc.documentName}
                    </Badge>
                  </div>
                  {/* Show document content */}
                  <div className="mt-2 bg-white rounded border border-slate-200 p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">{doc.documentName}:</p>
                    <div className="text-xs text-gray-700 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {(() => {
                        // Try to find the document content in different possible locations
                        let documentContent = null;
                        
                        // Check if it's directly in inputValues
                        if (inputValues && inputValues['Reference Document']) {
                          if (typeof inputValues['Reference Document'] === 'string') {
                            documentContent = inputValues['Reference Document'];
                          } else if (Array.isArray(inputValues['Reference Document']) && inputValues['Reference Document'].length > 0) {
                            const firstDoc = inputValues['Reference Document'][0];
                            if (typeof firstDoc === 'object' && firstDoc.documentContent) {
                              documentContent = firstDoc.documentContent;
                            } else if (typeof firstDoc === 'object' && firstDoc.content) {
                              documentContent = firstDoc.content;
                            }
                          }
                        }
                        
                        // Check if we have a document property
                        if (!documentContent && inputValues && inputValues['document']) {
                          documentContent = inputValues['document'];
                        }
                        
                        // Check in input config for any document-like content
                        if (!documentContent && inputValues) {
                          const docKeys = Object.keys(inputValues).filter(k => 
                            k.toLowerCase().includes('doc') || 
                            k.toLowerCase().includes('content') ||
                            k.toLowerCase().includes('text')
                          );
                          for (const key of docKeys) {
                            if (typeof inputValues[key] === 'string' && inputValues[key].length > 50) {
                              documentContent = inputValues[key];
                              break;
                            }
                          }
                        }
                        
                        if (documentContent) {
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
          )}
          
          
          {/* Document Selection - Only show if needed */}
          {needsDocument && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Document</Label>
                <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a document to process" />
                  </SelectTrigger>
                  <SelectContent align="start" side="bottom" sideOffset={5} alignOffset={-5}>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span>{doc.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {doc.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {documents.length === 0 && (
                  <p className="text-sm text-gray-500">No documents available. Please upload documents first.</p>
                )}
              </div>
            </>
          )}
          
          {/* Info message */}
          <Alert className="border-gray-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {inputData && inputData.length > 0 ? (
                <>
                  The extraction will process <strong>{inputData.length} records</strong> from your input data.
                  Each record will be processed individually to ensure accurate results.
                </>
              ) : (
                <>
                  Select a document to begin the extraction process. The function will analyze the document
                  and extract the requested information automatically.
                </>
              )}
            </AlertDescription>
          </Alert>
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