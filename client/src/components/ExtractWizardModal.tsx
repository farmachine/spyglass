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
  columnOrder
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5" style={{ color: '#4F63A4' }} />
            Extract: {title.replace('Extract ', '')}
          </DialogTitle>
        </DialogHeader>
        
        {/* Loading State */}
        {isLoading && (
          <div className="px-6 py-4 bg-blue-50 border-b">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#4F63A4' }} />
              <span className="text-sm font-medium text-gray-900">Processing extraction...</span>
            </div>
            <Progress 
              value={75} 
              className="h-2 bg-slate-200" 
              style={{"--indicator-color": "#4F63A4"} as any}
            />
            <p className="text-xs text-gray-600 mt-2">
              {stats.isComplete 
                ? 'Finalizing extraction...'
                : stats.isAITool && stats.remaining > 50 
                  ? `Analyzing records ${stats.startIndex}-${stats.endIndex} of ${stats.total} with AI`
                  : `Processing records ${stats.startIndex}-${stats.endIndex} of ${stats.total}`}
            </p>
          </div>
        )}
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Description */}
            {toolDescription && (
              <div className="pb-2">
                <p className="text-sm text-gray-700">{toolDescription}</p>
              </div>
            )}
            
            {/* Collapsible Input Data Preview */}
            {hasInputData && (
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection('data')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {toolOperationType?.startsWith('create') ? 'Data for lookup' : 'Data to be updated'}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-blue-50 text-blue-700"
                    >
                      {stats.processing} records
                    </Badge>
                    {stats.extracted > 0 && (
                      <span className="text-xs text-gray-500">
                        ({stats.extracted} already done)
                      </span>
                    )}
                  </div>
                  {expandedSections.has('data') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                
                {expandedSections.has('data') && (
                  <div className="px-4 pb-4">
                    <div className="bg-white rounded border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-fixed">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="w-32 px-2 py-1.5 text-left font-medium text-gray-700">ID</th>
                              {(() => {
                                if (inputData.length === 0) return null;
                                const allKeys = Object.keys(inputData[0]).filter(k => k !== 'identifierId');
                                const orderedKeys = columnOrder 
                                  ? columnOrder.filter(col => allKeys.includes(col))
                                  : allKeys;
                                  
                                return orderedKeys.map(key => (
                                  <th key={key} className="px-2 py-1.5 text-left font-medium text-gray-700 min-w-[120px]">
                                    {key}
                                  </th>
                                ));
                              })()}
                            </tr>
                          </thead>
                          <tbody>
                            {inputData.slice(0, 3).map((record, index) => (
                              <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50/50">
                                <td className="w-32 px-2 py-1.5 text-gray-600 font-mono">
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
                                    <td key={key} className="px-2 py-1.5 text-gray-700 min-w-[120px]">
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
                        <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 border-t">
                          ...and {inputData.length - 3} more records
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Collapsible Reference Documents */}
            {knowledgeDocuments && knowledgeDocuments.length > 0 && (
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection('knowledge')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Files className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Reference documents</span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-gray-50"
                    >
                      {knowledgeDocuments.length} document{knowledgeDocuments.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {expandedSections.has('knowledge') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                
                {expandedSections.has('knowledge') && (
                  <div className="px-4 pb-4 space-y-2">
                    {knowledgeDocuments.map((doc, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">
                            {doc.documentName || doc.displayName || doc.fileName || 'Reference Document'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 max-h-20 overflow-y-auto">
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
                <Label className="text-sm font-medium text-gray-700">
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
            
            {/* Warning for no data */}
            {!hasInputData && inputData.length === 0 && (
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
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