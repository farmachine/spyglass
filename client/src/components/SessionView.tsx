import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import ValidationIcon, { ValidationProgress } from "./ValidationIcon";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ExtractionSessionWithValidation, 
  FieldValidation, 
  ProjectWithDetails,
  ValidationStatus 
} from "@shared/schema";

interface SessionViewProps {
  sessionId: number;
  project: ProjectWithDetails;
}

export default function SessionView({ sessionId, project }: SessionViewProps) {
  const [editingField, setEditingField] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
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
    mutationFn: async (params: { id: number; data: Partial<FieldValidation> }) => {
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
          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
            {session.status}
          </Badge>
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
                      confidenceScore={validation.confidenceScore}
                      onManualEdit={() => handleManualEdit(validation)}
                    />
                    <div>
                      <Label className="font-medium">{validation.fieldName}</Label>
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
                        {validation.manuallyVerified && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Manually Verified
                          </Badge>
                        )}
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
      {Object.entries(collectionGroups).map(([collectionName, collectionValidations]) => (
        <Card key={collectionName}>
          <CardHeader>
            <CardTitle>Collection: {collectionName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {collectionValidations.map((validation) => (
                <div key={validation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <ValidationIcon
                      status={validation.validationStatus as ValidationStatus}
                      reasoning={validation.aiReasoning}
                      confidenceScore={validation.confidenceScore}
                      onManualEdit={() => handleManualEdit(validation)}
                    />
                    <div>
                      <Label className="font-medium">{validation.fieldName}</Label>
                      <p className="text-sm text-gray-600">
                        {validation.fieldType} • Record {validation.recordIndex + 1}
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
                        {validation.manuallyVerified && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Manually Verified
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

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