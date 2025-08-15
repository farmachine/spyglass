import { useState, useEffect } from "react";
import { Edit, Trash2, Plus, GripVertical, ChevronDown, ChevronRight, Key } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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
import type { ObjectCollection, CollectionProperty } from "@shared/schema";

interface CollectionCardProps {
  collection: ObjectCollection;
  fieldTypeColors: Record<string, string>;
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
  onEditCollection,
  onDeleteCollection,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  dragHandleProps,
  hideHeader = false,
}: CollectionCardProps) {
  const { data: properties = [], isLoading } = useCollectionProperties(String(collection.id));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sort properties by orderIndex for consistent ordering
  const safeProperties = properties ? [...properties].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) : [];
  
  // Lists should be collapsed by default if they have properties, expanded if no properties
  const [isExpanded, setIsExpanded] = useState(safeProperties.length === 0);
  
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Data Property
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <DragDropContext onDragEnd={handlePropertyDragEnd}>
                <div className="space-y-3">
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
                          <div className={`relative bg-white rounded-lg border-2 ${property.isIdentifier ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-blue-300"} p-4 transition-colors`}>
                            {/* Step number and drag handle */}
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${property.isIdentifier ? "bg-blue-600 text-white" : "bg-gray-600 text-white"}`}>
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
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-gray-900">{property.propertyName}</h4>
                                    {property.isIdentifier && (
                                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                        <Key className="h-3 w-3 mr-1" />
                                        Identifier
                                      </Badge>
                                    )}
                                    <Badge className={`${fieldTypeColors[property.propertyType as keyof typeof fieldTypeColors]} text-xs`}>
                                      {property.propertyType}
                                    </Badge>
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => onEditProperty(property)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {!property.isIdentifier && property.propertyType === 'TEXT' && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => setIdentifierField.mutate({ collectionId: collection.id, propertyId: property.id })}
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
                                        onClick={() => onDeleteProperty(property.id, property.propertyName)}
                                        title="Delete property"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Property description and confidence */}
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
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
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
                    className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600"
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