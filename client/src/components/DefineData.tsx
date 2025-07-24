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
import { useExtractionSteps, useCreateExtractionStep, useDeleteExtractionStep } from "@/hooks/useExtractionSteps";
import SchemaFieldDialog from "@/components/SchemaFieldDialog";
import CollectionDialog from "@/components/CollectionDialog";
import PropertyDialog from "@/components/PropertyDialog";
import DeleteDialog from "@/components/DeleteDialog";
import CollectionCard from "@/components/CollectionCard";
import StepDialog from "@/components/StepDialog";
import StepBlock from "@/components/StepBlock";
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
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ open: boolean; field?: ProjectSchemaField | null; stepId?: string }>({ open: false });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; collection?: ObjectCollection | null; stepId?: string }>({ open: false });
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: number; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: number; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);
  // State for managing extraction steps
  const [stepDialog, setStepDialog] = useState<{ open: boolean; step?: any | null }>({ open: false });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for live data instead of using static props
  const { data: schemaFields = [], isLoading: schemaFieldsLoading } = useProjectSchemaFields(project.id);
  const { data: collections = [], isLoading: collectionsLoading } = useObjectCollections(project.id);
  const { data: extractionSteps = [], isLoading: stepsLoading } = useExtractionSteps(project.id);

  // Handle data being null/undefined from API errors and sort by orderIndex
  const safeSchemaFields = Array.isArray(schemaFields) 
    ? [...schemaFields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];
  const safeCollections = Array.isArray(collections) 
    ? [...collections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];
  const safeExtractionSteps = Array.isArray(extractionSteps) 
    ? [...extractionSteps].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
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

  // Step mutations
  const createExtractionStep = useCreateExtractionStep();
  const deleteExtractionStep = useDeleteExtractionStep();

  // Handle step creation
  const handleCreateStep = async (stepData: any) => {
    try {
      await createExtractionStep.mutateAsync({
        projectId: project.id,
        stepData: {
          stepName: stepData.name,
          stepDescription: stepData.description,
          orderIndex: safeExtractionSteps.length
        }
      });
      toast({
        title: "Step created",
        description: `Step "${stepData.name}" has been added to your extraction workflow.`,
      });
    } catch (error) {
      console.error("Step creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create extraction step. Please try again.",
        variant: "destructive",
      });
    }
  };
  
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
      const orderIndex = safeSchemaFields.length; // Add to the end
      // Include stepId if provided (for step-based creation)
      const fieldData = schemaFieldDialog.stepId 
        ? { ...data, orderIndex, stepId: schemaFieldDialog.stepId }
        : { ...data, orderIndex };
      
      await createSchemaField.mutateAsync(fieldData);
      
      // Mark project as interacted AFTER successful creation to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
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
        field: data,
        projectId: project.id // Pass the current project ID for cache invalidation
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
      const orderIndex = safeCollections.length; // Add to the end
      // Include stepId if provided (for step-based creation)
      const collectionData = collectionDialog.stepId 
        ? { ...data, orderIndex, stepId: collectionDialog.stepId }
        : { ...data, orderIndex };
      
      await createCollection.mutateAsync(collectionData);
      
      // Mark project as interacted AFTER successful creation to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
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
        collection: data,
        projectId: project.id // Pass the current project ID for cache invalidation
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
        property: data,
        collectionId: propertyDialog.property.collectionId // Pass the collection ID for cache invalidation
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

  const handleDeleteStep = async (id: string) => {
    try {
      await deleteExtractionStep.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Step deleted",
        description: "Extraction step has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete step. Please try again.",
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
      case "step":
        await handleDeleteStep(deleteDialog.id);
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Show only when no data items exist */}
      {allDataItems.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-blue-900 mb-2 text-center">
            Welcome! Let's define your data structure
          </h3>
          <p className="text-blue-700 mb-4 text-center">
            To start extracting data from your {project.mainObjectName || "Session"} documents, you'll need to define what information you want to capture.
          </p>
          <div className="text-left max-w-md mx-auto space-y-2 text-sm text-blue-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Add fields for single pieces of information (like "Company Name" or "Date")</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Create lists for multiple similar items (like "Parties" or "Line Items")</span>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Define Data</h1>
      </div>

      {/* Main Object Name Card */}
      <Card className="mb-4">
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

      {/* Main Content - No outer card wrapper */}
      {(schemaFieldsLoading || collectionsLoading) ? (
        <div className="text-center py-8">
          <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading data structure...</p>
        </div>
      ) : safeExtractionSteps.length === 0 ? (
        <div className="text-center py-8">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No extraction steps defined
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Create extraction steps to organize fields and collections for processing your {project.mainObjectName || "Session"} documents
          </p>
        </div>
      ) : (
        /* Extraction Steps - Main outer containers */
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Extraction Steps</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define the fields and lists to extract from your {project.mainObjectName || "Session"} documents
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {safeExtractionSteps.length} step{safeExtractionSteps.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {safeExtractionSteps.map((step) => (
            <Card key={step.id} className="bg-white border-2 border-gray-300">
              <StepBlock 
                step={step}
                onEdit={(step) => setStepDialog({ open: true, step })}
                onDelete={(step) => setDeleteDialog({ 
                  open: true, 
                  type: "step", 
                  id: step.id, 
                  name: step.stepName 
                })}
                onAddField={(stepId) => {
                  // Set the stepId context for the field dialog
                  setSchemaFieldDialog({ open: true, field: null, stepId });
                }}
                onAddCollection={(stepId) => {
                  // Set the stepId context for the collection dialog  
                  setCollectionDialog({ open: true, collection: null, stepId });
                }}
                onEditField={(field) => setSchemaFieldDialog({ open: true, field })}
                onDeleteField={(field) => setDeleteDialog({ 
                  open: true, 
                  type: "field", 
                  id: field.id, 
                  name: field.fieldName 
                })}
                onEditCollection={(collection) => setCollectionDialog({ open: true, collection })}
                onDeleteCollection={(collection) => setDeleteDialog({ 
                  open: true, 
                  type: "collection", 
                  id: collection.id, 
                  name: collection.collectionName 
                })}
                onEditProperty={(property, collectionId, collectionName) => setPropertyDialog({ 
                  open: true, 
                  property, 
                  collectionId,
                  collectionName 
                })}
                onDeleteProperty={(property) => setDeleteDialog({ 
                  open: true, 
                  type: "property", 
                  id: property.id, 
                  name: property.propertyName 
                })}
              />
            </Card>
          ))}
        </div>
      )}
        
      {/* Add Step Button */}
      <div className="mt-6">
        <Button 
          variant="outline"
          onClick={() => setStepDialog({ open: true, step: null })}
          className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>

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

      <StepDialog
        open={stepDialog.open}
        onOpenChange={(open) => setStepDialog({ open, step: null })}
        onSave={handleCreateStep}
        step={stepDialog.step}
      />
    </div>
  );
}