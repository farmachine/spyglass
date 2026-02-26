import { useState, useEffect, useRef } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { FaFilePdf, FaFileWord, FaFileExcel } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { renderAsync } from "docx-preview";

interface DocumentPreviewProps {
  document: {
    id: string;
    fileName: string;
    mimeType: string | null;
    extractedContent: string | null;
    s3Key: string | null;
  };
  sessionId: string;
  onClose: () => void;
}

type PreviewState = "loading" | "raw" | "docx" | "text" | "error";

function getFileIcon(mimeType: string | null, fileName: string) {
  if (mimeType?.includes("pdf") || fileName?.endsWith(".pdf")) {
    return <FaFilePdf className="w-4 h-4 text-red-600" />;
  }
  if (mimeType?.includes("word") || mimeType?.includes("document") || fileName?.endsWith(".docx") || fileName?.endsWith(".doc")) {
    return <FaFileWord className="w-4 h-4 text-blue-600" />;
  }
  if (mimeType?.includes("excel") || mimeType?.includes("spreadsheet") || fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls")) {
    return <FaFileExcel className="w-4 h-4 text-green-600" />;
  }
  return <FileText className="w-4 h-4 text-gray-400" />;
}

function isPdf(mimeType: string | null, fileName: string): boolean {
  return !!(mimeType?.includes("pdf") || fileName?.endsWith(".pdf"));
}

function isImage(mimeType: string | null): boolean {
  return !!mimeType?.startsWith("image/");
}

function isDocx(fileName: string): boolean {
  return !!fileName?.toLowerCase().endsWith(".docx");
}

function isWord(mimeType: string | null, fileName: string): boolean {
  return !!(mimeType?.includes("word") || mimeType?.includes("document") ||
            fileName?.endsWith(".docx") || fileName?.endsWith(".doc"));
}

export default function DocumentPreview({ document, sessionId, onClose }: DocumentPreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxData, setDocxData] = useState<ArrayBuffer | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRawFile() {
      // Only attempt raw file fetch for PDFs, images, and Word documents
      if (!isPdf(document.mimeType, document.fileName) && !isImage(document.mimeType) && !isWord(document.mimeType, document.fileName)) {
        setPreviewState(document.extractedContent ? "text" : "error");
        return;
      }

      setPreviewState("loading");
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch(
          `/api/sessions/documents/${document.id}/file?sessionId=${sessionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          // Raw file not available — fall back to extracted text
          if (!cancelled) {
            setPreviewState(document.extractedContent ? "text" : "error");
          }
          return;
        }

        if (!cancelled) {
          // For .docx files, use docx-preview renderer
          if (isDocx(document.fileName)) {
            const arrayBuffer = await response.arrayBuffer();
            setDocxData(arrayBuffer);
            setPreviewState("docx");
          } else {
            // PDF/images/legacy .doc — use blob URL
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
            setPreviewState("raw");
          }
        }
      } catch {
        if (!cancelled) {
          setPreviewState(document.extractedContent ? "text" : "error");
        }
      }
    }

    loadRawFile();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [document.id]);

  // Render docx-preview when state is "docx" and container is ready
  useEffect(() => {
    if (previewState === "docx" && docxData && docxContainerRef.current) {
      docxContainerRef.current.innerHTML = "";
      renderAsync(docxData, docxContainerRef.current, undefined, {
        className: "docx",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: true,
        breakPages: true,
      }).catch(() => {
        // If docx-preview fails, fall back to extracted text
        setPreviewState(document.extractedContent ? "text" : "error");
      });
    }
  }, [previewState, docxData]);

  // Clean up blob URL when component unmounts or document changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getFileIcon(document.mimeType, document.fileName)}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={document.fileName}>
            {document.fileName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {previewState === "loading" && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#4F63A4]" />
              <p className="text-sm text-gray-500 mt-2">Loading preview...</p>
            </div>
          </div>
        )}

        {previewState === "raw" && blobUrl && isPdf(document.mimeType, document.fileName) && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title={`Preview of ${document.fileName}`}
          />
        )}

        {previewState === "raw" && blobUrl && isImage(document.mimeType) && (
          <div className="flex items-center justify-center h-full p-4 overflow-auto">
            <img
              src={blobUrl}
              alt={document.fileName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {previewState === "docx" && (
          <div className="h-full overflow-auto docx-preview-container">
            <div ref={docxContainerRef} />
          </div>
        )}

        {previewState === "text" && document.extractedContent && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Extracted text content
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-mono">
                {document.extractedContent}
              </div>
            </div>
          </ScrollArea>
        )}

        {previewState === "error" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Preview not available</p>
              <p className="text-xs text-gray-400 mt-1">
                This document has no extractable content or raw file.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
