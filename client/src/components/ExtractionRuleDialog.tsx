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
import type { ExtractionRule } from "@shared/schema";

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
}

const RULE_TYPES = [
  { value: "validation", label: "Validation Rule", description: "Check data accuracy and completeness" },
  { value: "formatting", label: "Formatting Rule", description: "Standardize data format and structure" },
  { value: "classification", label: "Classification Rule", description: "Categorize and classify extracted data" },
];

export default function ExtractionRuleDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  rule,
  isLoading = false 
}: ExtractionRuleDialogProps) {
  const form = useForm<ExtractionRuleForm>({
    resolver: zodResolver(extractionRuleFormSchema),
    defaultValues: {
      ruleName: rule?.ruleName || "",
      ruleType: rule?.ruleType || "validation",
      targetField: rule?.targetField || "",
      ruleContent: rule?.ruleContent || "",
      isActive: rule?.isActive ?? true,
    },
  });

  const selectedRuleType = form.watch("ruleType");
  const selectedRuleTypeInfo = RULE_TYPES.find(type => type.value === selectedRuleType);

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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ruleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Date Format Validation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ruleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rule type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RULE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-sm text-gray-500">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRuleTypeInfo && (
                    <p className="text-sm text-gray-600">
                      {selectedRuleTypeInfo.description}
                    </p>
                  )}
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
                  <FormControl>
                    <Input
                      placeholder="Leave empty to apply to all fields"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    Specify a field or property name to apply this rule to a specific field only.
                  </p>
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