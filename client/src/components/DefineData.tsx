import { useState } from "react";
import { Plus, Edit, Trash2, Settings, FileText, Database, Tag, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useProjectSchemaFields,
  useObjectCollections,
  useCreateSchemaField,
  useUpdateSchemaField,
  useDeleteSchemaField,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useUpdateProperty,
  useDeleteProperty
} from "@/hooks/useSchema";
import { useUpdateProject } from "@/hooks/useProjects";
import SchemaFieldDialog from "@/components/SchemaFieldDialog";
import CollectionDialog from "@/components/CollectionDialog";
import PropertyDialog from "@/components/PropertyDialog";
import DeleteDialog from "@/components/DeleteDialog";
import CollectionCard from "@/components/CollectionCard";
import type {
  ProjectWithDetails,
  ProjectSchemaField,
  ObjectCollection,
  CollectionProperty,
} from "@shared/schema";

interface DefineDataProps {
  project: ProjectWithDetails;
}

export default function DefineData({ project }: DefineDataProps) {
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ open: boolean; field?: ProjectSchemaField | null }>({ open: false });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; collection?: ObjectCollection | null }>({ open: false });
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: number; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: number; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for live data instead of using static props
  const { data: schemaFields = [], isLoading: schemaFieldsLoading } = useProjectSchemaFields(project.id);
  const { data: collections = [], isLoading: collectionsLoading } = useObjectCollections(project.id);

  // Handle data being null/undefined from API errors and sort by orderIndex
  const safeSchemaFields = Array.isArray(schemaFields) 
    ? [...schemaFields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];
  const safeCollections = Array.isArray(collections) 
    ? [...collections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];

  // Combine fields and collections for unified ordering
  const allDataItems = [
    ...safeSchemaFields.map(field => ({ ...field, type: 'field' as const })),
    ...safeCollections.map(collection => ({ ...collection, type: 'collection' as const }))
  ].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  // Schema field mutations
  const createSchemaField = useCreateSchemaField(project.id);
  const updateSchemaField = useUpdateSchemaField();
  const deleteSchemaField = useDeleteSchemaField();

  // Collection mutations
  const createCollection = useCreateCollection(project.id);
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();

  // Property mutations  
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  
  // Project mutations
  const updateProject = useUpdateProject();

  // Create mutations that don't invalidate any queries for reordering
  const updateCollectionForReorder = useMutation({
    mutationFn: ({ id, collection }: { id: string; collection: Partial<any> }) =>
      apiRequest(`/api/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(collection),
      }),
    onSuccess: () => {
      // Only invalidate collections query, not project query to prevent tab redirects
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", project.id, "collections"],
        exact: true 
      });
    }
  });

  const updateSchemaFieldForReorder = useMutation({
    mutationFn: ({ id, field }: { id: string; field: Partial<any> }) =>
      apiRequest(`/api/schema-fields/${id}`, {
        method: "PUT",
        body: JSON.stringify(field),
      }),
    onSuccess: () => {
      // Only invalidate schema fields, not the main project query to prevent tab redirects
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", project.id, "schema"],
        exact: true 
      });
    },
  });

  // Unified drag and drop handler for both fields and collections
  const handleUnifiedDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(allDataItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update orderIndex for all items to maintain unified order
    const updatedItems = items.map((item, index) => ({ ...item, orderIndex: index }));
    
    // Separate fields and collections but keep their unified order
    const updatedFields = updatedItems.filter(item => item.type === 'field');
    const updatedCollections = updatedItems.filter(item => item.type === 'collection');

    // Optimistically update both caches
    queryClient.setQueryData(["/api/projects", project.id, "schema"], updatedFields);
    queryClient.setQueryData(["/api/projects", project.id, "collections"], updatedCollections);

    // Update orderIndex for all affected items in the background
    try {
      const fieldPromises = updatedFields.map((field) => 
        updateSchemaFieldForReorder.mutateAsync({ 
          id: field.id, 
          field: { ...field, orderIndex: field.orderIndex } 
        })
      );
      
      const collectionPromises = updatedCollections.map((collection) => 
        updateCollectionForReorder.mutateAsync({ 
          id: collection.id, 
          collection: { ...collection, orderIndex: collection.orderIndex } 
        })
      );
      
      await Promise.all([...fieldPromises, ...collectionPromises]);
      
      // Silent update - no toast notification for reordering
    } catch (error) {
      // If update fails, refetch to restore correct order
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", project.id, "schema"],
        exact: true 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", project.id, "collections"],
        exact: true 
      });
      
      toast({
        title: "Error",
        description: "Failed to update item order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fieldTypeColors = {
    TEXT: "bg-blue-100 text-blue-800", // Changed to explicit blue background
    NUMBER: "bg-cyan-100 text-cyan-800", // Changed to turquoise/cyan
    DATE: "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-orange-100 text-orange-800",
  };

  // Schema field handlers
  const handleCreateSchemaField = async (data: any) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      const orderIndex = safeSchemaFields.length; // Add to the end
      await createSchemaField.mutateAsync({ ...data, orderIndex });
      setSchemaFieldDialog({ open: false });
      toast({
        title: "Field added",
        description: "Schema field has been added successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add schema field. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSchemaField = async (data: any) => {
    if (!schemaFieldDialog.field) return;
    try {
      await updateSchemaField.mutateAsync({ 
        id: schemaFieldDialog.field.id, 
        field: data 
      });
      setSchemaFieldDialog({ open: false });
      toast({
        title: "Field updated",
        description: "Schema field has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update schema field. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchemaField = async (id: number) => {
    try {
      await deleteSchemaField.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Field deleted",
        description: "Schema field has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete schema field. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Collection handlers
  const handleCreateCollection = async (data: any) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      const orderIndex = safeCollections.length; // Add to the end
      await createCollection.mutateAsync({ ...data, orderIndex });
      setCollectionDialog({ open: false });
      toast({
        title: "List created",
        description: "List has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create list. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCollection = async (data: any) => {
    if (!collectionDialog.collection) return;
    try {
      await updateCollection.mutateAsync({ 
        id: collectionDialog.collection.id, 
        collection: data 
      });
      setCollectionDialog({ open: false });
      toast({
        title: "List updated",
        description: "List has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update list. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCollection = async (id: number) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      await deleteCollection.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "List deleted",
        description: "List has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete list. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Property handlers
  const handleCreateProperty = async (data: any) => {
    if (!propertyDialog.collectionId) return;
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      // Create the property directly using apiRequest since we need dynamic collectionId
      await apiRequest(`/api/collections/${propertyDialog.collectionId}/properties`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      
      // Manually invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/collections", propertyDialog.collectionId, "properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      setPropertyDialog({ open: false });
      toast({
        title: "Property created",
        description: "Property has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create property. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProperty = async (data: any) => {
    if (!propertyDialog.property) return;
    try {
      await updateProperty.mutateAsync({ 
        id: propertyDialog.property.id, 
        property: data 
      });
      setPropertyDialog({ open: false });
      toast({
        title: "Property updated",
        description: "Property has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProperty = async (id: number) => {
    try {
      await deleteProperty.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Property deleted",
        description: "Property has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete property. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Main object name handlers
  const handleMainObjectNameSave = async () => {
    try {
      await updateProject.mutateAsync({
        id: project.id,
        project: { mainObjectName }
      });
      setIsEditingMainObjectName(false);
      toast({
        title: "Main object name updated",
        description: "The main object name has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update main object name. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return;

    switch (deleteDialog.type) {
      case "field":
        await handleDeleteSchemaField(deleteDialog.id);
        break;
      case "collection":
        await handleDeleteCollection(deleteDialog.id);
        break;
      case "property":
        await handleDeleteProperty(deleteDialog.id);
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Define Data</h1>
      </div>

      {/* Main Object Name Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="mainObjectName" className="text-sm font-medium">
                What type of data are you extracting?
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                This will replace "Session" throughout the interface (e.g. "Invoice", "Contract", "Report")
              </p>
              {isEditingMainObjectName ? (
                <div className="flex gap-2">
                  <Input
                    id="mainObjectName"
                    value={mainObjectName}
                    onChange={(e) => setMainObjectName(e.target.value)}
                    placeholder="e.g. Invoice, Contract, Report"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleMainObjectNameSave}>
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setMainObjectName(project.mainObjectName || "Session");
                      setIsEditingMainObjectName(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-blue-600">
                    {project.mainObjectName || "Session"}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsEditingMainObjectName(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Data Structure Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <Label className="text-sm font-medium">
              Define the fields and lists to extract from your {project.mainObjectName || "Session"} documents
            </Label>
          </div>
          {(schemaFieldsLoading || collectionsLoading) ? (
            <div className="text-center py-8">
              <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-gray-600">Loading data structure...</p>
            </div>
          ) : allDataItems.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No data structure defined
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Add fields and lists to extract data from your {project.mainObjectName || "Session"} documents
              </p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleUnifiedDragEnd}>
              <Droppable droppableId="unified-data">
                {(provided) => (
                  <div 
                    className="space-y-4"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {allDataItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "opacity-50" : ""}
                          >
                            {item.type === 'field' ? (
                              <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
                                      >
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <CardTitle className="text-lg">{item.fieldName}</CardTitle>
                                          <Badge className={fieldTypeColors[item.fieldType as keyof typeof fieldTypeColors]}>
                                            {item.fieldType}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {item.autoVerificationConfidence || 80}% confidence
                                          </Badge>
                                        </div>
                                        {item.description && (
                                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setSchemaFieldDialog({ open: true, field: item })}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-600"
                                        onClick={() => setDeleteDialog({ 
                                          open: true, 
                                          type: "field", 
                                          id: item.id, 
                                          name: item.fieldName 
                                        })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                              </Card>
                            ) : (
                              <CollectionCard
                                dragHandleProps={provided.dragHandleProps}
                                collection={item}
                                fieldTypeColors={fieldTypeColors}
                                onEditCollection={(collection) => setCollectionDialog({ open: true, collection })}
                                onDeleteCollection={(id, name) => setDeleteDialog({ 
                                  open: true, 
                                  type: "collection", 
                                  id, 
                                  name 
                                })}
                                onAddProperty={(collectionId, collectionName) => setPropertyDialog({ 
                                  open: true, 
                                  property: null, 
                                  collectionId,
                                  collectionName 
                                })}
                                onEditProperty={(property) => setPropertyDialog({ 
                                  open: true, 
                                  property, 
                                  collectionId: property.collectionId,
                                  collectionName: safeCollections.find(c => c.id === property.collectionId)?.collectionName || "" 
                                })}
                                onDeleteProperty={(id, name) => setDeleteDialog({ 
                                  open: true, 
                                  type: "property", 
                                  id, 
                                  name 
                                })}
                              />
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Action buttons */}
          <div className="mt-6 pt-6 border-t space-y-3">
            <Button 
              variant="outline"
              onClick={() => setSchemaFieldDialog({ open: true, field: null })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
            <Button 
              variant="outline"
              onClick={() => setCollectionDialog({ open: true, collection: null })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add List
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SchemaFieldDialog
        open={schemaFieldDialog.open}
        onOpenChange={(open) => setSchemaFieldDialog({ open, field: null })}
        onSave={schemaFieldDialog.field ? handleUpdateSchemaField : handleCreateSchemaField}
        field={schemaFieldDialog.field}
      />

      <CollectionDialog
        open={collectionDialog.open}
        onOpenChange={(open) => setCollectionDialog({ open, collection: null })}
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCreateCollection}
        collection={collectionDialog.collection}
      />

      <PropertyDialog
        open={propertyDialog.open}
        onOpenChange={(open) => setPropertyDialog({ open, property: null, collectionId: null, collectionName: "" })}
        onSave={propertyDialog.property ? handleUpdateProperty : handleCreateProperty}
        property={propertyDialog.property}
        collectionName={propertyDialog.collectionName}
      />

      <DeleteDialog
        open={deleteDialog.open}
        title={deleteDialog.type === "field" ? "Delete Field" : 
               deleteDialog.type === "collection" ? "Delete List" : "Delete Property"}
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
      />
    </div>
  );
}