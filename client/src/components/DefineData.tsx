import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  X, 
  ChevronRight, 
  ChevronDown,
  Check,
  Settings,
  Edit2,
  Trash2,
  Sparkles,
  Eye,
  Pencil,
  GripVertical,
  Database,
  Layout,
  FileDown,
  List,
  ChevronLeft,
  AlertCircle,
  ChevronUp,
  Upload,
  Layers,
  Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PropertyCard } from "@/components/PropertyCard";
import { CollectionCard } from "@/components/CollectionCard";
import { PropertyDialogNew } from "@/components/PropertyDialogNew";
import CollectionDialog from "@/components/CollectionDialog";
import { SchemaFieldDialogNew } from "@/components/SchemaFieldDialogNew";
import DeleteDialog from "@/components/DeleteDialog";
import { WorkflowBuilder } from '@/components/WorkflowBuilder';
import type { 
  Project, 
  SchemaField, 
  Collection, 
  Property,
  KnowledgeDocument,
  ExcelWizardryFunction
} from "@/types";

interface DefineDataProps {
  project: Project;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSetAddCollectionCallback?: (callback: (() => void) | null) => void;
}

export default function DefineData({ 
  project, 
  activeTab: activeTabParam, 
  onTabChange,
  onSetAddCollectionCallback
}: DefineDataProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workflowRef = useRef<any>(null);
  
  // State
  const [schemaFieldDialog, setSchemaFieldDialog] = useState<{ 
    open: boolean; 
    field: SchemaField | null 
  }>({ open: false, field: null });

  const [collectionDialog, setCollectionDialog] = useState<{ 
    open: boolean; 
    collection: Collection | null 
  }>({ open: false, collection: null });

  const [propertyDialog, setPropertyDialog] = useState<{ 
    open: boolean; 
    property: Property | null; 
    collectionId?: string;
    collectionName?: string;
  }>({ open: false, property: null, collectionId: undefined, collectionName: "" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type?: 'field' | 'collection' | 'property';
    id?: string;
    name?: string;
  }>({ open: false });

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedTestItems, setSelectedTestItems] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: schemaFields = [] } = useQuery<SchemaField[]>({
    queryKey: [`/api/projects/${project.id}/schema`],
  });

  const { data: collections = [] } = useQuery<Collection[]>({
    queryKey: [`/api/projects/${project.id}/collections`],
  });

  const { data: knowledgeDocuments = [] } = useQuery<KnowledgeDocument[]>({
    queryKey: [`/api/projects/${project.id}/knowledge`],
  });

  const { data: wizardryFunctions = [] } = useQuery<ExcelWizardryFunction[]>({
    queryKey: [`/api/projects/${project.id}/excel-functions`],
  });

  const { data: testDocuments = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${project.id}/test-documents`],
  });

  // Create mutations
  const createSchemaField = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${project.id}/schema`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/schema`] });
      toast({ title: "Field created successfully" });
    },
  });

  const updateSchemaField = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/schema/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/schema`] });
      toast({ title: "Field updated successfully" });
    },
  });

  const deleteSchemaField = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/schema/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/schema`] });
      toast({ title: "Field deleted successfully" });
    },
  });

  const createCollection = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${project.id}/collections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "List created successfully" });
    },
  });

  const updateCollection = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "List updated successfully" });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/collections/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "List deleted successfully" });
    },
  });

  const createProperty = useMutation({
    mutationFn: ({ collectionId, ...data }: any) => 
      apiRequest(`/api/collections/${collectionId}/properties`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "Property created successfully" });
    },
  });

  const updateProperty = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "Property updated successfully" });
    },
  });

  const deleteProperty = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/properties/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/collections`] });
      toast({ title: "Property deleted successfully" });
    },
  });

  // Handlers
  const handleCreateSchemaField = async (data: any) => {
    await createSchemaField.mutateAsync(data);
    setSchemaFieldDialog({ open: false, field: null });
  };

  const handleUpdateSchemaField = async (data: any) => {
    if (schemaFieldDialog.field) {
      await updateSchemaField.mutateAsync({ 
        id: schemaFieldDialog.field.id, 
        ...data 
      });
      setSchemaFieldDialog({ open: false, field: null });
    }
  };

  const handleCreateCollection = async (data: any) => {
    await createCollection.mutateAsync(data);
    setCollectionDialog({ open: false, collection: null });
  };

  const handleUpdateCollection = async (data: any) => {
    if (collectionDialog.collection) {
      await updateCollection.mutateAsync({ 
        id: collectionDialog.collection.id, 
        ...data 
      });
      setCollectionDialog({ open: false, collection: null });
    }
  };

  const handleCreateProperty = async (data: any) => {
    if (propertyDialog.collectionId) {
      await createProperty.mutateAsync({ 
        collectionId: propertyDialog.collectionId, 
        ...data 
      });
      setPropertyDialog({ open: false, property: null, collectionId: undefined, collectionName: "" });
    }
  };

  const handleUpdateProperty = async (data: any) => {
    if (propertyDialog.property) {
      await updateProperty.mutateAsync({ 
        id: propertyDialog.property.id, 
        ...data 
      });
      setPropertyDialog({ open: false, property: null, collectionId: undefined, collectionName: "" });
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.type && deleteDialog.id) {
      switch (deleteDialog.type) {
        case 'field':
          await deleteSchemaField.mutateAsync(deleteDialog.id);
          break;
        case 'collection':
          await deleteCollection.mutateAsync(deleteDialog.id);
          break;
        case 'property':
          await deleteProperty.mutateAsync(deleteDialog.id);
          break;
      }
      setDeleteDialog({ open: false });
    }
  };

  // Handler for saving workflow steps
  const handleSaveWorkflow = async (steps: any[]) => {
    // Convert workflow steps back to schema fields and collections
    console.log('Saving workflow steps:', steps);
  };

  // Handle test document upload
  const handleTestDocumentUpload = async (file: File) => {
    try {
      // First get the upload URL
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const { uploadURL } = await uploadResponse.json();
      
      // Upload the file to object storage
      const uploadResult = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      if (!uploadResult.ok) {
        throw new Error('Failed to upload file');
      }
      
      // Process the document through extraction pipeline
      const response = await fetch(`/api/projects/${project.id}/test-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          fileName: file.name, 
          fileURL: uploadURL.split('?')[0] // Remove query params from URL
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Test document processed:', data);
        toast({
          title: "Test Document Uploaded",
          description: `${file.name} has been processed and saved`
        });
      } else {
        toast({
          title: "Processing Failed",
          description: "Failed to process the test document",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing test document:', error);
      toast({
        title: "Upload Error",
        description: "An error occurred while processing the document",
        variant: "destructive"
      });
    }
  };

  // Prepare data for WorkflowBuilder
  const safeSchemaFields = schemaFields || [];
  const collectionsWithProps = collections?.map((collection: Collection) => ({
    ...collection,
    properties: collection.properties || []
  })) || [];

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              <span style={{ color: '#4F63A4' }}>•</span> Flow
            </h1>
            <p className="text-gray-600 mt-1">
              Design your data extraction workflow
            </p>
          </div>
          <div className="flex gap-2">
            {/* Test Document Upload */}
            <input
              type="file"
              id="test-document-upload-define"
              accept=".xlsx,.xls,.pdf,.docx,.doc"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await handleTestDocumentUpload(file);
                  // Reset input value to allow re-uploading same file
                  e.target.value = '';
                }
              }}
            />
            <Button
              onClick={() => document.getElementById('test-document-upload-define')?.click()}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-600 p-2"
              title="Upload Test Document"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setTestModalOpen(true)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-600 p-2"
              title="Test Workflow"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => {
                // Trigger workflow save
                if (workflowRef.current) {
                  workflowRef.current.saveFlow();
                }
              }}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              Save Flow
            </Button>
          </div>
        </div>
      </div>

      {/* Workflow Builder View */}
      <WorkflowBuilder
        ref={workflowRef}
        projectId={project.id}
        schemaFields={safeSchemaFields}
        collections={collectionsWithProps}
        excelFunctions={wizardryFunctions}
        knowledgeDocuments={knowledgeDocuments}
        onSave={handleSaveWorkflow}
      />

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
        onSave={collectionDialog.collection ? handleUpdateCollection : handleCreateCollection}
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

      {/* Test Modal */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Test Workflow</DialogTitle>
            <DialogDescription>
              Select test documents and workflow steps to test extraction
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Test Documents Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Test Documents</h3>
              <div className="space-y-2 pl-4">
                {testDocuments.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No test documents uploaded</p>
                ) : (
                  testDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`test-doc-${doc.id}`}
                        checked={selectedTestItems.has(`test-doc-${doc.id}`)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedTestItems);
                          if (checked) {
                            newSet.add(`test-doc-${doc.id}`);
                          } else {
                            newSet.delete(`test-doc-${doc.id}`);
                          }
                          setSelectedTestItems(newSet);
                        }}
                      />
                      <label htmlFor={`test-doc-${doc.id}`} className="text-sm text-gray-600 cursor-pointer">
                        {doc.document_name || "Unnamed Document"}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Workflow Steps Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Workflow Steps</h3>
              
              {/* Info Pages (Schema Fields) */}
              {safeSchemaFields.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                    <Layers className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Info Pages</span>
                  </div>
                  <div className="space-y-1 pl-8">
                    {safeSchemaFields.map((field: SchemaField) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`field-${field.id}`}
                          checked={selectedTestItems.has(`field-${field.id}`)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedTestItems);
                            if (checked) {
                              newSet.add(`field-${field.id}`);
                            } else {
                              newSet.delete(`field-${field.id}`);
                            }
                            setSelectedTestItems(newSet);
                          }}
                        />
                        <label htmlFor={`field-${field.id}`} className="text-sm text-gray-600 cursor-pointer">
                          {field.fieldName || "Unnamed Field"}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Tables (Collections) */}
              {collectionsWithProps.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center space-x-2">
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                    <List className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Data Tables</span>
                  </div>
                  <div className="space-y-3 pl-8">
                    {collectionsWithProps.map((collection: Collection) => (
                      <div key={collection.id} className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id={`collection-${collection.id}`}
                            checked={selectedTestItems.has(`collection-${collection.id}`)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedTestItems);
                              if (checked) {
                                newSet.add(`collection-${collection.id}`);
                                // Also select all properties when collection is selected
                                collection.properties?.forEach((prop: Property) => {
                                  newSet.add(`property-${prop.id}`);
                                });
                              } else {
                                newSet.delete(`collection-${collection.id}`);
                                // Also deselect all properties
                                collection.properties?.forEach((prop: Property) => {
                                  newSet.delete(`property-${prop.id}`);
                                });
                              }
                              setSelectedTestItems(newSet);
                            }}
                          />
                          <label htmlFor={`collection-${collection.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                            {collection.collectionName || "Unnamed Collection"}
                          </label>
                        </div>
                        {collection.properties && collection.properties.length > 0 && (
                          <div className="space-y-1 pl-6">
                            {collection.properties.map((property: Property) => (
                              <div key={property.id} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`property-${property.id}`}
                                  checked={selectedTestItems.has(`property-${property.id}`)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedTestItems);
                                    if (checked) {
                                      newSet.add(`property-${property.id}`);
                                    } else {
                                      newSet.delete(`property-${property.id}`);
                                    }
                                    setSelectedTestItems(newSet);
                                  }}
                                />
                                <label htmlFor={`property-${property.id}`} className="text-sm text-gray-500 cursor-pointer">
                                  {property.propertyName || "Unnamed Property"}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setTestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log("Selected items for testing:", Array.from(selectedTestItems));
                setTestModalOpen(false);
              }}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              Run Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}