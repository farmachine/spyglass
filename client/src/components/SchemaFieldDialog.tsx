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
import { processPromptReferences, validateReferences } from "@/utils/promptReferencing";
import { PromptTextarea } from "./PromptTextarea";

const fieldTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const schemaFieldFormSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  fieldType: z.enum(fieldTypes),
  functionId: z.string().min(1, "Function selection is required"),
  functionParameters: z.record(z.string(), z.any()).optional(),
  knowledgeDocumentIds: z.array(z.string()).optional(),
  extractionRuleIds: z.array(z.string()).optional(),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  orderIndex: z.number().default(0),
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
      functionId: "",
      functionParameters: {},
      knowledgeDocumentIds: [],
      extractionRuleIds: [],
      autoVerificationConfidence: 80,
      orderIndex: 0,
    },
  });

  // Reset form with new values when field prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        fieldName: field?.fieldName || "",
        fieldType: (field?.fieldType as typeof fieldTypes[number]) || "TEXT",
        functionId: field?.functionId || "",
        functionParameters: (field as any)?.functionParameters || {},
        knowledgeDocumentIds: field?.knowledgeDocumentIds as string[] || [],
        extractionRuleIds: field?.extractionRuleIds as string[] || [],
        autoVerificationConfidence: field?.autoVerificationConfidence || 80,
        orderIndex: field?.orderIndex || 0,
      });
    }
  }, [field, open, form]);

  const handleSubmit = async (data: SchemaFieldForm) => {
    try {
      // Add the extracted metadata from the selected function
      const selectedFunction = wizardryFunctions.find(f => f.id === data.functionId);
      const enhancedData = {
        ...data,
        extractionType: "FUNCTION" as const,
        requiredDocumentType: selectedFunction?.functionType === "AI_ONLY" ? undefined : "Excel" as const,
        description: selectedFunction?.description || "",
        documentsRequired: true,
      };
      await onSave(enhancedData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  // Get selected function details
  const selectedFunction = wizardryFunctions.find(f => f.id === form.watch("functionId"));
  const inputParameters = Array.isArray(selectedFunction?.inputParameters) 
    ? selectedFunction.inputParameters 
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {field ? "Edit Schema Field" : "Add Schema Field"}
          </DialogTitle>
          <DialogDescription>
            Configure a global field that uses function-based extraction
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Step 1: Function Configuration & Data Sources */}
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-600 text-white text-sm font-medium flex items-center justify-center">1</div>
                <h3 className="text-lg font-semibold text-slate-800">Function & Data Sources</h3>
              </div>
              
              <FormField
                control={form.control}
                name="functionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Functions</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {wizardryFunctions.length > 0 ? (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="h-auto min-h-[60px] border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500">
                              <SelectValue placeholder="Choose a function for data extraction..." />
                            </SelectTrigger>
                            <SelectContent>
                              {wizardryFunctions.map((func) => (
                                <SelectItem key={func.id} value={func.id}>
                                  {func.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="border rounded p-4 text-center">
                            <p className="text-gray-500">No functions available</p>
                            <p className="text-sm text-gray-400 mt-1">Create functions in the Tools section first</p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Function Parameters - Dynamic based on selected function */}
              {selectedFunction && inputParameters.length > 0 && (
                <div className="space-y-4 mt-4">
                  <h4 className="font-medium text-gray-800">Configure Parameters</h4>
                  <p className="text-sm text-gray-600">
                    Configure the input parameters for "{selectedFunction.name}"
                  </p>
                  
                  <div className="space-y-4">
                    {inputParameters.map((param: any, index: number) => (
                      <div key={param.name || index} className="space-y-2 p-3 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{param.name}</code>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{param.type}</span>
                        </div>
                        <p className="text-sm text-gray-600">{param.description}</p>
                        
                        {param.type === "text" ? (
                          <Input
                            value={(form.watch("functionParameters") || {})[param.name] || ""}
                            onChange={(e) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: e.target.value
                              });
                            }}
                            placeholder={`Enter value for ${param.name}`}
                            className="w-full"
                          />
                        ) : param.type === "document" ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 border rounded-lg bg-slate-50">
                              <input
                                type="checkbox"
                                checked={(form.watch("functionParameters") || {})[param.name] === "user_required"}
                                onChange={(e) => {
                                  const current = form.watch("functionParameters") || {};
                                  form.setValue("functionParameters", {
                                    ...current,
                                    [param.name]: e.target.checked ? "user_required" : ""
                                  });
                                }}
                                className="rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">User document upload required</div>
                                <div className="text-xs text-gray-600">Users must upload a document for this field to work</div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Source documents (knowledge base only)</label>
                              <Select 
                                value={(form.watch("functionParameters") || {})[param.name + "_knowledge"] || ""} 
                                onValueChange={(val) => {
                                  const current = form.watch("functionParameters") || {};
                                  form.setValue("functionParameters", {
                                    ...current,
                                    [param.name + "_knowledge"]: val
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select knowledge document (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {knowledgeDocuments?.map((doc) => (
                                    <SelectItem key={doc.id} value={doc.id}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        {doc.fileName}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            value={(form.watch("functionParameters") || {})[param.name] || ""}
                            onChange={(e) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: e.target.value
                              });
                            }}
                            placeholder={`Enter value for ${param.name}`}
                            rows={2}
                            className="w-full resize-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Documents & Rules */}
              {selectedFunction && (
                <div className="space-y-4 mt-4">
                  <h4 className="font-medium text-gray-800">Source Documents & Rules</h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="knowledgeDocumentIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User Document Upload Required</FormLabel>
                          <FormControl>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 p-3 border rounded-lg bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={field.value?.includes("user_document_required") || false}
                                  onChange={(e) => {
                                    const current = field.value || [];
                                    if (e.target.checked) {
                                      field.onChange([...current, "user_document_required"]);
                                    } else {
                                      field.onChange(current.filter(id => id !== "user_document_required"));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">Require user to upload document</div>
                                  <div className="text-xs text-gray-600">Users must upload a document for this field to be extracted. This ensures the extraction has the necessary source data to work with.</div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700">Source documents (knowledge base only):</div>
                                {knowledgeDocuments && knowledgeDocuments.length > 0 ? (
                                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2 bg-white">
                                    {knowledgeDocuments.map((doc) => (
                                      <label key={doc.id} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={field.value?.includes(doc.id) || false}
                                          onChange={(e) => {
                                            const current = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...current, doc.id]);
                                            } else {
                                              field.onChange(current.filter(id => id !== doc.id));
                                            }
                                          }}
                                          className="rounded"
                                        />
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          <span className="text-sm">{doc.fileName}</span>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="border rounded p-4 text-center text-gray-500">
                                    <p className="text-sm">No knowledge documents available</p>
                                    <p className="text-xs text-gray-400 mt-1">Upload knowledge documents first</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="extractionRuleIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Extraction Rules (Multiple Selection)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <div className="text-sm text-gray-600">Select one or more extraction rules:</div>
                              {extractionRules && extractionRules.length > 0 ? (
                                <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2 bg-white">
                                  {extractionRules.map((rule) => (
                                    <label key={rule.id} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={field.value?.includes(rule.id) || false}
                                        onChange={(e) => {
                                          const current = field.value || [];
                                          if (e.target.checked) {
                                            field.onChange([...current, rule.id]);
                                          } else {
                                            field.onChange(current.filter(id => id !== rule.id));
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                        <span className="text-sm">{rule.ruleName}</span>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="border rounded p-4 text-center text-gray-500">
                                  <p>No extraction rules available</p>
                                  <p className="text-sm text-gray-400 mt-1">Create extraction rules first</p>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Basic Field Configuration */}
            {selectedFunction && (
              <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-600 text-white text-sm font-medium flex items-center justify-center">2</div>
                  <h3 className="text-lg font-semibold text-slate-800">Field Settings</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fieldName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Field Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Pension Scheme Name" {...field} />
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
                        <FormLabel>Data Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select data type" />
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
                </div>

                <FormField
                  control={form.control}
                  name="autoVerificationConfidence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto Verification Confidence (%)</FormLabel>
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
                        Fields with confidence at or above this threshold will be automatically verified
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Show function info when selected */}
            {selectedFunction && (
              <div className="p-4 bg-gray-50 border rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Selected Function Summary</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {selectedFunction.name}</div>
                  <div><strong>Type:</strong> {selectedFunction.functionType}</div>
                  <div><strong>Description:</strong> {selectedFunction.description}</div>
                  {selectedFunction.tags && (
                    <div className="flex items-center gap-2">
                      <strong>Tags:</strong>
                      <div className="flex gap-1">
                        {selectedFunction.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-gray-400 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !selectedFunction}
                className="bg-slate-600 hover:bg-slate-700 text-white"
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
