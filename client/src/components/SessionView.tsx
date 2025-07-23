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

  const handleExportToExcel = () => {
    if (!session?.fieldValidations) return;

    console.log('Starting Excel export for session:', session.sessionName);
    console.log('Available validations:', session.fieldValidations.length);
    console.log('All field validations:', session.fieldValidations.map(v => ({
      fieldName: v.fieldName,
      fieldType: v.fieldType,
      extractedValue: v.extractedValue,
      recordIndex: v.recordIndex
    })));

    const workbook = XLSX.utils.book_new();
    
    // Separate schema fields and collection properties
    const schemaFieldValidations = session.fieldValidations.filter(v => v.fieldType === 'schema_field');
    const collectionValidations = session.fieldValidations.filter(v => v.fieldType === 'collection_property');
    
    // Group collection validations by collection name
    const collectionGroups = collectionValidations.reduce((acc, validation) => {
      const collectionName = validation.collectionName || 'Unknown Collection';
      if (!acc[collectionName]) acc[collectionName] = [];
      acc[collectionName].push(validation);
      return acc;
    }, {} as Record<string, FieldValidationWithName[]>);
    
    // Sheet 1: Main Object Info (Schema Fields)
    const mainObjectData = schemaFieldValidations.map(validation => [
      validation.fieldName || 'Unknown Field',
      validation.extractedValue || ''
    ]);
    
    const mainObjectSheet = XLSX.utils.aoa_to_sheet([
      ['Property Name', 'Property Value'],
      ...mainObjectData
    ]);
    
    XLSX.utils.book_append_sheet(workbook, mainObjectSheet, project?.mainObjectName || 'Main Object');

    // Sheets 2+: Collection Data
    Object.entries(collectionGroups).forEach(([collectionName, collectionValidations]) => {
      console.log(`Processing collection: ${collectionName} with ${collectionValidations.length} validations`);
      
      // Group validations by record index to create rows
      const recordGroups: Record<number, FieldValidationWithName[]> = {};
      
      collectionValidations.forEach(validation => {
        const recordIndex = validation.recordIndex ?? 0;
        if (!recordGroups[recordIndex]) recordGroups[recordIndex] = [];
        recordGroups[recordIndex].push(validation);
      });
      
      console.log(`Raw record groups before sorting:`, recordGroups);

      // Get unique property names for columns - fix the property extraction
      const propertyNames = [...new Set(collectionValidations.map(v => {
        const fieldName = v.fieldName || '';
        // Extract property name from patterns like "Parties.Name[0]" or "Parties.Name"
        const propertyMatch = fieldName.match(/\.([^.\[]+)/);
        return propertyMatch ? propertyMatch[1] : fieldName;
      }))].filter(name => name).sort();

      console.log(`Collection ${collectionName} properties:`, propertyNames);
      console.log(`Record groups:`, Object.keys(recordGroups));
      console.log(`Property names for headers:`, propertyNames);

      // Create header row
      const headers = propertyNames;
      
      // Create data rows - ensure we start from index 0
      const sortedRecordIndexes = Object.keys(recordGroups)
        .map(key => parseInt(key))
        .sort((a, b) => a - b);
      
      console.log(`Original record indexes:`, sortedRecordIndexes);
      
      // Map data rows continuously from 0, regardless of original record indexes
      const dataRows = sortedRecordIndexes.map(recordIndex => {
        const recordValidations = recordGroups[recordIndex];
        const row = propertyNames.map(propertyName => {
          const validation = recordValidations.find(v => {
            const fieldName = v.fieldName || '';
            return fieldName.includes(`.${propertyName}`);
          });
          return validation?.extractedValue || '';
        });
        console.log(`Record index ${recordIndex} -> row:`, row);
        return row;
      });

      console.log(`Collection ${collectionName} data rows:`, dataRows.length);
      console.log(`Headers to be written:`, headers);
      console.log(`First few data rows:`, dataRows.slice(0, 3));

      // Create worksheet - make sure we include all data rows
      const worksheetData = [headers, ...dataRows];
      console.log(`Complete worksheet data:`, worksheetData.slice(0, 4)); // Show headers + first 3 rows
      const collectionSheet = XLSX.utils.aoa_to_sheet(worksheetData);

      XLSX.utils.book_append_sheet(workbook, collectionSheet, collectionName);
    });

    // Generate filename with session name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

    console.log('Exporting Excel file:', filename);
    
    // Export the file
    XLSX.writeFile(workbook, filename);
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

  // Group collection validations by collection name
  const collectionGroups = collectionValidations.reduce((acc, validation) => {
    const collectionName = validation.collectionName || 'Unknown Collection';
    if (!acc[collectionName]) acc[collectionName] = [];
    acc[collectionName].push(validation);
    return acc;
  }, {} as Record<string, FieldValidation[]>);

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
                          <Label className="font-medium">{validation.fieldName || 'Unknown Field'}</Label>
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