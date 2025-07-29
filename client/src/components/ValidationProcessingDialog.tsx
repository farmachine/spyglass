import React from "react";
import { CheckCircle } from "lucide-react";
import { WaveIcon } from "@/components/SeaIcons";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ValidationProcessingDialogProps {
  open: boolean;
  processingStep: 'validating' | 'complete';
  processingProgress: number;
}

export default function ValidationProcessingDialog({ 
  open, 
  processingStep, 
  processingProgress 
}: ValidationProcessingDialogProps) {
  return (
    <Dialog open={open} modal={true}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="sr-only">
          <DialogTitle>Validation Processing</DialogTitle>
          <DialogDescription>Applying extraction rules and validation logic</DialogDescription>
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
              {processingStep === 'validating' && 'Validation & Rules'}
              {processingStep === 'complete' && 'Validation Complete'}
            </h3>
            <p className="text-sm text-gray-600">
              {processingStep === 'validating' && 'Applying extraction rules and validation logic...'}
              {processingStep === 'complete' && 'All validation rules processed successfully!'}
            </p>
          </div>

          <div className="w-full mb-4">
            <Progress value={processingProgress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{Math.round(processingProgress)}%</span>
              <span>
                {processingStep === 'validating' && 'Processing...'}
                {processingStep === 'complete' && 'Done!'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className={`flex items-center ${processingStep !== 'validating' ? 'text-green-600' : ''}`}>
              {processingStep === 'validating' ? (
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              Validate
            </div>
            <div className={`flex items-center ${processingStep === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
              {processingStep === 'complete' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <div className="h-3 w-3 border border-gray-300 rounded-full mr-1" />
              )}
              Complete
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}