import { useState } from "react";
import { Edit, Trash2, Plus } from "lucide-react";
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
  
  // Get fields and collections for this specific step
  const { data: allFields = [] } = useProjectSchemaFields(step.projectId);
  const { data: allCollections = [] } = useObjectCollections(step.projectId);
  
  // Filter fields and collections by stepId
  const stepFields = allFields.filter((field: any) => field.stepId === step.id);
  const stepCollections = allCollections.filter((collection: any) => collection.stepId === step.id);
  
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

  return (
    <div>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {step.orderIndex || 1}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">{step.stepName}</CardTitle>
              {step.stepDescription && (
                <p className="text-sm text-gray-600 mt-1">{step.stepDescription}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(step)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Edit className="h-4 w-4 text-gray-600" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(step)}
                className="h-8 w-8 p-0 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-800">
              Fields & Collections in this Step
            </h4>
            <div className="flex items-center space-x-2">
              {onAddField && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddField(step.id)}
                  className="h-8 px-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700"
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
                  className="h-8 px-3 text-sm bg-green-50 hover:bg-green-100 text-green-700"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Collection
                </Button>
              )}
            </div>
          </div>
          
          {sortedFields.length === 0 && sortedCollections.length === 0 ? (
            <p className="text-sm text-gray-600 italic text-center py-8 bg-gray-50 rounded-lg">
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
                            className="h-8 w-8 p-0 hover:bg-blue-100"
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {onDeleteField && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteField(field)}
                            className="h-8 w-8 p-0 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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
                  fieldTypeColors={{
                    TEXT: "bg-green-100 text-green-800",
                    NUMBER: "bg-cyan-100 text-cyan-800", 
                    DATE: "bg-purple-100 text-purple-800",
                    BOOLEAN: "bg-orange-100 text-orange-800",
                  }}
                  onEditCollection={(coll) => onEditCollection && onEditCollection(coll)}
                  onDeleteCollection={(id, name) => onDeleteCollection && onDeleteCollection(collection)}
                  onAddProperty={() => {}} // This should be handled by the parent
                  onEditProperty={(prop) => onEditProperty && onEditProperty(prop, collection.id, collection.collectionName)}
                  onDeleteProperty={(id, name) => onDeleteProperty && onDeleteProperty({ id, propertyName: name })}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
}