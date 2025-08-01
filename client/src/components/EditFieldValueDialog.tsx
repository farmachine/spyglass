import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";
import type { FieldValidation, FieldValidationWithName } from "@shared/schema";

interface EditFieldValueDialogProps {
  open: boolean;
  onClose: () => void;
  validation: FieldValidationWithName | null;
  onSave: (validationId: string, newValue: string, newStatus: string) => void;
  onVerificationToggle?: (fieldName: string, isVerified: boolean) => void;
  schemaField?: { fieldType: string; choiceOptions?: string[] } | null;
  collectionProperty?: { propertyType: string; choiceOptions?: string[] } | null;
}

export function EditFieldValueDialog({ 
  open, 
  onClose, 
  validation, 
  onSave,
  onVerificationToggle,
  schemaField,
  collectionProperty
}: EditFieldValueDialogProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("manual");
  const [isVerified, setIsVerified] = useState(false);

  // Reset form when validation changes or dialog opens
  useEffect(() => {
    if (validation) {
      setValue(validation.extractedValue || "");
      setStatus(validation.validationStatus || "manual");
      setIsVerified(validation.validationStatus === 'verified' || validation.validationStatus === 'valid');
    }
  }, [validation, open]);

  const handleSave = () => {
    if (!validation) return;
    
    // Determine status based on verification toggle state
    const finalStatus = isVerified ? "verified" : "manual";
    onSave(validation.id, value, finalStatus);
    onClose();
  };

  const getFieldDisplayName = (validation: FieldValidationWithName) => {
    if (validation.fieldType === "schema_field") {
      // For schema fields, extract the field name from fieldName property
      const parts = validation.fieldName?.split('.');
      return parts?.[parts.length - 1] || validation.fieldId || "Schema Field";
    } else {
      // For collection properties, show a cleaner name
      const parts = validation.fieldName?.split('.');
      if (parts && parts.length >= 2) {
        const collectionName = parts[0];
        const propertyName = parts[1].replace(/\[\d+\]$/, ""); // Remove index like [0]
        const index = validation.recordIndex !== null && validation.recordIndex !== undefined ? validation.recordIndex + 1 : "";
        return `${collectionName} ${index ? `#${index}` : ""} - ${propertyName}`;
      }
      return validation.fieldId || "Collection Property";
    }
  };

  const getFieldType = (validation: FieldValidationWithName) => {
    // Check if we have schema field or collection property data
    const fieldType = schemaField?.fieldType || collectionProperty?.propertyType;
    if (fieldType === "CHOICE") return "choice";
    if (fieldType === "DATE") return "date";
    if (fieldType === "NUMBER") return "number";
    
    // Fallback to detection from field name for legacy data
    const fieldName = validation.fieldName?.toLowerCase() || "";
    const extractedValue = validation.extractedValue || "";
    
    if (fieldName.includes("date") || fieldName.includes("time")) return "date";
    if (fieldName.includes("email")) return "email";
    if (fieldName.includes("phone") || fieldName.includes("tel")) return "tel";
    if (fieldName.includes("url") || fieldName.includes("website")) return "url";
    if (fieldName.includes("description") || fieldName.includes("notes") || fieldName.includes("comment")) return "textarea";
    
    // Check if the extracted value is long enough to warrant a textarea
    if (extractedValue.length > 50 || extractedValue.includes('\n')) return "textarea";
    
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
            {fieldType === "choice" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {(schemaField?.choiceOptions || collectionProperty?.choiceOptions || []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fieldType === "textarea" ? (
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

          {validation.aiReasoning ? (
            <div className="p-3 bg-blue-50 rounded-lg">
              <Label className="text-xs font-medium text-blue-800">AI Analysis</Label>
              <p className="text-xs text-blue-700 mt-1">{validation.aiReasoning}</p>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-lg">
              <Label className="text-xs font-medium text-amber-800">Why wasn't this extracted?</Label>
              <p className="text-xs text-amber-700 mt-1">
                The AI couldn't find this information in the document. This could be because:
                • The data isn't present in the source document
                • The information is in a format the AI couldn't recognize
                • The field name doesn't match the document content
                
                You can manually enter the correct value if you know it.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsVerified(!isVerified)}
                className="flex items-center justify-center hover:bg-gray-100 px-3 py-2 rounded transition-colors"
                title={isVerified ? "Click to mark as unverified" : "Click to mark as verified"}
              >
                {isVerified ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                className="bg-primary hover:bg-primary/90"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}