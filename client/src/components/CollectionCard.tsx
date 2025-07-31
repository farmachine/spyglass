import { useState, useEffect } from "react";
import { Edit, Trash2, Plus, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
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
      {/* Collection Header */}
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
      
      {/* Expanded content - Clean table design like SessionView */}
      {isExpanded && (
        <div className="ml-6">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading properties...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-2">No properties defined</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onAddProperty(collection.id, collection.collectionName)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <DragDropContext onDragEnd={handlePropertyDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Property Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Auto Verify</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <Droppable droppableId={`collection-properties-${collection.id}`}>
                    {(provided) => (
                      <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                        {safeProperties.map((property, index) => (
                          <Draggable key={property.id} draggableId={property.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <TableRow 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={snapshot.isDragging ? "opacity-50" : ""}
                              >
                                <TableCell>
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
                                  >
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{property.propertyName}</TableCell>
                                <TableCell>
                                  <Badge className={fieldTypeColors[property.propertyType as keyof typeof fieldTypeColors]}>
                                    {property.propertyType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-gray-600">
                                  {property.description || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {property.autoVerificationConfidence || 80}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => onEditProperty(property)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-red-600"
                                      onClick={() => onDeleteProperty(property.id, property.propertyName)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </Table>
              </DragDropContext>
              
              {/* Add Property button at bottom */}
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onAddProperty(collection.id, collection.collectionName)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}