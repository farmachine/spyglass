import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wand2, FileText, Database, AlertCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowValueExtractModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (documentId: string) => void;
  valueName: string;
  stepName: string;
  toolId?: string;
  inputValues?: Record<string, any>;
  documents: Array<{ id: string; name: string; type: string }>;
  inputData: any[];
  isLoading?: boolean;
  needsDocument?: boolean;
}

export default function WorkflowValueExtractModal({
  open,
  onClose,
  onConfirm,
  valueName,
  stepName,
  toolId,
  inputValues,
  documents,
  inputData,
  isLoading = false,
  needsDocument = true
}: WorkflowValueExtractModalProps) {
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  
  useEffect(() => {
    // Auto-select if only one document
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
  
  // Parse input values to show configuration
  const getInputConfig = () => {
    if (!inputValues) return [];
    
    const config: Array<{ key: string; value: any; type: string }> = [];
    
    Object.entries(inputValues).forEach(([key, value]) => {
      // Skip internal keys starting with numbers
      if (key.match(/^\d+\./)) {
        // Extract meaningful part from keys like "0.hb25dnz5dmd"
        const displayKey = key.split('.')[1] || key;
        
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
            config.push({
              key: 'Source Fields',
              value: value.join(', '),
              type: 'array'
            });
          }
        } else if (typeof value === 'string') {
          // Check for prompts or text content
          if (value.length > 100) {
            config.push({
              key: 'Extraction Prompt',
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
              key: displayKey,
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
  const hasInputData = inputData && inputData.length > 0;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5 text-blue-600" />
            Extract: {valueName}
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            From step: {stepName}
          </p>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4">
            {/* Tool Configuration Display */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Extraction Configuration
              </h3>
              
              {inputConfig.length > 0 ? (
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
                            <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-800">
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
              ) : (
                <p className="text-sm text-gray-600">
                  No specific configuration found. This will use default extraction.
                </p>
              )}
            </div>
            
            {/* Input Data Preview */}
            {hasInputData && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  Input Data Available
                </h3>
                <p className="text-sm text-gray-600">
                  {inputData.length} record{inputData.length !== 1 ? 's' : ''} from previous steps
                </p>
                {inputData.length > 0 && inputData[0] && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Sample fields:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(inputData[0]).slice(0, 5).map(key => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}
                        </Badge>
                      ))}
                      {Object.keys(inputData[0]).length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{Object.keys(inputData[0]).length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Document Selection */}
            {needsDocument ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Document</Label>
                <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a document to process" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      No documents available. Please upload documents first.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert className="border-green-200 bg-green-50">
                <Database className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  This extraction uses data from previous steps. No document selection needed.
                </AlertDescription>
              </Alert>
            )}
            
            <Separator />
            
            {/* Extraction Process Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-900 font-medium mb-1">What will happen:</p>
              <ol className="text-sm text-amber-800 space-y-1 ml-4">
                <li>1. System will process the configured extraction</li>
                {needsDocument && <li>2. Document will be analyzed using the tool configuration</li>}
                {hasInputData && <li>{needsDocument ? '3' : '2'}. Input data will be used as context</li>}
                <li>{needsDocument ? (hasInputData ? '4' : '3') : (hasInputData ? '3' : '2')}. Extracted values will appear in the session view</li>
              </ol>
            </div>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || (needsDocument && !selectedDocument)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⊙</span>
                Extracting...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Start Extraction
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}