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
  Play,
  FileUp,
  FileText,
  Table2,
  Loader2
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
  const [testDocumentsModalOpen, setTestDocumentsModalOpen] = useState(false);
  const [processingDocument, setProcessingDocument] = useState<string | null>(null);

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

  const { data: testDocuments = [], refetch: refetchTestDocuments } = useQuery<any[]>({
    queryKey: [`/api/projects/${project.id}/test-documents`],
  });

  const { data: workflowData } = useQuery({
    queryKey: [`/api/projects/${project.id}/workflow`],
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

  const deleteTestDocumentMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/test-documents/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/test-documents`] });
      toast({ title: "Test document deleted successfully" });
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
      setProcessingDocument(file.name);
      
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
        // Refetch test documents to show the new one
        refetchTestDocuments?.();
      }
    } catch (error) {
      console.error('Error processing test document:', error);
    } finally {
      setProcessingDocument(null);
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
            <Button
              onClick={() => setTestDocumentsModalOpen(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
            >
              Test Documents
            </Button>
            <Button
              onClick={() => setTestModalOpen(true)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-600"
              title="Test Workflow"
            >
              <Play className="h-4 w-4 mr-2" />
              Test
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
              <div className="space-y-3 pl-4">
                {testDocuments.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No test documents uploaded</p>
                ) : (
                  testDocuments.map((doc: any) => (
                    <div key={doc.id} className="space-y-1">
                      <div className="flex items-center space-x-2">
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
                        <label htmlFor={`test-doc-${doc.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                          {doc.fileName || doc.file_name || "Unnamed Document"}
                        </label>
                      </div>
                      {(doc.extractedContent || doc.extracted_content) && (
                        <div className="ml-6 p-2 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {typeof (doc.extractedContent || doc.extracted_content) === 'string' 
                              ? (doc.extractedContent || doc.extracted_content).substring(0, 200) + ((doc.extractedContent || doc.extracted_content).length > 200 ? '...' : '')
                              : JSON.stringify(doc.extractedContent || doc.extracted_content).substring(0, 200) + '...'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Workflow Steps Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Workflow Steps</h3>
              
              <div className="space-y-2">
                {/* Show workflow steps from database in order */}
                {workflowData?.steps ? (
                  workflowData.steps.map((step: any) => (
                    <div key={step.id} className="space-y-1">
                      <div className="flex items-center space-x-2 pl-2">
                        <Checkbox 
                          id={`step-${step.id}`}
                          checked={selectedTestItems.has(`step-${step.id}`)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedTestItems);
                            if (checked) {
                              newSet.add(`step-${step.id}`);
                              // Also select all values when step is selected
                              step.values?.forEach((value: any) => {
                                newSet.add(`value-${value.id}`);
                              });
                            } else {
                              newSet.delete(`step-${step.id}`);
                              // Also deselect all values
                              step.values?.forEach((value: any) => {
                                newSet.delete(`value-${value.id}`);
                              });
                            }
                            setSelectedTestItems(newSet);
                          }}
                        />
                        {step.stepType === 'page' ? (
                          <Layers className="h-4 w-4 text-gray-500" />
                        ) : (
                          <List className="h-4 w-4 text-gray-500" />
                        )}
                        <label htmlFor={`step-${step.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                          {step.stepName || "Unnamed Step"}
                        </label>
                      </div>
                      {step.values && step.values.length > 0 && (
                        <div className="space-y-1 pl-10">
                          {step.values.map((value: any) => (
                            <div key={value.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`value-${value.id}`}
                                checked={selectedTestItems.has(`value-${value.id}`)}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(selectedTestItems);
                                  if (checked) {
                                    newSet.add(`value-${value.id}`);
                                  } else {
                                    newSet.delete(`value-${value.id}`);
                                  }
                                  setSelectedTestItems(newSet);
                                }}
                              />
                              <label htmlFor={`value-${value.id}`} className="text-sm text-gray-500 cursor-pointer">
                                {value.name || value.valueName || "Unnamed Value"}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic pl-2">No workflow steps defined</p>
                )}
              </div>
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
              onClick={async () => {
                // Get selected test documents and workflow values
                const selectedDocs = testDocuments.filter((doc: any) => 
                  selectedTestItems.has(`test-doc-${doc.id}`)
                );
                
                const selectedValues: any[] = [];
                if (workflowData?.steps) {
                  workflowData.steps.forEach((step: any) => {
                    step.values?.forEach((value: any) => {
                      if (selectedTestItems.has(`value-${value.id}`)) {
                        selectedValues.push({
                          stepId: step.id,
                          stepName: step.stepName,
                          stepType: step.stepType,
                          valueId: value.id,
                          valueName: value.name || value.valueName,
                          toolId: value.toolId,
                          inputValues: value.inputValues
                        });
                      }
                    });
                  });
                }

                console.log("🧪 Running Test Workflow");
                console.log("📄 Selected Documents:", selectedDocs);
                console.log("🔧 Selected Values:", selectedValues);

                // Process each document through each selected value
                for (const doc of selectedDocs) {
                  console.log(`\n📊 Processing document: ${doc.file_name || doc.fileName}`);
                  
                  for (const value of selectedValues) {
                    console.log(`  ⚙️ Running ${value.stepName} > ${value.valueName}`);
                    
                    try {
                      // Call the test endpoint
                      const response = await apiRequest(`/api/projects/${project.id}/test-workflow`, {
                        method: 'POST',
                        body: JSON.stringify({
                          documentId: doc.id,
                          documentContent: doc.extracted_content || doc.extractedContent,
                          valueConfig: value
                        })
                      });
                      
                      console.log(`  ✅ Result:`, response.result);
                    } catch (error) {
                      console.error(`  ❌ Error:`, error);
                    }
                  }
                }
                
                console.log("\n✨ Test completed!");
                setTestModalOpen(false);
              }}
              className="bg-gray-700 hover:bg-gray-800 text-white"
            >
              Run Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Documents Modal */}
      <Dialog open={testDocumentsModalOpen} onOpenChange={setTestDocumentsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Documents</DialogTitle>
            <DialogDescription>
              Manage test documents for your workflow
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Upload New Document */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                type="file"
                id="test-document-modal-upload"
                accept=".xlsx,.xls,.pdf,.docx,.doc"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleTestDocumentUpload(file);
                    e.target.value = '';
                    // Refresh the test documents list
                    refetchTestDocuments?.();
                  }
                }}
              />
              <div className="text-center">
                <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Excel, Word, or PDF files
                </p>
                <Button
                  onClick={() => document.getElementById('test-document-modal-upload')?.click()}
                  className="mt-4 bg-gray-700 hover:bg-gray-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </div>

            {/* List of Test Documents */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">Current Test Documents</h3>
              
              {/* Show processing spinner if a document is being processed */}
              {processingDocument && (
                <div className="p-3 bg-blue-50 rounded-lg flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">{processingDocument}</p>
                    <p className="text-xs text-blue-600">Processing...</p>
                  </div>
                </div>
              )}
              
              {testDocuments?.length === 0 && !processingDocument ? (
                <p className="text-sm text-gray-500 italic">No test documents uploaded yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {testDocuments?.map((doc: TestDocument) => (
                    <div key={doc.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">{doc.file_name || doc.fileName}</p>
                            {(doc.extracted_content || doc.extractedContent) && (
                              <p className="text-xs text-gray-500">
                                {(doc.extracted_content || doc.extractedContent).length} characters extracted
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await deleteTestDocumentMutation.mutateAsync(doc.id);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {(doc.extracted_content || doc.extractedContent) && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Preview:</p>
                          <p className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words overflow-hidden max-h-24 overflow-y-auto">
                            {(doc.extracted_content || doc.extractedContent).substring(0, 500)}{(doc.extracted_content || doc.extractedContent).length > 500 ? '...' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setTestDocumentsModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}