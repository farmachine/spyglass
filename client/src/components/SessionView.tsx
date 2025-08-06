import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import ValidationIcon, { ValidationProgress } from "./ValidationIcon";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from 'xlsx';
import type { 
  ExtractionSessionWithValidation, 
  FieldValidation,
  FieldValidationWithName,
  ProjectWithDetails,
  ValidationStatus 
} from "@shared/schema";

interface SessionViewProps {
  sessionId: string;
  project: ProjectWithDetails;
}

export default function SessionView({ sessionId, project }: SessionViewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery<ExtractionSessionWithValidation>({
    queryKey: ['/api/sessions', sessionId, 'with-validations'],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}/with-validations`);
      if (!response.ok) throw new Error('Failed to fetch session');
      return response.json();
    }
  });

  // Get schema data to determine property order
  const { data: schemaData } = useQuery({
    queryKey: [`/api/projects/${project.id}/schema-data`],
    enabled: !!project.id,
  });

  const updateValidationMutation = useMutation({
    mutationFn: async (params: { id: string; data: Partial<FieldValidation> }) => {
      return apiRequest(`/api/validations/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(params.data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'with-validations'] });
    }
  });

  const handleManualEdit = (validation: FieldValidation) => {
    setEditingField(validation.id);
    setEditValue(validation.extractedValue || "");
  };

  const handleSaveEdit = async (validation: FieldValidation) => {
    if (editingField === validation.id) {
      await updateValidationMutation.mutateAsync({
        id: validation.id,
        data: {
          extractedValue: editValue,
          validationStatus: "manual" as ValidationStatus,
          manuallyVerified: true,
          aiReasoning: `Value manually updated by user to: ${editValue}`
        }
      });
      setEditingField(null);
      setEditValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const toggleCollectionExpansion = (collectionName: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionName)) {
        newSet.delete(collectionName);
      } else {
        newSet.add(collectionName);
      }
      return newSet;
    });
  };

  // Initialize collapsed collections when session data loads
  useEffect(() => {
    if (session?.fieldValidations) {
      const collectionValidations = session.fieldValidations.filter(v => v.fieldType === 'collection_property');
      const collectionGroups = collectionValidations.reduce((acc, validation) => {
        const collectionName = validation.collectionName || 'Unknown Collection';
        if (!acc[collectionName]) acc[collectionName] = [];
        acc[collectionName].push(validation);
        return acc;
      }, {} as Record<string, FieldValidationWithName[]>);
      
      const initialExpanded = new Set<string>();
      
      // Collections with data start collapsed, empty collections start expanded (but this shouldn't happen in review)
      Object.entries(collectionGroups).forEach(([collectionName, validations]) => {
        if (validations.length === 0) {
          initialExpanded.add(collectionName);
        }
      });
      
      setExpandedCollections(initialExpanded);
    }
  }, [session?.fieldValidations]);

  const handleExportToExcel = async () => {
    try {
      if (!session?.id) {
        console.error('No session ID available for export');
        return;
      }

      console.log('Starting DIRECT database Excel export for session:', session.id);

      // Use the new direct API endpoint that bypasses frontend filtering
      const response = await fetch(`/api/sessions/${session.id}/direct-excel-data`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const excelData = await response.json();
      console.log('Received Excel data from server:', excelData);

      // Create Excel workbook using server data
      const workbook = XLSX.utils.book_new();

      // First, create main object sheet using server data
      const mainObjectSheetData = [
        ['Property', 'Value'],
        ...excelData.mainObject.map((item: any) => [item.property, item.value])
      ];
      
      const mainObjectSheet = XLSX.utils.aoa_to_sheet(mainObjectSheetData);
      XLSX.utils.book_append_sheet(workbook, mainObjectSheet, excelData.mainObjectName);

      // Create collection sheets using server data
      Object.entries(excelData.collections).forEach(([collectionName, collectionData]: [string, any]) => {
        console.log(`Creating Excel sheet for ${collectionName}:`, collectionData);
        
        // Build worksheet data with headers and records
        const worksheetData = [
          collectionData.headers,
          ...collectionData.records
        ];
        
        console.log(`Worksheet data for ${collectionName}:`, worksheetData);
        
        const collectionSheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, collectionSheet, collectionName);
      });

      // Generate filename with session name and timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

    console.log('Exporting Excel file:', filename);
    
    // Export the file
    XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          <p>Session not found</p>
        </div>
      </div>
    );
  }

  // Parse extracted data
  let extractedData: any = {};
  try {
    extractedData = session.extractedData ? JSON.parse(session.extractedData) : {};
  } catch (error) {
    console.error('Failed to parse extracted data:', error);
  }

  // Calculate validation statistics
  const validations = session.fieldValidations || [];
  const validFields = validations.filter(v => v.validationStatus === 'valid').length;
  const invalidFields = validations.filter(v => v.validationStatus === 'invalid').length;
  const manualFields = validations.filter(v => v.validationStatus === 'manual').length;
  const pendingFields = validations.filter(v => v.validationStatus === 'pending').length;

  // Group validations by field type
  const schemaFieldValidations = validations.filter(v => v.fieldType === 'schema_field');
  const collectionValidations = validations.filter(v => v.fieldType === 'collection_property');

  // Group collection validations by collection name and sort by schema property order
  const collectionGroups = collectionValidations.reduce((acc, validation) => {
    const collectionName = validation.collectionName || 'Unknown Collection';
    if (!acc[collectionName]) acc[collectionName] = [];
    acc[collectionName].push(validation);
    return acc;
  }, {} as Record<string, FieldValidation[]>);

  // Sort validations within each collection by property order from schema
  Object.keys(collectionGroups).forEach(collectionName => {
    const collection = (schemaData as any)?.collections?.find((c: any) => c.collectionName === collectionName);
    if (collection && collection.properties) {
      // Create a property order map from schema
      const propertyOrderMap = new Map();
      collection.properties
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .forEach((prop: any, index: number) => {
          propertyOrderMap.set(prop.propertyName, index);
        });

      // Sort validations by property order, then by record index
      collectionGroups[collectionName].sort((a, b) => {
        // Extract property name from field name (e.g., "Escalation Rates.Rate Value[0]" -> "Rate Value")
        const getPropertyName = (fieldName: string) => {
          const match = fieldName?.match(/\.([^.\[]+)/);
          return match ? match[1] : fieldName || '';
        };

        const propA = getPropertyName((a as FieldValidationWithName).fieldName);
        const propB = getPropertyName((b as FieldValidationWithName).fieldName);
        
        const orderA = propertyOrderMap.get(propA) ?? 999;
        const orderB = propertyOrderMap.get(propB) ?? 999;
        
        // First sort by property order, then by record index
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.recordIndex ?? 0) - (b.recordIndex ?? 0);
      });
    }
  });

  return (
    <div className="p-8 space-y-6">
      {/* Session Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{session.sessionName}</h2>
            <p className="text-gray-600">{session.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExportToExcel}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
          </div>
        </div>

        {/* Validation Progress */}
        <ValidationProgress
          totalFields={validations.length}
          validFields={validFields}
          invalidFields={invalidFields}
          pendingFields={pendingFields}
          manualFields={manualFields}
        />
      </div>

      <Separator />

      {/* Project Schema Fields */}
      {schemaFieldValidations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Schema Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {schemaFieldValidations.map((validation) => (
                <div key={validation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <ValidationIcon
                      status={validation.validationStatus as ValidationStatus}
                      reasoning={validation.aiReasoning}
                      confidenceScore={validation.confidenceScore ?? 0}
                      onManualEdit={() => handleManualEdit(validation)}
                    />
                    <div>
                      <Label className="font-medium">{validation.fieldName || 'Unknown Field'}</Label>
                      <p className="text-sm text-gray-600">{validation.fieldType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingField === validation.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-48"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(validation)}
                          disabled={updateValidationMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="font-medium">{validation.extractedValue || 'No value'}</p>
                        <div className="flex items-center gap-2 mt-1 justify-end">
                          {validation.validationStatus === 'valid' && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              ✓ Verified
                            </Badge>
                          )}
                          {validation.validationStatus === 'manual' && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              Manual Input
                            </Badge>
                          )}
                          {validation.confidenceScore && validation.confidenceScore > 0 && validation.validationStatus !== 'manual' && (
                            <Badge className="bg-gray-100 text-gray-800 text-xs">
                              Confidence: {validation.confidenceScore}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collection Properties */}
      {Object.entries(collectionGroups).map(([collectionName, collectionValidations]) => {
        const isExpanded = expandedCollections.has(collectionName);
        
        return (
          <Card key={collectionName} className="border-gray-200 border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCollectionExpansion(collectionName)}
                    className="p-1 h-auto"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{collectionName}</CardTitle>
                      <Badge className="bg-green-100 text-green-800">List</Badge>
                    </div>
                  </div>
                  {!isExpanded && collectionValidations.length > 0 && (
                    <div className="text-sm text-gray-500">
                      {collectionValidations.length} item{collectionValidations.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="space-y-4">
                  {collectionValidations.map((validation) => (
                    <div key={validation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <ValidationIcon
                          status={validation.validationStatus as ValidationStatus}
                          reasoning={validation.aiReasoning}
                          confidenceScore={validation.confidenceScore ?? 0}
                          onManualEdit={() => handleManualEdit(validation)}
                        />
                        <div>
                          <Label className="font-medium">{(validation as FieldValidationWithName).fieldName || 'Unknown Field'}</Label>
                          <p className="text-sm text-gray-600">
                            {validation.fieldType} • Record {(validation.recordIndex ?? 0) + 1}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingField === validation.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-48"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(validation)}
                              disabled={updateValidationMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="font-medium">{validation.extractedValue || 'No value'}</p>
                            <div className="flex items-center gap-2 mt-1 justify-end">
                              {validation.validationStatus === 'valid' && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  ✓ Verified
                                </Badge>
                              )}
                              {validation.validationStatus === 'manual' && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  Manual Input
                                </Badge>
                              )}
                              {validation.confidenceScore && validation.confidenceScore > 0 && validation.validationStatus !== 'manual' && (
                                <Badge className="bg-gray-100 text-gray-800 text-xs">
                                  Confidence: {validation.confidenceScore}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Raw Extracted Data (for debugging) */}
      {extractedData && Object.keys(extractedData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Extracted Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <pre className="text-xs bg-gray-50 p-4 rounded">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}