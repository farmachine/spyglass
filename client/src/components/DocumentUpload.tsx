import { useState } from "react";
import { Upload, File, FileText, Loader2, CheckCircle, AlertTriangle, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SessionDocument } from "@shared/schema";

interface DocumentUploadProps {
  sessionId: string;
}

interface FileWithPreview extends File {
  id?: string;
  preview?: string;
}

export default function DocumentUpload({ sessionId }: DocumentUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SessionDocument | null>(null);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: [`/api/sessions/${sessionId}/documents`],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/documents`)
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: FileWithPreview) => {
      const formData = new FormData();
      
      // Convert file to base64
      const fileContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const fileType = getFileType(file.type);
      
      return apiRequest(`/api/sessions/${sessionId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name.replace(/[^a-zA-Z0-9.-]/g, '_'),
          originalFileName: file.name,
          fileType,
          mimeType: file.type,
          fileSize: file.size,
          fileContent
        }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/documents`] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => 
      apiRequest(`/api/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/documents`] });
    }
  });

  const getFileType = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('ms-excel')) return 'excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    return 'unknown';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return <File className="h-4 w-4 text-red-500" />;
      case 'excel': return <File className="h-4 w-4 text-green-500" />;
      case 'word': return <FileText className="h-4 w-4 text-blue-500" />;
      default: return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'extracted': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return null;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    
    for (const file of files) {
      const fileType = getFileType(file.type);
      
      if (!['pdf', 'excel', 'word'].includes(fileType)) {
        console.warn(`Unsupported file type: ${file.type}`);
        continue;
      }

      try {
        await uploadMutation.mutateAsync(file as FileWithPreview);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
    
    setUploading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = (document: SessionDocument) => {
    try {
      const byteCharacters = atob(document.fileContent.split(',')[1] || document.fileContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: document.mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-gray-600">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragOver 
            ? 'border-[#4F63A4] bg-blue-50/50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        <CardContent className="p-6 text-center">
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#4F63A4]" />
              <p className="text-sm text-gray-600">Uploading and extracting content...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <p className="text-sm font-medium">Upload documents</p>
              <p className="text-xs text-gray-500">
                Drag & drop or click to select PDF, Excel, or Word files
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.docx,.doc"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-gray-700">Uploaded Documents</h3>
          {documents.map((doc: SessionDocument) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(doc.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.originalFileName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">
                          {doc.fileType.toUpperCase()}
                        </Badge>
                        {getStatusIcon(doc.extractionStatus)}
                        <span className="capitalize">{doc.extractionStatus}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {doc.extractedText && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Extracted Content - {doc.originalFileName}</DialogTitle>
                          </DialogHeader>
                          <div className="max-h-96 overflow-y-auto">
                            <Textarea 
                              value={doc.extractedText} 
                              readOnly 
                              className="min-h-64 resize-none"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                
                {doc.extractionError && (
                  <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded">
                    {doc.extractionError}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}