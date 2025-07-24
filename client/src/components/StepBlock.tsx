import { useState } from "react";
import { Edit, Trash2, ChevronDown, ChevronRight, Plus, Grip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectSchemaFields, useObjectCollections } from "@/hooks/useSchema";
import CollectionCard from "@/components/CollectionCard";
import type { ExtractionStep } from "@/hooks/useExtractionSteps";
import type { ProjectSchemaField, ObjectCollection } from "@shared/schema";

interface StepBlockProps {
  step: ExtractionStep;
  onEdit?: (step: ExtractionStep) => void;
  onDelete?: (step: ExtractionStep) => void;
  onAddField?: (stepId: string) => void;
  onAddCollection?: (stepId: string) => void;
  onEditField?: (field: ProjectSchemaField) => void;
  onDeleteField?: (field: ProjectSchemaField) => void;
  onEditCollection?: (collection: ObjectCollection) => void;
  onDeleteCollection?: (collection: ObjectCollection) => void;
  onEditProperty?: (property: any, collectionId: string, collectionName: string) => void;
  onDeleteProperty?: (property: any) => void;
}

export default function StepBlock({ 
  step, 
  onEdit, 
  onDelete, 
  onAddField, 
  onAddCollection,
  onEditField,
  onDeleteField,
  onEditCollection,
  onDeleteCollection,
  onEditProperty,
  onDeleteProperty
}: StepBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get fields and collections for this specific step
  const { data: allFields = [] } = useProjectSchemaFields(step.projectId);
  const { data: allCollections = [] } = useObjectCollections(step.projectId);
  
  // Filter fields and collections by stepId
  const stepFields = allFields.filter(field => field.stepId === step.id);
  const stepCollections = allCollections.filter(collection => collection.stepId === step.id);
  
  // Sort by orderIndex
  const sortedFields = [...stepFields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  const sortedCollections = [...stepCollections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  
  // Field type color helpers
  const getFieldTypeColor = (fieldType: string) => {
    const colors = {
      TEXT: "bg-green-100 text-green-800",
      NUMBER: "bg-cyan-100 text-cyan-800", 
      DATE: "bg-purple-100 text-purple-800",
      BOOLEAN: "bg-orange-100 text-orange-800",
    };
    return colors[fieldType as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };
  
  const getFieldTypeColors = () => ({
    TEXT: "bg-green-100 text-green-800",
    NUMBER: "bg-cyan-100 text-cyan-800", 
    DATE: "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-orange-100 text-orange-800",
  });

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0 h-auto hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-orange-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-orange-600" />
              )}
            </Button>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                Step {step.orderIndex}
              </Badge>
              <CardTitle className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                {step.stepName}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(step)}
                className="h-8 w-8 p-0 hover:bg-orange-200 dark:hover:bg-orange-800"
              >
                <Edit className="h-4 w-4 text-orange-600" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(step)}
                className="h-8 w-8 p-0 hover:bg-red-200 dark:hover:bg-red-800"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                Description
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {step.stepDescription}
              </p>
            </div>
            
            <div className="border-t border-orange-200 dark:border-orange-800 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Fields & Collections in this Step
                </h4>
                <div className="flex items-center space-x-2">
                  {onAddField && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddField(step.id)}
                      className="h-8 px-3 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900 dark:hover:bg-orange-800 dark:text-orange-200"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field
                    </Button>
                  )}
                  {onAddCollection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddCollection(step.id)}
                      className="h-8 px-3 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900 dark:hover:bg-orange-800 dark:text-orange-200"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Collection
                    </Button>
                  )}
                </div>
              </div>
              
              {sortedFields.length === 0 && sortedCollections.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center py-8">
                  No fields or collections defined for this step yet. Click "Add Field" or "Add Collection" to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Render Schema Fields */}
                  {sortedFields.map((field) => (
                    <Card key={field.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{field.fieldName}</CardTitle>
                                <Badge className={getFieldTypeColor(field.fieldType)}>
                                  {field.fieldType}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {field.autoVerificationConfidence || 80}% confidence
                                </Badge>
                              </div>
                              {field.description && (
                                <p className="text-sm text-gray-600 mt-1">{field.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {onEditField && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => onEditField(field)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {onDeleteField && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600"
                                onClick={() => onDeleteField(field)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  
                  {/* Render Collections */}
                  {sortedCollections.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      fieldTypeColors={getFieldTypeColors()}
                      onEditCollection={onEditCollection}
                      onDeleteCollection={(id, name) => onDeleteCollection && onDeleteCollection(collection)}
                      onAddProperty={(collectionId, collectionName) => {
                        // Handle add property - for now just placeholder
                      }}
                      onEditProperty={onEditProperty}
                      onDeleteProperty={onDeleteProperty}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}