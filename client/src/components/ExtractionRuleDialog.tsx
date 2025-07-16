import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertExtractionRuleSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useProjectSchemaFields, useObjectCollections, useAllProjectProperties } from "@/hooks/useSchema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ExtractionRule, ProjectWithDetails } from "@shared/schema";

const extractionRuleFormSchema = insertExtractionRuleSchema.omit({ projectId: true }).extend({
  ruleContent: z.string().min(1, "Rule content is required to guide AI extraction"),
  targetFields: z.array(z.string()).optional(),
}).omit({ targetField: true });

type ExtractionRuleForm = z.infer<typeof extractionRuleFormSchema>;

interface ExtractionRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ExtractionRuleForm) => Promise<void>;
  rule?: ExtractionRule | null;
  isLoading?: boolean;
  project: ProjectWithDetails;
}

export default function ExtractionRuleDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  rule,
  isLoading = false,
  project
}: ExtractionRuleDialogProps) {
  // Fetch schema fields and all project properties
  const { data: schemaFields = [] } = useProjectSchemaFields(project.id);
  const { data: allProperties = [] } = useAllProjectProperties(project.id);

  const form = useForm<ExtractionRuleForm>({
    resolver: zodResolver(extractionRuleFormSchema),
    defaultValues: {
      ruleName: "",
      targetFields: [],
      ruleContent: "",
      isActive: true,
    },
  });

  // Reset form with new values when rule prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        ruleName: rule?.ruleName || "",
        targetFields: rule?.targetField ? 
          (rule.targetField === "" ? [] : rule.targetField.split(", ").filter(f => f.trim() !== "")) : 
          [],
        ruleContent: rule?.ruleContent || "",
        isActive: rule?.isActive ?? true,
      });
    }
  }, [rule, open, form]);

  // Build target field options from project schema and collection properties
  const targetFieldOptions = useMemo(() => [
    // Project schema fields
    ...schemaFields.map(field => ({
      value: field.fieldName,
      label: field.fieldName,
    })),
    // Collection properties  
    ...allProperties.map(property => ({
      value: `${property.collectionName} --> ${property.propertyName}`,
      label: `${property.collectionName} --> ${property.propertyName}`,
    })),
  ], [schemaFields, allProperties]);

  const handleSubmit = async (data: ExtractionRuleForm) => {
    try {
      // Convert targetFields array back to single targetField for storage
      const processedData = {
        ...data,
        targetField: data.targetFields && data.targetFields.length > 0 ? 
          data.targetFields.join(", ") : 
          ""
      };
      // Remove targetFields from the processed data
      delete (processedData as any).targetFields;
      await onSave(processedData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save extraction rule:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {rule ? "Edit Extraction Rule" : "Create Extraction Rule"}
          </DialogTitle>
          <DialogDescription>
            Define custom rules to guide AI data extraction, validation, and formatting.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ruleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter rule name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="targetFields"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Fields (Optional)</FormLabel>
                  <div className="space-y-2">
                    {/* Selected fields display */}
                    {field.value && field.value.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {field.value.map((selectedField) => (
                          <Badge 
                            key={selectedField} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {targetFieldOptions.find(opt => opt.value === selectedField)?.label || selectedField}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => {
                                const newValue = field.value?.filter(f => f !== selectedField) || [];
                                field.onChange(newValue);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Add field selector */}
                    <Select 
                      onValueChange={(value) => {
                        if (value && !field.value?.includes(value)) {
                          const newValue = [...(field.value || []), value];
                          field.onChange(newValue);
                        }
                      }}
                      value=""
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Add target field" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targetFieldOptions
                          .filter(option => !field.value?.includes(option.value))
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormDescription>
                    Choose specific fields this rule applies to, or leave empty for all fields
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ruleContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Example: 'Dates must be in YYYY-MM-DD format. If date is written as MM/DD/YYYY, convert it to the standard format. Reject invalid dates and flag for manual review.'"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    Required. Describe the exact rule logic for the AI to follow during extraction.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Rule</FormLabel>
                    <div className="text-sm text-gray-500">
                      Enable this rule for active extraction sessions
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}