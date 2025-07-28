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
import { useExtractionRules } from "@/hooks/useKnowledge";
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
  const [processingStep, setProcessingStep] = useState<'uploading' | 'text_extraction' | 'ai_extraction' | 'field_validation' | 'complete'>('uploading');
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

  const handleSubmit = async (data: UploadForm, mode: 'automated' | 'debug' = 'automated') => {
    if (selectedFiles.length === 0) {
      return;
    }

    setExtractionMode(mode);
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

      // Step 3: Text Extraction
      setProcessingStep('text_extraction');
      setProcessingProgress(0);
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "processing" as const })));

      // Call text extraction endpoint
      const textExtractionResult = await apiRequest(`/api/sessions/${session.id}/extract-text`, {
        method: 'POST',
        body: JSON.stringify({ files: filesData }),
        headers: { 'Content-Type': 'application/json' }
      });

      setProcessingProgress(100);

      // Step 4: Start Background Extraction Job
      setProcessingStep('ai_extraction');
      setProcessingProgress(0);

      // Start the background extraction job
      await apiRequest(`/api/sessions/${session.id}/extraction-job/start`, {
        method: 'POST'
      });

      // Step 5: Poll for completion
      setProcessingStep('field_validation');
      let extractionComplete = false;
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 5 minutes max

      while (!extractionComplete && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
        pollAttempts++;

        try {
          const jobStatus = await apiRequest(`/api/sessions/${session.id}/extraction-job`);
          
          if (jobStatus.documentExtractionStatus === 'complete') {
            extractionComplete = true;
            setProcessingProgress(100);
          } else if (jobStatus.documentExtractionStatus === 'failed') {
            throw new Error('Background extraction failed');
          } else {
            // Still in progress, update progress based on time elapsed
            const progressPercent = Math.min((pollAttempts / maxPollAttempts) * 100, 90);
            setProcessingProgress(progressPercent);
          }
        } catch (pollError) {
          console.error('Error polling extraction status:', pollError);
          // Continue polling unless it's a critical error
          if (pollAttempts >= maxPollAttempts / 2) {
            throw pollError;
          }
        }
      }

      if (!extractionComplete) {
        throw new Error('Extraction timed out. Please check the session later.');
      }

      // Step 6: Complete
      setProcessingStep('complete');
      setProcessingProgress(100);

      // Mark files as completed
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "completed" as const })));

      // Show success briefly before redirect
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (session?.id) {
        toast({
          title: "Extraction complete",
          description: `${selectedFiles.length} file(s) processed successfully. Redirecting to session view...`,
        });

        // Close dialog and redirect to session view
        setShowProcessingDialog(false);
        setLocation(`/sessions/${session.id}`);
      } else {
        throw new Error("Extraction completed but session data is missing");
      }
      
      // Reset form
      form.reset();
      setSelectedFiles([]);
    } catch (error) {
      console.error("Failed to complete extraction:", error);
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "error" as const })));
      
      setShowProcessingDialog(false);
      toast({
        title: "Extraction failed",
        description: "There was an error processing your files. Please try again.",
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
                    onClick={form.handleSubmit((data) => handleSubmit(data, 'automated'))}
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

                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canStartExtraction || selectedFiles.length === 0 || isProcessing}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300 mt-2"
                    onClick={form.handleSubmit((data) => handleSubmit(data, 'debug'))}
                  >
                    Run in debug mode
                  </Button>

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
                {processingStep === 'text_extraction' && 'Text Extraction'}
                {processingStep === 'ai_extraction' && 'AI Data Extraction'}
                {processingStep === 'field_validation' && 'Field Validation'}
                {processingStep === 'complete' && 'Processing Complete'}
              </h3>
              <p className="text-sm text-gray-600">
                {processingStep === 'uploading' && `Uploading ${processedDocuments} of ${totalDocuments} documents...`}
                {processingStep === 'text_extraction' && 'Extracting text content from uploaded documents...'}
                {processingStep === 'ai_extraction' && 'Running AI analysis to extract structured data...'}
                {processingStep === 'field_validation' && 'Creating field validations and applying rules...'}
                {processingStep === 'complete' && 'All documents processed successfully!'}
              </p>
            </div>

            <div className="w-full mb-4">
              <Progress value={processingProgress} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{Math.round(processingProgress)}%</span>
                <span>
                  {processingStep === 'uploading' && `${processedDocuments}/${totalDocuments} files`}
                  {processingStep === 'text_extraction' && 'Text Processing...'}
                  {processingStep === 'ai_extraction' && 'AI Analysis...'}
                  {processingStep === 'field_validation' && 'Field Validation...'}
                  {processingStep === 'complete' && 'Done!'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <div className={`flex items-center ${processingStep !== 'uploading' ? 'text-green-600' : ''}`}>
                {processingStep === 'uploading' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Upload
              </div>
              <div className={`flex items-center ${processingStep === 'text_extraction' ? 'text-blue-600' : ['ai_extraction', 'field_validation', 'complete'].includes(processingStep) ? 'text-green-600' : 'text-gray-400'}`}>
                {processingStep === 'text_extraction' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : ['ai_extraction', 'field_validation', 'complete'].includes(processingStep) ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                Text
              </div>
              <div className={`flex items-center ${processingStep === 'ai_extraction' ? 'text-blue-600' : ['field_validation', 'complete'].includes(processingStep) ? 'text-green-600' : 'text-gray-400'}`}>
                {processingStep === 'ai_extraction' ? (
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
                ) : ['field_validation', 'complete'].includes(processingStep) ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                AI
              </div>
              <div className={`flex items-center ${processingStep === 'field_validation' ? 'text-blue-600' : processingStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
                {processingStep === 'field_validation' ? (
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
                <p className="text-sm text-green-600 font-medium">Redirecting to session view...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}