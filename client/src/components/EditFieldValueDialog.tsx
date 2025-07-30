import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldValidation } from "@shared/schema";

interface EditFieldValueDialogProps {
  open: boolean;
  onClose: () => void;
  validation: FieldValidation | null;
  onSave: (validationId: string, newValue: string, newStatus: string) => void;
}

export function EditFieldValueDialog({ 
  open, 
  onClose, 
  validation, 
  onSave 
}: EditFieldValueDialogProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("manual");

  // Reset form when validation changes or dialog opens
  useEffect(() => {
    if (validation) {
      setValue(validation.extractedValue || "");
      setStatus(validation.validationStatus || "manual");
    }
  }, [validation, open]);

  const handleSave = () => {
    if (!validation) return;
    
    onSave(validation.id, value, "manual"); // Always set status to manual when user edits
    onClose();
  };

  const getFieldDisplayName = (validation: FieldValidation) => {
    if (validation.fieldType === "schema_field") {
      return `Schema Field ${validation.fieldId}`;
    } else {
      // For collection properties, show a cleaner name
      const collectionName = validation.collectionName || "Collection";
      const index = validation.recordIndex !== null ? validation.recordIndex + 1 : "";
      return `${collectionName} ${index ? `#${index}` : ""} - Field`;
    }
  };

  const getFieldType = (validation: FieldValidation) => {
    // This would ideally come from the schema, but for now we'll detect from field name
    const fieldName = validation.fieldId?.toLowerCase() || "";
    if (fieldName.includes("date") || fieldName.includes("time")) return "date";
    if (fieldName.includes("email")) return "email";
    if (fieldName.includes("phone") || fieldName.includes("tel")) return "tel";
    if (fieldName.includes("url") || fieldName.includes("website")) return "url";
    if (fieldName.includes("description") || fieldName.includes("notes") || fieldName.includes("comment")) return "textarea";
    return "text";
  };

  if (!validation) return null;

  const fieldType = getFieldType(validation);
  const displayName = getFieldDisplayName(validation);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Field Value</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Field: {displayName}
            </Label>
          </div>

          <div>
            <Label htmlFor="field-value" className="text-sm font-medium">
              Value
            </Label>
            {fieldType === "textarea" ? (
              <Textarea
                id="field-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                className="mt-1"
                rows={3}
                autoFocus
                disabled={false}
              />
            ) : (
              <Input
                id="field-value"
                type={fieldType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                className="mt-1"
                autoFocus
                disabled={false}
              />
            )}
          </div>

          {validation.aiReasoning && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <Label className="text-xs font-medium text-blue-800">AI Analysis</Label>
              <p className="text-xs text-blue-700 mt-1">{validation.aiReasoning}</p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}