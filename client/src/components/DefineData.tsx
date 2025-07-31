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
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: string; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: string; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [mainObjectDescription, setMainObjectDescription] = useState(project.mainObjectDescription || "");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);
  const [isEditingMainObjectDescription, setIsEditingMainObjectDescription] = useState(false);
  const [activeTab, setActiveTab] = useState('main-data');
  
  // Update local state when project prop changes (needed for database updates)
  useEffect(() => {
    console.log("DefineData: Project prop changed", { 
      mainObjectName: project.mainObjectName, 
      mainObjectDescription: project.mainObjectDescription 
    });
    setMainObjectName(project.mainObjectName || "Session");
    setMainObjectDescription(project.mainObjectDescription || "");
  }, [project.mainObjectName, project.mainObjectDescription]);
  
  // AI Query state
  const [aiQuery, setAiQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Field type colors
  const fieldTypeColors = {
    TEXT: "bg-blue-100 text-blue-800 border border-blue-200",
    NUMBER: "bg-green-100 text-green-800 border border-green-200",
    DATE: "bg-purple-100 text-purple-800 border border-purple-200",
    BOOLEAN: "bg-orange-100 text-orange-800 border border-orange-200",
    EMAIL: "bg-red-100 text-red-800 border border-red-200",
    URL: "bg-teal-100 text-teal-800 border border-teal-200",
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/schema`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({
        title: "Schema generated successfully",
        description: "AI has created your data structure based on your description.",
      });
    },
    onError: () => {
      setIsGenerating(false);
      toast({
        title: "Schema generation failed",
        description: "Failed to generate schema. Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Field created",
        description: "Schema field has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create field. Please try again.",
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
        description: "Failed to update field. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchemaField = async (id: string) => {
    try {
      // Mark project as interacted to prevent welcome flow redirects
      sessionStorage.setItem(`project-${project.id}-interacted`, 'true');
      
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
      await createCollection.mutateAsync({ ...data, orderIndex });
      
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

  const handleDeleteCollection = async (id: string) => {
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

  const handleDeleteProperty = async (id: string) => {
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

  // AI Schema Generation handler
  const handleGenerateSchema = async () => {
    if (!aiQuery.trim()) {
      toast({
        title: "Query required",
        description: "Please describe what data you want to collect.",
        variant: "destructive",
      });
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
      toast({
        title: "Main object name updated",
        description: "The main object name has been updated successfully.",
      });
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Error",
        description: "Failed to update main object name. Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Description updated",
        description: "The main object description has been updated successfully.",
      });
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Error",
        description: "Failed to update description. Please try again.",
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

  // When collection is created, automatically switch to that tab
  const handleCollectionCreateWithTabSwitch = async (data: any) => {
    await handleCreateCollection(data);
    setActiveTab(data.collectionName);
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
          
          {/* AI Schema Generation Section */}
          <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4 mx-auto max-w-2xl">
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
          
          <div className="text-center mb-4">
            <span className="text-gray-500 text-sm">or build manually</span>
          </div>
          
          <div className="flex justify-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setSchemaFieldDialog({ open: true, field: null })}
              className="bg-white hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
            <Button 
              variant="outline"
              onClick={() => setCollectionDialog({ open: true, collection: null })}
              className="bg-white hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add List
            </Button>
          </div>
        </div>
      )}

      {/* Tab-Based Data Structure Layout */}
      {allDataItems.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="main-data" className="w-full folder-tabs">
          <TabsList className="w-full justify-start tabs-list">
            <TabsTrigger value="main-data" className="tabs-trigger">{project.mainObjectName || "Session"} Data</TabsTrigger>
            {safeCollections.map((collection) => (
              <TabsTrigger key={collection.id} value={collection.collectionName} className="tabs-trigger">
                {collection.collectionName}
              </TabsTrigger>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollectionDialog({ open: true, collection: null })}
              className="h-10 px-3 rounded-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TabsList>

          {/* Main Data Tab Content */}
          <TabsContent value="main-data" className="mt-0 px-0 ml-0">
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

                {/* Add Field Button */}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Individual Collection Tabs */}
          {safeCollections.map((collection) => (
            <TabsContent key={collection.id} value={collection.collectionName} className="mt-0 px-0 ml-0">
              <Card className="border-t-0 rounded-tl-none ml-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {collection.collectionName}
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      {collection.properties?.length || 0} properties
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600">{collection.description}</p>
                </CardHeader>
                <CardContent>
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
                      collectionName: collection.collectionName
                    })}
                    onDeleteProperty={(id, name) => setDeleteDialog({ 
                      open: true, 
                      type: "property", 
                      id, 
                      name 
                    })}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

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
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCollectionCreateWithTabSwitch}
        collection={collectionDialog.collection}
      />

      <PropertyDialog
        open={propertyDialog.open}
        onOpenChange={(open) => setPropertyDialog({ open, property: null, collectionId: undefined, collectionName: "" })}
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