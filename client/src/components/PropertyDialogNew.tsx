import { useEffect, useState } from "react";
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
import { Key } from "lucide-react";
import type { CollectionProperty, KnowledgeDocument, ExcelWizardryFunction, ProjectSchemaField, ObjectCollection } from "@shared/schema";
// Simple AutocompleteInput component for @-key referencing
interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableFields: Array<{key: string, label: string, source: string}>;
}

function AutocompleteInput({ value, onChange, placeholder, availableFields }: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Check if @ symbol was typed to show suggestions
    const lastAtIndex = newValue.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex <= e.target.selectionStart!) {
      setShowSuggestions(true);
      setCursorPosition(lastAtIndex);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const insertReference = (fieldKey: string) => {
    const beforeAt = value.substring(0, cursorPosition);
    const afterAt = value.substring(cursorPosition + 1);
    const newValue = beforeAt + `@${fieldKey}` + afterAt;
    onChange(newValue);
    setShowSuggestions(false);
  };
  
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      
      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {availableFields.length > 0 ? (
            availableFields.map((field) => (
              <div
                key={field.key}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => insertReference(field.key)}
              >
                <div className="font-medium text-sm">{field.label}</div>
                <div className="text-xs text-gray-500">{field.source}</div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No fields available for referencing
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const propertyFormSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  propertyType: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "CHOICE"]),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  confidenceThreshold: z.number().min(0).max(100).default(80),
  functionId: z.string().min(1, "Function selection is required"),
  functionParameters: z.record(z.string()).optional(),
  choices: z.array(z.string()).optional(),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface PropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: CollectionProperty;
  collectionName: string;
  onSave: (data: any) => Promise<void>;
  knowledgeDocuments: KnowledgeDocument[];
  wizardryFunctions: ExcelWizardryFunction[];
  schemaFields: ProjectSchemaField[];
  collections: ObjectCollection[];
  allProperties: CollectionProperty[];
  currentCollectionIndex: number;
}

export function PropertyDialog({
  open,
  onOpenChange,
  property,
  collectionName,
  onSave,
  knowledgeDocuments,
  wizardryFunctions,
  schemaFields,
  collections,
  allProperties,
  currentCollectionIndex
}: PropertyDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      propertyName: property?.propertyName || "",
      propertyType: (property?.propertyType as any) || "TEXT",
      description: property?.description || "",
      isRequired: false,
      confidenceThreshold: 80,
      functionId: property?.functionId || "",
      functionParameters: {},
      choices: [],
    }
  });

  const selectedFunctionId = form.watch("functionId");
  const selectedFunction = wizardryFunctions.find(f => f.id === selectedFunctionId);
  const watchedPropertyType = form.watch("propertyType");

  useEffect(() => {
    // Initialize choices if editing an existing property
    setChoices([]);
  }, [property]);

  useEffect(() => {
    if (watchedPropertyType !== "CHOICE") {
      setChoices([]);
      form.setValue("choices", []);
    }
  }, [watchedPropertyType, form]);

  // Build available fields for @-key referencing
  const buildAvailableFields = () => {
    const fields: Array<{key: string, label: string, source: string}> = [];
    
    // Add main schema fields
    schemaFields.forEach(field => {
      fields.push({
        key: field.fieldName,
        label: field.fieldName,
        source: 'Main Schema'
      });
    });
    
    // Add properties from previous collections (based on currentCollectionIndex)
    if (currentCollectionIndex === -1) {
      // If collection index is -1, include all properties as fallback
      allProperties.forEach((prop) => {
        fields.push({
          key: prop.propertyName,
          label: prop.propertyName,
          source: `Collection Property`
        });
      });
    } else {
      // Add properties from collections that come before the current collection
      collections.forEach((collection, collectionIndex) => {
        if (collectionIndex < currentCollectionIndex) {
          const collectionProperties = allProperties.filter(prop => 
            prop.collectionId === collection.id
          );
          
          collectionProperties.forEach((prop: any) => {
            fields.push({
              key: prop.propertyName,
              label: prop.propertyName,
              source: `${collection.collectionName} Collection`
            });
          });
        }
      });
    }
    
    return fields;
  };

  const availableFields = buildAvailableFields();

  const handleSubmit = async (data: PropertyFormData) => {
    setIsLoading(true);
    try {
      const selectedFunction = wizardryFunctions.find(f => f.id === data.functionId);
      
      const enhancedData = {
        ...data,
        extractionType: "FUNCTION" as const,
        requiredDocumentType: selectedFunction?.functionType === "AI_ONLY" ? undefined : "Excel" as const,
        documentsRequired: true,
        functionParameters: JSON.stringify(data.functionParameters || {}),
        choices: watchedPropertyType === "CHOICE" ? choices : undefined,
      };
      
      await onSave(enhancedData);
      onOpenChange(false);
      form.reset();
      setChoices([]);
    } catch (error) {
      console.error("Error saving property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addChoice = () => {
    setChoices([...choices, ""]);
  };

  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
    form.setValue("choices", newChoices);
  };

  const removeChoice = (index: number) => {
    const newChoices = choices.filter((_, i) => i !== index);
    setChoices(newChoices);
    form.setValue("choices", newChoices);
  };

  const inputParameters = selectedFunction?.inputParameters ? JSON.parse(selectedFunction.inputParameters) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
            Configure a property for the "{collectionName}" collection using function-based extraction.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Basic Property Information */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-800">Property Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="propertyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter property name" disabled={property?.isIdentifier} />
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
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={property?.isIdentifier}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEXT">Text</SelectItem>
                            <SelectItem value="NUMBER">Number</SelectItem>
                            <SelectItem value="DATE">Date</SelectItem>
                            <SelectItem value="BOOLEAN">Boolean</SelectItem>
                            <SelectItem value="CHOICE">Choice</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Brief description of this property" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Choice Options */}
              {watchedPropertyType === "CHOICE" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Choice Options</FormLabel>
                    <Button type="button" onClick={addChoice} size="sm" variant="outline">
                      Add Choice
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {choices.map((choice, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={choice}
                          onChange={(e) => updateChoice(index, e.target.value)}
                          placeholder={`Choice ${index + 1}`}
                        />
                        <Button
                          type="button"
                          onClick={() => removeChoice(index)}
                          size="sm"
                          variant="outline"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Function Selection */}
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
              <h3 className="font-semibold text-gray-800">Extraction Function</h3>
              
              <FormField
                control={form.control}
                name="functionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Functions</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a function for data extraction..." />
                        </SelectTrigger>
                        <SelectContent>
                          {wizardryFunctions.map((func) => (
                            <SelectItem key={func.id} value={func.id}>
                              {func.name} - {func.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Function Parameters */}
              {selectedFunction && inputParameters.length > 0 && (
                <div className="space-y-4 mt-4">
                  <h4 className="font-medium text-gray-800">Function Parameters</h4>
                  <div className="space-y-3">
                    {inputParameters.map((param: any, index: number) => (
                      <div key={param.name || index} className="space-y-2 p-3 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{param.name}</code>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{param.type}</span>
                        </div>
                        <p className="text-sm text-gray-600">{param.description}</p>
                        
                        <AutocompleteInput
                          value={(form.watch("functionParameters") || {})[param.name] || ""}
                          onChange={(val) => {
                            const current = form.watch("functionParameters") || {};
                            form.setValue("functionParameters", {
                              ...current,
                              [param.name]: val
                            });
                          }}
                          placeholder={`Enter value for ${param.name} (use @ to reference fields)`}
                          availableFields={availableFields}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Function Info */}
              {selectedFunction && (
                <div className="p-3 bg-white border rounded">
                  <h4 className="font-medium text-gray-800 mb-2">Function Details</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Type:</strong> {selectedFunction.functionType}</div>
                    <div><strong>Description:</strong> {selectedFunction.description}</div>
                    {selectedFunction.tags && (
                      <div className="flex items-center gap-2">
                        <strong>Tags:</strong>
                        {selectedFunction.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
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
                disabled={isLoading || !selectedFunctionId}
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