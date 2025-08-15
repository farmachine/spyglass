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
import { Plus, X, Key, FileText, Brain, Settings } from "lucide-react";
import type { CollectionProperty, KnowledgeDocument, ExtractionRule, ExcelWizardryFunction } from "@shared/schema";

const propertyTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const propertyFormSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  propertyType: z.enum(propertyTypes),
  description: z.string().min(1, "Prompt is required - this helps the AI understand what to extract"),
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
});

type PropertyForm = z.infer<typeof propertyFormSchema>;

interface PropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PropertyForm) => Promise<void>;
  property?: CollectionProperty | null;
  isLoading?: boolean;
  collectionName?: string;
  knowledgeDocuments?: KnowledgeDocument[];
  extractionRules?: ExtractionRule[];
  wizardryFunctions?: ExcelWizardryFunction[];
}

export default function PropertyDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  property, 
  isLoading = false,
  collectionName = "Collection",
  knowledgeDocuments = [],
  extractionRules = [],
  wizardryFunctions = []
}: PropertyDialogProps) {
  const form = useForm<PropertyForm>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      propertyName: "",
      propertyType: "TEXT",
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

  // Reset form with new values when property prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        propertyName: property?.propertyName || "",
        propertyType: (property?.propertyType as typeof propertyTypes[number]) || "TEXT",
        description: property?.description || "",
        extractionType: (property?.extractionType as "AI" | "FUNCTION") || "AI",
        knowledgeDocumentIds: property?.knowledgeDocumentIds as string[] || [],
        extractionRuleIds: property?.extractionRuleIds as string[] || [],
        documentsRequired: property?.documentsRequired ?? true,
        functionId: property?.functionId || undefined,
        requiredDocumentType: property?.requiredDocumentType as "Excel" | "Word" | "PDF" || undefined,
        autoVerificationConfidence: property?.autoVerificationConfidence || 80,
        choiceOptions: property?.choiceOptions as string[] || [],
        orderIndex: property?.orderIndex || 0,
      });
    }
  }, [property, open, form]);

  const handleSubmit = async (data: PropertyForm) => {
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
          <DialogTitle className="flex items-center gap-2">
            {property ? "Edit Property" : "Add Property"}
            {property?.isIdentifier && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                <Key className="h-3 w-3 mr-1" />
                Identifier Field
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {property?.isIdentifier 
              ? `Editing the identifier field for "${collectionName}" collection. This field uniquely identifies items in the collection and must remain as TEXT type.`
              : `Add a property to the "${collectionName}" collection. The description helps the AI understand what data to extract for this property.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="propertyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Name, Salary, Date of Birth" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={property?.isIdentifier}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      {!property?.isIdentifier && <SelectItem value="NUMBER">Number</SelectItem>}
                      {!property?.isIdentifier && <SelectItem value="DATE">Date</SelectItem>}
                      {!property?.isIdentifier && <SelectItem value="CHOICE">Choice</SelectItem>}
                    </SelectContent>
                  </Select>
                  {property?.isIdentifier && (
                    <p className="text-sm text-muted-foreground">
                      Identifier fields must be TEXT type and cannot be changed.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Choice Options - only show for CHOICE property type */}
            {form.watch("propertyType") === "CHOICE" && (
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
                      Define the possible values for this choice property. Press Enter or click + to add options.
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
                  <FormLabel>Prompt *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell the AI what to look for (e.g., 'The employee's full name as listed in the document' or 'Annual salary amount in dollars')"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    This prompt guides the AI during data extraction
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Extraction Configuration */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Extraction Configuration
              </h3>
              
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
                          Reference documents to guide AI extraction for this property
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
                          Apply specific extraction rules to this property
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
                            Require source documents for this property's extraction
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
                <div className="space-y-4 pl-4 border-l-2 border-green-200">
                  <h4 className="font-medium text-green-700 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Function Configuration
                  </h4>
                  
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
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a function..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {wizardryFunctions.map((func) => (
                                    <SelectItem key={func.id} value={func.id}>
                                      <div className="space-y-1">
                                        <div className="font-medium">{func.name}</div>
                                        <div className="text-sm text-muted-foreground">{func.description}</div>
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
                </div>
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
                {isLoading ? "Saving..." : property ? "Update Property" : "Add Property"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}