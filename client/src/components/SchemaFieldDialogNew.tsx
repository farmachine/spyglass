import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, Settings, X, Plus } from "lucide-react";
import type { ProjectSchemaField, KnowledgeDocument, ExcelWizardryFunction } from "@shared/schema";
import { useAllCollectionsForReferences } from "@/hooks/useSchema";

const fieldTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const formSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  fieldType: z.enum(fieldTypes),
  functionId: z.string().min(1, "Extraction method is required"),
  functionParameters: z.record(z.any()).default({}),
  choices: z.array(z.string()).optional(),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  orderIndex: z.number().default(0),
});

type SchemaFieldForm = z.infer<typeof formSchema>;

interface SchemaFieldDialogNewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SchemaFieldForm) => Promise<void>;
  field?: ProjectSchemaField | null;
  isLoading?: boolean;
  knowledgeDocuments?: KnowledgeDocument[];
  wizardryFunctions?: ExcelWizardryFunction[];
  projectId?: string;
}

export function SchemaFieldDialogNew({ 
  open, 
  onOpenChange, 
  onSave, 
  field, 
  isLoading = false,
  knowledgeDocuments = [],
  wizardryFunctions = [],
  projectId
}: SchemaFieldDialogNewProps) {
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [inputParameters, setInputParameters] = useState<any[]>([]);
  
  const form = useForm<SchemaFieldForm>({
    resolver: zodResolver(formSchema),
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

  // Update form when field prop changes
  useEffect(() => {
    if (field) {
      const toolId = field.functionId || "";
      setSelectedToolId(toolId);
      
      form.reset({
        fieldName: field.fieldName || "",
        fieldType: (field.fieldType as "TEXT" | "NUMBER" | "DATE" | "CHOICE") || "TEXT",
        functionId: toolId,
        functionParameters: field.functionParameters || {},
        choices: (field as any).choices || [],
        autoVerificationConfidence: field.autoVerificationConfidence || 80,
        orderIndex: field.orderIndex || 0,
      });
    } else {
      setSelectedToolId("");
      form.reset({
        fieldName: "",
        fieldType: "TEXT",
        functionId: "",
        functionParameters: {},
        choices: [],
        autoVerificationConfidence: 80,
        orderIndex: 0,
      });
    }
  }, [field, form]);

  const isManual = selectedToolId === "manual";
  const selectedTool = selectedToolId && !isManual ? wizardryFunctions.find(f => f.id === selectedToolId) : null;

  // Load input parameters when tool changes
  useEffect(() => {
    if (selectedTool?.inputParameters) {
      try {
        const params = typeof selectedTool.inputParameters === 'string' 
          ? JSON.parse(selectedTool.inputParameters)
          : selectedTool.inputParameters;
        setInputParameters(Array.isArray(params) ? params : []);
      } catch (error) {
        console.error("Error parsing input parameters:", error);
        setInputParameters([]);
      }
    } else {
      setInputParameters([]);
    }
  }, [selectedToolId, selectedTool]);

  // Fetch all collections for references
  const { data: allCollections = [] } = useAllCollectionsForReferences();

  // Build reference options from collections in current project
  const buildReferenceOptions = () => {
    const options: Array<{ id: string; name: string; type: string; category: string }> = [];
    
    // Add collections from current project only
    const currentProjectCollections = allCollections.filter((collection: any) => 
      collection.projectId === projectId
    );
    
    currentProjectCollections.forEach((collection: any) => {
      collection.properties?.forEach((property: any) => {
        options.push({
          id: `@${collection.collectionName}.${property.propertyName}`,
          name: `${collection.collectionName}.${property.propertyName}`,
          type: property.propertyType || 'TEXT',
          category: 'Collection Property'
        });
      });
    });
    
    return options;
  };

  const referenceOptions = buildReferenceOptions();

  const handleSubmit = async (data: SchemaFieldForm) => {
    try {
      await onSave(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving field:", error);
    }
  };

  // Render input based on parameter type
  const renderParameterInput = (param: any) => {
    const paramValue = form.watch(`functionParameters.${param.id}`) || "";

    switch (param.type) {
      case "text":
      case "string":
        return (
          <FormItem>
            <FormLabel>{param.name}</FormLabel>
            <FormControl>
              <Input
                placeholder={param.description || `Enter ${param.name.toLowerCase()}...`}
                value={paramValue}
                onChange={(e) => form.setValue(`functionParameters.${param.id}`, e.target.value)}
              />
            </FormControl>
          </FormItem>
        );

      case "textarea":
        return (
          <FormItem>
            <FormLabel>{param.name}</FormLabel>
            <FormControl>
              <Textarea
                placeholder={param.description || `Enter ${param.name.toLowerCase()}...`}
                value={paramValue}
                onChange={(e) => form.setValue(`functionParameters.${param.id}`, e.target.value)}
                rows={4}
              />
            </FormControl>
          </FormItem>
        );

      case "data":
        const selectedRefs = Array.isArray(paramValue) ? paramValue : [];
        return (
          <FormItem>
            <FormLabel>{param.name}</FormLabel>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedRefs.includes(value)) {
                  form.setValue(`functionParameters.${param.id}`, [...selectedRefs, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reference data..." />
              </SelectTrigger>
              <SelectContent>
                {referenceOptions.length === 0 ? (
                  <SelectItem value="none" disabled>No reference data available</SelectItem>
                ) : (
                  referenceOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex items-center gap-2">
                        <span>{option.name}</span>
                        <Badge variant="outline" className="text-xs">{option.category}</Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedRefs.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedRefs.map((ref: string) => (
                  <div key={ref} className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
                    <span className="flex-1">{ref}</span>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue(
                          `functionParameters.${param.id}`,
                          selectedRefs.filter((r: string) => r !== ref)
                        );
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormItem>
        );

      case "documents":
        const selectedDocs = Array.isArray(paramValue) ? paramValue : [];
        return (
          <FormItem>
            <FormLabel>{param.name}</FormLabel>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedDocs.includes(value)) {
                  form.setValue(`functionParameters.${param.id}`, [...selectedDocs, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select documents..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="session_header" disabled>
                  <div className="font-semibold text-gray-600">Session Documents</div>
                </SelectItem>
                <SelectItem value="session_placeholder">
                  Documents from extraction session
                </SelectItem>
                
                {knowledgeDocuments.length > 0 && (
                  <>
                    <SelectItem value="knowledge_header" disabled>
                      <div className="font-semibold text-gray-600 mt-2">Knowledge Documents</div>
                    </SelectItem>
                    {knowledgeDocuments.map((doc) => (
                      <SelectItem key={`knowledge_${doc.id}`} value={`knowledge_${doc.id}`}>
                        {doc.displayName || doc.fileName || 'Unnamed Document'}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {selectedDocs.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedDocs.map((docRef: string) => {
                  const isKnowledge = docRef.startsWith('knowledge_');
                  const docId = isKnowledge ? docRef.replace('knowledge_', '') : docRef;
                  const doc = isKnowledge ? knowledgeDocuments.find(d => d.id === docId) : null;
                  const displayName = doc ? (doc.displayName || doc.fileName) : docRef;
                  
                  return (
                    <div key={docRef} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200 text-sm">
                      <span className="flex-1">{displayName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          form.setValue(
                            `functionParameters.${param.id}`,
                            selectedDocs.filter((r: string) => r !== docRef)
                          );
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </FormItem>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {field ? "Edit Schema Field" : "Add Schema Field"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Step 1: Extraction Method */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-semibold text-white">1</div>
                <h5 className="font-medium">Extraction Method</h5>
              </div>
              
              <FormField
                control={form.control}
                name="functionId"
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Select Extraction Tool</FormLabel>
                    <Select
                      value={selectedToolId}
                      onValueChange={(value) => {
                        setSelectedToolId(value);
                        formField.onChange(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an extraction method..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Add Manually</span>
                          </div>
                        </SelectItem>
                        <div className="my-1 border-t border-gray-200" />
                        {wizardryFunctions.length === 0 ? (
                          <SelectItem value="none" disabled>No tools available</SelectItem>
                        ) : (
                          wizardryFunctions.map((tool) => (
                            <SelectItem 
                              key={tool.id} 
                              value={tool.id}
                              className="focus:bg-gray-700 dark:focus:bg-gray-700"
                            >
                              <div className="flex items-center gap-2">
                                {tool.toolType === "AI_ONLY" ? (
                                  <Brain className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                ) : (
                                  <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                )}
                                <span>{tool.name}</span>
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {tool.toolType === "AI_ONLY" ? "AI Data Extraction" : "CODE"}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {(selectedTool || isManual) && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    {isManual ? "Manually enter values for this field without extraction" : selectedTool?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Tool Parameters */}
            {selectedToolId && !isManual && inputParameters.length > 0 && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs font-semibold text-white">2</div>
                  <h5 className="font-medium">Data Sources & Configuration</h5>
                </div>
                
                <div className="space-y-4">
                  {inputParameters.map((param) => (
                    <div key={param.id}>
                      {renderParameterInput(param)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Field Settings */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">3</div>
                <h5 className="font-medium">Output Settings</h5>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

                <FormField
                  control={form.control}
                  name="autoVerificationConfidence"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Auto-Verification Confidence (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Field"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}