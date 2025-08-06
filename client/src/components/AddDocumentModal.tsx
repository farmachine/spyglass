import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  projectId: string;
}

export default function AddDocumentModal({ isOpen, onClose, sessionId, projectId }: AddDocumentModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`documents`, file);
      });
      
      return apiRequest(`/api/sessions/${sessionId}/add-documents`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Documents uploaded successfully",
        description: "The AI is now processing the additional documents with your existing verified data.",
      });
      
      // Invalidate relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      // Reset state and close modal
      setSelectedFiles([]);
      onClose();
    },
    onError: (error: any) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      return validTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, Word, and Excel files are supported.",
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(event.dataTransfer.files);
    const validFiles = files.filter(file => {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      return validTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, Word, and Excel files are supported.",
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one document to upload.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(selectedFiles);
  };

  const handleClose = () => {
    if (uploadMutation.isPending) return;
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Documents to Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Drop documents here or click to browse
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              id="document-upload"
              disabled={uploadMutation.isPending}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('document-upload')?.click()}
              disabled={uploadMutation.isPending}
            >
              Select Files
            </Button>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Selected Files:</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm flex-1 truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={uploadMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>• Supported formats: PDF, Word (.doc/.docx), Excel (.xls/.xlsx)</p>
            <p>• The AI will use your existing verified data to help extract information from the new documents</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Processing..." : "Upload & Extract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}