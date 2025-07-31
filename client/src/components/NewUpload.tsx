import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, FileText, AlertCircle, Play, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { WaveIcon, DropletIcon, FlowIcon, StreamIcon } from "@/components/SeaIcons";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateExtractionSession } from "@/hooks/useExtractionSessions";
import { useProcessExtraction } from "@/hooks/useAIExtraction";
import { useProjectSchemaFields, useObjectCollections } from "@/hooks/useSchema";
import { useExtractionRules, useKnowledgeDocuments } from "@/hooks/useKnowledge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectWithDetails } from "@shared/schema";

const uploadFormSchema = z.object({
  sessionName: z.string().min(1, "Session name is required"),
  description: z.string().optional(),
  files: z.any().optional(),
});

type UploadForm = z.infer<typeof uploadFormSchema>;

interface NewUploadProps {
  project: ProjectWithDetails;
}

const ACCEPTED_FILE_TYPES = [
  ".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".csv"
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

interface UploadedFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
}

export default function NewUpload({ project }: NewUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessingDialog, setShowProcessingDialog] = useState(false);
  const [processingStep, setProcessingStep] = useState<'uploading' | 'extracting' | 'validating' | 'complete'>('uploading');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processedDocuments, setProcessedDocuments] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [extractionMode, setExtractionMode] = useState<'automated' | 'debug'>('automated');
  const [, setLocation] = useLocation();
  
  const createExtractionSession = useCreateExtractionSession(project.id);
  const processExtraction = useProcessExtraction();
  const { toast } = useToast();
  
  // Fetch schema data for validation
  const { data: schemaFields = [] } = useProjectSchemaFields(project.id);
  const { data: collections = [] } = useObjectCollections(project.id);
  const { data: extractionRules = [] } = useExtractionRules(project.id);
  const { data: knowledgeDocuments = [] } = useKnowledgeDocuments(project.id);
  


  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      sessionName: "",
      description: "",
    },
  });

  const validateFile = (file: File): string | null => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    
    if (!ACCEPTED_FILE_TYPES.includes(extension)) {
      return `File type ${extension} is not supported. Please use: ${ACCEPTED_FILE_TYPES.join(", ")}`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
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
      // In a real app, show these errors in a toast or alert
      console.error("File validation errors:", errors);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [selectedFiles]);

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

  const simulateFileProcessing = async (files: UploadedFile[]) => {
    // Simulate file upload and processing
    for (const fileData of files) {
      setSelectedFiles(prev => prev.map(f => 
        f.id === fileData.id ? { ...f, status: "uploading" } : f
      ));

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, progress } : f
        ));
      }

      setSelectedFiles(prev => prev.map(f => 
        f.id === fileData.id ? { ...f, status: "processing" } : f
      ));

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSelectedFiles(prev => prev.map(f => 
        f.id === fileData.id ? { ...f, status: "completed", progress: 100 } : f
      ));
    }
  };

  const handleSubmit = async (data: UploadForm) => {
    if (selectedFiles.length === 0) {
      return;
    }

    setExtractionMode(extractionMode);
    setIsProcessing(true);
    setShowProcessingDialog(true);
    setTotalDocuments(selectedFiles.length);
    setProcessedDocuments(0);
    setProcessingStep('uploading');
    setProcessingProgress(0);

    try {
      // Step 1: Create extraction session
      const session = await createExtractionSession.mutateAsync({
        sessionName: data.sessionName,
        description: data.description || null,
        documentCount: selectedFiles.length,
        status: "in_progress",
      });

      // Step 2: File upload progress
      setProcessingStep('uploading');
      for (let i = 0; i < selectedFiles.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProcessedDocuments(i + 1);
        setProcessingProgress(((i + 1) / selectedFiles.length) * 100);
      }

      // Prepare file data for text extraction
      const filesData = await Promise.all(selectedFiles.map(async (fileData) => {
        try {
          // Read file content as base64
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
            reader.readAsDataURL(fileData.file);
          });

          return {
            name: fileData.file.name,
            size: fileData.file.size,
            type: fileData.file.type,
            content: base64Content
          };
        } catch (error) {
          console.error(`Failed to read file ${fileData.file.name}:`, error);
          return {
            name: fileData.file.name,
            size: fileData.file.size,
            type: fileData.file.type,
            content: ""
          };
        }
      }));

      // Step 3: Text Extraction Phase (NEW SIMPLIFIED APPROACH)
      setProcessingStep('extracting');
      setProcessingProgress(0);
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "processing" as const })));

      // Call new text extraction endpoint
      const textExtractionResult = await apiRequest(`/api/sessions/${session.id}/extract-text`, {
        method: 'POST',
        body: JSON.stringify({ files: filesData }),
        headers: { 'Content-Type': 'application/json' }
      });

      setProcessingProgress(100);

      if (extractionMode === 'automated') {
        // Step 4: AI Extraction (Automated Mode Only)
        setProcessingStep('extracting');
        setProcessingProgress(0);

        // Generate the comprehensive prompt using same logic as SchemaView
        const schemaData = {
          schema_fields: schemaFields,
          collections: collections,
          extraction_rules: extractionRules,
          knowledge_documents: knowledgeDocuments,
          project: project
        };

        const generateSchemaMarkdown = (schemaData: any, extractedText: string, documentCount: number) => {
          let prompt = `You are an AI data extraction specialist. Extract data from the provided documents according to the schema configuration below.\n\n`;
          
          // Document content
          prompt += `DOCUMENT CONTENT (${documentCount} document(s)):\n${extractedText}\n\n`;
          
          // Schema fields section
          prompt += `PROJECT SCHEMA FIELDS (${schemaData.schema_fields.length} fields):\n`;
          schemaData.schema_fields.forEach((field: any, index: number) => {
            prompt += `${index + 1}. Field Name: ${field.fieldName}\n`;
            prompt += `   Field Type: ${field.fieldType}\n`;
            prompt += `   Description: ${field.description || 'No description'}\n`;
            if (field.fieldType === 'CHOICE' && field.choiceOptions) {
              const choices = field.choiceOptions.map((opt: any) => opt.value || opt).join('; ');
              prompt += `   Choice Options: The output should be one of the following choices: ${choices}.\n`;
            }
            prompt += `   Auto Verification: ${field.autoVerificationConfidence || 80}%\n`;
            
            // Add extraction rules for this field
            const fieldRules = schemaData.extraction_rules.filter((rule: any) => 
              !rule.targetPropertyIds || rule.targetPropertyIds.length === 0 || rule.targetPropertyIds.includes(field.id)
            );
            if (fieldRules.length > 0) {
              prompt += `   Extraction Rules: ${fieldRules.map((rule: any) => rule.ruleContent).join('; ')}\n`;
            } else {
              prompt += `   Extraction Rules: None\n`;
            }
            prompt += `\n`;
          });
          
          // Collections section
          prompt += `\nCOLLECTIONS (${schemaData.collections.length} collections):\n`;
          schemaData.collections.forEach((collection: any, collIndex: number) => {
            prompt += `${collIndex + 1}. Collection Name: ${collection.collectionName}\n`;
            prompt += `   Description: ${collection.description || 'No description'}\n`;
            prompt += `   Properties (${collection.properties?.length || 0}):\n`;
            
            collection.properties?.forEach((prop: any, propIndex: number) => {
              prompt += `   ${propIndex + 1}. Property Name: ${prop.propertyName}\n`;
              prompt += `      Property Type: ${prop.propertyType}\n`;  
              prompt += `      Description: ${prop.description || 'No description'}\n`;
              if (prop.propertyType === 'CHOICE' && prop.choiceOptions) {
                const choices = prop.choiceOptions.map((opt: any) => opt.value || opt).join('; ');
                prompt += `      Choice Options: The output should be one of the following choices: ${choices}.\n`;
              }
              prompt += `      Auto Verification: ${prop.autoVerificationConfidence || 80}%\n`;
              
              // Add extraction rules for this property
              const propRules = schemaData.extraction_rules.filter((rule: any) => 
                !rule.targetPropertyIds || rule.targetPropertyIds.length === 0 || rule.targetPropertyIds.includes(prop.id)
              );
              if (propRules.length > 0) {
                prompt += `      Extraction Rules: ${propRules.map((rule: any) => rule.ruleContent).join('; ')}\n`;
              } else {
                prompt += `      Extraction Rules: None\n`;
              }
              prompt += `\n`;
            });
            prompt += `\n`;
          });
          
          // Knowledge documents
          prompt += `\nKNOWLEDGE DOCUMENTS (${schemaData.knowledge_documents.length}):\n`;
          if (schemaData.knowledge_documents.length > 0) {
            schemaData.knowledge_documents.forEach((doc: any, index: number) => {
              prompt += `${index + 1}. Document: ${doc.title}\n`;
              prompt += `   Content: ${doc.content || 'No content'}\n\n`;
            });
          } else {
            prompt += `No knowledge documents configured\n\n`;
          }
          
          // AI Processing Instructions
          prompt += `AI PROCESSING INSTRUCTIONS:\n`;
          prompt += `CORE EXTRACTION PROCESS:\n`;
          prompt += `1. Extract data according to schema structure above\n`;
          prompt += `2. Count ALL instances across ALL documents accurately\n`;
          prompt += `3. Apply extraction rules to modify confidence scores as specified\n`;
          prompt += `4. Use knowledge documents for validation and conflict detection\n\n`;
          
          prompt += `CHOICE FIELD HANDLING:\n`;
          prompt += `- For CHOICE fields, ONLY return values from the specified choice options\n`;
          prompt += `- If extracted text doesn't match any choice exactly, return null for extracted_value\n`;
          prompt += `- Do not force extraction into choices - null values are acceptable\n`;
          prompt += `- This allows database writes to continue without blocking\n\n`;
          
          prompt += `CONFIDENCE SCORING (confidence_score 0-100):\n`;
          prompt += `• Base: High confidence (85-95) for clear extractions\n`;
          prompt += `• Apply extraction rule adjustments per rule content\n`;
          prompt += `• Reduce confidence for knowledge document conflicts\n`;
          prompt += `• Use each field's Auto Verification threshold for validation_status\n\n`;
          
          prompt += `OUTPUT: Return only valid JSON matching this exact schema:\n`;
          prompt += `{\n  "field_validations": [\n`;
          prompt += `    // Schema fields and collection properties with:\n`;
          prompt += `    // field_type, field_id, extracted_value, confidence_score, ai_reasoning, document_source, validation_status, record_index\n`;
          prompt += `  ]\n}\n`;
          
          return prompt;
        };

        const fullPrompt = generateSchemaMarkdown(schemaData, textExtractionResult.extractedText || '', selectedFiles.length);

        const aiResponse = await apiRequest(`/api/sessions/${session.id}/gemini-extraction`, {
          method: 'POST',
          body: JSON.stringify({ 
            extractedTexts: textExtractionResult.extracted_texts || textExtractionResult.result?.extracted_texts || [],
            schemaFields: schemaData.schema_fields || [],
            collections: schemaData.collections || [],
            extractionRules: schemaData.extraction_rules || [],
            knowledgeDocuments: schemaData.knowledge_documents || []
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        setProcessingProgress(50);

        if (!aiResponse.success) {
          throw new Error(`AI extraction failed: ${aiResponse.error}`);
        }

        // Step 5: Save to Database (Automated Mode Only)
        setProcessingStep('validating');
        setProcessingProgress(75);

        // Use the field_validations directly from the Python script response
        const fieldValidations = aiResponse.field_validations || aiResponse.extractedData?.field_validations || [];

        if (!fieldValidations || fieldValidations.length === 0) {
          throw new Error('No field validations found in AI extraction results');
        }

        const saveResponse = await apiRequest(`/api/sessions/${session.id}/save-validations`, {
          method: 'POST',
          body: JSON.stringify({ 
            extractedData: JSON.stringify({ field_validations: fieldValidations })
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        if (!saveResponse.success) {
          throw new Error(`Database save failed: ${saveResponse.error}`);
        }

        setProcessingProgress(100);
        
        // Step 6: Complete and redirect to session view
        setProcessingStep('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast({
          title: "Extraction complete",
          description: `${selectedFiles.length} file(s) processed and data extracted successfully.`,
        });

        setShowProcessingDialog(false);
        setLocation(`/projects/${project.id}/sessions/${session.id}`);
      } else {
        // Debug mode - redirect to schema view as before
        setProcessingStep('complete');
        
        // Mark files as completed
        setSelectedFiles(prev => prev.map(f => ({ ...f, status: "completed" as const })));

        // Show success briefly before redirect
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (textExtractionResult && session?.id) {
          toast({
            title: "Text extraction complete",
            description: `${selectedFiles.length} file(s) processed successfully. Going to schema generation...`,
          });

          // Close dialog and redirect to schema view with mode parameter
          setShowProcessingDialog(false);
          const redirectUrl = textExtractionResult.redirect || `/sessions/${session.id}/schema-view`;
          const urlWithMode = `${redirectUrl}?mode=${extractionMode}`;

          setLocation(urlWithMode);
        } else {
          throw new Error("Text extraction completed but session data is missing");
        }
      }
      
      // Reset form
      form.reset();
      setSelectedFiles([]);
    } catch (error) {
      console.error("Processing failed:", error);
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "error" as const })));
      
      setShowProcessingDialog(false);
      
      // Determine more specific error message based on processing step
      let errorTitle = "Processing failed";
      let errorDescription = "There was an error processing your documents. Please try again.";
      
      if (processingStep === 'extracting' && extractionMode === 'automated') {
        errorTitle = "AI extraction failed";
        errorDescription = "The AI analysis encountered an error. The text was extracted successfully, but data extraction failed. Try debug mode to see more details.";
      } else if (processingStep === 'extracting') {
        errorTitle = "Text extraction failed";
        errorDescription = "There was an error extracting text from your files. Please try again.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
      
      // Don't redirect on error - keep user on upload tab
    } finally {
      setIsProcessing(false);
    }
  };

  const canStartExtraction = selectedFiles.length > 0 && 
    (schemaFields.length > 0 || collections.length > 0);

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-gray-400" />;
      case "uploading": case "processing": return <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />;
      case "completed": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case "pending": return "Ready";
      case "uploading": return "Uploading...";
      case "processing": return "Processing...";
      case "completed": return "Complete";
      case "error": return "Error";
      default: return status;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-4 pb-12 px-4">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <TrendingUp className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Add New {project.mainObjectName || "Session"}</h2>
        <p className="text-gray-600 mt-1">
          Upload documents for AI-powered data extraction into your organization's desired format.
        </p>
      </div>

      {/* Main Form Card */}
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8">
          <div className="space-y-8">
            {/* Upload Area */}
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <DropletIcon className="h-8 w-8 text-primary mx-auto mb-4" />
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Drop files here, or{" "}
                    <label className="text-primary hover:text-primary/80 cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept={ACCEPTED_FILE_TYPES.join(",")}
                        onChange={handleFileInput}
                        disabled={isProcessing}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports: PDF, Word, Excel, CSV, Text files (max {MAX_FILES} files, {MAX_FILE_SIZE / (1024 * 1024)}MB each)
                  </p>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Selected Files ({selectedFiles.length})</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((fileData) => (
                      <div key={fileData.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {fileData.file.name}
                          </p>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(fileData.status)}
                            <span className="text-xs text-gray-500">
                              {getStatusText(fileData.status)}
                            </span>
                            {fileData.status === "uploading" && (
                              <Progress value={fileData.progress} className="flex-1 h-1" />
                            )}
                          </div>
                        </div>
                        {!isProcessing && fileData.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileData.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Session Configuration */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="sessionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{project.mainObjectName || "Session"} Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`e.g., Q4 2024 ${project.mainObjectName || "Session"} Data`}
                            {...field}
                            disabled={isProcessing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional context about this upload session..."
                            {...field}
                            disabled={isProcessing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <Button 
                    type="submit" 
                    disabled={!canStartExtraction || selectedFiles.length === 0 || isProcessing}
                    className="w-full"
                    onClick={() => setExtractionMode('automated')}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FlowIcon className="h-4 w-4 mr-2" />
                        Start Extraction
                      </>
                    )}
                  </Button>

                  {/* Debug mode disabled - debugging now available in session view */}

                  <div className="pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Extraction Schema</h4>
                    <div className="space-y-2">
                      {project.schemaFields.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Project Fields ({project.schemaFields.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {project.schemaFields.slice(0, 3).map((field) => (
                              <Badge key={field.id} variant="outline" className="text-xs">
                                {field.fieldName}
                              </Badge>
                            ))}
                            {project.schemaFields.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{project.schemaFields.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {project.collections.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Object Collections ({project.collections.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {project.collections.slice(0, 3).map((collection) => (
                              <Badge key={collection.id} variant="secondary" className="text-xs">
                                {collection.collectionName}
                              </Badge>
                            ))}
                            {project.collections.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{project.collections.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </Form>
          </div>
        </CardContent>
      </Card>

      {/* Processing Dialog */}
      <Dialog open={showProcessingDialog} modal={true}>
        <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="sr-only">
            <DialogTitle>Document Processing</DialogTitle>
            <DialogDescription>Processing your documents through multiple stages</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 mb-6 relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <WaveIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-2">
                  {extractionMode === 'automated' ? 'Automated Mode' : 'Debug Mode'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {processingStep === 'uploading' && 'Processing Documents'}
                {processingStep === 'extracting' && 'AI Data Extraction'}
                {processingStep === 'validating' && 'Validation & Rules'}
                {processingStep === 'complete' && 'Processing Complete'}
              </h3>
              <p className="text-sm text-gray-600">
                {processingStep === 'uploading' && `Uploading ${processedDocuments} of ${totalDocuments} documents...`}
                {processingStep === 'extracting' && 'Analyzing documents and extracting data using AI...'}
                {processingStep === 'validating' && 'Applying extraction rules and validation logic...'}
                {processingStep === 'complete' && 'All documents processed successfully!'}
              </p>
            </div>

            <div className="w-full mb-4">
              <Progress value={processingProgress} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{Math.round(processingProgress)}%</span>
                <span>
                  {processingStep === 'uploading' && `${processedDocuments}/${totalDocuments} files`}
                  {processingStep === 'extracting' && 'Extracting...'}
                  {processingStep === 'validating' && 'Validating...'}
                  {processingStep === 'complete' && 'Done!'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className={`flex items-center ${processingStep !== 'uploading' ? 'text-green-600' : ''}`}>
                {processingStep === 'uploading' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Upload
              </div>
              <div className={`flex items-center ${processingStep === 'extracting' ? 'text-blue-600' : processingStep === 'validating' || processingStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
                {processingStep === 'extracting' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : processingStep === 'validating' || processingStep === 'complete' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                Extract
              </div>
              <div className={`flex items-center ${processingStep === 'validating' ? 'text-blue-600' : processingStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
                {processingStep === 'validating' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : processingStep === 'complete' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                Validate
              </div>
            </div>

            {processingStep === 'complete' && (
              <div className="mt-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-600 font-medium">Redirecting to review page...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}