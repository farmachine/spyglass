import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, FileText, Table, Database, FileSearch, ChevronRight, Loader2 } from "lucide-react";
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
  isLoading = false
}: ExtractWizardModalProps) {
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  
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
    if (selectedDocument) {
      onConfirm(selectedDocument);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* User Guide Section */}
          <Alert className="border-blue-200 bg-blue-50/50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="space-y-3">
              <div>
                <p className="font-medium text-gray-900 mb-1">What this does:</p>
                <p className="text-gray-700">{functionInfo.detailedDescription}</p>
              </div>
              
              {toolDescription && (
                <div>
                  <p className="font-medium text-gray-900 mb-1">Function details:</p>
                  <p className="text-gray-700 text-sm">{toolDescription}</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
          
          {/* How it works section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900">How it works:</Label>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {functionInfo.whatHappens.map((step, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700 flex-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Requirements section */}
          {functionInfo.requirements && functionInfo.requirements.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">Requirements:</Label>
              <div className="flex flex-wrap gap-2">
                {functionInfo.requirements.map((req, index) => (
                  <Badge key={index} variant="secondary" className="bg-gray-100">
                    {req}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <Separator />
          
          {/* Document Selection */}
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
              <p className="text-sm text-gray-500">No documents available. Please upload documents first.</p>
            )}
          </div>
          
          {/* Input Data Preview */}
          {inputData && inputData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Input Data ({inputData.length} records)</Label>
                <Badge variant="secondary" className="text-xs">
                  Preview
                </Badge>
              </div>
              <ScrollArea className="h-48 border rounded-lg bg-gray-50">
                <div className="p-3 space-y-3">
                  {inputData.slice(0, 3).map((record, index) => (
                    <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">
                          Record {index + 1}
                        </span>
                      </div>
                      <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(record, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {inputData.length > 3 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      ... and {inputData.length - 3} more records
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
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
            disabled={!selectedDocument || isLoading}
            className="min-w-[140px]"
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