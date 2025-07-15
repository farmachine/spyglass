import { Upload, Plus, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectWithDetails } from "@shared/schema";

interface NewUploadProps {
  project: ProjectWithDetails;
}

export default function NewUpload({ project }: NewUploadProps) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">New Upload</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload documents to extract data for this project
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add More Documents
        </Button>
      </div>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-sm text-gray-500">
              Supports PDF, DOC, DOCX, XLS, XLSX files
            </p>
          </div>

          {/* Sample uploaded files - this would be dynamic */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Uploaded Files</h4>
            <div className="flex flex-wrap gap-3">
              {/* This would be populated from actual uploads */}
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm">
                <FileText className="h-4 w-4" />
                sample_document.pdf
                <button className="text-red-500 hover:text-red-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extraction Status */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">
              <Upload className="h-12 w-12 mx-auto opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No documents uploaded yet
            </h3>
            <p className="text-sm text-gray-600">
              Upload documents to begin data extraction based on your project schema
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
