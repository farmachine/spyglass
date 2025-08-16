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
  functionId: z.string().min(1, "Function selection is required"),
  functionParameters: z.record(z.string(), z.any()).optional(),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  orderIndex: z.number().default(0),
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
      functionId: "",
      functionParameters: {},
      autoVerificationConfidence: 80,
      orderIndex: 0,
    },
  });

  // Reset form with new values when property prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        propertyName: property?.propertyName || "",
        propertyType: (property?.propertyType as typeof propertyTypes[number]) || "TEXT",
        functionId: property?.functionId || "",
        functionParameters: (property as any)?.functionParameters || {},
        autoVerificationConfidence: property?.autoVerificationConfidence || 80,
        orderIndex: property?.orderIndex || 0,
      });
    }
  }, [property, open, form]);

  const handleSubmit = async (data: PropertyForm) => {
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
                                <div className="text-xs text-gray-600">Users must upload a document for this property to work</div>
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
            </div>

            {/* Step 2: Basic Property Configuration */}
            {selectedFunction && (
              <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-600 text-white text-sm font-medium flex items-center justify-center">2</div>
                  <h3 className="text-lg font-semibold text-slate-800">Property Settings</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Employee Name, Salary" {...field} />
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
                {isLoading ? "Saving..." : property ? "Update Property" : "Add Property"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
