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
  choices: z.array(z.string()).optional(),
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
      choices: [],
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
        choices: (field as any)?.choices || [],
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
  
  // Debug logging for function parameters
  console.log('📋 Selected function:', selectedFunction?.name);
  console.log('📋 Input parameters:', inputParameters);
  console.log('📋 Raw inputParameters from function:', selectedFunction?.inputParameters);

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
        
        {/* Global Function Selector - Top Right */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-semibold text-lg">Schema Field Configuration</h3>
            <p className="text-sm text-gray-600">Configure extraction settings for this schema field</p>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Extraction Method</label>
            {wizardryFunctions && wizardryFunctions.length > 0 ? (
              <Select 
                value={form.watch("functionId") || ""} 
                onValueChange={(value) => {
                  form.setValue("functionId", value);
                  // Reset function parameters when function changes
                  form.setValue("functionParameters", {});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  {[...wizardryFunctions].sort((a, b) => a.name.localeCompare(b.name)).map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      {func.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="border rounded p-3 text-center text-sm">
                <p className="text-gray-500">No functions available</p>
                <p className="text-xs text-gray-400 mt-1">Create functions in Tools section</p>
              </div>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Field Settings Section - Always First */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                <h5 className="font-medium text-gray-800">Field Settings</h5>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fieldName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Employee Name, Department" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

              {/* Dynamic Choices for CHOICE type */}
              {form.watch("fieldType") === "CHOICE" && (
                <FormField
                  control={form.control}
                  name="choices"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Choices</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          {(field.value || []).map((choice: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                value={choice}
                                onChange={(e) => {
                                  const newChoices = [...(field.value || [])];
                                  newChoices[index] = e.target.value;
                                  field.onChange(newChoices);
                                }}
                                placeholder={`Choice ${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newChoices = (field.value || []).filter((_: string, i: number) => i !== index);
                                  field.onChange(newChoices);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              field.onChange([...(field.value || []), ""]);
                            }}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Choice
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Data Sources Section - Only show when function is selected */}
            {selectedFunction ? (
              <div className="space-y-6">
                {/* Function Description */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-blue-900">{selectedFunction.name}</h4>
                  </div>
                  <p className="text-sm text-blue-800">{selectedFunction.description}</p>
                </div>

                {/* Function parameters if any */}
                {inputParameters.length > 0 && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-gray-600" />
                      <h5 className="font-medium text-gray-800">Data Sources</h5>
                    </div>
                    {inputParameters.map((param: any, index: number) => (
                      <div key={param.name || index} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {param.name}
                          <span className="text-xs text-gray-500 ml-2">({param.type})</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{param.description}</p>
                        
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
                          <Select 
                            value={(form.watch("functionParameters") || {})[param.name] || ""} 
                            onValueChange={(val) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: val
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select document for ${param.name}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user_provided">User Uploaded Documents</SelectItem>
                              {knowledgeDocuments.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  {doc.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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


            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button" 
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.watch("functionId") || !form.watch("fieldName")}
              >
                {field ? "Update" : "Add"} Field
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
