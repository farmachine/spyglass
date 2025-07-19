import { useState } from "react";
import { Settings, Plus, Edit, Trash2, Database, FileText, Tag, Lightbulb, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  useProjectSchemaFields,
  useObjectCollections,
  useCollectionProperties,
  useCreateSchemaField, 
  useUpdateSchemaField, 
  useDeleteSchemaField,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty
} from "@/hooks/useSchema";
import { useUpdateProject } from "@/hooks/useProjects";
import SchemaFieldDialog from "./SchemaFieldDialog";
import CollectionDialog from "./CollectionDialog";
import PropertyDialog from "./PropertyDialog";
import CollectionCard from "./CollectionCard";
import type { ProjectWithDetails, ProjectSchemaField, ObjectCollection, CollectionProperty } from "@shared/schema";

interface DefineDataProps {
  project: ProjectWithDetails;
}

export default function DefineData({ project }: DefineDataProps) {
  const [activeTab, setActiveTab] = useState("schema");
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ open: boolean; field?: ProjectSchemaField | null }>({ open: false });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; collection?: ObjectCollection | null }>({ open: false });
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: number; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: number; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for live data instead of using static props
  const { data: schemaFields = [], isLoading: schemaFieldsLoading, error: schemaFieldsError } = useProjectSchemaFields(project.id);
  const { data: collections = [], isLoading: collectionsLoading, error: collectionsError } = useObjectCollections(project.id);

  // Handle data being null/undefined from API errors and sort by orderIndex
  const safeSchemaFields = Array.isArray(schemaFields) 
    ? [...schemaFields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];
  const safeCollections = Array.isArray(collections) 
    ? [...collections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];

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

  // Create a mutation that doesn't invalidate any queries for collection reordering
  const updateCollectionForReorder = useMutation({
    mutationFn: ({ id, collection }: { id: string; collection: Partial<any> }) =>
      apiRequest(`/api/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(collection),
      }),
    // No onSuccess invalidation - rely on optimistic updates only
  });

  // Create a mutation that doesn't invalidate project queries for reordering
  const updateSchemaFieldForReorder = useMutation({
    mutationFn: ({ id, field }: { id: string; field: Partial<any> }) =>
      apiRequest(`/api/schema-fields/${id}`, {
        method: "PUT",
        body: JSON.stringify(field),
      }),
    onSuccess: () => {
      // Only invalidate schema fields, not the main project query
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "schema"] });
    },
  });

  // Drag and drop handler for reordering schema fields
  const handleFieldDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(safeSchemaFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistically update the cache immediately to prevent visual flashing
    const updatedItems = items.map((field, index) => ({ ...field, orderIndex: index }));
    queryClient.setQueryData(["/api/projects", project.id, "schema"], updatedItems);

    // Update orderIndex for all affected fields in the background
    try {
      const updatePromises = items.map((field, index) => 
        updateSchemaFieldForReorder.mutateAsync({ 
          id: field.id, 
          field: { ...field, orderIndex: index } 
        })
      );
      
      await Promise.all(updatePromises);
      
      // Silent update - no toast notification for reordering
    } catch (error) {
      // If update fails, refetch to restore correct order
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "schema"] });
      
      toast({
        title: "Error",
        description: "Failed to update field order. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Drag and drop handler for reordering collections
  const handleCollectionDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(safeCollections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistically update the cache immediately to prevent visual flashing
    const updatedItems = items.map((collection, index) => ({ ...collection, orderIndex: index }));
    queryClient.setQueryData(["/api/projects", project.id, "collections"], updatedItems);

    // Update orderIndex for all affected collections in the background
    try {
      const updatePromises = items.map((collection, index) => 
        updateCollectionForReorder.mutateAsync({ 
          id: collection.id, 
          collection: { ...collection, orderIndex: index } 
        })
      );
      
      await Promise.all(updatePromises);
      
      // Silent update - no toast notification for reordering
    } catch (error) {
      // If update fails, refetch to restore correct order
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "collections"] });
      
      toast({
        title: "Error",
        description: "Failed to update collection order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fieldTypeColors = {
    TEXT: "bg-primary/10 text-primary",
    NUMBER: "bg-green-100 text-green-800",
    DATE: "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-orange-100 text-orange-800",
  };

  // Schema field handlers
  const handleCreateSchemaField = async (data: any) => {
    try {
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
        field: { ...data, projectId: project.id } 
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

  // Collection handlers
  const handleCreateCollection = async (data: any) => {
    try {
      await createCollection.mutateAsync(data);
      setCollectionDialog({ open: false });
      toast({
        title: "Collection created",
        description: "Object collection has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create collection. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCollection = async (data: any) => {
    if (!collectionDialog.collection) return;
    try {
      await updateCollection.mutateAsync({ 
        id: collectionDialog.collection.id, 
        collection: { ...data, projectId: project.id } 
      });
      setCollectionDialog({ open: false });
      toast({
        title: "Collection updated",
        description: "Object collection has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update collection. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Property handlers (using direct API call since we need dynamic collectionId)
  const handleCreateProperty = async (data: any) => {
    if (!propertyDialog.collectionId) return;
    try {
      const response = await fetch(`/api/collections/${propertyDialog.collectionId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to create property');
      
      // Invalidate queries to refresh the data
      const { queryClient } = await import('@/lib/queryClient');
      queryClient.invalidateQueries({ queryKey: ["/api/collections", propertyDialog.collectionId, "properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      
      setPropertyDialog({ open: false });
      toast({
        title: "Property added",
        description: "Collection property has been added successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add property. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProperty = async (data: any) => {
    if (!propertyDialog.property) return;
    try {
      await updateProperty.mutateAsync({ 
        id: propertyDialog.property.id, 
        property: { ...data, collectionId: propertyDialog.property.collectionId } 
      });
      setPropertyDialog({ open: false });
      toast({
        title: "Property updated",
        description: "Collection property has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Main Object Name handler
  const handleMainObjectNameSave = async () => {
    if (!mainObjectName.trim()) {
      toast({
        title: "Error",
        description: "Main object name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await updateProject.mutateAsync({ 
        id: project.id, 
        project: { mainObjectName: mainObjectName.trim() } 
      });
      toast({
        title: "Main object name updated",
        description: "The main object name has been updated successfully.",
      });
      setIsEditingMainObjectName(false);
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
    
    try {
      switch (deleteDialog.type) {
        case "field":
          await deleteSchemaField.mutateAsync(deleteDialog.id);
          toast({
            title: "Field deleted",
            description: "Schema field has been deleted successfully.",
          });
          break;
        case "collection":
          await deleteCollection.mutateAsync(deleteDialog.id);
          toast({
            title: "Collection deleted",
            description: "Object collection has been deleted successfully.",
          });
          break;
        case "property":
          await deleteProperty.mutateAsync(deleteDialog.id);
          toast({
            title: "Property deleted",
            description: "Collection property has been deleted successfully.",
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      });
    }
    setDeleteDialog({ open: false });
  };

  // Check if this is a new project without data schema
  const isNewProject = !project.isInitialSetupComplete && 
    safeSchemaFields.length === 0 &&
    safeCollections.length === 0;

  return (
    <div>
      {/* Welcome Message for New Projects */}
      {isNewProject && (
        <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-4">
            <Lightbulb className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Welcome to {project.name}!
              </h3>
              <p className="text-blue-800 mb-4">
                Before you can start extracting data, you need to define what information you want to capture from your documents. This helps the AI understand exactly what to look for.
              </p>
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>Step 1:</strong> Set your "Main Object Name" below (e.g., "Invoice", "Contract", "Report")</p>
                <p><strong>Step 2:</strong> Add fields for the main document data (e.g., "Total Amount", "Date", "Company Name")</p>
                <p><strong>Step 3:</strong> Optionally, create collections for repeating items (e.g., "Line Items", "Signers")</p>
              </div>
              <p className="text-blue-800 mt-4 font-medium">
                Once you've defined your data schema, the other tabs will become available for uploading and processing documents.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Define Data Schema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure the data structure and fields for extraction
          </p>
        </div>
      </div>

      {/* Main Object Name Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Main Object Name
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="mainObjectName" className="text-sm font-medium">
                What type of object are you extracting data from?
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schema">{project.mainObjectName || "Session"} Data</TabsTrigger>
          <TabsTrigger value="collections">Items related to {project.mainObjectName || "Session"}</TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {project.mainObjectName || "Session"} Data Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schemaFieldsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Loading schema fields...</p>
                </div>
              ) : safeSchemaFields.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No schema fields defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define global fields that apply to the entire document set
                  </p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleFieldDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Auto Verify</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <Droppable droppableId="schema-fields">
                      {(provided) => (
                        <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                          {safeSchemaFields.map((field, index) => (
                            <Draggable key={field.id} draggableId={field.id} index={index}>
                              {(provided, snapshot) => (
                                <TableRow 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={snapshot.isDragging ? "bg-gray-50" : ""}
                                >
                                  <TableCell>
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                                    >
                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{field.fieldName}</TableCell>
                                  <TableCell>
                                    <Badge className={fieldTypeColors[field.fieldType as keyof typeof fieldTypeColors]}>
                                      {field.fieldType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {field.description || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {field.autoVerificationConfidence || 80}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setSchemaFieldDialog({ open: true, field })}
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
                                          id: field.id, 
                                          name: field.fieldName 
                                        })}
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
              )}
              
              {/* Always show Add Field button */}
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => setSchemaFieldDialog({ open: true, field: null })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Items related to {project.mainObjectName || "Session"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collectionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Loading collections...</p>
                </div>
              ) : safeCollections.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No object collections defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define object types (like Employees, Assets, etc.) with their properties
                  </p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleCollectionDragEnd}>
                  <Droppable droppableId="collections">
                    {(provided) => (
                      <div 
                        className="space-y-6"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {safeCollections.map((collection, index) => (
                          <Draggable key={collection.id} draggableId={collection.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={snapshot.isDragging ? "opacity-50" : ""}
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing p-2 rounded hover:bg-gray-100 mt-4"
                                  >
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                  </div>
                                  <div className="flex-1">
                                    <CollectionCard
                                      collection={collection}
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
              )}
              
              {/* Always show Add Collection button */}
              <div className="mt-6 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => setCollectionDialog({ open: true, collection: null })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Collection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schema Field Dialog */}
      <SchemaFieldDialog
        open={schemaFieldDialog.open}
        onOpenChange={(open) => setSchemaFieldDialog({ open, field: open ? schemaFieldDialog.field : null })}
        onSave={schemaFieldDialog.field ? handleUpdateSchemaField : handleCreateSchemaField}
        field={schemaFieldDialog.field}
        isLoading={createSchemaField.isPending || updateSchemaField.isPending}
      />

      {/* Collection Dialog */}
      <CollectionDialog
        open={collectionDialog.open}
        onOpenChange={(open) => setCollectionDialog({ open, collection: open ? collectionDialog.collection : null })}
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCreateCollection}
        collection={collectionDialog.collection}
        isLoading={createCollection.isPending || updateCollection.isPending}
      />

      {/* Property Dialog */}
      <PropertyDialog
        open={propertyDialog.open}
        onOpenChange={(open) => setPropertyDialog({ 
          open, 
          property: open ? propertyDialog.property : null,
          collectionId: open ? propertyDialog.collectionId : undefined,
          collectionName: open ? propertyDialog.collectionName : undefined
        })}
        onSave={propertyDialog.property ? handleUpdateProperty : handleCreateProperty}
        property={propertyDialog.property}
        collectionName={propertyDialog.collectionName}
        isLoading={updateProperty.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? This action cannot be undone.
              {deleteDialog.type === "collection" && " All properties in this collection will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSchemaField.isPending || deleteCollection.isPending || deleteProperty.isPending}
            >
              {deleteSchemaField.isPending || deleteCollection.isPending || deleteProperty.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
