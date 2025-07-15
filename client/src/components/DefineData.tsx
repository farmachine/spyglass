import { useState } from "react";
import { Settings, Plus, Edit, Trash2, Database, FileText } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { 
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
import SchemaFieldDialog from "./SchemaFieldDialog";
import CollectionDialog from "./CollectionDialog";
import PropertyDialog from "./PropertyDialog";
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

  const { toast } = useToast();

  // Schema field mutations
  const createSchemaField = useCreateSchemaField(project.id);
  const updateSchemaField = useUpdateSchemaField();
  const deleteSchemaField = useDeleteSchemaField();

  // Collection mutations
  const createCollection = useCreateCollection(project.id);
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();

  // Property mutations
  const createProperty = useCreateProperty(propertyDialog.collectionId || 0);
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  const fieldTypeColors = {
    TEXT: "bg-blue-100 text-blue-800",
    NUMBER: "bg-green-100 text-green-800",
    DATE: "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-orange-100 text-orange-800",
  };

  // Schema field handlers
  const handleCreateSchemaField = async (data: any) => {
    try {
      await createSchemaField.mutateAsync(data);
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

  // Property handlers
  const handleCreateProperty = async (data: any) => {
    if (!propertyDialog.collectionId) return;
    try {
      await createProperty.mutateAsync(data);
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Define Data Schema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure the data structure and fields for extraction
          </p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            if (activeTab === "schema") {
              setSchemaFieldDialog({ open: true, field: null });
            } else {
              setCollectionDialog({ open: true, collection: null });
            }
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === "schema" ? "Add Field" : "Create Collection"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schema">Project Schema</TabsTrigger>
          <TabsTrigger value="collections">Object Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Global Project Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.schemaFields.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No schema fields defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define global fields that apply to the entire document set
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setSchemaFieldDialog({ open: true, field: null })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schema Field
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.schemaFields.map((field) => (
                      <TableRow key={field.id}>
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Object Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.collections.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No object collections defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define object types (like Employees, Assets, etc.) with their properties
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setCollectionDialog({ open: true, collection: null })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Collection
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {project.collections.map((collection) => (
                    <Card key={collection.id} className="border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{collection.collectionName}</CardTitle>
                            {collection.description && (
                              <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setCollectionDialog({ open: true, collection })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                type: "collection", 
                                id: collection.id, 
                                name: collection.collectionName 
                              })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {collection.properties.length === 0 ? (
                          <div className="text-center py-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-2">No properties defined</p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setPropertyDialog({ 
                                open: true, 
                                property: null, 
                                collectionId: collection.id,
                                collectionName: collection.collectionName 
                              })}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Property
                            </Button>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Property Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {collection.properties.map((property) => (
                                <TableRow key={property.id}>
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
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setPropertyDialog({ 
                                          open: true, 
                                          property, 
                                          collectionId: collection.id,
                                          collectionName: collection.collectionName 
                                        })}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-600"
                                        onClick={() => setDeleteDialog({ 
                                          open: true, 
                                          type: "property", 
                                          id: property.id, 
                                          name: property.propertyName 
                                        })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
        isLoading={createProperty.isPending || updateProperty.isPending}
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
