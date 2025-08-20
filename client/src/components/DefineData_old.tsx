import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Settings, Database, Tag, GripVertical, Sparkles } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  useProjectSchemaFields,
  useObjectCollections,
  useCollectionsWithProperties,
  useCreateSchemaField,
  useUpdateSchemaField,
  useDeleteSchemaField,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useUpdateProperty,
  useDeleteProperty,
  useExcelWizardryFunctions
} from "@/hooks/useSchema";
import { useKnowledgeDocuments, useExtractionRules } from "@/hooks/useKnowledge";
import { useUpdateProject } from "@/hooks/useProjects";
import { SchemaFieldDialogNew } from "@/components/SchemaFieldDialogNew";
import CollectionDialog from "@/components/CollectionDialog";
import { PropertyDialogNew } from "@/components/PropertyDialogNew";
import DeleteDialog from "@/components/DeleteDialog";
import { CollectionCard } from "@/components/CollectionCard";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import type {
  ProjectWithDetails,
  ProjectSchemaField,
  ObjectCollection,
  CollectionProperty,
} from "@shared/schema";

interface DefineDataProps {
  project: ProjectWithDetails;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSetAddCollectionCallback?: (callback: () => void) => void;
}

export default function DefineData({ project, activeTab, onTabChange, onSetAddCollectionCallback }: DefineDataProps) {
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ open: boolean; field?: ProjectSchemaField | null }>({ open: false });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; collection?: ObjectCollection | null }>({ open: false });
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: string; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: string; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [mainObjectDescription, setMainObjectDescription] = useState(project.mainObjectDescription || "");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);
  const [isEditingMainObjectDescription, setIsEditingMainObjectDescription] = useState(false);
  const [viewMode, setViewMode] = useState<'classic' | 'workflow'>('workflow');

  
  // Update local state when project prop changes (needed for database updates)
  useEffect(() => {
    setMainObjectName(project.mainObjectName || "Session");
    setMainObjectDescription(project.mainObjectDescription || "");
  }, [project.mainObjectName, project.mainObjectDescription]);

  // Set up the add collection callback for the sidebar
  useEffect(() => {

    if (onSetAddCollectionCallback) {
      const handleAddCollection = () => {

        setCollectionDialog({ open: true, collection: null });
      };
      onSetAddCollectionCallback(handleAddCollection);
    }
  }, [onSetAddCollectionCallback]);
  
  // AI Query state
  const [aiQuery, setAiQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const queryClient = useQueryClient();

  // Query for live data instead of using static props
  const { data: schemaFields = [], isLoading: schemaFieldsLoading } = useProjectSchemaFields(project.id);
  const { data: collections = [], isLoading: collectionsLoading } = useObjectCollections(project.id);
  const { data: collectionsWithProps = [], isLoading: collectionsWithPropsLoading } = useCollectionsWithProperties(project.id);
  const { data: knowledgeDocuments = [] } = useKnowledgeDocuments(project.id);
  const { data: extractionRules = [] } = useExtractionRules(project.id);
  
  // Debug logging for schema fields visibility
  // Debug info available if needed
  const debugInfo = {
    activeTab,
    schemaFieldsCount: schemaFields?.length || 0,
    schemaFieldsLoading,
    showingSchemaTab: activeTab === 'Session Fields',
  };
  

  

  const { data: wizardryFunctions = [] } = useExcelWizardryFunctions();

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

  // Field type colors
  const fieldTypeColors = {
    TEXT: "bg-gray-100 text-gray-700 border border-gray-500",
    NUMBER: "bg-gray-100 text-gray-700 border border-gray-500",
    DATE: "bg-gray-100 text-gray-700 border border-gray-500",
    BOOLEAN: "bg-gray-100 text-gray-700 border border-gray-500",
    EMAIL: "bg-gray-100 text-gray-700 border border-gray-500",
    URL: "bg-gray-100 text-gray-700 border border-gray-500",
  };

  // Schema field mutations
  const createSchemaField = useCreateSchemaField(project.id);
  const updateSchemaField = useUpdateSchemaField(project.id);
  const deleteSchemaField = useDeleteSchemaField(project.id);

  // Collection mutations
  const createCollection = useCreateCollection(project.id);
  const updateCollection = useUpdateCollection(project.id);
  const deleteCollection = useDeleteCollection(project.id);

  // Property mutations
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  
  // Create property mutation
  const createProperty = useMutation({
    mutationFn: (data: any) => 
      apiRequest(`/api/collections/${data.collectionId}/properties`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  // Project mutations
  const updateProject = useUpdateProject();

  // AI Schema Generation mutation
  const generateSchemaMutation = useMutation({
    mutationFn: async (data: { query: string }) => {
      const response = await apiRequest(`/api/projects/${project.id}/generate-schema`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    },
    onSuccess: () => {
      setAiQuery("");
      setIsGenerating(false);
      // Invalidate all related queries to ensure fresh data loads
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "schema"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "collections"] });
      console.log("Schema generated successfully - AI has created your data structure based on your description.");
    },
    onError: () => {
      setIsGenerating(false);
      console.error("Schema generation failed - Failed to generate schema. Please try again.");
    }
  });

  // Schema field handlers
  const handleCreateSchemaField = async (data: any) => {
    try {
      const orderIndex = safeSchemaFields.length + safeCollections.length; // Add to the end
      await createSchemaField.mutateAsync({ ...data, orderIndex });
      
      // Mark project as interacted AFTER successful creation to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      setSchemaFieldDialog({ open: false });
    } catch (error) {
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
    } catch (error) {
    }
  };

  const handleDeleteSchemaField = async (id: string) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      await deleteSchemaField.mutateAsync(id);
      setDeleteDialog({ open: false });
    } catch (error) {
    }
  };

  // Collection handlers
  const handleCreateCollection = async (data: any) => {
    try {
      const orderIndex = safeCollections.length; // Add to the end
      await createCollection.mutateAsync({ ...data, orderIndex });
      
      // Mark project as interacted AFTER successful creation to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      setCollectionDialog({ open: false });
    } catch (error) {
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
    } catch (error) {
    }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
      // Find the collection being deleted to determine tab navigation
      const collectionToDelete = safeCollections.find(c => c.id === id);
      const currentCollectionName = collectionToDelete?.collectionName;
      
      // Determine which tab to navigate to after deletion
      let targetTab = "main-data"; // Default to main fields tab
      
      if (currentCollectionName && activeTab === currentCollectionName) {
        // Find the index of the current collection
        const currentIndex = safeCollections.findIndex(c => c.collectionName === currentCollectionName);
        
        if (currentIndex > 0) {
          // Navigate to the previous collection tab
          targetTab = safeCollections[currentIndex - 1].collectionName;
        }
        // If it's the first collection (index 0), targetTab remains "main-data"
      }
      
      // Optimistic update: Immediately update the cache to remove the collection
      queryClient.setQueryData(["/api/projects", project.id, "collections"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((collection: any) => collection.id !== id);
      });
      
      // Optimistic update: Update the main project data to reflect the collection removal
      queryClient.setQueryData(["/api/projects", project.id], (oldData: any) => {
        if (!oldData) return oldData;
        const updatedCollections = (oldData.collections || []).filter((collection: any) => collection.id !== id);
        return { ...oldData, collections: updatedCollections };
      });
      
      // Navigate to the determined tab immediately
      onTabChange(targetTab);
      setDeleteDialog({ open: false });
      
      // Perform the actual deletion in the background
      await deleteCollection.mutateAsync(id);
    } catch (error) {
      // Revert optimistic updates on error
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      console.error("Failed to delete collection:", error);
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
    } catch (error) {
    }
  };

  const handleUpdateProperty = async (data: any) => {
    if (!propertyDialog.property) return;
    try {
      console.log('🔄 SCHEMA UPDATE - Property update initiated:', {
        propertyId: propertyDialog.property.id,
        collectionId: propertyDialog.property.collectionId,
        updateData: data
      });
      
      await updateProperty.mutateAsync({ 
        id: propertyDialog.property.id, 
        property: data,
        collectionId: propertyDialog.property.collectionId // Pass the collection ID for cache invalidation
      });
      
      console.log('✅ SCHEMA UPDATE - Property update completed successfully');
      setPropertyDialog({ open: false });
    } catch (error) {
      console.error('❌ SCHEMA UPDATE - Property update failed:', error);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      setDeleteDialog({ open: false });
    } catch (error) {
    }
  };

  // AI Schema Generation handler
  const handleGenerateSchema = async () => {
    if (!aiQuery.trim()) {
      console.warn("Query required - Please describe what data you want to collect.");
      return;
    }
    
    setIsGenerating(true);
    await generateSchemaMutation.mutateAsync({ query: aiQuery.trim() });
  };

  // Main object name and description handlers
  const handleMainObjectNameSave = async () => {
    try {
      // Optimistically update the cache immediately
      queryClient.setQueryData(["/api/projects", project.id], (oldData: any) => {
        if (!oldData) return oldData;
        return { ...oldData, mainObjectName };
      });
      
      await updateProject.mutateAsync({
        id: project.id,
        project: { mainObjectName }
      });
      
      setIsEditingMainObjectName(false);
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
    }
  };

  const handleMainObjectDescriptionSave = async () => {
    try {
      // Optimistically update the cache immediately
      queryClient.setQueryData(["/api/projects", project.id], (oldData: any) => {
        if (!oldData) return oldData;
        return { ...oldData, mainObjectDescription };
      });
      
      await updateProject.mutateAsync({
        id: project.id,
        project: { mainObjectDescription }
      });
      
      setIsEditingMainObjectDescription(false);
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
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

  // When collection is created, automatically switch to that tab
  const handleCollectionCreateWithTabSwitch = async (data: any) => {
    await handleCreateCollection(data);
    onTabChange(data.collectionName);
  };

  // Handler for saving workflow steps
  const handleSaveWorkflow = async (steps: any[]) => {
    // Convert workflow steps back to schema fields and collections
    console.log('Saving workflow steps:', steps);
  };

  return (
    <div className="space-y-6">
      {/* Page Heading with View Mode Toggle */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              extrapl <span style={{ color: '#4F63A4' }}>•</span> Flow
            </h1>
            <p className="text-gray-600 mt-1">
              Design your data extraction workflow
            </p>
          </div>

        </div>
      </div>

      {/* Workflow Builder View */}
      <WorkflowBuilder
        projectId={project.id}
        schemaFields={safeSchemaFields}
        collections={collectionsWithProps}
        excelFunctions={wizardryFunctions}
        knowledgeDocuments={knowledgeDocuments}
        onSave={handleSaveWorkflow}
      />

      {/* Dialogs */}
            To start extracting data from your {project.mainObjectName || "Session"} documents, you'll need to define what information you want to capture.
          </p>
          
          {/* AI Schema Generation Section - Hidden temporarily but functionality preserved */}
          {false && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 mx-auto max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">Generate with AI</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Describe what data you want to collect and AI will create the complete schema for you.
              </p>
              <div className="space-y-3">
                <Textarea
                  placeholder="e.g., I need to collect party information from NDAs including company names, addresses, and contact details"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  rows={3}
                  className="resize-none"
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleGenerateSchema}
                  disabled={isGenerating || !aiQuery.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Generating Schema...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Removed "or build manually" text since AI section is now hidden */}
          
          <div className="flex justify-center gap-3">
            <Button 
              onClick={() => setSchemaFieldDialog({ open: true, field: null })}
              className="bg-gray-600 hover:bg-gray-700 text-white border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
            <Button 
              onClick={() => setCollectionDialog({ open: true, collection: null })}
              className="bg-gray-600 hover:bg-gray-700 text-white border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add List
            </Button>
          </div>
        </div>
      )}

      {/* Data Structure Content */}
      {allDataItems.length > 0 && (
        <div>
          {/* Main Data Tab Content */}
          {activeTab === 'main-data' && (
            <Card className="border-t-0 rounded-tl-none ml-0">
              <CardHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {isEditingMainObjectName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={mainObjectName}
                          onChange={(e) => setMainObjectName(e.target.value)}
                          className="text-lg font-semibold"
                          placeholder="e.g., Contract, Agreement, Session"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleMainObjectNameSave();
                            if (e.key === 'Escape') {
                              setMainObjectName(project.mainObjectName || "Session");
                              setIsEditingMainObjectName(false);
                            }
                          }}
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
                      <div className="flex items-center gap-2 flex-1">
                        <CardTitle className="text-xl">
                          {project.mainObjectName || "Session"} Fields
                        </CardTitle>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setIsEditingMainObjectName(true)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          {safeSchemaFields.length} fields
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {isEditingMainObjectDescription ? (
                      <div className="flex items-center gap-2">
                        <Textarea
                          value={mainObjectDescription}
                          onChange={(e) => setMainObjectDescription(e.target.value)}
                          className="text-sm resize-none"
                          placeholder="Describe the main object type (e.g., Legal contracts for service agreements)"
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleMainObjectDescriptionSave();
                            }
                            if (e.key === 'Escape') {
                              setMainObjectDescription(project.mainObjectDescription || "");
                              setIsEditingMainObjectDescription(false);
                            }
                          }}
                        />
                        <div className="flex flex-col gap-1">
                          <Button size="sm" onClick={handleMainObjectDescriptionSave}>
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setMainObjectDescription(project.mainObjectDescription || "");
                              setIsEditingMainObjectDescription(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-gray-600 flex-1">
                          {project.mainObjectDescription || 
                            `Core fields extracted from your ${project.mainObjectName || "Session"} documents.`
                          }
                        </p>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setIsEditingMainObjectDescription(true)}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {schemaFieldsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-sm text-gray-600">Loading fields...</p>
                  </div>
                ) : safeSchemaFields.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No fields defined
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Add fields to extract data from your {project.mainObjectName || "Session"} documents
                    </p>
                    <Button 
                      onClick={() => setSchemaFieldDialog({ open: true, field: null })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <DragDropContext onDragEnd={() => {}}>
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
                            <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                              {safeSchemaFields.map((field, index) => (
                                <Draggable key={field.id} draggableId={field.id.toString()} index={index}>
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
                  </div>
                )}

                {/* Add Field Button - Always show when not loading */}
                {!schemaFieldsLoading && (
                  <div className="mt-6 pt-6 border-t">
                    <Button 
                      variant="outline"
                      onClick={() => setSchemaFieldDialog({ open: true, field: null })}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Individual Collection Tabs */}
          {safeCollections.map((collection) => activeTab === collection.collectionName && (
            <div key={collection.id}>
              <Card className="border-t-0 rounded-tl-none ml-0">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <CardTitle className="text-xl">
                        {collection.collectionName}
                      </CardTitle>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setCollectionDialog({ open: true, collection })}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        {collection.properties?.length || 0} properties
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteDialog({ 
                          open: true, 
                          type: "collection", 
                          id: collection.id, 
                          name: collection.collectionName 
                        })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-gray-600 flex-1">
                      {collection.description || `List of items extracted from your ${project.mainObjectName || "Session"} documents.`}
                    </p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setCollectionDialog({ open: true, collection })}
                      className="h-6 w-6 p-0 flex-shrink-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CollectionCard
                    collection={collection}
                    onDeleteCollection={(id) => setDeleteDialog({ 
                      open: true, 
                      type: "collection", 
                      id, 
                      name: collection.collectionName 
                    })}
                    onEditCollection={(id, data) => updateCollection.mutate({ id, ...data })}
                    onAddProperty={async (data) => {
                      await createProperty.mutateAsync(data);
                    }}
                    onEditProperty={async (propertyId, data) => {
                      await updateProperty.mutateAsync({ id: propertyId, ...data });
                    }}
                    onDeleteProperty={(propertyId) => setDeleteDialog({ 
                      open: true, 
                      type: "property", 
                      id: propertyId, 
                      name: "this property" 
                    })}
                    excelFunctions={wizardryFunctions || []}
                    knowledgeDocuments={knowledgeDocuments || []}
                    projectId={project.id}
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
      </div>
      )}

      {/* Dialogs */}
      <SchemaFieldDialogNew
        open={schemaFieldDialog.open}
        onOpenChange={(open) => setSchemaFieldDialog({ open, field: null })}
        onSave={schemaFieldDialog.field ? handleUpdateSchemaField : handleCreateSchemaField}
        field={schemaFieldDialog.field}
        knowledgeDocuments={knowledgeDocuments}
        wizardryFunctions={wizardryFunctions}
        projectId={project.id}
      />

      <CollectionDialog
        open={collectionDialog.open}
        onOpenChange={(open) => setCollectionDialog({ open, collection: null })}
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCollectionCreateWithTabSwitch}
        collection={collectionDialog.collection}
      />

      <PropertyDialogNew
        open={propertyDialog.open}
        onOpenChange={(open) => setPropertyDialog({ open, property: null, collectionId: undefined, collectionName: "" })}
        onSave={propertyDialog.property ? handleUpdateProperty : handleCreateProperty}
        property={propertyDialog.property}
        collectionName={propertyDialog.collectionName || ""}
        knowledgeDocuments={knowledgeDocuments}
        wizardryFunctions={wizardryFunctions}
        schemaFields={schemaFields || []}
        collections={collections || []}
        currentCollectionIndex={collections?.findIndex((c: any) => c.collectionName === propertyDialog.collectionName) || 0}
        collectionId={propertyDialog.collectionId || ""}
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