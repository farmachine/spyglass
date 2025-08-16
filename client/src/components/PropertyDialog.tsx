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

// Dynamic Function Parameters Component
interface DynamicFunctionParametersProps {
  functionId: string;
  wizardryFunctions: ExcelWizardryFunction[];
  value: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
}

function DynamicFunctionParameters({ functionId, wizardryFunctions, value, onChange }: DynamicFunctionParametersProps) {
  const selectedFunction = wizardryFunctions.find(f => f.id === functionId);
  
  if (!selectedFunction || !selectedFunction.inputParameters) {
    return null;
  }

  const inputParameters = Array.isArray(selectedFunction.inputParameters) 
    ? selectedFunction.inputParameters 
    : [];

  if (inputParameters.length === 0) {
    return null;
  }

  const handleParameterChange = (paramName: string, paramValue: any) => {
    onChange({
      ...value,
      [paramName]: paramValue
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-gray-600" />
        <h4 className="font-medium text-gray-800">Function Parameters</h4>
      </div>
      <p className="text-sm text-gray-600">
        Configure the input parameters for "{selectedFunction.name}"
      </p>
      
      <div className="space-y-3">
        {inputParameters.map((param: any, index: number) => (
          <div key={param.name || index} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              @{param.name}
              <span className="text-xs text-gray-500 ml-2">({param.type})</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">{param.description}</p>
            
            {param.type === "text" ? (
              <Input
                value={value[param.name] || ""}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                placeholder={`Enter value for ${param.name}`}
                className="w-full"
              />
            ) : param.type === "document" ? (
              <Select 
                value={value[param.name] || ""} 
                onValueChange={(val) => handleParameterChange(param.name, val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select document for ${param.name}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uploaded_document">Use Uploaded Document</SelectItem>
                  <SelectItem value="field_reference">Reference Another Field</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Textarea
                value={value[param.name] || ""}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                placeholder={`Enter value for ${param.name}`}
                rows={2}
                className="w-full resize-none"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const propertyTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const propertyFormSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  propertyType: z.enum(propertyTypes),
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
  functionParameters: z.record(z.string(), z.any()).optional(), // Dynamic parameters based on function metadata
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
      functionParameters: {},
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
        functionParameters: (property as any)?.functionParameters || {},
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
                  <FormLabel>{form.watch("extractionType") === "FUNCTION" ? "Description" : "Prompt *"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={form.watch("extractionType") === "FUNCTION" 
                        ? "Optional description of this property for documentation" 
                        : "Tell the AI what to look for (e.g., 'The employee's full name as listed in the document' or 'Annual salary amount in dollars')"
                      }
                      className="resize-none"
                      rows={3}
                      {...field}
                      required={form.watch("extractionType") === "AI"}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    {form.watch("extractionType") === "FUNCTION" 
                      ? "Optional property description for documentation purposes"
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
                <>
                  {/* Knowledge Documents */}
                  <FormField
                    control={form.control}
                    name="knowledgeDocumentIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Knowledge Documents (Optional)</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {knowledgeDocuments.length > 0 ? (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  {field.value?.map((docId) => {
                                    const doc = knowledgeDocuments.find(d => d.id === docId);
                                    return doc ? (
                                      <Badge key={docId} variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-300">
                                        {doc.displayName}
                                        <X 
                                          className="h-3 w-3 cursor-pointer hover:text-red-600" 
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
                                  <SelectTrigger className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500">
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
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground border rounded p-3 bg-gray-50">
                                No knowledge documents available. Create knowledge documents in project settings for additional AI context.
                              </p>
                            )}
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
                        <FormLabel>Extraction Rules (Optional)</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {extractionRules.length > 0 ? (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  {field.value?.map((ruleId) => {
                                    const rule = extractionRules.find(r => r.id === ruleId);
                                    return rule ? (
                                      <Badge key={ruleId} variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-300">
                                        {rule.ruleName}
                                        <X 
                                          className="h-3 w-3 cursor-pointer hover:text-red-600" 
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
                                  <SelectTrigger className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500">
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
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground border rounded p-3 bg-gray-50">
                                No extraction rules available. Create rules in project settings to define specific AI guidelines.
                              </p>
                            )}
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border-2 border-gray-200 p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="space-y-1">
                          <FormLabel className="font-medium">Source Documents Required</FormLabel>
                          <p className="text-sm text-gray-600">
                            Require source documents for this property's extraction
                          </p>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-2 border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
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

                  {/* Dynamic Function Parameters */}
                  {form.watch("functionId") && (
                    <DynamicFunctionParameters
                      functionId={form.watch("functionId")}
                      wizardryFunctions={wizardryFunctions}
                      value={form.watch("functionParameters") || {}}
                      onChange={(params) => form.setValue("functionParameters", params)}
                    />
                  )}
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
                {isLoading ? "Saving..." : property ? "Update Property" : "Add Property"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}