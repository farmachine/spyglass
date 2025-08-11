import { useQuery } from "@tanstack/react-query";
import { FileText, FileSpreadsheet, FileImage, File, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SessionDocument {
  id: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number | null;
  extractionStatus: 'pending' | 'extracted' | 'failed';
  extractionError: string | null;
  uploadedAt: string;
  processedAt: string | null;
}

interface SessionDocumentsProps {
  sessionId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileType: string, mimeType: string) {
  if (fileType === 'pdf' || mimeType.includes('pdf')) {
    return <FileText className="h-4 w-4 text-red-600" />;
  }
  if (fileType === 'excel' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  }
  if (fileType === 'word' || mimeType.includes('document') || mimeType.includes('word')) {
    return <FileText className="h-4 w-4 text-blue-600" />;
  }
  if (mimeType.includes('image')) {
    return <FileImage className="h-4 w-4 text-purple-600" />;
  }
  return <File className="h-4 w-4 text-gray-600" />;
}

function getStatusBadge(status: string, error: string | null) {
  switch (status) {
    case 'extracted':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Extracted
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" title={error || 'Unknown error'}>
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'pending':
    default:
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
  }
}

export function SessionDocuments({ sessionId }: SessionDocumentsProps) {
  const { data: documents, isLoading, error } = useQuery<SessionDocument[]>({
    queryKey: ["/api/sessions", sessionId, "documents"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading documents...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            Failed to load documents: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No documents have been uploaded to this session yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Uploaded Documents ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                {getFileIcon(document.fileType, document.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={document.fileName}>
                    {document.fileName}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span>•</span>
                    <span>{document.fileType.toUpperCase()}</span>
                    <span>•</span>
                    <span>
                      Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(document.extractionStatus, document.extractionError)}
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {documents.filter(d => d.extractionStatus === 'extracted').length} extracted,{' '}
              {documents.filter(d => d.extractionStatus === 'pending').length} processing,{' '}
              {documents.filter(d => d.extractionStatus === 'failed').length} failed
            </span>
            <span>
              Total: {formatFileSize(documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}