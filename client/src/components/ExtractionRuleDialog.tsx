import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertExtractionRuleSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import type { ExtractionRule, ProjectWithDetails } from "@shared/schema";

const extractionRuleFormSchema = insertExtractionRuleSchema.omit({ projectId: true }).extend({
  ruleContent: z.string().min(1, "Rule content is required to guide AI extraction"),
});

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
  const form = useForm<ExtractionRuleForm>({
    resolver: zodResolver(extractionRuleFormSchema),
    defaultValues: {
      ruleName: rule?.ruleName || "",
      targetField: rule?.targetField || "",
      ruleContent: rule?.ruleContent || "",
      isActive: rule?.isActive ?? true,
    },
  });

  // Build target field options from project schema
  const targetFieldOptions = [
    // Project schema fields
    ...project.schemaFields.map(field => ({
      value: field.fieldName,
      label: field.fieldName,
    })),
    // Collection properties
    ...project.collections.flatMap(collection =>
      collection.properties.map(property => ({
        value: `${collection.collectionName} --> ${property.propertyName}`,
        label: `${collection.collectionName} --> ${property.propertyName}`,
      }))
    ),
  ];

  const handleSubmit = async (data: ExtractionRuleForm) => {
    try {
      await onSave(data);
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
              name="targetField"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Field (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target field" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None (applies to all fields)</SelectItem>
                      {targetFieldOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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