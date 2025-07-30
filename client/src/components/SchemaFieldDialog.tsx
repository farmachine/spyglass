import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import type { ProjectSchemaField } from "@shared/schema";

const fieldTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const schemaFieldFormSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  fieldType: z.enum(fieldTypes),
  description: z.string().min(1, "Description is required - this helps the AI understand what to extract"),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  choiceOptions: z.array(z.string()).optional(),
  orderIndex: z.number().default(0),
});

type SchemaFieldForm = z.infer<typeof schemaFieldFormSchema>;

interface SchemaFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SchemaFieldForm) => Promise<void>;
  field?: ProjectSchemaField | null;
  isLoading?: boolean;
}

export default function SchemaFieldDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  field, 
  isLoading = false 
}: SchemaFieldDialogProps) {
  const form = useForm<SchemaFieldForm>({
    resolver: zodResolver(schemaFieldFormSchema),
    defaultValues: {
      fieldName: "",
      fieldType: "TEXT",
      description: "",
      autoVerificationConfidence: 80,
      choiceOptions: [],
      orderIndex: 0,
    },
  });

  // Reset form with new values when field prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        fieldName: field?.fieldName || "",
        fieldType: (field?.fieldType as typeof fieldTypes[number]) || "TEXT",
        description: field?.description || "",
        autoVerificationConfidence: field?.autoVerificationConfidence || 80,
        choiceOptions: field?.choiceOptions as string[] || [],
        orderIndex: field?.orderIndex || 0,
      });
    }
  }, [field, open, form]);

  const handleSubmit = async (data: SchemaFieldForm) => {
    try {
      await onSave(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {field ? "Edit Schema Field" : "Add Schema Field"}
          </DialogTitle>
          <DialogDescription>
            Define a global field that applies to the entire document set. The description helps the AI understand what to look for during extraction.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fieldName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Company Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fieldType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                      <SelectItem value="CHOICE">Choice</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Choice Options - only show for CHOICE field type */}
            {form.watch("fieldType") === "CHOICE" && (
              <FormField
                control={form.control}
                name="choiceOptions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Choice Options</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {field.value?.map((option, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {option}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => {
                                  const newOptions = [...(field.value || [])];
                                  newOptions.splice(index, 1);
                                  field.onChange(newOptions);
                                }}
                              />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add choice option..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.target as HTMLInputElement;
                                const newOption = input.value.trim();
                                if (newOption && !field.value?.includes(newOption)) {
                                  field.onChange([...(field.value || []), newOption]);
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                              const newOption = input?.value.trim();
                              if (newOption && !field.value?.includes(newOption)) {
                                field.onChange([...(field.value || []), newOption]);
                                input.value = '';
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Define the possible values for this choice field. Press Enter or click + to add options.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell the AI what to look for in this field (e.g., 'The company name as it appears in the document header')"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    This description guides the AI during data extraction
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="autoVerificationConfidence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto Verification Confidence Level (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      max={100} 
                      placeholder="80"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Fields with confidence at or above this threshold will be automatically verified after extraction
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className=""
              >
                {isLoading ? "Saving..." : field ? "Update Field" : "Add Field"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}