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
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testResultsPage, setTestResultsPage] = useState(1);
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

  const { data: workflowData, refetch: refetchWorkflow } = useQuery({
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
    
    // After saving, refresh the workflow data for the test modal
    await refetchWorkflow();
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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              <span style={{ color: '#4F63A4' }}>•</span> Flow
            </h1>
            <p className="text-gray-600 dark:text-gray-100 mt-1">
              Design your data extraction workflow
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setTestDocumentsModalOpen(true)}
              variant="ghost"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FileText className="h-4 w-4 mr-2" />
              Test Documents
            </Button>
            <Button
              onClick={() => setTestModalOpen(true)}
              variant="ghost"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
              className="bg-gray-700 hover:bg-gray-800 text-white border border-gray-600"
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
      <Dialog open={testModalOpen} onOpenChange={(open) => {
        setTestModalOpen(open);
        if (!open) {
          setTestResults([]); // Clear results when closing
          setTestResultsPage(1); // Reset pagination
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Test Workflow</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              Select test documents and workflow steps to test extraction
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left Panel - Test Configuration */}
            <div className="w-80 overflow-y-auto space-y-4 py-4 pr-4">
            {/* Test Documents Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Test Documents</h3>
              <div className="space-y-3 pl-4">
                {testDocuments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No test documents uploaded</p>
                ) : (
                  testDocuments.map((doc: any) => (
                    <div key={doc.id} className="space-y-1">
                      <div className="flex items-center space-x-3">
                        {/* Circular checkbox replacement */}
                        <button
                          onClick={() => {
                            const newSet = new Set(selectedTestItems);
                            if (selectedTestItems.has(`test-doc-${doc.id}`)) {
                              newSet.delete(`test-doc-${doc.id}`);
                            } else {
                              newSet.add(`test-doc-${doc.id}`);
                            }
                            setSelectedTestItems(newSet);
                          }}
                          className="relative w-4 h-4 rounded-full border-2 border-gray-400 dark:border-gray-500 hover:border-gray-600 dark:hover:border-gray-400 transition-colors"
                        >
                          {selectedTestItems.has(`test-doc-${doc.id}`) && (
                            <div className="absolute inset-0.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                          )}
                        </button>
                        
                        <label 
                          onClick={() => {
                            const newSet = new Set(selectedTestItems);
                            if (selectedTestItems.has(`test-doc-${doc.id}`)) {
                              newSet.delete(`test-doc-${doc.id}`);
                            } else {
                              newSet.add(`test-doc-${doc.id}`);
                            }
                            setSelectedTestItems(newSet);
                          }}
                          className="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer select-none"
                        >
                          {doc.fileName || doc.file_name || "Unnamed Document"}
                        </label>
                      </div>
                      {(doc.extractedContent || doc.extracted_content) && (
                        <div className="ml-7 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {typeof (doc.extractedContent || doc.extracted_content) === 'string' 
                            ? (doc.extractedContent || doc.extracted_content).split('\n')[0].substring(0, 50) + '...'
                            : 'Document content available'}
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
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Workflow Steps</h3>
              
              <div className="space-y-2">
                {/* Show workflow steps from database in order */}
                {workflowData?.steps ? (
                  workflowData.steps.map((step: any, stepIndex: number) => (
                    <div key={step.id} className="relative">
                      <div className="flex items-center space-x-3 pl-2">
                        {/* Circular checkbox replacement */}
                        <button
                          onClick={() => {
                            const newSet = new Set(selectedTestItems);
                            if (selectedTestItems.has(`step-${step.id}`)) {
                              newSet.delete(`step-${step.id}`);
                              // Also deselect all values
                              step.values?.forEach((value: any) => {
                                newSet.delete(`value-${value.id}`);
                              });
                            } else {
                              newSet.add(`step-${step.id}`);
                              // Also select all values when step is selected
                              step.values?.forEach((value: any) => {
                                newSet.add(`value-${value.id}`);
                              });
                            }
                            setSelectedTestItems(newSet);
                          }}
                          className="relative w-4 h-4 rounded-full border-2 border-gray-400 dark:border-gray-500 hover:border-gray-600 dark:hover:border-gray-400 transition-colors"
                        >
                          {selectedTestItems.has(`step-${step.id}`) && (
                            <div className="absolute inset-0.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                          )}
                        </button>
                        
                        {step.stepType === 'page' ? (
                          <Layers className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <List className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        )}
                        <label 
                          onClick={() => {
                            const newSet = new Set(selectedTestItems);
                            if (selectedTestItems.has(`step-${step.id}`)) {
                              newSet.delete(`step-${step.id}`);
                              step.values?.forEach((value: any) => {
                                newSet.delete(`value-${value.id}`);
                              });
                            } else {
                              newSet.add(`step-${step.id}`);
                              step.values?.forEach((value: any) => {
                                newSet.add(`value-${value.id}`);
                              });
                            }
                            setSelectedTestItems(newSet);
                          }}
                          className="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer select-none"
                        >
                          {step.stepName || "Unnamed Step"}
                        </label>
                      </div>
                      
                      {step.values && step.values.length > 0 && (
                        <div className="relative">
                          {/* Vertical line connecting to values */}
                          <div className="absolute left-[18px] top-2 bottom-0 w-px bg-gray-300 dark:bg-gray-600"></div>
                          
                          <div className="space-y-2 pl-10 pt-2">
                            {step.values.map((value: any, valueIndex: number) => (
                              <div key={value.id} className="relative flex items-center space-x-3">
                                {/* Horizontal line from vertical line to dot */}
                                <div className="absolute left-[-22px] top-2 w-4 h-px bg-gray-300 dark:bg-gray-600"></div>
                                
                                {/* Circular checkbox for values */}
                                <button
                                  onClick={() => {
                                    const newSet = new Set(selectedTestItems);
                                    if (selectedTestItems.has(`value-${value.id}`)) {
                                      newSet.delete(`value-${value.id}`);
                                    } else {
                                      newSet.add(`value-${value.id}`);
                                    }
                                    setSelectedTestItems(newSet);
                                  }}
                                  className="relative w-3 h-3 rounded-full border-2 border-gray-400 dark:border-gray-500 hover:border-gray-600 dark:hover:border-gray-400 transition-colors"
                                >
                                  {selectedTestItems.has(`value-${value.id}`) && (
                                    <div className="absolute inset-0.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                                  )}
                                </button>
                                
                                <label 
                                  onClick={() => {
                                    const newSet = new Set(selectedTestItems);
                                    if (selectedTestItems.has(`value-${value.id}`)) {
                                      newSet.delete(`value-${value.id}`);
                                    } else {
                                      newSet.add(`value-${value.id}`);
                                    }
                                    setSelectedTestItems(newSet);
                                  }}
                                  className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer select-none"
                                >
                                  {value.name || value.valueName || "Unnamed Value"}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-2">No workflow steps defined</p>
                )}
              </div>
            </div>
            </div>
            
            {/* Right Panel - Test Results */}
            <div className="flex-1 border-l border-gray-200 dark:border-gray-700 flex flex-col p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Test Results</h3>
              {testResults.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No test results yet. Run the test to see results here.</p>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Show combined results in single table */}
                  {(() => {
                    // Get the first result with data to determine structure
                    const firstResultWithData = testResults.find((r: any) => r.data && r.data.length > 0);
                    if (!firstResultWithData) {
                      return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No data extracted</p>;
                    }
                    
                    // For Column Name Mapping, merge results by index
                    const allData: any[] = [];
                    
                    if (firstResultWithData.stepName === 'Column Name Mapping') {
                      // Get results for each value type
                      const columnNamesResult = testResults.find((r: any) => r.valueName === 'Column Names');
                      const worksheetResult = testResults.find((r: any) => r.valueName === 'Worksheet Name');
                      const standardResult = testResults.find((r: any) => r.valueName === 'Standard Equivalent');
                      
                      const columnData = columnNamesResult?.data || [];
                      const worksheetData = worksheetResult?.data || [];
                      const standardData = standardResult?.data || [];
                      
                      // Merge by index
                      const maxLength = Math.max(columnData.length, worksheetData.length, standardData.length);
                      for (let i = 0; i < maxLength; i++) {
                        allData.push({
                          _stepName: 'Column Name Mapping',
                          columnName: columnData[i]?.extractedValue || 'Unknown',
                          worksheetName: worksheetData[i]?.extractedValue || 'Pending',
                          standardEquivalent: standardData[i]?.extractedValue || 'Not Found'
                        });
                      }
                    } else {
                      // For other steps, just combine normally
                      testResults.forEach((result: any) => {
                        if (result.data && Array.isArray(result.data)) {
                          result.data.forEach((item: any) => {
                            allData.push({
                              ...item,
                              _stepName: result.stepName,
                              _valueName: result.valueName
                            });
                          });
                        }
                      });
                    }
                    
                    // Pagination logic using component state
                    const itemsPerPage = 20;
                    const totalPages = Math.ceil(allData.length / itemsPerPage);
                    const startIndex = (testResultsPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentData = allData.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        {/* Summary */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {testResults.map((result: any, idx: number) => (
                              <span key={idx} className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                result.success 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {result.stepName}: {result.count || 0}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Total: {allData.length} records
                          </span>
                        </div>
                        
                        {/* Scrollable table container */}
                        <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  #
                                </th>
                                {/* For Column Name Mapping specific headers */}
                                {firstResultWithData.stepName === 'Column Name Mapping' ? (
                                  <>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Column Names
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Worksheet Name
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Standard Equivalent
                                    </th>
                                  </>
                                ) : (
                                  // Generic headers
                                  (() => {
                                    const firstItem = firstResultWithData.data[0];
                                    if (typeof firstItem === 'object' && firstItem !== null) {
                                      return Object.keys(firstItem).filter(k => !k.startsWith('_')).slice(0, 5).map((key) => (
                                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                          {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </th>
                                      ));
                                    }
                                    return (
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Value
                                      </th>
                                    );
                                  })()
                                )}
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {currentData.map((item: any, itemIndex: number) => (
                                <tr key={itemIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    {startIndex + itemIndex + 1}
                                  </td>
                                  {(() => {
                                    // For Column Name Mapping
                                    if (item._stepName === 'Column Name Mapping') {
                                      // Use the merged data structure
                                      const columnName = item.columnName || 'Unknown';
                                      const worksheetName = item.worksheetName || 'Pending';
                                      const standardEquivalent = item.standardEquivalent || 'Not Found';
                                      
                                      return (
                                        <>
                                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                            {columnName}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                            {worksheetName}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                            <div className="max-w-xs truncate" title={standardEquivalent}>
                                              {standardEquivalent}
                                            </div>
                                          </td>
                                        </>
                                      );
                                    }
                                    
                                    // Generic display
                                    if (typeof item === 'object' && item !== null) {
                                      return Object.entries(item)
                                        .filter(([key]) => !key.startsWith('_'))
                                        .slice(0, 5)
                                        .map(([key, value]: [string, any], i: number) => (
                                          <td key={i} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                            <div className="max-w-xs truncate" title={String(value)}>
                                              {String(value).substring(0, 50)}{String(value).length > 50 ? '...' : ''}
                                            </div>
                                          </td>
                                        ));
                                    }
                                    return (
                                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                        {String(item)}
                                      </td>
                                    );
                                  })()}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination controls */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Showing {startIndex + 1} to {Math.min(endIndex, allData.length)} of {allData.length} results
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setTestResultsPage(Math.max(1, testResultsPage - 1))}
                              disabled={testResultsPage === 1}
                              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <span className="px-3 py-1 text-sm">
                              Page {testResultsPage} of {totalPages}
                            </span>
                            <button
                              onClick={() => setTestResultsPage(Math.min(totalPages, testResultsPage + 1))}
                              disabled={testResultsPage === totalPages}
                              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => setTestModalOpen(false)}
              className="dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
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
                console.log("🔍 Selected Test Items:", Array.from(selectedTestItems));
                console.log("📄 Available Test Documents:", testDocuments);
                console.log("📄 Selected Documents:", selectedDocs);
                console.log("🔧 Selected Values:", selectedValues);
                
                // Check if any items are selected
                if (selectedDocs.length === 0 || selectedValues.length === 0) {
                  console.warn("⚠️ No documents or values selected for testing!");
                  console.log("Please select at least one document and one value to test.");
                  return;
                }

                // Track all test results for display
                const allTestResults: any[] = [];
                
                // Process each document through each selected value
                for (const doc of selectedDocs) {
                  console.log(`\n📊 Processing document: ${doc.file_name || doc.fileName}`);
                  
                  // Track results from previous steps for sequential execution
                  const previousResults: { [key: string]: any } = {};
                  
                  // Sort values to ensure dependencies are processed first
                  // (In a real implementation, we'd do topological sort based on @-references)
                  for (const value of selectedValues) {
                    console.log(`  ⚙️ Running ${value.stepName} > ${value.valueName}`);
                    
                    try {
                      // Prepare the request body with previous results
                      const requestBody = {
                        documentId: doc.id,
                        documentContent: doc.extracted_content || doc.extractedContent,
                        valueConfig: value,
                        previousResults: previousResults // Pass accumulated results
                      };
                      
                      // Log critical info about previousResults
                      console.log("📤 Previous Results Summary:");
                      for (const [key, val] of Object.entries(previousResults)) {
                        if (Array.isArray(val)) {
                          console.log(`    ${key}: ${val.length} items`);
                        }
                      }
                      console.log("📤 Request Body:", JSON.stringify(requestBody, null, 2).slice(0, 2000) + "...");
                      
                      // Check if this will need async processing (large arrays)
                      const hasLargeArrays = Object.values(previousResults).some((v: any) => 
                        Array.isArray(v) && v.length > 50
                      );
                      
                      // Call the test endpoint
                      const response = await apiRequest(`/api/projects/${project.id}/test-workflow`, {
                        method: 'POST',
                        body: JSON.stringify({
                          ...requestBody,
                          async: hasLargeArrays
                        })
                      });
                      
                      console.log("📥 Complete Response:", JSON.stringify(response, null, 2));
                      
                      // Handle async job response
                      if (response.jobId) {
                        console.log(`  ⏳ Job started: ${response.jobId}`);
                        console.log(`  ⏳ Processing ${Array.isArray(previousResults[Object.keys(previousResults)[0]]) ? previousResults[Object.keys(previousResults)[0]].length : 0} items asynchronously...`);
                        
                        // Poll for job completion
                        let jobComplete = false;
                        let pollAttempts = 0;
                        const maxPolls = 60; // Max 5 minutes (60 * 5 seconds)
                        
                        while (!jobComplete && pollAttempts < maxPolls) {
                          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                          pollAttempts++;
                          
                          const jobStatus = await apiRequest(`/api/projects/${project.id}/test-workflow/job/${response.jobId}`, {
                            method: 'GET'
                          });
                          
                          if (jobStatus.job?.progress) {
                            console.log(`  ⏳ Progress: ${jobStatus.job.progress.current}/${jobStatus.job.progress.total} - ${jobStatus.job.progress.message || ''}`);
                          }
                          
                          if (jobStatus.job?.status === 'completed') {
                            jobComplete = true;
                            // Debug the structure
                            console.log('  📦 Job result structure:', jobStatus.job.result);
                            
                            // Try different paths to find the results
                            const results = jobStatus.job.result?.results?.results || 
                                          jobStatus.job.result?.results || 
                                          jobStatus.job.result || 
                                          [];
                            
                            if (results && Array.isArray(results)) {
                              console.log(`  ✅ Extracted ${results.length} items`);
                              
                              // Log first few results for debugging
                              if (results.length > 0) {
                                console.log(`  📋 Sample results:`);
                                results.slice(0, 3).forEach((item: any, idx: number) => {
                                  console.log(`    Item ${idx + 1}:`, item);
                                });
                                if (results.length > 3) {
                                  console.log(`    ... and ${results.length - 3} more items`);
                                }
                              }
                              
                              // Store the results for use by subsequent steps
                              const resultKey = `${value.stepName}.${value.valueName}`;
                              previousResults[resultKey] = results;
                              previousResults[value.valueName] = results;
                              
                              console.log(`  💾 Stored results as "${resultKey}" and "${value.valueName}" for subsequent steps`);
                              console.log(`  📊 Stored array has ${results.length} items`);
                            }
                          } else if (jobStatus.job?.status === 'failed') {
                            jobComplete = true;
                            console.error(`  ❌ Job failed: ${jobStatus.job.error}`);
                          }
                        }
                        
                        if (!jobComplete) {
                          console.error(`  ❌ Job timed out after ${maxPolls * 5} seconds`);
                        }
                      } else if (response.result?.results) {
                        // Synchronous response
                        console.log(`  ✅ Extracted ${response.result.results.length} items`);
                        
                        // Store the results for use by subsequent steps
                        // Use both step.value format and just value name for flexibility
                        const resultKey = `${value.stepName}.${value.valueName}`;
                        previousResults[resultKey] = response.result.results;
                        previousResults[value.valueName] = response.result.results;
                        
                        console.log(`  💾 Stored results as "${resultKey}" and "${value.valueName}" for subsequent steps`);
                        
                        // Debug: Log what we're storing
                        console.log(`  📊 Stored array has ${response.result.results.length} items`);
                        if (response.result.results.length > 0) {
                          console.log(`    First item:`, response.result.results[0]);
                          if (response.result.results.length > 1) {
                            console.log(`    Last item:`, response.result.results[response.result.results.length - 1]);
                          }
                        }
                        
                        // Add to test results for display
                        allTestResults.push({
                          stepName: value.stepName,
                          valueName: value.valueName,
                          success: true,
                          count: response.result.results.length,
                          data: response.result.results
                        });
                      }
                    } catch (error) {
                      console.error(`  ❌ Error:`, error);
                      
                      // Add failed result
                      allTestResults.push({
                        stepName: value.stepName,
                        valueName: value.valueName,
                        success: false,
                        count: 0,
                        error: error
                      });
                    }
                  }
                }
                
                console.log("\n✨ Test completed!");
                
                // Update the test results display
                setTestResults(allTestResults);
                setTestResultsPage(1); // Reset to first page when new results come in
                
                // Don't close modal - show results instead
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