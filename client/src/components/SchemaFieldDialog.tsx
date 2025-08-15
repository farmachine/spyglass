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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, FileText, Brain, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectSchemaField, KnowledgeDocument, ExtractionRule, ExcelWizardryFunction } from "@shared/schema";

const fieldTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const schemaFieldFormSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  fieldType: z.enum(fieldTypes),
  description: z.string().optional(),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  choiceOptions: z.array(z.string()).optional(),
  orderIndex: z.number().default(0),
  // New extraction configuration fields
  extractionType: z.enum(["AI", "FUNCTION"]).default("AI"),
  knowledgeDocumentIds: z.array(z.string()).optional(),
  extractionRuleIds: z.array(z.string()).optional(),
  documentsRequired: z.boolean().default(true),
  functionId: z.string().optional(),
  requiredDocumentType: z.enum(["Excel", "Word", "PDF"]).optional(),
}).refine((data) => {
  // Only require description for AI extraction
  if (data.extractionType === "AI" && !data.description?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Prompt is required for AI extraction",
  path: ["description"],
});

type SchemaFieldForm = z.infer<typeof schemaFieldFormSchema>;

interface SchemaFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SchemaFieldForm) => Promise<void>;
  field?: ProjectSchemaField | null;
  isLoading?: boolean;
  knowledgeDocuments?: KnowledgeDocument[];
  extractionRules?: ExtractionRule[];
  wizardryFunctions?: ExcelWizardryFunction[];
}

export default function SchemaFieldDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  field, 
  isLoading = false,
  knowledgeDocuments = [],
  extractionRules = [],
  wizardryFunctions = []
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
      extractionType: "AI",
      knowledgeDocumentIds: [],
      extractionRuleIds: [],
      documentsRequired: true,
      functionId: undefined,
      requiredDocumentType: undefined,
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
        extractionType: (field?.extractionType as "AI" | "FUNCTION") || "AI",
        knowledgeDocumentIds: field?.knowledgeDocumentIds as string[] || [],
        extractionRuleIds: field?.extractionRuleIds as string[] || [],
        documentsRequired: field?.documentsRequired ?? true,
        functionId: field?.functionId || undefined,
        requiredDocumentType: field?.requiredDocumentType as "Excel" | "Word" | "PDF" || undefined,
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
            {/* Extraction Type - Moved to top for easy toggling */}
            <FormField
              control={form.control}
              name="extractionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extraction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select extraction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AI">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          AI Extraction
                        </div>
                      </SelectItem>
                      <SelectItem value="FUNCTION">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Function-based Extraction
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormLabel>{form.watch("extractionType") === "FUNCTION" ? "Description" : "Prompt *"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={form.watch("extractionType") === "FUNCTION" 
                        ? "Optional description of this field for documentation" 
                        : "Tell the AI what to look for in this field (e.g., 'The company name as it appears in the document header')"
                      }
                      className="resize-none"
                      rows={3}
                      {...field}
                      required={form.watch("extractionType") === "AI"}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    {form.watch("extractionType") === "FUNCTION" 
                      ? "Optional field description for documentation purposes"
                      : "This prompt guides the AI during data extraction"
                    }
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Extraction Configuration */}
            <div className="space-y-4 border-t pt-4">
              {/* AI Extraction Configuration */}
              {form.watch("extractionType") === "AI" && (
                <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                  <h4 className="font-medium text-blue-700 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Configuration
                  </h4>
                  
                  {/* Knowledge Documents */}
                  <FormField
                    control={form.control}
                    name="knowledgeDocumentIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Knowledge Documents</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {field.value?.map((docId) => {
                                const doc = knowledgeDocuments.find(d => d.id === docId);
                                return doc ? (
                                  <Badge key={docId} variant="secondary" className="flex items-center gap-1">
                                    {doc.displayName}
                                    <X 
                                      className="h-3 w-3 cursor-pointer" 
                                      onClick={() => {
                                        const newDocs = field.value?.filter(id => id !== docId) || [];
                                        field.onChange(newDocs);
                                      }}
                                    />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                            <Select onValueChange={(value) => {
                              if (!field.value?.includes(value)) {
                                field.onChange([...(field.value || []), value]);
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select knowledge documents..." />
                              </SelectTrigger>
                              <SelectContent>
                                {knowledgeDocuments.filter(doc => !field.value?.includes(doc.id)).map((doc) => (
                                  <SelectItem key={doc.id} value={doc.id}>
                                    {doc.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Reference documents to guide AI extraction for this field
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Extraction Rules */}
                  <FormField
                    control={form.control}
                    name="extractionRuleIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extraction Rules</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {field.value?.map((ruleId) => {
                                const rule = extractionRules.find(r => r.id === ruleId);
                                return rule ? (
                                  <Badge key={ruleId} variant="secondary" className="flex items-center gap-1">
                                    {rule.ruleName}
                                    <X 
                                      className="h-3 w-3 cursor-pointer" 
                                      onClick={() => {
                                        const newRules = field.value?.filter(id => id !== ruleId) || [];
                                        field.onChange(newRules);
                                      }}
                                    />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                            <Select onValueChange={(value) => {
                              if (!field.value?.includes(value)) {
                                field.onChange([...(field.value || []), value]);
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select extraction rules..." />
                              </SelectTrigger>
                              <SelectContent>
                                {extractionRules.filter(rule => !field.value?.includes(rule.id)).map((rule) => (
                                  <SelectItem key={rule.id} value={rule.id}>
                                    {rule.ruleName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Apply specific extraction rules to this field
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Source Documents Required */}
                  <FormField
                    control={form.control}
                    name="documentsRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Source Documents Required</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Require source documents for this field's extraction
                          </p>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Function Extraction Configuration */}
              {form.watch("extractionType") === "FUNCTION" && (
                <>
                  {/* Required Document Type */}
                  <FormField
                    control={form.control}
                    name="requiredDocumentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Document Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Excel">Excel (.xlsx, .xls)</SelectItem>
                            <SelectItem value="Word">Word (.docx, .doc)</SelectItem>
                            <SelectItem value="PDF">PDF (.pdf)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Function Selection */}
                  <FormField
                    control={form.control}
                    name="functionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Function</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {wizardryFunctions.length > 0 ? (
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger className="h-auto min-h-[50px] border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500">
                                  <SelectValue placeholder="Select a pre-built function..." className="text-gray-500" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[450px]">
                                  {wizardryFunctions.map((func) => (
                                    <SelectItem key={func.id} value={func.id} className="h-auto py-4 px-3 cursor-pointer hover:bg-blue-50 focus:bg-blue-50">
                                      <div className="space-y-2">
                                        <div className="font-semibold text-base text-blue-900 flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-blue-600" />
                                          {func.name}
                                        </div>
                                        <div className="text-sm text-gray-600 whitespace-normal leading-relaxed max-w-[400px] pl-6">
                                          {func.description}
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground border rounded p-3">
                                No functions available. Functions are created automatically during the extraction process.
                              </p>
                            )}
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Select a pre-built function for data extraction
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            
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