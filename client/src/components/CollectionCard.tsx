import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Check, X, Plus, Settings, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CollectionProperty, ExcelWizardryFunction, KnowledgeDocument } from "@shared/schema";

// Property Editor Component
interface InlinePropertyEditorProps {
  property: CollectionProperty;
  excelFunctions: ExcelWizardryFunction[];
  knowledgeDocuments: KnowledgeDocument[];
  onSave: (formData: Record<string, any>) => void;
  onCancel: () => void;
  isLoading: boolean;
  collectionName: string;
  projectId: string;
}

function InlinePropertyEditor({ 
  property, 
  excelFunctions, 
  knowledgeDocuments, 
  onSave, 
  onCancel, 
  isLoading,
  collectionName,
  projectId
}: InlinePropertyEditorProps) {

  const [formData, setFormData] = useState({
    propertyName: property.propertyName,
    propertyType: property.propertyType,
    description: property.description || '',
    functionId: property.functionId || '',
    functionParameters: (property as any).functionParameters || {},
    autoVerificationConfidence: property.autoVerificationConfidence || 80,
  });

  const [selectedToolId, setSelectedToolId] = useState<string>(property.functionId || '');
  const [inputParameters, setInputParameters] = useState<any[]>([]);

  const selectedTool = excelFunctions.find(f => f.id === selectedToolId);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      id: property.id,
      collectionId: property.collectionId,
      propertyName: formData.propertyName,
      propertyType: formData.propertyType,
      description: formData.description,
      functionId: formData.functionId,
      functionParameters: formData.functionParameters,
      autoVerificationConfidence: formData.autoVerificationConfidence,
      choiceOptions: property.choiceOptions || [],
      isIdentifier: property.isIdentifier || false,
      orderIndex: property.orderIndex,
    };
    
    onSave(submitData);
  };

  // Render input based on parameter type
  const renderParameterInput = (param: any) => {
    const paramValue = formData.functionParameters[param.id] || "";

    switch (param.type) {
      case "text":
      case "string":
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium">{param.name}</label>
            <Input
              placeholder={param.description || `Enter ${param.name.toLowerCase()}...`}
              value={paramValue}
              onChange={(e) => setFormData({
                ...formData,
                functionParameters: { ...formData.functionParameters, [param.id]: e.target.value }
              })}
            />
          </div>
        );

      case "textarea":
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium">{param.name}</label>
            <Textarea
              placeholder={param.description || `Enter ${param.name.toLowerCase()}...`}
              value={paramValue}
              onChange={(e) => setFormData({
                ...formData,
                functionParameters: { ...formData.functionParameters, [param.id]: e.target.value }
              })}
              rows={3}
            />
          </div>
        );

      case "data":
        const selectedRefs = Array.isArray(paramValue) ? paramValue : [];
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium">{param.name}</label>
            <p className="text-xs text-gray-500">Select collection properties as reference data</p>
            {selectedRefs.length > 0 && (
              <div className="space-y-1 mb-2">
                {selectedRefs.map((ref: string) => (
                  <div key={ref} className="flex items-center gap-2 p-1 bg-gray-50 rounded text-xs">
                    <span className="flex-1">{ref}</span>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        functionParameters: {
                          ...formData.functionParameters,
                          [param.id]: selectedRefs.filter((r: string) => r !== ref)
                        }
                      })}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "documents":
        const selectedDocs = Array.isArray(paramValue) ? paramValue : [];
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium">{param.name}</label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedDocs.includes(value)) {
                  setFormData({
                    ...formData,
                    functionParameters: {
                      ...formData.functionParameters,
                      [param.id]: [...selectedDocs, value]
                    }
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select documents..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="session_docs">Session Documents</SelectItem>
                {knowledgeDocuments.map((doc) => (
                  <SelectItem key={`knowledge_${doc.id}`} value={`knowledge_${doc.id}`}>
                    {doc.displayName || doc.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDocs.length > 0 && (
              <div className="space-y-1 mt-1">
                {selectedDocs.map((docRef: string) => {
                  const isKnowledge = docRef.startsWith('knowledge_');
                  const docId = isKnowledge ? docRef.replace('knowledge_', '') : docRef;
                  const doc = isKnowledge ? knowledgeDocuments.find(d => d.id === docId) : null;
                  const displayName = doc ? (doc.displayName || doc.fileName) : 'Session Documents';
                  
                  return (
                    <div key={docRef} className="flex items-center gap-2 p-1 bg-green-50 rounded text-xs">
                      <span className="flex-1">{displayName}</span>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          functionParameters: {
                            ...formData.functionParameters,
                            [param.id]: selectedDocs.filter((r: string) => r !== docRef)
                          }
                        })}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Extraction Method */}
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-semibold text-white">1</div>
          <h5 className="font-medium">Extraction Method</h5>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Extraction Tool</label>
          <Select
            value={selectedToolId}
            onValueChange={(value) => {
              setSelectedToolId(value);
              setFormData({ ...formData, functionId: value });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an extraction method..." />
            </SelectTrigger>
            <SelectContent>
              {excelFunctions.length === 0 ? (
                <SelectItem value="none" disabled>No tools available</SelectItem>
              ) : (
                excelFunctions.map((tool) => (
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
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        

      </div>

      {/* Step 2: Information Source - Dynamic based on extraction method */}
      {selectedToolId && inputParameters.length > 0 && (
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs font-semibold text-white">2</div>
            <h5 className="font-medium">Information Source</h5>
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

      {/* Step 3: Output Settings */}
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">3</div>
          <h5 className="font-medium">Output Settings</h5>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Property Name</label>
            <Input
              value={formData.propertyName}
              onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
              placeholder="e.g., Column Name"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Property Type</label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) => setFormData({ ...formData, propertyType: value as any })}
            >
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
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Auto-Verification Confidence (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.autoVerificationConfidence}
              onChange={(e) => setFormData({ ...formData, autoVerificationConfidence: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={isLoading || !selectedToolId}
        >
          {isLoading ? "Saving..." : "Save Property"}
        </Button>
      </div>
    </form>
  );
}

// Main CollectionCard Component
interface CollectionCardProps {
  collection: any;
  onDeleteCollection: (id: string) => void;
  onEditCollection: (id: string, data: any) => void;
  onAddProperty: (data: any) => void;
  onEditProperty: (propertyId: string, data: any) => void;
  onDeleteProperty: (propertyId: string) => void;
  excelFunctions?: ExcelWizardryFunction[];
  knowledgeDocuments?: KnowledgeDocument[];
  projectId?: string;
}

export function CollectionCard({
  collection,
  onDeleteCollection,
  onEditCollection,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  excelFunctions = [],
  knowledgeDocuments = [],
  projectId = ''
}: CollectionCardProps) {
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [collectionName, setCollectionName] = useState(collection.collectionName);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);

  const handleEditCollection = () => {
    if (isEditingCollection) {
      onEditCollection(collection.id, { collectionName });
    }
    setIsEditingCollection(!isEditingCollection);
  };

  const handleSaveProperty = async (formData: any) => {
    setIsLoadingProperty(true);
    try {
      if (editingPropertyId) {
        await onEditProperty(editingPropertyId, formData);
        setEditingPropertyId(null);
      } else if (isAddingProperty) {
        await onAddProperty({
          ...formData,
          collectionId: collection.id,
        });
        setIsAddingProperty(false);
      }
    } finally {
      setIsLoadingProperty(false);
    }
  };

  const newProperty: any = {
    id: 'new',
    collectionId: collection.id,
    propertyName: '',
    propertyType: 'TEXT',
    description: '',
    functionId: '',
    autoVerificationConfidence: 80,
    orderIndex: collection.properties?.length || 0,
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {isEditingCollection ? (
              <Input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="max-w-xs"
                autoFocus
              />
            ) : (
              <CardTitle className="text-lg font-semibold">
                {collection.collectionName}
              </CardTitle>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditCollection}
            >
              {isEditingCollection ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteCollection(collection.id)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Properties List */}
        {collection.properties?.map((property: CollectionProperty) => (
          <div key={property.id}>
            {editingPropertyId === property.id ? (
              <InlinePropertyEditor
                property={property}
                excelFunctions={excelFunctions}
                knowledgeDocuments={knowledgeDocuments}
                onSave={handleSaveProperty}
                onCancel={() => setEditingPropertyId(null)}
                isLoading={isLoadingProperty}
                collectionName={collection.collectionName}
                projectId={projectId}
              />
            ) : (
              <div className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium text-sm">{property.propertyName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {property.propertyType}
                      </Badge>
                      {property.functionId && (
                        <Badge variant="secondary" className="text-xs">
                          {excelFunctions.find(f => f.id === property.functionId)?.toolType === "AI_ONLY" ? (
                            <Brain className="h-3 w-3 mr-1" />
                          ) : (
                            <Settings className="h-3 w-3 mr-1" />
                          )}
                          {excelFunctions.find(f => f.id === property.functionId)?.name || 'Tool'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPropertyId(property.id)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteProperty(property.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add New Property */}
        {isAddingProperty ? (
          <InlinePropertyEditor
            property={newProperty}
            excelFunctions={excelFunctions}
            knowledgeDocuments={knowledgeDocuments}
            onSave={handleSaveProperty}
            onCancel={() => setIsAddingProperty(false)}
            isLoading={isLoadingProperty}
            collectionName={collection.collectionName}
            projectId={projectId}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingProperty(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        )}
      </CardContent>
    </Card>
  );
}