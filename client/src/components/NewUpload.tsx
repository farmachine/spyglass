import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, FileText, AlertCircle, Play, CheckCircle, Clock } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
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
  const [, setLocation] = useLocation();
  
  const createExtractionSession = useCreateExtractionSession(project.id);
  const processExtraction = useProcessExtraction();
  const { toast } = useToast();
  const { user } = useAuth();
  
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

  // Helper function to generate schema markdown (same as SchemaView)
  const generateSchemaMarkdown = (schemaData: any, documentText: string, documentCount: number) => {
    let markdown = `# AI DATA EXTRACTION TASK\n\n`;
    
    // Document content at the top
    markdown += `## DOCUMENTS TO PROCESS\n\n`;
    markdown += `**INSTRUCTION:** Extract data from the following ${documentCount} document(s) according to the schema structure below.\n\n`;
    markdown += `${documentText}\n\n`;
    markdown += `--- END OF DOCUMENTS ---\n\n`;
    
    // Schema fields
    markdown += `## SCHEMA FIELDS\n\n`;
    if (schemaData.schema_fields && schemaData.schema_fields.length > 0) {
      const fieldsData = {
        schema_fields: schemaData.schema_fields.map((field: any) => ({
          field_name: field.fieldName,
          type: field.fieldType,
          "AI guidance": field.description,
          "Extraction Rules": "No rules",
          "Knowledge Documents": schemaData.knowledge_documents?.length > 0 ? 
            schemaData.knowledge_documents.map((doc: any) => doc.displayName).join(', ') : 
            "None"
        }))
      };
      markdown += `\`\`\`json\n${JSON.stringify(fieldsData, null, 2)}\n\`\`\`\n\n`;
    }
    
    // Collections
    markdown += `## OBJECT COLLECTIONS\n\n`;
    if (schemaData.collections && schemaData.collections.length > 0) {
      const collectionsData = {
        collections: schemaData.collections.map((collection: any) => ({
          collection_name: collection.collectionName,
          properties: collection.properties?.map((prop: any) => ({
            property_name: prop.propertyName,
            type: prop.propertyType,
            "AI guidance": prop.description,
            "Extraction Rules": "No rules",
            "Knowledge Documents": schemaData.knowledge_documents?.length > 0 ? 
              schemaData.knowledge_documents.map((doc: any) => doc.displayName).join(', ') : 
              "None"
          })) || []
        }))
      };
      markdown += `\`\`\`json\n${JSON.stringify(collectionsData, null, 2)}\n\`\`\`\n\n`;
    }
    
    // Knowledge Documents
    markdown += `## KNOWLEDGE DOCUMENTS\n\n`;
    markdown += `**INSTRUCTION:** Use these documents as reference material for validation and conflict detection.\n\n`;
    if (schemaData.knowledge_documents && schemaData.knowledge_documents.length > 0) {
      schemaData.knowledge_documents.forEach((doc: any, index: number) => {
        markdown += `### KNOWLEDGE DOCUMENT ${index + 1}: ${doc.displayName}\n\n`;
        markdown += `${doc.content || 'No content available'}\n\n`;
      });
    } else {
      markdown += `No knowledge documents configured\n\n`;
    }
    
    // Extraction Rules
    markdown += `## EXTRACTION RULES\n\n`;
    markdown += `**INSTRUCTION:** Apply these rules to modify confidence scores for matching values.\n\n`;
    if (schemaData.extraction_rules && schemaData.extraction_rules.length > 0) {
      schemaData.extraction_rules.forEach((rule: any, index: number) => {
        const isGlobalRule = !rule.targetFields || rule.targetFields.length === 0;
        markdown += `### ${isGlobalRule ? 'GLOBAL RULE' : 'TARGETED RULE'} ${index + 1}: ${rule.ruleName || `Rule ${index + 1}`}\n\n`;
        markdown += `**Applies to:** ${isGlobalRule ? 
          'ALL SCHEMA FIELDS AND COLLECTION PROPERTIES (Auto-mapped)' : 
          rule.targetFields?.join(', ') || 'Not specified'
        }\n\n`;
        markdown += `**Rule Content:** ${rule.ruleContent}\n\n`;
      });
    } else {
      markdown += `No extraction rules configured\n\n`;
    }
    
    // AI Processing Instructions
    markdown += `## AI PROCESSING INSTRUCTIONS\n\n`;
    markdown += `### CORE EXTRACTION PROCESS:\n`;
    markdown += `1. Extract data according to schema structure above\n`;
    markdown += `2. Count ALL instances across ALL documents accurately\n`;
    markdown += `3. Apply extraction rules to modify confidence scores as specified\n`;
    markdown += `4. Use knowledge documents for validation and conflict detection\n\n`;
    
    markdown += `### CONFIDENCE SCORING (confidence_score 0-100):\n`;
    markdown += `- Base: High confidence (85-95) for clear extractions\n`;
    markdown += `- Apply extraction rule adjustments per rule content\n`;
    markdown += `- Reduce confidence for knowledge document conflicts\n\n`;
    
    markdown += `### AI REASONING (ai_reasoning):\n`;
    markdown += `Give reasoning for the score. Reference which knowledge documents and/or extraction rules influenced the decision.\n\n`;
    
    // JSON Schema
    markdown += `## REQUIRED JSON OUTPUT SCHEMA\n\n`;
    const outputSchema = {
      "field_validations": [
        // Schema fields
        ...(schemaData.schema_fields || []).map((field: any) => ({
          "field_type": "schema_field",
          "field_id": field.id,
          "field_name": field.fieldName,
          "description": field.description || 'No description',
          "extracted_value": null,
          "confidence_score": 95,
          "ai_reasoning": "Provide reasoning here",
          "document_source": "document_name.pdf",
          "validation_status": "pending",
          "record_index": 0
        })),
        // Collection properties
        ...(schemaData.collections || []).flatMap((collection: any) => 
          (collection.properties || []).map((prop: any) => ({
            "field_type": "collection_property",
            "field_id": prop.id,
            "field_name": `${collection.collectionName}.${prop.propertyName}`,
            "collection_name": collection.collectionName,
            "description": prop.description || 'No description',
            "extracted_value": null,
            "confidence_score": 95,
            "ai_reasoning": "Provide reasoning here",
            "document_source": "document_name.pdf",
            "validation_status": "pending",
            "record_index": 0
          }))
        )
      ]
    };
    
    markdown += `\`\`\`json\n${JSON.stringify(outputSchema, null, 2)}\n\`\`\`\n\n`;
    
    return markdown;
  };

  // Single-click extraction: Exact same workflow as SchemaView debugging page
  const handleSingleClickExtraction = async (data: UploadForm) => {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    setShowProcessingDialog(true);
    setTotalDocuments(selectedFiles.length);
    setProcessedDocuments(0);
    setProcessingStep('uploading');
    setProcessingProgress(0);

    try {
      // Step 1: Create extraction session
      setProcessingStep('uploading');
      setProcessingProgress(10);
      
      const session = await createExtractionSession.mutateAsync({
        sessionName: data.sessionName,
        description: data.description || null,
        documentCount: selectedFiles.length,
        status: "in_progress",
      });

      // Step 2: Convert files to base64 and call extract-text API (same as debug workflow)
      setProcessingProgress(25);
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

      // Step 3: Extract text content using same API as debug workflow
      setProcessingStep('extracting');
      setProcessingProgress(40);

      const textExtractionResult = await apiRequest(`/api/sessions/${session.id}/extract-text`, {
        method: 'POST',
        body: JSON.stringify({ files: filesData }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!textExtractionResult.success) {
        throw new Error("Text extraction failed");
      }

      // Step 4: Get session with extracted content
      const updatedSession = await apiRequest(`/api/sessions/${session.id}`);
      
      // Parse document content (same logic as SchemaView)
      let documentContent = null;
      if (updatedSession.extractedData) {
        try {
          let extractedData;
          if (typeof updatedSession.extractedData === 'string') {
            extractedData = JSON.parse(updatedSession.extractedData);
          } else {
            extractedData = updatedSession.extractedData;
          }
          
          if (extractedData?.success && extractedData?.extracted_texts && Array.isArray(extractedData.extracted_texts)) {
            const text = extractedData.extracted_texts.map((doc: any, index: number) => 
              `--- DOCUMENT ${index + 1}: ${doc.file_name} ---\n${doc.text_content}`
            ).join('\n\n--- DOCUMENT SEPARATOR ---\n\n');
            documentContent = {
              text,
              count: extractedData.extracted_texts.length
            };
          }
        } catch (parseError) {
          console.error("Failed to parse extracted data:", parseError);
        }
      }

      if (!documentContent) {
        throw new Error("No document content extracted");
      }

      // Step 5: Get schema data for prompt generation
      setProcessingProgress(50);
      const schemaData = await apiRequest(`/api/projects/${session.projectId}/schema-data`);

      // Step 6: Generate prompt and call Gemini (same as SchemaView)
      setProcessingProgress(60);
      const fullPrompt = generateSchemaMarkdown(schemaData, documentContent.text, documentContent.count);
      
      const geminiResponse = await apiRequest(`/api/sessions/${session.id}/gemini-extraction`, {
        method: 'POST',
        body: JSON.stringify({ 
          prompt: fullPrompt,
          projectId: session.projectId 
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!geminiResponse.success) {
        throw new Error(geminiResponse.error || "Gemini extraction failed");
      }

      // Step 7: Parse JSON and save to database (same logic as SchemaView)
      setProcessingStep('validating');
      setProcessingProgress(75);

      const responseText = geminiResponse.extractedData || geminiResponse.result || '';
      
      // Extract JSON from response
      let jsonText = null;
      let jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else {
        // Look for object starting with { and ending with }
        const lines = responseText.split('\n');
        let objectStart = -1;
        let objectEnd = -1;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('{') && objectStart === -1) {
            objectStart = i;
            braceCount = 1;
            for (let j = 1; j < line.length; j++) {
              if (line[j] === '{') braceCount++;
              if (line[j] === '}') braceCount--;
            }
            if (braceCount === 0) {
              objectEnd = i;
              break;
            }
          } else if (objectStart !== -1) {
            for (let j = 0; j < line.length; j++) {
              if (line[j] === '{') braceCount++;
              if (line[j] === '}') braceCount--;
            }
            if (braceCount === 0) {
              objectEnd = i;
              break;
            }
          }
        }
        
        if (objectStart !== -1 && objectEnd !== -1) {
          jsonText = lines.slice(objectStart, objectEnd + 1).join('\n').trim();
        }
      }

      if (!jsonText) {
        throw new Error('No valid JSON found in extraction results');
      }

      // Clean and parse JSON
      let cleanedJsonText = jsonText
        .replace(/\n\s*\n/g, '\n')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\.\.\./g, '')
        .replace(/…\[TRUNCATED\]/g, '')
        .trim();
      
      let lastClosingBrace = cleanedJsonText.lastIndexOf('}');
      if (lastClosingBrace > 0) {
        cleanedJsonText = cleanedJsonText.substring(0, lastClosingBrace + 1);
      }
      
      const parsedJson = JSON.parse(cleanedJsonText);
      
      // Extract field_validations array
      let extractedValidations;
      if (parsedJson.field_validations && Array.isArray(parsedJson.field_validations)) {
        extractedValidations = parsedJson.field_validations;
      } else if (Array.isArray(parsedJson)) {
        extractedValidations = parsedJson;
      } else {
        throw new Error('Invalid JSON structure - expected field_validations array');
      }
      
      const validationsArray = Array.isArray(extractedValidations) ? extractedValidations : [extractedValidations];
      
      // Step 8: Save to database
      setProcessingProgress(85);
      const saveResponse = await apiRequest(`/api/sessions/${session.id}/save-validations`, {
        method: 'POST',
        body: JSON.stringify({ validations: validationsArray }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.error || 'Failed to save validation results');
      }

      // Step 9: Complete and redirect
      setProcessingStep('complete');
      setProcessingProgress(100);
      
      toast({
        title: "Extraction completed successfully",
        description: "Redirecting to review page...",
      });
      
      // Brief delay for user feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Close dialog and redirect to session review
      setShowProcessingDialog(false);
      setLocation(`/projects/${project.id}/sessions/${session.id}`);
      
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
    } finally {
      setIsProcessing(false);
    }
  };

  // Debug mode: Original 2-step process for joshfarm@gmail.com
  const handleSubmit = async (data: UploadForm) => {
    if (selectedFiles.length === 0) {
      return;
    }

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

      // Step 4: Complete
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

        // Close dialog and redirect to text view
        setShowProcessingDialog(false);
        setLocation(textExtractionResult.redirect || `/sessions/${session.id}/text-view`);
      } else {
        throw new Error("Text extraction completed but session data is missing");
      }
      
      // Reset form
      form.reset();
      setSelectedFiles([]);
    } catch (error) {
      console.error("Failed to extract text:", error);
      setSelectedFiles(prev => prev.map(f => ({ ...f, status: "error" as const })));
      
      setShowProcessingDialog(false);
      toast({
        title: "Text extraction failed",
        description: "There was an error extracting text from your files. Please try again.",
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
    <div className="space-y-6 relative">

      
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Add New {project.mainObjectName || "Session"}</h2>
        <p className="text-gray-600 mt-1">
          Upload documents for AI-powered data extraction into your organization's desired format.
        </p>
      </div>



      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

                  {/* Single-click extraction button */}
                  <Button 
                    type="button"
                    onClick={() => form.handleSubmit(handleSingleClickExtraction)()}
                    disabled={!canStartExtraction || selectedFiles.length === 0 || isProcessing}
                    className="w-full"
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

                  {/* Debug button - only visible to joshfarm@gmail.com */}
                  {user?.email === 'joshfarm@gmail.com' && (
                    <Button 
                      type="button"
                      onClick={() => form.handleSubmit(handleSubmit)()}
                      disabled={!canStartExtraction || selectedFiles.length === 0 || isProcessing}
                      className="w-full mt-2"
                      variant="outline"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run with debugging page
                        </>
                      )}
                    </Button>
                  )}
                </form>
              </Form>
            </div>
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