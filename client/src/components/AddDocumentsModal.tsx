import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddDocumentsModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  projectId: string;
  onSuccess: () => void;
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

export default function AddDocumentsModal({ 
  open, 
  onClose, 
  sessionId, 
  projectId, 
  onSuccess 
}: AddDocumentsModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

        // Use the same extraction endpoint as NewUpload - this automatically handles existing session detection
        const extractionResponse = await apiRequest(`/api/sessions/${sessionId}/extract-text`, {
          method: 'POST',
          body: JSON.stringify({ files: [fileData] }),
          headers: { 'Content-Type': 'application/json' }
        });

        if (!extractionResponse || !extractionResponse.success) {
          throw new Error(extractionResponse?.error || extractionResponse?.message || `Failed to process ${file.file.name}`);
        }

        // Update to completed
        setSelectedFiles(prev => prev.map((f, index) => 
          index === i ? { ...f, progress: 100, status: "completed" as const } : f
        ));
      }

      toast({
        title: "Documents added successfully",
        description: `${selectedFiles.length} document(s) have been processed and added to the session`,
      });

      // Clear files and close modal
      setSelectedFiles([]);
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Add Documents to Session
          </DialogTitle>
          <DialogDescription>
            Upload additional documents to extract more data for this session. Previously verified data will be preserved and used to guide the extraction.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
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