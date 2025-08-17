import { useEffect, useState, useRef } from "react";
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
import { Plus, X, Key, FileText, Brain, Settings, ChevronDown } from "lucide-react";
import type { CollectionProperty, KnowledgeDocument, ExtractionRule, ExcelWizardryFunction, ProjectSchemaField, ObjectCollection } from "@shared/schema";

// Multi-Select Document Component
interface MultiSelectDocumentProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  knowledgeDocuments: KnowledgeDocument[];
}

function MultiSelectDocument({ value = [], onChange, placeholder, knowledgeDocuments }: MultiSelectDocumentProps) {
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
            const isSelected = value.includes(option.id);
            return (
              <div
                key={option.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                  isSelected ? 'bg-blue-50 text-blue-700' : ''
                }`}
                onClick={() => {
                  handleDocumentToggle(option.id);
                  // Don't close dropdown on selection to allow multiple selections
                }}
              >
                <div className={`w-4 h-4 border rounded flex-shrink-0 ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-sm m-0.5" />}
                </div>
                {option.id === "user_provided" ? (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500" />
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

// Autocomplete Input Component for @-key references
interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableFields: Array<{ key: string; label: string; source: string }>;
}

function AutocompleteInput({ value, onChange, placeholder, availableFields }: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredFields, setFilteredFields] = useState(availableFields);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    
    // Check if user is typing @
    const lastAtIndex = inputValue.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = inputValue.substring(lastAtIndex + 1);
      const filtered = availableFields.filter(field => 
        field.key.toLowerCase().includes(query.toLowerCase()) ||
        field.label.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFields(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const handleSuggestionClick = (fieldKey: string) => {
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const beforeAt = value.substring(0, lastAtIndex);
      const newValue = beforeAt + '@' + fieldKey;
      onChange(newValue);
    } else {
      onChange(value + '@' + fieldKey);
    }
    setShowSuggestions(false);
  };
  
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full"
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onFocus={() => {
          if (value.includes('@')) {
            const lastAtIndex = value.lastIndexOf('@');
            const query = value.substring(lastAtIndex + 1);
            const filtered = availableFields.filter(field => 
              field.key.toLowerCase().includes(query.toLowerCase()) ||
              field.label.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredFields(filtered);
            setShowSuggestions(true);
          }
        }}
      />
      
      {showSuggestions && filteredFields.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {filteredFields.map((field) => (
            <button
              key={field.key}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
              onClick={() => handleSuggestionClick(field.key)}
            >
              <span className="font-medium">@{field.key}</span>
              <span className="text-xs text-gray-500">{field.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Dynamic Function Parameters Component
interface DynamicFunctionParametersProps {
  functionId: string;
  wizardryFunctions: ExcelWizardryFunction[];
  value: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  availableFields: Array<{ key: string; label: string; source: string }>;
  knowledgeDocuments: KnowledgeDocument[];
}

function DynamicFunctionParameters({ functionId, wizardryFunctions, value, onChange, availableFields, knowledgeDocuments }: DynamicFunctionParametersProps) {
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
              <AutocompleteInput
                value={value[param.name] || ""}
                onChange={(val) => handleParameterChange(param.name, val)}
                placeholder={`Enter value for ${param.name} (use @ to reference other fields)`}
                availableFields={availableFields}
              />
            ) : param.type === "document" ? (
              <MultiSelectDocument
                value={Array.isArray(value[param.name]) ? value[param.name] : (value[param.name] ? [value[param.name]] : [])}
                onChange={(docs) => handleParameterChange(param.name, docs)}
                placeholder={`Select documents for ${param.name}`}
                knowledgeDocuments={knowledgeDocuments}
              />
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
  choices: z.array(z.string()).optional(),
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
  // Project schema data for @-key references
  schemaFields?: ProjectSchemaField[];
  collections?: ObjectCollection[];
  currentCollectionIndex?: number;
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
  wizardryFunctions = [],
  schemaFields = [],
  collections = [],
  currentCollectionIndex = 0
}: PropertyDialogProps) {
  const form = useForm<PropertyForm>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      propertyName: "",
      propertyType: "TEXT",
      functionId: "",
      functionParameters: {},
      choices: [],
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
        choices: (property as any)?.choices || [],
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
  
  // Debug logging for function parameters
  console.log('📋 [PropertyDialog] Selected function:', selectedFunction?.name);
  console.log('📋 [PropertyDialog] Input parameters:', inputParameters);
  console.log('📋 [PropertyDialog] Raw inputParameters from function:', selectedFunction?.inputParameters);

  // Build available fields for @-key referencing
  const buildAvailableFields = () => {
    const fields: Array<{ key: string; label: string; source: string }> = [];
    
    // Add main schema fields
    schemaFields.forEach(field => {
      fields.push({
        key: field.fieldName,
        label: field.fieldName,
        source: 'Main Schema'
      });
    });
    
    // Add properties from collections with lower or equal index
    collections.forEach((collection, collectionIndex) => {
      if (collectionIndex <= currentCollectionIndex && (collection as any).properties) {
        (collection as any).properties.forEach((prop: any) => {
          fields.push({
            key: prop.propertyName,
            label: prop.propertyName,
            source: `${collection.collectionName} Collection`
          });
        });
      }
    });
    
    return fields;
  };
  
  const availableFields = buildAvailableFields();

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
        
        {/* Global Function Selector - Top Right */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-semibold text-lg">Property Configuration</h3>
            <p className="text-sm text-gray-600">Configure extraction settings for this property</p>
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
                  {wizardryFunctions.map((func) => (
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
            {/* Dynamic Function-Based Form Content */}
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
                    <h5 className="font-medium text-gray-800">Input Parameters</h5>
                    {inputParameters.map((param: any, index: number) => (
                      <div key={param.name || index} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {param.name}
                          <span className="text-xs text-gray-500 ml-2">({param.type})</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{param.description}</p>
                        
                        {param.type === "text" ? (
                          <AutocompleteInput
                            value={(form.watch("functionParameters") || {})[param.name] || ""}
                            onChange={(val) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: val
                              });
                            }}
                            placeholder={`Enter value for ${param.name} (use @ to reference other fields)`}
                            availableFields={availableFields}
                          />
                        ) : param.type === "document" ? (
                          <MultiSelectDocument
                            value={Array.isArray((form.watch("functionParameters") || {})[param.name]) 
                              ? (form.watch("functionParameters") || {})[param.name] 
                              : ((form.watch("functionParameters") || {})[param.name] ? [(form.watch("functionParameters") || {})[param.name]] : [])}
                            onChange={(docs) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: docs
                              });
                            }}
                            placeholder={`Select documents for ${param.name}`}
                            knowledgeDocuments={knowledgeDocuments || []}
                          />
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
                )}

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
                          <AutocompleteInput
                            value={(form.watch("functionParameters") || {})[param.name] || ""}
                            onChange={(val) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: val
                              });
                            }}
                            placeholder={`Enter value for ${param.name} (use @ to reference other fields)`}
                            availableFields={availableFields}
                          />
                        ) : param.type === "document" ? (
                          <MultiSelectDocument
                            value={Array.isArray((form.watch("functionParameters") || {})[param.name]) 
                              ? (form.watch("functionParameters") || {})[param.name] 
                              : ((form.watch("functionParameters") || {})[param.name] ? [(form.watch("functionParameters") || {})[param.name]] : [])}
                            onChange={(docs) => {
                              const current = form.watch("functionParameters") || {};
                              form.setValue("functionParameters", {
                                ...current,
                                [param.name]: docs
                              });
                            }}
                            placeholder={`Select documents for ${param.name}`}
                            knowledgeDocuments={knowledgeDocuments || []}
                          />
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
                )}
                
                {/* Basic Property Configuration */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h5 className="font-medium text-gray-800">Property Settings</h5>
                  
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

                {/* Choices field for CHOICE type */}
                {form.watch("propertyType") === "CHOICE" && (
                  <FormField
                    control={form.control}
                    name="choices"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Choices</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
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
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
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
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentChoices = field.value || [];
                                field.onChange([...currentChoices, ""]);
                              }}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Choice
                            </Button>
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Define the available options for this choice field
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
