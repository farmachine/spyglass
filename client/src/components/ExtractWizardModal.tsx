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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-gray-800">
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
                    {(() => {
                      // Build pivoted preview data grouped by identifierId
                      const buildPivotPreview = () => {
                        if (!validations || validations.length === 0) {
                          // Fallback to inputData if no validations
                          if (inputData.length === 0) return { columns: [], rows: [] };
                          const allKeys = Object.keys(inputData[0]);
                          const orderedKeys = columnOrder ? columnOrder.filter(col => allKeys.includes(col)) : allKeys;
                          return {
                            columns: orderedKeys,
                            rows: inputData.slice(0, 10)
                          };
                        }

                        // Group validations by identifierId and map across columns
                        const rowsMap: Record<string, any> = {};
                        const columnSet = new Set<string>();

                        // Process validations to build pivot data
                        validations.forEach(validation => {
                          if (!validation.identifierId) return;
                          
                          // Initialize row if not exists
                          if (!rowsMap[validation.identifierId]) {
                            rowsMap[validation.identifierId] = { identifierId: validation.identifierId };
                          }

                          // Determine column key using referenceFieldNames or fallback
                          let columnKey = validation.fieldName || validation.columnName || `Column_${validation.valueId}`;
                          if (referenceFieldNames && validation.valueId && referenceFieldNames[validation.valueId]) {
                            columnKey = referenceFieldNames[validation.valueId];
                          }
                          
                          columnSet.add(columnKey);

                          // Determine display value with precedence
                          let displayValue = validation.extractedValue;
                          if (validation.validatedValue !== undefined && validation.validatedValue !== null) {
                            displayValue = validation.validatedValue;
                          } else if (validation.normalizedValue !== undefined && validation.normalizedValue !== null) {
                            displayValue = validation.normalizedValue;
                          } else if (validation.rawValue !== undefined && validation.rawValue !== null) {
                            displayValue = validation.rawValue;
                          }

                          // Set the value (handle duplicates by keeping latest or highest confidence)
                          if (!rowsMap[validation.identifierId][columnKey] || 
                              (validation.validationStatus === 'valid' && rowsMap[validation.identifierId][columnKey + '_status'] !== 'valid')) {
                            rowsMap[validation.identifierId][columnKey] = displayValue;
                            rowsMap[validation.identifierId][columnKey + '_status'] = validation.validationStatus;
                          }
                        });

                        // Merge inputData to fill gaps
                        inputData.forEach(record => {
                          if (record.identifierId && rowsMap[record.identifierId]) {
                            Object.keys(record).forEach(key => {
                              if (key !== 'identifierId' && !rowsMap[record.identifierId][key]) {
                                rowsMap[record.identifierId][key] = record[key];
                                columnSet.add(key);
                              }
                            });
                          }
                        });

                        // Build final columns array
                        const allColumns = Array.from(columnSet);
                        const finalColumns = columnOrder 
                          ? ['identifierId', ...columnOrder.filter(col => allColumns.includes(col))]
                          : ['identifierId', ...allColumns];

                        // Convert rowsMap to array
                        const finalRows = Object.values(rowsMap).slice(0, 10);

                        return { columns: finalColumns, rows: finalRows };
                      };

                      const { columns, rows } = buildPivotPreview();

                      return (
                        <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 sticky top-0">
                                <tr>
                                  {columns.length === 0 ? (
                                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">No Data</th>
                                  ) : (
                                    columns.map(columnKey => (
                                      <th key={columnKey} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 min-w-[150px] max-w-[250px]">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                          <span className="truncate" title={columnKey}>
                                            {columnKey === 'identifierId' ? 'ID' : columnKey}
                                          </span>
                                        </div>
                                      </th>
                                    ))
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row, index) => (
                                  <tr key={row.identifierId || index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                    {columns.map(columnKey => (
                                      <td key={columnKey} className="px-3 py-2 text-gray-800 dark:text-gray-200 min-w-[150px] max-w-[250px]">
                                        <div className="truncate" title={String(row[columnKey] || '')}>
                                          {row[columnKey] === null || row[columnKey] === undefined ? (
                                            <span className="text-gray-400 italic">-</span>
                                          ) : columnKey === 'identifierId' ? (
                                            <span className="font-mono text-xs">{String(row[columnKey]).substring(0, 8)}...</span>
                                          ) : (
                                            String(row[columnKey])
                                          )}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                            <span>
                              {rows.length === 0 ? 'No data available' : `${rows.length} records shown`}
                              {validations && validations.length > 0 && ` (from ${validations.length} validations)`}
                            </span>
                            {columns.length > 0 && (
                              <span className="text-xs">{columns.length} columns</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            
            {/* Sections rendered purely from tool input configuration */}
            {inputValues && Object.keys(inputValues).length > 0 && (
              <div className="space-y-4">
                {Object.entries(inputValues).map(([key, value]) => {
                  // Get parameter name from referenceFieldNames or use key as fallback
                  const parameterName = referenceFieldNames[key] || key.split('.').pop()?.replace(/_/g, ' ') || key;
                  const isArray = Array.isArray(value);
                  const valueCount = isArray ? value.length : 1;
                  
                  // Check if this is a document input (needs dropdown)
                  const isDocumentInput = (typeof value === 'string' && value === 'user_document') || 
                                         (Array.isArray(value) && value.length === 1 && value[0] === 'user_document');
                  
                  // Check if this is a knowledge document input
                  const isKnowledgeDocInput = key.startsWith('knowledge_document');
                  
                  // Determine icon based on parameter name and value content
                  const getParameterIcon = () => {
                    const lowerName = parameterName.toLowerCase();
                    const lowerKey = key.toLowerCase();
                    
                    if (lowerName.includes('document') || lowerKey.includes('document') || 
                        lowerName.includes('file') || lowerKey.includes('file')) {
                      return <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
                    } else if (lowerName.includes('instruction') || lowerName.includes('prompt') || 
                               lowerName.includes('query') || lowerName.includes('ai')) {
                      return <Sparkles className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
                    } else {
                      return <Database className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
                    }
                  };
                  
                  // Determine badge color based on parameter type
                  const getBadgeColor = () => {
                    const lowerName = parameterName.toLowerCase();
                    const lowerKey = key.toLowerCase();
                    
                    if (lowerName.includes('document') || lowerKey.includes('document') || 
                        lowerName.includes('file') || lowerKey.includes('file')) {
                      return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
                    } else if (lowerName.includes('instruction') || lowerName.includes('prompt') || 
                               lowerName.includes('query') || lowerName.includes('ai')) {
                      return 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                    } else {
                      return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300';
                    }
                  };
                  
                  return (
                    <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {getParameterIcon()}
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{parameterName}</span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getBadgeColor()}`}
                          >
                            {isDocumentInput ? 'document selection' : 
                             isKnowledgeDocInput ? `${knowledgeDocuments?.length || 0} reference${knowledgeDocuments?.length !== 1 ? 's' : ''}` :
                             isArray ? `${valueCount} columns` : 'value'}
                          </Badge>
                          {/* Show record count for column arrays */}
                          {isArray && stats.processing > 0 && (
                            <Badge 
                              variant="outline" 
                              className="text-xs ml-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            >
                              {stats.processing} records
                            </Badge>
                          )}
                        </div>
                        {expandedSections.has(key) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        )}
                      </button>
                      
                      {expandedSections.has(key) && (
                        <div className="px-4 pb-4">
                          {/* Document dropdown for user document inputs */}
                          {isDocumentInput && (
                            <div className="space-y-2">
                              <Label htmlFor={`document-select-${key}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Select document
                              </Label>
                              <Select
                                value={selectedDocument}
                                onValueChange={setSelectedDocument}
                              >
                                <SelectTrigger id={`document-select-${key}`} className="w-full">
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
                          
                          {/* Knowledge documents display */}
                          {isKnowledgeDocInput && knowledgeDocuments && knowledgeDocuments.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Reference documents that will be used:
                              </p>
                              {knowledgeDocuments.map((doc, index) => (
                                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {doc.displayName || doc.documentName || doc.fileName || 'Reference Document'}
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
                          
                          {/* Regular parameter value display */}
                          {!isDocumentInput && !isKnowledgeDocInput && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {(() => {
                                  // Map UUIDs to actual values for display
                                  let displayValue = value;
                                  
                                  if (validations && validations.length > 0) {
                                    if (isArray && value.every((v: any) => typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i))) {
                                      // Array of column UUIDs - show extracted values from each column
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
                                      // Single column UUID - show extracted values from that column  
                                      const columnValidations = validations.filter(v => v.valueId === value && v.extractedValue);
                                      
                                      if (columnValidations.length > 0) {
                                        displayValue = columnValidations.map(v => v.extractedValue);
                                      } else {
                                        displayValue = [value.substring(0, 8) + '...'];
                                      }
                                    }
                                  }
                                  
                                  if (Array.isArray(displayValue)) {
                                    // Check if we have actual data to display in table format
                                    if (validations && validations.length > 0 && Array.isArray(value) && value.every((v: any) => typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i))) {
                                      // This is column UUIDs with validations - show data table
                                      const rowsMap: Record<string, any> = {};
                                      const columnHeaders: string[] = [];

                                      // First, get all unique valueIds and create column headers
                                      const valueIdToColumnName: Record<string, string> = {};
                                      value.forEach((valueId: string) => {
                                        let columnName = '';
                                        if (referenceFieldNames && referenceFieldNames[valueId]) {
                                          columnName = referenceFieldNames[valueId];
                                        } else {
                                          // Find any validation for this valueId to get field name
                                          const sampleValidation = validations.find(v => v.valueId === valueId);
                                          columnName = sampleValidation?.fieldName || sampleValidation?.columnName || `Column_${valueId}`;
                                        }
                                        
                                        // Clean up column name by removing index numbers like [0], [1], [4], etc.
                                        columnName = columnName.replace(/\[\d+\]$/, '');
                                        
                                        valueIdToColumnName[valueId] = columnName;
                                        columnHeaders.push(columnName);
                                      });

                                      // Build data rows from validations, grouping by valueId
                                      validations.forEach(validation => {
                                        if (!validation.identifierId || !(Array.isArray(value) && value.includes(validation.valueId))) return;
                                        
                                        // Initialize row if not exists
                                        if (!rowsMap[validation.identifierId]) {
                                          rowsMap[validation.identifierId] = { identifierId: validation.identifierId };
                                        }

                                        // Get column name for this valueId
                                        const columnName = valueIdToColumnName[validation.valueId];
                                        
                                        // Get best value with precedence
                                        let cellValue = validation.extractedValue;
                                        if (validation.validatedValue !== undefined && validation.validatedValue !== null) {
                                          cellValue = validation.validatedValue;
                                        } else if (validation.normalizedValue !== undefined && validation.normalizedValue !== null) {
                                          cellValue = validation.normalizedValue;
                                        }

                                        // If we already have a value for this cell, combine them (shouldn't happen in normal cases)
                                        if (rowsMap[validation.identifierId][columnName]) {
                                          // Keep the first non-null/non-empty value, or combine if needed
                                          if (!cellValue || cellValue === '') {
                                            // Keep existing value
                                          } else if (!rowsMap[validation.identifierId][columnName] || rowsMap[validation.identifierId][columnName] === '') {
                                            rowsMap[validation.identifierId][columnName] = cellValue;
                                          }
                                          // If both have values, keep the existing one (first wins)
                                        } else {
                                          rowsMap[validation.identifierId][columnName] = cellValue;
                                        }
                                      });

                                      const dataRows = Object.values(rowsMap).slice(0, 5); // Show first 5 rows

                                      if (dataRows.length > 0 && columnHeaders.length > 0) {
                                        return (
                                          <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <div className="overflow-x-auto max-h-48">
                                              <table className="text-xs table-auto w-full">
                                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 sticky top-0">
                                                  <tr>
                                                    {columnHeaders.map((header, index) => (
                                                      <th key={header} className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-300" style={{ 
                                                        width: '200px',
                                                        maxWidth: '200px' 
                                                      }}>
                                                        <div className="flex items-center gap-1">
                                                          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                                          <span className="truncate" title={header}>{header}</span>
                                                        </div>
                                                      </th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {dataRows.map((row, rowIdx) => (
                                                    <tr key={row.identifierId || rowIdx} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                                      {columnHeaders.map((header) => (
                                                        <td key={header} className="px-2 py-1.5 text-gray-800 dark:text-gray-200" style={{ 
                                                          width: '200px',
                                                          maxWidth: '200px' 
                                                        }}>
                                                          {row[header] === null || row[header] === undefined ? (
                                                            <span className="text-gray-400 italic">-</span>
                                                          ) : (
                                                            <div className="truncate" title={String(row[header])}>
                                                              {String(row[header])}
                                                            </div>
                                                          )}
                                                        </td>
                                                      ))}
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                            <div className="px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                              <span>{dataRows.length} of {Object.keys(rowsMap).length} records shown</span>
                                              <span>{columnHeaders.length} columns</span>
                                            </div>
                                          </div>
                                        );
                                      }
                                    }
                                    
                                    // Fallback to simple list if no table data available
                                    return (
                                      <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {displayValue.map((item: any, idx: number) => (
                                          <div key={idx} className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                                            {typeof item === 'string' ? 
                                              (item.length > 150 ? item.substring(0, 150) + '...' : item) : 
                                              JSON.stringify(item)
                                            }
                                          </div>
                                        ))}
                                        {displayValue.length > 0 && (
                                          <div className="text-xs text-gray-500 italic px-2 pt-1 border-t border-gray-200 dark:border-gray-600">
                                            {displayValue.length} total column{displayValue.length !== 1 ? 's' : ''} shown
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 max-h-20 overflow-y-auto whitespace-pre-wrap">
                                        {String(displayValue).length > 300 ? 
                                          String(displayValue).substring(0, 300) + '...' : 
                                          String(displayValue)
                                        }
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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