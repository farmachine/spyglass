import { useState } from "react";
import { Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExtractionStep } from "@/hooks/useExtractionSteps";

interface StepBlockProps {
  step: ExtractionStep;
  onEdit?: (step: ExtractionStep) => void;
  onDelete?: (step: ExtractionStep) => void;
}

export default function StepBlock({ step, onEdit, onDelete }: StepBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0 h-auto hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-orange-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-orange-600" />
              )}
            </Button>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                Step {step.orderIndex}
              </Badge>
              <CardTitle className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                {step.stepName}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(step)}
                className="h-8 w-8 p-0 hover:bg-orange-200 dark:hover:bg-orange-800"
              >
                <Edit className="h-4 w-4 text-orange-600" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(step)}
                className="h-8 w-8 p-0 hover:bg-red-200 dark:hover:bg-red-800"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                Description
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {step.stepDescription}
              </p>
            </div>
            
            <div className="border-t border-orange-200 dark:border-orange-800 pt-4">
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                Fields & Collections in this Step
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                Fields and collections will appear here when assigned to this step.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}