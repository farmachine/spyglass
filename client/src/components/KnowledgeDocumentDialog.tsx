import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { KnowledgeDocument } from "@shared/schema";

const knowledgeDocumentFormSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  description: z.string().min(1, "Description is required to guide AI extraction"),
  file: z.any().optional(),
});

type KnowledgeDocumentForm = z.infer<typeof knowledgeDocumentFormSchema>;

interface KnowledgeDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { fileName: string; displayName: string; fileType: string; fileSize: number; description: string }) => Promise<void>;
  document?: KnowledgeDocument | null;
  isLoading?: boolean;
}

const ACCEPTED_FILE_TYPES = [
  ".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".csv"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function KnowledgeDocumentDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  document,
  isLoading = false 
}: KnowledgeDocumentDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useForm<KnowledgeDocumentForm>({
    resolver: zodResolver(knowledgeDocumentFormSchema),
    defaultValues: {
      displayName: document?.displayName || "",
      description: document?.description || "",
    },
  });

  // Reset form when document changes (for edit mode)
  React.useEffect(() => {
    if (document) {
      form.reset({
        displayName: document.displayName || "",
        description: document.description || "",
      });
    } else {
      form.reset({
        displayName: "",
        description: "",
      });
    }
  }, [document, form]);

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

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      return;
    }
    
    setFileError(null);
    setSelectedFile(file);
    
    // Auto-fill display name if empty
    if (!form.getValues("displayName")) {
      form.setValue("displayName", file.name.split('.').slice(0, -1).join('.'));
    }
  }, [form]);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }, [handleFileSelect]);

  const handleSubmit = async (data: KnowledgeDocumentForm) => {
    if (!document && !selectedFile) {
      setFileError("Please select a file to upload");
      return;
    }

    try {
      const submitData = {
        fileName: document ? document.fileName : selectedFile!.name,
        displayName: data.displayName,
        fileType: document ? document.fileType : selectedFile!.name.split('.').pop()?.toLowerCase() || "unknown",
        fileSize: document ? document.fileSize : selectedFile!.size,
        description: data.description,
      };

      await onSave(submitData);
      form.reset();
      setSelectedFile(null);
      setFileError(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save knowledge document:", error);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {document ? "Edit Knowledge Document" : "Upload Knowledge Document"}
          </DialogTitle>
          <DialogDescription>
            Upload reference documents to improve AI extraction accuracy. These documents provide context and examples for better data extraction.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {!document && (
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeFile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-lg font-medium text-gray-900">
                          Drop your file here, or 
                          <label className="text-blue-600 hover:text-blue-500 cursor-pointer ml-1">
                            browse
                            <input
                              type="file"
                              className="hidden"
                              accept={ACCEPTED_FILE_TYPES.join(",")}
                              onChange={handleFileInput}
                            />
                          </label>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Supports: PDF, Word, Excel, CSV, Text files (max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {fileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter a display name for this document"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    A friendly name to identify this document in the knowledge base.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Guidance Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe how this document should guide AI extraction. Example: 'This policy document contains standard formats for employee information, use it to understand proper data structure for personnel records.'"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    Required. This description tells the AI how to use this document during extraction.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Uploading..." : document ? "Update Document" : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}