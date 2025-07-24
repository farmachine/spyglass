import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Package, ArrowRight, Settings } from "lucide-react";
import type { ExtractionStepWithDetails } from "@shared/schema";

interface StepDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ExtractionStepWithDetails;
  onSave: () => void;
}

export function StepDetailsDialog({ open, onOpenChange, step }: StepDetailsDialogProps) {
  const getStepTypeIcon = (stepType: string) => {
    switch (stepType) {
      case "extract":
        return <FileText className="h-4 w-4" />;
      case "transform":
        return <ArrowRight className="h-4 w-4" />;
      case "validate":
        return <Package className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStepTypeColor = (stepType: string) => {
    switch (stepType) {
      case "extract":
        return "bg-blue-100 text-blue-800";
      case "transform":
        return "bg-purple-100 text-purple-800";
      case "validate":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFieldTypeColor = (fieldType: string) => {
    switch (fieldType) {
      case "TEXT":
        return "bg-green-100 text-green-800";
      case "NUMBER":
        return "bg-blue-100 text-blue-800";
      case "DATE":
        return "bg-purple-100 text-purple-800";
      case "BOOLEAN":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <DialogTitle className="flex items-center space-x-2">
              <span>{step.stepName}</span>
              <Badge 
                variant="secondary" 
                className={`text-xs ${getStepTypeColor(step.stepType)}`}
              >
                {getStepTypeIcon(step.stepType)}
                <span className="ml-1 capitalize">{step.stepType}</span>
              </Badge>
            </DialogTitle>
          </div>
          {step.description && (
            <p className="text-sm text-gray-600 mt-2">{step.description}</p>
          )}
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schema">Schema Fields</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="references">References</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Step Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Order Index:</span>
                    <span className="text-sm font-medium">{step.orderIndex || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Conditional:</span>
                    <Badge variant={step.isConditional ? "default" : "outline"} className="text-xs">
                      {step.isConditional ? "Yes" : "No"}
                    </Badge>
                  </div>
                  {step.isConditional && step.conditionLogic && (
                    <div>
                      <span className="text-sm text-gray-600">Condition Logic:</span>
                      <p className="text-sm mt-1 p-2 bg-gray-50 rounded text-gray-800">
                        {step.conditionLogic}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Schema Fields:</span>
                    <span className="text-sm font-medium">{step.schemaFields.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Collections:</span>
                    <span className="text-sm font-medium">{step.collections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">References:</span>
                    <span className="text-sm font-medium">{step.references.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <div className="space-y-3">
              {step.schemaFields.length > 0 ? (
                step.schemaFields
                  .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                  .map((field) => (
                    <Card key={field.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{field.fieldName}</h4>
                            {field.description && (
                              <p className="text-sm text-gray-600 mt-1">{field.description}</p>
                            )}
                          </div>
                          <Badge className={`text-xs ${getFieldTypeColor(field.fieldType)}`}>
                            {field.fieldType}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8">No schema fields defined for this step.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="collections" className="space-y-4">
            <div className="space-y-4">
              {step.collections.length > 0 ? (
                step.collections
                  .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                  .map((collection) => (
                    <Card key={collection.id}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center space-x-2">
                          <Package className="h-4 w-4" />
                          <span>{collection.collectionName}</span>
                        </CardTitle>
                        {collection.description && (
                          <p className="text-sm text-gray-600">{collection.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {collection.properties.length > 0 ? (
                            collection.properties
                              .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                              .map((property) => (
                                <div key={property.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div>
                                    <span className="font-medium text-sm">{property.propertyName}</span>
                                    {property.description && (
                                      <p className="text-xs text-gray-600">{property.description}</p>
                                    )}
                                  </div>
                                  <Badge className={`text-xs ${getFieldTypeColor(property.propertyType)}`}>
                                    {property.propertyType}
                                  </Badge>
                                </div>
                              ))
                          ) : (
                            <p className="text-sm text-gray-500">No properties defined</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
              ) : (
                <p className="text-gray-500 text-center py-8">No collections defined for this step.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="references" className="space-y-4">
            <div className="space-y-3">
              {step.references.length > 0 ? (
                step.references.map((reference) => (
                  <Card key={reference.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center space-x-3">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">
                            References: {reference.fromFieldName || 'Unknown field'}
                          </p>
                          <p className="text-xs text-gray-600">
                            From step: {reference.fromStepId}
                          </p>
                          {reference.referenceType && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {reference.referenceType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No references defined for this step.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}