import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Database, 
  ChevronRight, 
  ChevronDown,
  Loader2, 
  AlertCircle, 
  Sparkles,
  Files,
  RefreshCw,
  CheckCircle,
  Circle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ExtractWizardModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (documentId: string) => void;
  title: string;
  toolType?: string;
  toolDescription?: string;
  toolOperationType?: string; // Add operation type
  documents: Array<{ id: string; name: string; type: string }>;
  inputData: any[];
  isLoading?: boolean;
  needsDocument?: boolean;
  inputValues?: any;
  knowledgeDocuments?: Array<{ id: string; documentName?: string; displayName?: string; fileName?: string; documentContent?: string; content?: string }>;
  extractedCount?: number;
  totalAvailable?: number;
  columnOrder?: string[]; // Array of column names in the correct order
  isFirstColumn?: boolean; // Flag to indicate if this is the first column
  referenceFieldNames?: Record<string, string>; // Map of field IDs to human-readable names
  validations?: any[]; // Validation records to resolve UUIDs to extracted values
}

export default function ExtractWizardModal({
  open,
  onClose,
  onConfirm,
  title,
  toolType = 'default',
  toolDescription,
  toolOperationType = 'updateMultiple',
  documents,
  inputData,
  isLoading = false,
  needsDocument = true,
  inputValues,
  knowledgeDocuments = [],
  extractedCount = 0,
  totalAvailable = 0,
  columnOrder,
  isFirstColumn = false,
  referenceFieldNames = {},
  validations = []
}: ExtractWizardModalProps) {
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (documents.length === 1) {
      setSelectedDocument(documents[0].id);
    }
  }, [documents]);
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  const handleConfirm = () => {
    if (needsDocument && !selectedDocument) {
      return;
    }
    onConfirm(selectedDocument || '');
  };
  
  // Calculate extraction statistics
  const getExtractionStats = () => {
    const remainingToExtract = Math.max(0, (totalAvailable || inputData.length) - (extractedCount || 0));
    const isAITool = toolType === 'AI' || toolType === 'AI_ONLY' || 
                     (inputValues && Object.values(inputValues).some(v => 
                       typeof v === 'string' && v.length > 100));
    
    const recordsToProcess = isAITool && remainingToExtract > 50 ? 50 : remainingToExtract;
    const startIndex = extractedCount ? extractedCount + 1 : 1;
    const endIndex = extractedCount ? extractedCount + recordsToProcess : recordsToProcess;
    
    return {
      total: totalAvailable || inputData.length,
      extracted: extractedCount || 0,
      remaining: remainingToExtract,
      processing: recordsToProcess,
      startIndex,
      endIndex,
      isAITool,
      isComplete: remainingToExtract === 0
    };
  };
  
  const stats = getExtractionStats();
  
  // Check if we have meaningful data to show
  const hasInputData = inputData && inputData.length > 0 && 
    inputData.some(record => 
      Object.keys(record).some(key => key !== 'identifierId' && key !== '_recordIndex')
    );
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-gray-800">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-white">
            <Sparkles className="h-5 w-5" style={{ color: '#4F63A4' }} />
            Extract: {title.replace('Extract ', '')}
          </DialogTitle>
        </DialogHeader>
        
        {/* Loading overlay during extraction - same style as Info Page */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-lg">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-[#4F63A4]" />
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Extracting data...
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
                {stats.isComplete 
                  ? 'Finalizing extraction...'
                  : stats.isAITool && stats.remaining > 50 
                    ? `Analyzing records ${stats.startIndex}-${stats.endIndex} of ${stats.total} with AI`
                    : `Processing records ${stats.startIndex}-${stats.endIndex} of ${stats.total}`}
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500">
                <div className="w-2 h-2 bg-[#4F63A4] rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-[#4F63A4] rounded-full animate-pulse [animation-delay:150ms]"></div>
                <div className="w-2 h-2 bg-[#4F63A4] rounded-full animate-pulse [animation-delay:300ms]"></div>
              </div>
            </div>
          </div>
        )}
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Description */}
            {toolDescription && (
              <div className="pb-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">{toolDescription}</p>
              </div>
            )}
            
            {/* Collapsible Input Data Preview */}
            {hasInputData && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('data')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {toolOperationType?.startsWith('create') ? 'Data for lookup' : 'Data to be updated'}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {stats.processing} records
                    </Badge>
                    {stats.extracted > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({stats.extracted} already done)
                      </span>
                    )}
                  </div>
                  {expandedSections.has('data') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
                
                {expandedSections.has('data') && (
                  <div className="px-4 pb-4">
                    <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-fixed">
                          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                            <tr>
                              <th className="w-32 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-300">ID</th>
                              {(() => {
                                if (inputData.length === 0) return null;
                                const allKeys = Object.keys(inputData[0]).filter(k => k !== 'identifierId');
                                const orderedKeys = columnOrder 
                                  ? columnOrder.filter(col => allKeys.includes(col))
                                  : allKeys;
                                  
                                return orderedKeys.map(key => (
                                  <th key={key} className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">
                                    {key}
                                  </th>
                                ));
                              })()}
                            </tr>
                          </thead>
                          <tbody>
                            {inputData.slice(0, 3).map((record, index) => (
                              <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="w-32 px-2 py-1.5 text-gray-800 dark:text-gray-200 font-mono">
                                  <div className="truncate" title={record.identifierId || `Row ${index + 1}`}>
                                    {record.identifierId ? record.identifierId.substring(0, 8) + '...' : `Row ${index + 1}`}
                                  </div>
                                </td>
                                {(() => {
                                  const allKeys = Object.keys(record).filter(k => k !== 'identifierId');
                                  const orderedKeys = columnOrder 
                                    ? columnOrder.filter(col => allKeys.includes(col))
                                    : allKeys;
                                    
                                  return orderedKeys.map(key => (
                                    <td key={key} className="px-2 py-1.5 text-gray-800 dark:text-gray-200 min-w-[120px]">
                                      <div className="truncate" title={String(record[key])}>
                                        {record[key] === null || record[key] === undefined ? '-' : String(record[key])}
                                      </div>
                                    </td>
                                  ));
                                })()}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {inputData.length > 3 && (
                        <div className="px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600">
                          ...and {inputData.length - 3} more records
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Collapsible Referenced Input Data */}
            {inputValues && Object.keys(inputValues).length > 0 && Object.entries(inputValues).filter(([key, value]) => {
              // Filter out knowledge documents
              if (key.startsWith('knowledge_document')) return false;
              
              // Filter out user document parameters since they're handled by the document dropdown
              if (Array.isArray(value)) {
                const hasUserDoc = value.some(v => {
                  if (typeof v === 'string') {
                    const lowerV = v.toLowerCase();
                    return lowerV.includes('user') && lowerV.includes('document') ||
                           lowerV === 'user_document';
                  }
                  return false;
                });
                if (hasUserDoc) return false;
              }
              
              if (typeof value === 'string') {
                const lowerValue = value.toLowerCase();
                if (lowerValue.includes('user') && lowerValue.includes('document') ||
                    lowerValue === 'user_document') {
                  return false;
                }
              }
              
              return true;
            }).length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('references')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Referenced input data</span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    >
                      {Object.keys(inputValues).filter(key => !key.startsWith('knowledge_document')).length} field{Object.keys(inputValues).filter(key => !key.startsWith('knowledge_document')).length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {expandedSections.has('references') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
                
                {expandedSections.has('references') && (
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      The following fields are being used as input for this extraction:
                    </p>
                    {Object.entries(inputValues).filter(([key, value]) => {
                      // Filter out knowledge documents
                      if (key.startsWith('knowledge_document')) return false;
                      
                      // Filter out user document parameters since they're handled by the document dropdown
                      if (Array.isArray(value)) {
                        const hasUserDoc = value.some(v => {
                          if (typeof v === 'string') {
                            const lowerV = v.toLowerCase();
                            return lowerV.includes('user') && lowerV.includes('document') ||
                                   lowerV === 'user_document';
                          }
                          return false;
                        });
                        if (hasUserDoc) return false;
                      }
                      
                      if (typeof value === 'string') {
                        const lowerValue = value.toLowerCase();
                        if (lowerValue.includes('user') && lowerValue.includes('document') ||
                            lowerValue === 'user_document') {
                          return false;
                        }
                      }
                      
                      return true;
                    }).map(([key, value], index) => {
                      // Get readable name from referenceFieldNames or parse the key
                      const displayName = referenceFieldNames[key] || key.split('.').pop()?.replace(/_/g, ' ') || key;
                      const isArray = Array.isArray(value);
                      const valueCount = isArray ? value.length : 1;
                      
                      return (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Database className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                                {displayName}
                              </span>
                            </div>
                            {isArray && (
                              <Badge variant="outline" className="text-xs">
                                {valueCount} item{valueCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {(() => {
                              // Map UUIDs to actual values for display
                              let displayValue = value;
                              
                              // Map column UUIDs to their extracted values from validation records
                              
                              if (validations && validations.length > 0) {
                                if (isArray && value.every((v: any) => typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i))) {
                                  // This is an array of column UUIDs - for each unique valueId, show all extracted values from that column
                                  const allExtractedValues = [];
                                  
                                  for (const uuid of value) {
                                    const columnValidations = validations.filter(v => v.valueId === uuid && v.extractedValue);
                                    if (columnValidations.length > 0) {
                                      allExtractedValues.push(...columnValidations.map(v => v.extractedValue));
                                    } else {
                                      allExtractedValues.push(uuid.substring(0, 8) + '...');
                                    }
                                  }
                                  
                                  displayValue = allExtractedValues;
                                } else if (typeof value === 'string' && value.match(/^[a-f0-9-]{36}$/i)) {
                                  // Single column UUID - show all extracted values from that column  
                                  const columnValidations = validations.filter(v => v.valueId === value && v.extractedValue);
                                  
                                  if (columnValidations.length > 0) {
                                    displayValue = columnValidations.map(v => v.extractedValue);
                                  } else {
                                    displayValue = [value.substring(0, 8) + '...'];
                                  }
                                }
                              }
                              
                              if (isArray) {
                                return (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {displayValue.slice(0, 3).map((item: any, idx: number) => (
                                      <div key={idx} className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                                        {typeof item === 'string' ? item : JSON.stringify(item)}
                                      </div>
                                    ))}
                                    {displayValue.length > 3 && (
                                      <div className="text-xs text-gray-500 italic px-2">
                                        ... and {displayValue.length - 3} more
                                      </div>
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 max-h-16 overflow-y-auto">
                                    {String(displayValue).substring(0, 200) + (String(displayValue).length > 200 ? '...' : '')}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Collapsible Reference Documents */}
            {knowledgeDocuments && knowledgeDocuments.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('knowledge')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Files className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reference documents</span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-gray-50 dark:bg-gray-700"
                    >
                      {knowledgeDocuments.length} document{knowledgeDocuments.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {expandedSections.has('knowledge') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
                
                {expandedSections.has('knowledge') && (
                  <div className="px-4 pb-4 space-y-2">
                    {knowledgeDocuments.map((doc, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {doc.documentName || doc.displayName || doc.fileName || 'Reference Document'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto">
                          {(() => {
                            let content = doc.documentContent || doc.content;
                            if (content && content !== '@reference_document') {
                              return content.length > 200 
                                ? content.substring(0, 200) + '...'
                                : content;
                            }
                            return (
                              <span className="italic">
                                Standard field mappings reference document
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Document Selection */}
            {needsDocument && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select document for extraction
                </Label>
                <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose your document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span>{doc.name}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {doc.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedDocument && documents.length === 0 && (
                  <p className="text-xs text-red-500">No documents available in session</p>
                )}
              </div>
            )}
            
            {/* Warning for no data - only show for non-first columns */}
            {!hasInputData && inputData.length === 0 && !isFirstColumn && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription>
                  <p className="font-semibold text-gray-900 mb-1">No data from previous steps</p>
                  <p className="text-sm text-gray-700">
                    Please complete previous extraction steps first.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || (needsDocument && !selectedDocument)}
            style={{ backgroundColor: '#4F63A4' }}
            className="text-white hover:opacity-90"
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