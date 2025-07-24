import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, FileText, Package, ArrowRight } from "lucide-react";
import type { ExtractionStepWithDetails } from "@shared/schema";

interface StepCardProps {
  step: ExtractionStepWithDetails;
  stepNumber: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function StepCard({ step, stepNumber, onEdit, onDelete }: StepCardProps) {
  const getStepTypeIcon = (stepType: string) => {
    switch (stepType) {
      case "extract":
        return <FileText className="h-4 w-4" />;
      case "transform":
        return <ArrowRight className="h-4 w-4" />;
      case "validate":
        return <Package className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStepTypeColor = (stepType: string) => {
    switch (stepType) {
      case "extract":
        return "bg-blue-100 text-blue-800";
      case "transform":
        return "bg-purple-100 text-purple-800";
      case "validate":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-semibold">
              {stepNumber}
            </div>
            <div>
              <CardTitle className="text-base">{step.stepName}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getStepTypeColor(step.stepType)}`}
                >
                  {getStepTypeIcon(step.stepType)}
                  <span className="ml-1 capitalize">{step.stepType}</span>
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {step.description && (
          <p className="text-sm text-gray-600 mb-3">{step.description}</p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>{step.schemaFields.length} fields</span>
            <span>{step.collections.length} collections</span>
            {step.references.length > 0 && (
              <span>{step.references.length} references</span>
            )}
          </div>
          {step.isConditional && (
            <Badge variant="outline" className="text-xs">
              Conditional
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}