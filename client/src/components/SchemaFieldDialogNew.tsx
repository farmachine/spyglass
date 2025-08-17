import { useState, useEffect, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, Key, Settings, Plus, X, ChevronDown, FileText } from "lucide-react";
import type { ProjectSchemaField, KnowledgeDocument, ExcelWizardryFunction } from "@shared/schema";
import { useAllCollectionsForReferences } from "@/hooks/useSchema";

const fieldTypes = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;

const formSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  fieldType: z.enum(fieldTypes),
  functionId: z.string().min(1, "Function selection is required"),
  functionParameters: z.record(z.any()).optional(),
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
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("");
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

  console.log("🔧 Selected function:", selectedFunctionId);
  console.log("📋 Input parameters:", inputParameters);

  // Update form when field prop changes
  useEffect(() => {
    if (field) {
      const functionId = field.functionId || "ai_extraction";
      setSelectedFunctionId(functionId);
      
      form.reset({
        fieldName: field.fieldName || "",
        fieldType: (field.fieldType as "TEXT" | "NUMBER" | "DATE" | "CHOICE") || "TEXT",
        functionId: functionId,
        functionParameters: field.functionParameters || {},
        choices: (field as any).choices || [],
        autoVerificationConfidence: field.autoVerificationConfidence || 80,
        orderIndex: field.orderIndex || 0,
      });
    } else {
      setSelectedFunctionId("");
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

  const selectedFunction = wizardryFunctions.find(f => f.id === selectedFunctionId);

  // Load input parameters when function changes
  useEffect(() => {
    console.log("📋 Raw inputParameters from function:", selectedFunction?.inputParameters);
    
    if (selectedFunction?.inputParameters) {
      try {
        const params = typeof selectedFunction.inputParameters === 'string' 
          ? JSON.parse(selectedFunction.inputParameters)
          : selectedFunction.inputParameters;
        setInputParameters(Array.isArray(params) ? params : []);
      } catch (error) {
        console.error("Error parsing input parameters:", error);
        setInputParameters([]);
      }
    } else if (selectedFunctionId === "" || !selectedFunction) {
      // Default AI extraction parameters
      setInputParameters([
        {
          id: "0.tg3n906d9i",
          name: "Reference Data",
          type: "text",
          description: "Previously collected data to use as reference."
        },
        {
          id: "0.kj4m9d6f8l",
          name: "AI Instructions", 
          type: "textarea",
          description: "Specific instructions for AI extraction process."
        },
        {
          id: "0.p2x7v5n1qw",
          name: "Reference Documents",
          type: "documents",
          description: "Knowledge documents to reference during extraction."
        }
      ]);
    } else {
      setInputParameters([]);
    }
  }, [selectedFunctionId, selectedFunction]);

  // Fetch all collections across all projects for @-key referencing
  const { data: allCollections = [], isLoading: collectionsLoading } = useAllCollectionsForReferences();

  console.log('📝 All collections data:', allCollections);

  const buildAvailableFields = () => {
    const fields: Array<{ key: string; label: string; source: string }> = [];
    
    // For schema fields: Show collections from the CURRENT project only
    const currentProjectCollections = allCollections.filter((collection: any) => 
      collection.projectId === projectId
    );
    
    currentProjectCollections.forEach((collection: any) => {
      collection.properties.forEach((property: any) => {
        fields.push({
          key: `@${collection.collectionName}.${property.propertyName}`,
          label: `${collection.collectionName}.${property.propertyName}`,
          source: `${collection.collectionName} Collection`
        });
      });
    });
    
    return fields.sort((a, b) => a.label.localeCompare(b.label));
  };
  
  const availableFields = buildAvailableFields();
  console.log('📝 Available fields for autocomplete (schema field - current project only):', availableFields);

  // Simple Dropdown component for reference data
  function ReferenceDataDropdown({ value, onChange, placeholder, availableFields }: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    availableFields: Array<{ key: string; label: string; source: string }>;
  }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || "Select reference data..."} />
        </SelectTrigger>
        <SelectContent>
          {availableFields.length === 0 && (
            <SelectItem value="none" disabled>No reference data available</SelectItem>
          )}
          {availableFields.map((field) => (
            <SelectItem key={field.key} value={field.key}>
              <div className="flex justify-between items-center w-full">
                <span>{field.label}</span>
                <span className="text-xs text-gray-500 ml-2">{field.source}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Inline MultiSelectDocument component
  function MultiSelectDocument({ value = [], onChange, placeholder, knowledgeDocuments }: {
    value: string[];
    onChange: (docs: string[]) => void;
    placeholder: string;
    knowledgeDocuments: KnowledgeDocument[];
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);
    
    const selectedDocs = knowledgeDocuments.filter(doc => value.includes(doc.id));
    const hasUserProvided = value.includes("user_provided");
    const availableOptions = [
      { id: "user_provided", displayName: "User Provided Document" },
      ...knowledgeDocuments
    ];
    
    const handleDocumentToggle = (docId: string) => {
      const newValue = value.includes(docId) 
        ? value.filter(id => id !== docId)
        : [...value, docId];
      onChange(newValue);
    };
    
    return (
      <div className="relative" ref={dropdownRef}>
        <div 
          className="min-h-10 p-3 border border-gray-200 rounded-md cursor-pointer bg-white flex items-center justify-between hover:border-gray-300 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-wrap gap-1 min-h-6">
            {hasUserProvided && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                User Provided Document
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDocumentToggle("user_provided");
                  }}
                />
              </Badge>
            )}
            {selectedDocs.length > 0 && selectedDocs.map(doc => (
              <Badge key={doc.id} variant="secondary" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {doc.displayName}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDocumentToggle(doc.id);
                  }}
                />
              </Badge>
            ))}
            {!hasUserProvided && selectedDocs.length === 0 && (
              <span className="text-gray-500 text-sm">{placeholder || "Select documents..."}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
            {availableOptions.map((option) => {
              const isSelected = option.id === "user_provided" ? hasUserProvided : selectedDocs.some(doc => doc.id === option.id);
              return (
                <div
                  key={option.id}
                  className={`p-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => handleDocumentToggle(option.id)}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  {option.id === "user_provided" ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">{option.displayName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {field ? "Edit Schema Field" : "Add Schema Field"}
            </DialogTitle>
            
            {/* Global Function Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Extraction Method:</span>
              <Select
                value={selectedFunctionId}
                onValueChange={(value) => {
                  setSelectedFunctionId(value);
                  form.setValue("functionId", value);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {[...wizardryFunctions].sort((a, b) => a.name.localeCompare(b.name)).map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      <div className="flex items-center gap-2">
                        {func.functionType === "AI_ONLY" ? <Brain className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                        {func.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            
            {/* Step 1: Function & Data Sources */}
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Function & Data Sources
              </h3>
              
              {/* Dynamic Parameter Inputs */}
              {inputParameters.map((param) => (
                <div key={param.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {param.name}
                  </label>
                  {param.description && (
                    <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                  )}
                  
                  {param.type === "textarea" ? (
                    <Textarea
                      placeholder={`Enter ${param.name.toLowerCase()}...`}
                      value={form.watch(`functionParameters.${param.id}`) || ""}
                      onChange={(e) => form.setValue(`functionParameters.${param.id}`, e.target.value)}
                      rows={3}
                      className="w-full"
                    />
                  ) : param.type === "documents" ? (
                    <MultiSelectDocument
                      value={form.watch(`functionParameters.${param.id}`) || []}
                      onChange={(docs) => form.setValue(`functionParameters.${param.id}`, docs)}
                      placeholder="Select knowledge documents..."
                      knowledgeDocuments={knowledgeDocuments}
                    />
                  ) : (
                    <ReferenceDataDropdown
                      value={form.watch(`functionParameters.${param.id}`) || ""}
                      onChange={(val) => form.setValue(`functionParameters.${param.id}`, val)}
                      placeholder={`Select ${param.name.toLowerCase()}...`}
                      availableFields={availableFields}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step 2: Field Settings */}
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Field Settings
              </h3>
              
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

              {/* Dynamic Choices for CHOICE type */}
              {form.watch("fieldType") === "CHOICE" && (
                <div className="space-y-2">
                  <FormLabel>Choice Options</FormLabel>
                  {(form.watch("choices") || []).map((choice, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={choice}
                        onChange={(e) => {
                          const newChoices = [...(form.watch("choices") || [])];
                          newChoices[index] = e.target.value;
                          form.setValue("choices", newChoices);
                        }}
                        placeholder={`Choice ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newChoices = (form.watch("choices") || []).filter((_, i) => i !== index);
                          form.setValue("choices", newChoices);
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
                      const currentChoices = form.watch("choices") || [];
                      form.setValue("choices", [...currentChoices, ""]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Choice
                  </Button>
                </div>
              )}

              <FormField
                control={form.control}
                name="autoVerificationConfidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-Verification Confidence (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : field ? "Update Field" : "Add Field"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}