import { CheckCircle, AlertCircle, Clock, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { ValidationStatus } from "@shared/schema";

interface ValidationIconProps {
  status: ValidationStatus;
  reasoning?: string | null;
  confidenceScore?: number;
  onManualEdit?: () => void;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  isEmpty?: boolean; // New prop to indicate if the field value is empty
}

export default function ValidationIcon({
  status,
  reasoning,
  confidenceScore = 0,
  onManualEdit,
  showTooltip = true,
  size = "md",
  isEmpty = false
}: ValidationIconProps) {
  const getStatusIcon = () => {
    const iconSizes = {
      sm: "h-3 w-3",
      md: "h-4 w-4", 
      lg: "h-5 w-5"
    };
    const iconSize = iconSizes[size];

    switch (status) {
      case "valid":
        return <CheckCircle className={`${iconSize} text-success`} />;
      case "invalid":
        return <AlertCircle className={`${iconSize} text-destructive`} />;
      case "manual":
        return <Edit2 className={`${iconSize} text-primary`} />;
      case "pending":
      default:
        return <Clock className={`${iconSize} text-muted-foreground`} />;
    }
  };

  const getStatusBadge = () => {
    const badgeVariants = {
      valid: "bg-success/10 text-success border-success/20",
      invalid: "bg-destructive/10 text-destructive border-destructive/20", 
      manual: "bg-primary/10 text-primary border-primary/20",
      pending: "bg-muted text-muted-foreground border-border"
    };

    const statusLabels = {
      valid: "Valid",
      invalid: "Invalid",
      manual: "Manual",
      pending: "Pending"
    };

    return (
      <Badge 
        variant="outline" 
        className={`${badgeVariants[status]} text-xs`}
      >
        {statusLabels[status]}
      </Badge>
    );
  };

  const getTooltipContent = () => {
    return (
      <div className="space-y-2 max-w-sm">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">
            {status === "valid" && "Valid Field"}
            {status === "invalid" && "Invalid Field"}
            {status === "manual" && "Manually Verified"}
            {status === "pending" && "Pending Validation"}
          </span>
        </div>
        
        {reasoning && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">AI Reasoning:</span>
            <p className="mt-1">{reasoning}</p>
          </div>
        )}
        
        {confidenceScore > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Confidence:</span> {confidenceScore}%
          </div>
        )}
        
        {onManualEdit && (isEmpty || status === "invalid" || status === "pending") && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onManualEdit}
            className="w-full mt-2"
          >
            <Edit2 className="h-3 w-3 mr-1" />
            {isEmpty ? "Enter Value" : (status === "pending" ? "Enter Value" : "Edit Manually")}
          </Button>
        )}
      </div>
    );
  };

  if (!showTooltip) {
    return getStatusIcon();
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-1"
            onClick={(isEmpty || status === "invalid" || status === "pending") ? onManualEdit : undefined}
          >
            {getStatusIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Progress indicator component
interface ValidationProgressProps {
  totalFields: number;
  validFields: number;
  invalidFields: number;
  pendingFields: number;
  manualFields: number;
}

export function ValidationProgress({
  totalFields,
  validFields,
  invalidFields,
  pendingFields,
  manualFields
}: ValidationProgressProps) {
  const completionPercentage = totalFields > 0 ? Math.round(((validFields + manualFields) / totalFields) * 100) : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Validation Progress</span>
        <span className="text-sm text-gray-600">{completionPercentage}% Complete</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-success h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-success" />
          <span>{validFields + manualFields} Valid</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>{invalidFields} Invalid</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>{pendingFields} Pending</span>
        </div>
      </div>
    </div>
  );
}