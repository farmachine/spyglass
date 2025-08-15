import { useState, useEffect } from "react";
import { Edit, Trash2, Plus, GripVertical, ChevronDown, ChevronRight, ChevronUp, Key, Check, X } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollectionProperties } from "@/hooks/useSchema";
import { useQuery } from "@tanstack/react-query";
import type { ObjectCollection, CollectionProperty } from "@shared/schema";
import { processPromptReferences, validateReferences } from "@/utils/promptReferencing";
import { PromptTextarea } from "./PromptTextarea";

// Inline Property Editor Component
interface InlinePropertyEditorProps {
  property: CollectionProperty;
  excelFunctions: any[];
  knowledgeDocuments: any[];
  extractionRules: any[];
  allProperties: CollectionProperty[];
  onSave: (formData: Record<string, any>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function InlinePropertyEditor({ property, excelFunctions, knowledgeDocuments, extractionRules, allProperties, onSave, onCancel, isLoading }: InlinePropertyEditorProps) {

  const [formData, setFormData] = useState({
    propertyName: property.propertyName,
    propertyType: property.propertyType,
    description: property.description || '',
    extractionType: property.extractionType || 'AI',
    requiredDocumentType: property.requiredDocumentType || 'Any',
    functionId: property.functionId || null,
    autoVerificationConfidence: property.autoVerificationConfidence || 80,
    documentsRequired: property.documentsRequired || false,
    sourceDocumentsRequired: (property as any).sourceDocumentsRequired || false,
    knowledgeDocumentIds: (property as any).knowledgeDocumentIds || [],
    aiInstructions: (property as any).aiInstructions || '',
    extractionRuleIds: (property as any).extractionRuleIds || [],
    referencedMainFieldIds: (property as any).referencedMainFieldIds || [],
    referencedCollectionIds: (property as any).referencedCollectionIds || [],
  });

  // Get previous step properties for reference selection
  const [selectedReferences, setSelectedReferences] = useState<string[]>(() => {
    // Initialize with existing references from both arrays
    const existingRefs = [
      ...(formData.referencedMainFieldIds || []),
      ...(formData.referencedCollectionIds || [])
    ];
    return existingRefs;
  });
  
  // Build reference options from schema fields and preceding collections
  const buildReferenceOptions = () => {
    const options: Array<{id: string, name: string, type: string, description: string, category: string}> = [];
    
    // Add schema fields (always available)
    const schemaFields = [
      { id: 'pension_scheme_name', name: 'Pension Scheme Name', type: 'TEXT', description: 'Main schema field', category: 'Schema Field' },
      { id: 'broker', name: 'Broker', type: 'TEXT', description: 'Main schema field', category: 'Schema Field' },
      { id: 'admin_contact', name: 'Admin Contact', type: 'TEXT', description: 'Main schema field', category: 'Schema Field' },
    ];
    
    // Add preceding collections based on current collection
    // Only show collections that come BEFORE the current one in order
    const precedingCollections = [];
    
    // Define the collection order
    const collectionOrder = [
      'Column Name Mapping',
      'Additional Column Names', 
      'Missing Column Names',
      'Codes',
      'Missing Data',
      'Invalid Thresholds',
      'Cross Validation Checks'
    ];
    
    // Find current collection's position and only include preceding ones
    // For now, we'll use a hardcoded mapping since collectionName isn't available on property
    const currentCollectionName = 'Column Name Mapping'; // This would need to be passed from parent
    const currentIndex = collectionOrder.indexOf(currentCollectionName);
    
    if (currentIndex > 0) {
      // Only add collections that come before the current one
      for (let i = 0; i < currentIndex; i++) {
        const collectionName = collectionOrder[i];
        precedingCollections.push({
          id: collectionName.toLowerCase().replace(/\s+/g, '_'),
          name: collectionName,
          type: 'COLLECTION',
          description: `Collection: ${collectionName}`,
          category: 'Collection'
        });
      }
    }
    
    return [...schemaFields, ...precedingCollections];
  };
  
  const previousStepOptions = buildReferenceOptions();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Separate main field references from collection references
    const referencedMainFieldIds = selectedReferences.filter(ref => {
      const option = previousStepOptions.find(opt => opt.id === ref);
      return option?.category === 'Schema Field';
    });
    
    const referencedCollectionIds = selectedReferences.filter(ref => {
      const option = previousStepOptions.find(opt => opt.id === ref);
      return option?.category === 'Collection';
    });

    // Process @-key references in AI instructions
    let processedDescription = formData.extractionType === 'AI' ? formData.aiInstructions : formData.description;
    
    if (formData.extractionType === 'AI' && formData.aiInstructions) {
      // Build reference context for prompt processing
      const referenceContext = {
        knowledgeDocuments: knowledgeDocuments?.filter(doc => 
          (formData.knowledgeDocumentIds as string[]).includes(doc.id)
        ),
        referencedFields: referencedMainFieldIds.map(id => {
          const option = previousStepOptions.find(opt => opt.id === id);
          return {
            id,
            fieldName: option?.name,
            description: option?.description,
            fieldType: option?.type
          };
        }),
        referencedCollections: referencedCollectionIds.map(id => {
          const option = previousStepOptions.find(opt => opt.id === id);
          return {
            id,
            collectionName: option?.name || 'Unknown Collection',
            description: option?.description
          };
        }),
        extractionRules: extractionRules?.filter(rule => 
          (formData.extractionRuleIds as string[]).includes(rule.id)
        )
      };

      // Process the prompt with reference context
      processedDescription = processPromptReferences(formData.aiInstructions, referenceContext);
      
      // Validate references (optional - could show warnings)
      const validationErrors = validateReferences(formData.aiInstructions, referenceContext);
      if (validationErrors.length > 0) {
        console.warn('Reference validation warnings:', validationErrors);
      }
    }
    
    // Map form data to API format
    const mappedData = {
      id: property.id,
      collectionId: property.collectionId,
      propertyName: formData.propertyName,
      propertyType: formData.propertyType,
      description: processedDescription,
      referencedMainFieldIds,
      referencedCollectionIds,
      autoVerificationConfidence: formData.autoVerificationConfidence,
      choiceOptions: property.choiceOptions || [], // Same behavior
      isIdentifier: property.isIdentifier || false, // Same behavior
      orderIndex: property.orderIndex, // Same behavior
      knowledgeDocumentIds: formData.knowledgeDocumentIds,
      extractionRuleIds: formData.extractionRuleIds,
      documentsRequired: formData.documentsRequired,
      extractionType: formData.extractionType,
      functionId: formData.functionId,
      requiredDocumentType: formData.requiredDocumentType === 'Any' ? null : formData.requiredDocumentType
    };
    
    console.log('🔄 SCHEMA UPDATE - Submitting property changes:', mappedData);
    onSave(mappedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Inputs Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: '#374151'}}>1</div>
          <h5 className="text-sm font-semibold text-gray-900">Inputs</h5>
        </div>
        <div className="space-y-3 pl-8">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="documentsRequired"
              checked={formData.documentsRequired}
              onChange={(e) => setFormData(prev => ({...prev, documentsRequired: e.target.checked}))}
              className="rounded border-gray-300"
            />
            <Label htmlFor="documentsRequired" className="text-sm font-medium">
              User must provide at least one document
            </Label>
          </div>

          <div>
            <Label className="text-sm font-medium">References from Previous Steps (Optional)</Label>
            <Select 
              value=""
              onValueChange={(value) => {
                if (value && !selectedReferences.includes(value)) {
                  setSelectedReferences(prev => [...prev, value]);
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select data sources from previous steps (optional)" />
              </SelectTrigger>
              <SelectContent>
                {previousStepOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {option.category}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Selected References Display */}
            {selectedReferences.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-600">Selected references:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedReferences.map((refId) => {
                    const ref = previousStepOptions.find(opt => opt.id === refId);
                    return ref ? (
                      <div key={refId} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                        <span>{ref.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedReferences(prev => prev.filter(id => id !== refId))}
                          className="text-blue-600 hover:text-blue-800 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Knowledge Documents (Optional)</Label>
            <Select 
              value=""
              onValueChange={(value) => {
                if (value && !formData.knowledgeDocumentIds.includes(value)) {
                  setFormData(prev => ({
                    ...prev, 
                    knowledgeDocumentIds: [...(prev.knowledgeDocumentIds as string[]), value]
                  }));
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select knowledge documents to include (optional)" />
              </SelectTrigger>
              <SelectContent>
                {knowledgeDocuments && knowledgeDocuments.length > 0 ? (
                  knowledgeDocuments.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.displayName || doc.name || doc.fileName || 'Unnamed Document'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-docs" disabled>
                    No knowledge documents available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Selected Knowledge Documents Display */}
            {(formData.knowledgeDocumentIds as string[]).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-600">Selected knowledge documents:</p>
                <div className="flex flex-wrap gap-2">
                  {(formData.knowledgeDocumentIds as string[]).map((docId: string) => {
                    const doc = knowledgeDocuments.find((d: any) => d.id === docId);
                    return doc ? (
                      <div key={docId} className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm">
                        <span>{doc.displayName || doc.name || doc.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            knowledgeDocumentIds: (prev.knowledgeDocumentIds as string[]).filter((id: string) => id !== docId)
                          }))}
                          className="text-green-600 hover:text-green-800 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extraction Type Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: '#6b7280'}}>2</div>
          <h5 className="text-sm font-semibold text-gray-900">Extraction Type</h5>
        </div>
        <div className="space-y-3 pl-8">
          <div>
            <Label className="text-sm font-medium">Method</Label>
            <Select value={formData.extractionType} onValueChange={(value) => setFormData(prev => ({...prev, extractionType: value as 'AI' | 'FUNCTION'}))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI">AI-based Extraction</SelectItem>
                <SelectItem value="FUNCTION">Function-based Extraction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.extractionType === 'AI' && (
            <>
              <div>
                <Label className="text-sm font-medium">AI Instructions</Label>
                <PromptTextarea
                  value={formData.aiInstructions}
                  onChange={(value) => setFormData(prev => ({...prev, aiInstructions: value}))}
                  placeholder="Enter specific instructions for the AI extraction process. Use @-key referencing to reference available resources."
                  rows={5}
                  className="mt-1"
                  knowledgeDocuments={knowledgeDocuments}
                  referencedFields={selectedReferences.filter(ref => {
                    const option = previousStepOptions.find(opt => opt.id === ref);
                    return option?.category === 'Schema Field';
                  }).map(id => {
                    const option = previousStepOptions.find(opt => opt.id === id);
                    return {
                      id,
                      name: option?.name || 'Unknown Field',
                      type: option?.type || 'TEXT',
                      description: option?.description
                    };
                  })}
                  referencedCollections={selectedReferences.filter(ref => {
                    const option = previousStepOptions.find(opt => opt.id === ref);
                    return option?.category === 'Collection';
                  }).map(id => {
                    const option = previousStepOptions.find(opt => opt.id === id);
                    return {
                      id,
                      name: option?.name || 'Unknown Collection',
                      description: option?.description
                    };
                  })}
                  previousCollectionProperties={allProperties
                    .filter(prop => 
                      prop.id !== property.id && 
                      (prop.orderIndex || 0) < (property.orderIndex || 0)
                    )
                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                    .map(prop => ({
                      id: prop.id,
                      propertyName: prop.propertyName,
                      propertyType: prop.propertyType,
                      description: prop.description
                    }))
                  }
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Extraction Rules (Optional)</Label>
                <Select 
                  value=""
                  onValueChange={(value) => {
                    if (value && !(formData.extractionRuleIds as string[]).includes(value)) {
                      setFormData(prev => ({
                        ...prev, 
                        extractionRuleIds: [...(prev.extractionRuleIds as string[]), value]
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select extraction rules to apply (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {extractionRules && extractionRules.length > 0 ? (
                      extractionRules.map((rule: any) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {rule.ruleName || rule.name || 'Unnamed Rule'}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-rules" disabled>
                        No extraction rules available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* Selected Extraction Rules Display */}
                {(formData.extractionRuleIds as string[]).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-600">Selected extraction rules:</p>
                    <div className="flex flex-wrap gap-2">
                      {(formData.extractionRuleIds as string[]).map((ruleId: string) => {
                        const rule = extractionRules.find((r: any) => r.id === ruleId);
                        return rule ? (
                          <div key={ruleId} className="flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-sm">
                            <span>{rule.ruleName || rule.name}</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                extractionRuleIds: (prev.extractionRuleIds as string[]).filter((id: string) => id !== ruleId)
                              }))}
                              className="text-purple-600 hover:text-purple-800 ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                    {/* Show rule descriptions */}
                    <div className="mt-2">
                      {(formData.extractionRuleIds as string[]).map((ruleId: string) => {
                        const rule = extractionRules.find((r: any) => r.id === ruleId);
                        return rule && (rule.description || rule.ruleContent) ? (
                          <div key={`desc-${ruleId}`} className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                            <p className="text-sm font-medium text-purple-900">{rule.ruleName || rule.name}</p>
                            <p className="text-sm text-purple-700 mt-1">{rule.ruleContent || rule.description}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {formData.extractionType === 'FUNCTION' && (
            <>
              <div>
                <Label htmlFor="documentType" className="text-sm font-medium">Required Document Type</Label>
                <Select value={formData.requiredDocumentType} onValueChange={(value) => setFormData(prev => ({...prev, requiredDocumentType: value}))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any">Any</SelectItem>
                    <SelectItem value="Excel">Excel (.xlsx, .xls)</SelectItem>
                    <SelectItem value="Word">Word (.docx, .doc)</SelectItem>
                    <SelectItem value="PDF">PDF (.pdf)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="function" className="text-sm font-medium">Function</Label>
                <Select value={formData.functionId || ''} onValueChange={(value) => setFormData(prev => ({...prev, functionId: value}))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a pre-built function" />
                  </SelectTrigger>
                  <SelectContent>
                    {excelFunctions.map((func: any) => (
                      <SelectItem key={func.id} value={func.id}>
                        {func.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.functionId && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-gray-700">
                      {excelFunctions.find((f: any) => f.id === formData.functionId)?.description || 'No description available'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>



      {/* Output Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">3</div>
          <h5 className="text-sm font-semibold text-gray-900">Output</h5>
        </div>
        <div className="space-y-3 pl-8">
          <div>
            <Label htmlFor="propertyName" className="text-sm font-medium">Property Name</Label>
            <Input
              id="propertyName"
              value={formData.propertyName}
              onChange={(e) => setFormData(prev => ({...prev, propertyName: e.target.value}))}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="propertyType" className="text-sm font-medium">Property Type</Label>
            <Select value={formData.propertyType} onValueChange={(value) => setFormData(prev => ({...prev, propertyType: value}))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="BOOLEAN">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
              placeholder="Add a description for this property"
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confidence" className="text-sm font-medium">Auto Verification Confidence Level (%)</Label>
            <Input
              id="confidence"
              type="number"
              min="0"
              max="100"
              value={formData.autoVerificationConfidence}
              onChange={(e) => setFormData(prev => ({...prev, autoVerificationConfidence: parseInt(e.target.value)}))}
              className="mt-1"
            />
          </div>


        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isLoading} className="bg-gray-700 hover:bg-gray-800">
          {isLoading ? "Saving..." : "Save Changes"}
          <Check className="h-4 w-4 ml-2" />
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
          <X className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}

interface CollectionCardProps {
  collection: ObjectCollection;
  fieldTypeColors: Record<string, string>;
  knowledgeDocuments: any[];
  extractionRules: any[];
  onEditCollection: (collection: ObjectCollection) => void;
  onDeleteCollection: (id: string, name: string) => void;
  onAddProperty: (collectionId: string, collectionName: string) => void;
  onEditProperty: (property: CollectionProperty) => void;
  onDeleteProperty: (id: string, name: string) => void;
  dragHandleProps?: any;
  hideHeader?: boolean;
}

export default function CollectionCard({
  collection,
  fieldTypeColors,
  knowledgeDocuments = [],
  extractionRules = [],
  onEditCollection,
  onDeleteCollection,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  dragHandleProps,
  hideHeader = false,
}: CollectionCardProps) {
  
  console.log('CollectionCard - Props received:', {
    collection: collection.collectionName,
    knowledgeDocuments: knowledgeDocuments.length,
    extractionRules: extractionRules.length
  });
  const { data: properties = [], isLoading } = useCollectionProperties(String(collection.id));
  const { data: excelFunctions = [] } = useQuery({
    queryKey: ["/api/excel-functions"],
    queryFn: () => apiRequest("/api/excel-functions"),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sort properties by orderIndex for consistent ordering
  const safeProperties = properties ? [...properties].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) : [];
  
  // Lists should be collapsed by default if they have properties, expanded if no properties
  const [isExpanded, setIsExpanded] = useState(safeProperties.length === 0);
  
  // State for inline editing
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  
  // State for property expansion
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Set<string>>(new Set());
  
  // Toggle property expansion
  const togglePropertyExpansion = (propertyId: string) => {
    setExpandedPropertyIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };
  
  // Update collapse state when properties are first added to an empty list
  // useEffect(() => {
  //   if (safeProperties.length === 1 && isExpanded) {
  //     // When the first property is added to an empty list, collapse it
  //     setIsExpanded(false);
  //   }
  // }, [safeProperties.length]);

  // Create a mutation that doesn't invalidate any queries for reordering
  const updatePropertyForReorder = useMutation({
    mutationFn: ({ id, property }: { id: string; property: Partial<any> }) =>
      apiRequest(`/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(property),
      }),
    // No onSuccess invalidation - rely on optimistic updates only
  });

  // Mutation for setting identifier field
  const setIdentifierField = useMutation({
    mutationFn: ({ collectionId, propertyId }: { collectionId: string; propertyId: string }) => {
      console.log('Setting identifier field:', { collectionId, propertyId });
      return apiRequest(`/api/collections/${collectionId}/set-identifier/${propertyId}`, {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      console.log('Identifier field set successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/collections", collection.id, "properties"] });
      toast({
        title: "Success",
        description: "Identifier field updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error setting identifier field:', error);
      toast({
        title: "Error",
        description: "Failed to set identifier field. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating properties
  const updateProperty = useMutation({
    mutationFn: ({ id, property }: { id: string; property: Partial<CollectionProperty> }) =>
      apiRequest(`/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(property),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections", collection.id, "properties"] });
      setEditingPropertyId(null);
      toast({
        title: "Success",
        description: "Property updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating property:', error);
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle inline edit save
  const handleSaveProperty = (property: CollectionProperty, formData: Record<string, any>) => {
    updateProperty.mutate({
      id: property.id,
      property: {
        ...property,
        ...formData,
      },
    });
  };

  // Drag and drop handler for reordering collection properties
  const handlePropertyDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(safeProperties);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistically update the cache immediately to prevent visual flashing
    const updatedItems = items.map((property, index) => ({ ...property, orderIndex: index }));
    queryClient.setQueryData(["/api/collections", collection.id, "properties"], updatedItems);

    // Update orderIndex for all affected properties in the background
    try {
      const updatePromises = items.map((property, index) => 
        updatePropertyForReorder.mutateAsync({ 
          id: property.id, 
          property: { ...property, orderIndex: index } 
        })
      );
      
      await Promise.all(updatePromises);
      
      // Silent update - no toast notification for reordering
    } catch (error) {
      // If update fails, refetch to restore correct order
      queryClient.invalidateQueries({ queryKey: ["/api/collections", collection.id, "properties"] });
      
      toast({
        title: "Error",
        description: "Failed to update property order. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Collection Header - Hide when hideHeader prop is true */}
      {!hideHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {dragHandleProps && (
              <div
                {...dragHandleProps}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 mt-1"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-0 h-auto hover:bg-transparent"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{collection.collectionName}</h3>
                    <Badge className="bg-green-100 text-green-800 text-xs">List</Badge>
                    <Badge variant="outline" className="text-xs bg-white">
                      {properties.length} field{properties.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {collection.description && (
                    <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEditCollection(collection)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDeleteCollection(collection.id, collection.collectionName)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Expanded content - Sequential Process Flow Design */}
      {/* When header is hidden, always show content (expanded) */}
      {(hideHeader || isExpanded) && (
        <div className={hideHeader ? "" : "ml-6"}>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading properties...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No data properties configured</p>
                <p className="text-sm text-gray-600 mb-4">Start building your data extraction process</p>
                <Button 
                  onClick={() => onAddProperty(collection.id, collection.collectionName)}
                  className="bg-gray-700 hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Data Property
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <DragDropContext onDragEnd={handlePropertyDragEnd}>
                <Droppable droppableId={`collection-properties-${collection.id}`}>
                  {(provided) => (
                    <div className="space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                      {safeProperties.map((property, index) => (
                        <Draggable key={property.id} draggableId={property.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`group relative ${snapshot.isDragging ? "opacity-50" : ""}`}
                        >
                          {/* Step connector line */}
                          {index < safeProperties.length - 1 && (
                            <div className="absolute left-[17px] top-12 w-0.5 h-6 bg-gray-200" />
                          )}
                          
                          {/* Step card */}
                          <div className={`relative bg-white rounded-lg border ${property.isIdentifier ? (index === 0 ? "border-gray-300 bg-gray-50 hover:border-gray-700" : "border-gray-300 bg-gray-50 hover:border-gray-500") : (index === 0 ? "border-gray-300 hover:border-gray-700" : "border-gray-300 hover:border-gray-500")} hover:border-2 ${expandedPropertyIds.has(property.id) ? "p-4" : "p-3"} transition-all`}>
                            {/* Step number and drag handle */}
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white" 
                                  style={{backgroundColor: property.isIdentifier ? (index === 0 ? '#374151' : '#6b7280') : (index === 0 ? '#374151' : '#6b7280')}}
                                >
                                  {index + 1}
                                </div>
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <GripVertical className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                              
                              {/* Property content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => togglePropertyExpansion(property.id)}>
                                    <h4 className="font-semibold text-gray-900">{property.propertyName}</h4>
                                    <Badge className="bg-gray-100 border border-gray-500 text-gray-700 text-xs">
                                      {property.propertyType}
                                    </Badge>
                                    {!expandedPropertyIds.has(property.id) && (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    )}
                                    {expandedPropertyIds.has(property.id) && (
                                      <ChevronUp className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingPropertyId(editingPropertyId === property.id ? null : property.id);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {!property.isIdentifier && property.propertyType === 'TEXT' && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIdentifierField.mutate({ collectionId: collection.id, propertyId: property.id });
                                        }}
                                        title="Set as identifier field"
                                      >
                                        <Key className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {!property.isIdentifier && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteProperty(property.id, property.propertyName);
                                        }}
                                        title="Delete property"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Property description and confidence - Only show when expanded */}
                                {expandedPropertyIds.has(property.id) && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                      {property.description || "No description provided"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">Auto Verify:</span>
                                      <Badge variant="outline" className="text-xs">
                                        {property.autoVerificationConfidence || 80}%
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Auto Verify badge when collapsed */}
                                {!expandedPropertyIds.has(property.id) && (
                                  <div className="mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {property.autoVerificationConfidence || 80}%
                                    </Badge>
                                  </div>
                                )}
                                
                                {/* Inline Editing Form - Expanded */}
                                {editingPropertyId === property.id && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <InlinePropertyEditor
                                      property={property}
                                      excelFunctions={excelFunctions}
                                      knowledgeDocuments={knowledgeDocuments}
                                      extractionRules={extractionRules}
                                      allProperties={safeProperties}
                                      onSave={(formData) => handleSaveProperty(property, formData)}
                                      onCancel={() => setEditingPropertyId(null)}
                                      isLoading={updateProperty.isPending}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              
              {/* Add next data property */}
              <div className="relative">
                {/* Connector line from last step */}
                <div className="absolute left-[17px] -top-3 w-0.5 h-6 bg-gray-200" />
                
                {/* Add button with step styling */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => onAddProperty(collection.id, collection.collectionName)}
                    className="border-2 border-dashed border-gray-300 hover:border-gray-500 hover:text-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Next Data Property
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}