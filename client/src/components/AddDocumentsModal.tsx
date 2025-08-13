import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, CheckCircle, AlertTriangle, Target, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProjectSchemaFields, useObjectCollections, useAllProjectProperties } from "@/hooks/useSchema";
import type { ProjectSchemaField, ObjectCollection } from "@shared/schema";

interface AddDocumentsModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  projectId: string;
  onSuccess: () => void;
  mode?: 'extract' | 'upload'; // 'extract' = full extraction workflow, 'upload' = documents only
}

const ACCEPTED_FILE_TYPES = [".pdf", ".docx", ".doc", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

interface UploadedFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
}

interface TargetField {
  id: string;
  name: string;
  type: 'schema_field' | 'collection_property';
  collectionName?: string;
}

export default function AddDocumentsModal({ 
  open, 
  onClose, 
  sessionId, 
  projectId, 
  onSuccess,
  mode = 'extract' 
}: AddDocumentsModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetFields, setTargetFields] = useState<Set<string>>(new Set());
  const [showTargetFields, setShowTargetFields] = useState(false);
  const [schemaFieldsExpanded, setSchemaFieldsExpanded] = useState(true);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch project schema data
  const { data: schemaFields = [] } = useProjectSchemaFields(projectId);
  const { data: collections = [] } = useObjectCollections(projectId);
  const { data: allProperties = [] } = useAllProjectProperties(projectId);

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FILE_TYPES.includes(extension)) {
      return `File type ${extension} not supported`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
    }
    return null;
  };

  const handleFilesSelect = useCallback((files: FileList) => {
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    if (selectedFiles.length + files.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      const isDuplicate = selectedFiles.some(f => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) {
        errors.push(`${file.name}: File already selected`);
        return;
      }

      newFiles.push({
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: "pending",
        progress: 0,
      });
    });

    if (errors.length > 0) {
      toast({
        title: "File validation errors",
        description: errors.join(", "),
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [selectedFiles, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFilesSelect(e.dataTransfer.files);
    }
  }, [handleFilesSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelect(e.target.files);
    }
  }, [handleFilesSelect]);

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one document to upload",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Update files to uploading status
      setSelectedFiles(prev => prev.map(file => ({
        ...file,
        status: "uploading" as const,
        progress: 0
      })));

      // Upload files one by one
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Update progress
        setSelectedFiles(prev => prev.map((f, index) => 
          index === i ? { ...f, progress: 30 } : f
        ));

        // Read file content as base64 for the extraction endpoint
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to read file as data URL'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file.file);
        });

        const fileData = {
          name: file.file.name,
          size: file.file.size,
          type: file.file.type,
          content: base64Content
        };

        // Update progress
        setSelectedFiles(prev => prev.map((f, index) => 
          index === i ? { ...f, progress: 60, status: "processing" as const } : f
        ));

        if (mode === 'upload') {
          // Upload mode: Only extract and save documents, no AI processing
          const uploadResponse = await apiRequest(`/api/sessions/${sessionId}/upload-documents`, {
            method: 'POST',
            body: JSON.stringify({ files: [fileData] }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!uploadResponse || !uploadResponse.success) {
            throw new Error(uploadResponse?.error || uploadResponse?.message || `Failed to upload ${file.file.name}`);
          }
        } else {
          // Extract mode: Full extraction workflow with AI processing
          
          // Step 1: Extract text from document
          const textExtractionResponse = await apiRequest(`/api/sessions/${sessionId}/extract-text`, {
            method: 'POST',
            body: JSON.stringify({ files: [fileData] }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!textExtractionResponse || !textExtractionResponse.success) {
            throw new Error(textExtractionResponse?.error || textExtractionResponse?.message || `Failed to extract text from ${file.file.name}`);
          }

          // Update progress
          setSelectedFiles(prev => prev.map((f, index) => 
            index === i ? { ...f, progress: 80, status: "processing" as const } : f
          ));

          // Step 2: Run AI extraction to match content to existing schema fields
          const extractionPayload: any = {};
          
          // Add target fields if any are selected
          if (targetFields.size > 0) {
            const targetFieldsData = {
              schemaFields: Array.from(targetFields).filter(id => 
                schemaFields.some(field => field.id === id)
              ).map(id => schemaFields.find(field => field.id === id)!),
              collectionProperties: Array.from(targetFields).filter(id => 
                allProperties.some(prop => prop.id === id)
              ).map(id => allProperties.find(prop => prop.id === id)!)
            };
            extractionPayload.targetFields = targetFieldsData;
          }
          
          const aiExtractionResponse = await apiRequest(`/api/sessions/${sessionId}/ai-extraction`, {
            method: 'POST',
            body: JSON.stringify(extractionPayload),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!aiExtractionResponse || !aiExtractionResponse.success) {
            throw new Error(aiExtractionResponse?.error || aiExtractionResponse?.message || `Failed to process ${file.file.name} with AI`);
          }
        }

        // Update to completed
        setSelectedFiles(prev => prev.map((f, index) => 
          index === i ? { ...f, progress: 100, status: "completed" as const } : f
        ));
      }

      toast({
        title: mode === 'upload' ? "Documents uploaded successfully" : "Documents added successfully",
        description: mode === 'upload' 
          ? `${selectedFiles.length} document(s) have been uploaded and saved to the session`
          : `${selectedFiles.length} document(s) have been processed and added to the session`,
      });

      // Clear files, target fields and close modal
      setSelectedFiles([]);
      setTargetFields(new Set());
      setShowTargetFields(false);
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });

      // Mark failed files as error
      setSelectedFiles(prev => prev.map(file => ({
        ...file,
        status: "error" as const,
        error: error instanceof Error ? error.message : "Upload failed"
      })));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "uploading":
      case "processing":
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "uploading":
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const handleModalClose = () => {
    if (isProcessing) return;
    setSelectedFiles([]);
    setTargetFields(new Set());
    setShowTargetFields(false);
    onClose();
  };

  const toggleTargetField = (fieldId: string) => {
    const newTargetFields = new Set(targetFields);
    if (newTargetFields.has(fieldId)) {
      newTargetFields.delete(fieldId);
    } else {
      newTargetFields.add(fieldId);
    }
    setTargetFields(newTargetFields);
  };

  const selectAllFields = (type: 'schema' | 'collection') => {
    const newTargetFields = new Set(targetFields);
    if (type === 'schema') {
      schemaFields.forEach(field => newTargetFields.add(field.id));
    } else {
      allProperties.forEach(prop => newTargetFields.add(prop.id));
    }
    setTargetFields(newTargetFields);
  };

  const clearAllFields = (type: 'schema' | 'collection') => {
    const newTargetFields = new Set(targetFields);
    if (type === 'schema') {
      schemaFields.forEach(field => newTargetFields.delete(field.id));
    } else {
      allProperties.forEach(prop => newTargetFields.delete(prop.id));
    }
    setTargetFields(newTargetFields);
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {mode === 'upload' ? 'Upload Documents' : 'Add Documents to Session'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'upload' 
              ? 'Upload documents to save them in the session. No data extraction will be performed.'
              : 'Upload additional documents to extract more data for this session. Previously verified data will be preserved and used to guide the extraction.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Target Fields Section - Only show in extract mode */}
          {mode === 'extract' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium">Target Fields (Optional)</Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTargetFields(!showTargetFields)}
                className="text-blue-600 hover:text-blue-800"
              >
                {showTargetFields ? 'Hide' : 'Show'} Target Options
              </Button>
            </div>
            
            {targetFields.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {targetFields.size} field{targetFields.size !== 1 ? 's' : ''} targeted
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTargetFields(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </Button>
              </div>
            )}
            
            {showTargetFields && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <p className="text-xs text-gray-600">
                  Select specific fields to focus AI extraction on. If no fields are selected, all fields will be processed.
                </p>
                
                {/* Schema Fields */}
                {schemaFields.length > 0 && (
                  <Collapsible open={schemaFieldsExpanded} onOpenChange={setSchemaFieldsExpanded}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-blue-600">
                          {schemaFieldsExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">Schema Fields ({schemaFields.length})</span>
                        </CollapsibleTrigger>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => selectAllFields('schema')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => clearAllFields('schema')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      
                      <CollapsibleContent className="space-y-2">
                        {schemaFields.map((field) => (
                          <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`schema-${field.id}`}
                              checked={targetFields.has(field.id)}
                              onCheckedChange={() => toggleTargetField(field.id)}
                            />
                            <Label
                              htmlFor={`schema-${field.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {field.fieldName}
                              <span className="text-xs text-gray-500 ml-2">({field.fieldType})</span>
                            </Label>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
                
                {/* Collection Properties */}
                {collections.length > 0 && allProperties.length > 0 && (
                  <Collapsible open={collectionsExpanded} onOpenChange={setCollectionsExpanded}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-blue-600">
                          {collectionsExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">Collection Properties ({allProperties.length})</span>
                        </CollapsibleTrigger>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => selectAllFields('collection')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => clearAllFields('collection')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      
                      <CollapsibleContent className="space-y-3">
                        {collections.map((collection) => {
                          const collectionProps = allProperties.filter(prop => prop.collectionName === collection.collectionName);
                          if (collectionProps.length === 0) return null;
                          
                          return (
                            <div key={collection.id} className="border-l-2 border-blue-200 pl-3 space-y-2">
                              <div className="text-sm font-medium text-gray-700">{collection.collectionName}</div>
                              {collectionProps.map((prop) => (
                                <div key={prop.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`prop-${prop.id}`}
                                    checked={targetFields.has(prop.id)}
                                    onCheckedChange={() => toggleTargetField(prop.id)}
                                  />
                                  <Label
                                    htmlFor={`prop-${prop.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {prop.propertyName}
                                    <span className="text-xs text-gray-500 ml-2">({prop.propertyType})</span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
                
                {schemaFields.length === 0 && collections.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No schema fields or collections found for this project.
                  </p>
                )}
              </div>
            )}
          </div>
          )}
          
          <Separator />
          
          {/* File Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-300 hover:border-gray-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Drop files here or click to select
            </p>
            <p className="text-xs text-gray-400">
              Supports: {ACCEPTED_FILE_TYPES.join(", ")} • Max {MAX_FILE_SIZE / (1024 * 1024)}MB each
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Selected Files ({selectedFiles.length})</h3>
              {selectedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {getStatusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    {file.status !== "pending" && file.status !== "completed" && file.status !== "error" && (
                      <Progress value={file.progress} className="mt-1" />
                    )}
                    {file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(file.status)}>
                    {file.status === "uploading" ? "Uploading" : 
                     file.status === "processing" ? "Processing" : 
                     file.status === "completed" ? "Completed" : 
                     file.status === "error" ? "Error" : "Ready"}
                  </Badge>
                  {!isProcessing && file.status !== "processing" && file.status !== "uploading" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleModalClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Add Documents ({selectedFiles.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}