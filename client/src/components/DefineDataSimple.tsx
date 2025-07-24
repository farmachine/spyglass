import { useState } from "react";
import { Plus, Edit, Trash2, Database, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useDeleteProperty,
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

export default function DefineDataSimple({ project }: DefineDataProps) {
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ open: boolean; field?: ProjectSchemaField | null; stepNumber?: number }>({ open: false });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; collection?: ObjectCollection | null; stepNumber?: number }>({ open: false });
  const [propertyDialog, setPropertyDialog] = useState<{ open: boolean; property?: CollectionProperty | null; collectionId?: number; collectionName?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: string; id?: number; name?: string }>({ open: false });
  const [mainObjectName, setMainObjectName] = useState(project.mainObjectName || "Session");
  const [isEditingMainObjectName, setIsEditingMainObjectName] = useState(false);

  const { toast } = useToast();

  // Query for live data
  const { data: schemaFields = [], isLoading: schemaFieldsLoading } = useProjectSchemaFields(project.id.toString());
  const { data: collections = [], isLoading: collectionsLoading } = useObjectCollections(project.id.toString());

  // Handle mutations
  const createField = useCreateSchemaField();
  const updateField = useUpdateSchemaField();
  const deleteField = useDeleteSchemaField();
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const updateProject = useUpdateProject();

  // Safe data with fallback
  const safeSchemaFields = Array.isArray(schemaFields) 
    ? [...schemaFields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];
  const safeCollections = Array.isArray(collections) 
    ? [...collections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];

  // Check if project has any data
  const hasDataItems = safeSchemaFields.length > 0 || safeCollections.length > 0;

  // Main object name save handler
  const handleMainObjectNameSave = async () => {
    try {
      await updateProject.mutateAsync({
        id: project.id.toString(),
        project: { mainObjectName }
      });
      setIsEditingMainObjectName(false);
      toast({
        title: "Object name updated",
        description: "Main object name has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update object name. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Field handlers
  const handleCreateSchemaField = async (data: any) => {
    try {
      const fieldData = {
        ...data,
        step: schemaFieldDialog.stepNumber || 1,
      };
      await createField.mutateAsync({ 
        field: fieldData, 
        projectId: project.id.toString() 
      });
      sessionStorage.setItem(`project-${project.id.toString()}-interacted`, 'true');
      setSchemaFieldDialog({ open: false });
      toast({
        title: "Field created",
        description: "Field has been created successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create field. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateSchemaField = async (data: any) => {
    if (!schemaFieldDialog.field) return;
    try {
      await updateField.mutateAsync({ 
        id: schemaFieldDialog.field.id, 
        field: data,
        projectId: project.id.toString()
      });
      setSchemaFieldDialog({ open: false });
      toast({
        title: "Field updated",
        description: "Field has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update field. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      sessionStorage.setItem(`project-${project.id.toString()}-interacted`, 'true');
      await deleteField.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Field deleted",
        description: "Field has been deleted successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete field. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Collection handlers
  const handleCreateCollection = async (data: any) => {
    try {
      const collectionData = {
        ...data,
        step: collectionDialog.stepNumber || 1,
      };
      await createCollection.mutateAsync({ 
        collection: collectionData, 
        projectId: project.id.toString() 
      });
      sessionStorage.setItem(`project-${project.id.toString()}-interacted`, 'true');
      setCollectionDialog({ open: false });
      toast({
        title: "Collection created",
        description: "Collection has been created successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create collection. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCollection = async (data: any) => {
    if (!collectionDialog.collection) return;
    try {
      await updateCollection.mutateAsync({ 
        id: collectionDialog.collection.id, 
        collection: data,
        projectId: project.id.toString()
      });
      setCollectionDialog({ open: false });
      toast({
        title: "Collection updated",
        description: "Collection has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update collection. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      sessionStorage.setItem(`project-${project.id.toString()}-interacted`, 'true');
      await deleteCollection.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Collection deleted",
        description: "Collection has been deleted successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete collection. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Property handlers - simplified
  const handleUpdateProperty = async (data: any) => {
    if (!propertyDialog.property) return;
    try {
      await updateProperty.mutateAsync({ 
        id: propertyDialog.property.id, 
        property: data,
        collectionId: propertyDialog.property.collectionId
      });
      setPropertyDialog({ open: false });
      toast({
        title: "Property updated",
        description: "Property has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      setDeleteDialog({ open: false });
      toast({
        title: "Property deleted",
        description: "Property has been deleted successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete property. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Generic delete handler
  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    
    switch (deleteDialog.type) {
      case "field":
        await handleDeleteField(deleteDialog.id.toString());
        break;
      case "collection":
        await handleDeleteCollection(deleteDialog.id.toString());
        break;
      case "property":
        await handleDeleteProperty(deleteDialog.id.toString());
        break;
    }
  };

  return (
    <div>
      {/* Welcome message for new projects */}
      {!hasDataItems && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Welcome! Let's define your data structure
          </h2>
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
              <span>Create collections for multiple similar items (like "Parties" or "Line Items")</span>
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

      {/* Main Content */}
      {(schemaFieldsLoading || collectionsLoading) ? (
        <div className="text-center py-8">
          <div className="animate-spin h-12 w-12 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading data structure...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Data Schema</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define the fields and collections to extract from your {project.mainObjectName || "Session"} documents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                onClick={() => setSchemaFieldDialog({ open: true, field: null, stepNumber: 1 })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => setCollectionDialog({ open: true, collection: null, stepNumber: 1 })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Collection
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {safeSchemaFields.length === 0 && safeCollections.length === 0 ? (
              <Card className="p-8 text-center">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No data structure defined
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Start by adding fields and collections to define what data you want to extract
                </p>
              </Card>
            ) : (
              <>
                {/* Fields Section */}
                {safeSchemaFields.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Fields</h3>
                    <div className="space-y-2">
                      {safeSchemaFields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <div>
                              <div className="font-medium">{field.fieldName}</div>
                              <div className="text-sm text-gray-600">{field.description}</div>
                            </div>
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              {field.fieldType}
                            </Badge>
                            {field.step && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                                Step {field.step}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSchemaFieldDialog({ open: true, field })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Collections Section */}
                {safeCollections.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Collections</h3>
                    <div className="space-y-4">
                      {safeCollections.map((collection) => (
                        <div key={collection.id}>
                          <CollectionCard
                            collection={collection}
                            onEdit={() => setCollectionDialog({ open: true, collection })}
                            onDelete={() => setDeleteDialog({ 
                              open: true, 
                              type: "collection", 
                              id: collection.id, 
                              name: collection.collectionName 
                            })}
                            onEditProperty={(property) => setPropertyDialog({ 
                              open: true, 
                              property, 
                              collectionId: collection.id,
                              collectionName: collection.collectionName 
                            })}
                            onDeleteProperty={(property) => setDeleteDialog({ 
                              open: true, 
                              type: "property", 
                              id: property.id, 
                              name: property.propertyName 
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCreateCollection}
        collection={collectionDialog.collection}
      />

      <PropertyDialog
        open={propertyDialog.open}
        onOpenChange={(open) => setPropertyDialog({ open, property: null, collectionId: null, collectionName: "" })}
        onSave={propertyDialog.property ? handleUpdateProperty : () => {}}
        property={propertyDialog.property}
        collectionName={propertyDialog.collectionName}
      />

      <DeleteDialog
        open={deleteDialog.open}
        title={deleteDialog.type === "field" ? "Delete Field" : 
               deleteDialog.type === "collection" ? "Delete Collection" : "Delete Property"}
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
      />
    </div>
  );
}