import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, AlertCircle, Edit3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ExtractionSession, 
  ProjectWithDetails, 
  FieldValidation 
} from "@shared/schema";

export default function SessionView() {
  const { projectId, sessionId } = useParams();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    }
  });

  const { data: session, isLoading: sessionLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      return response.json();
    }
  });

  const { data: validations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations'],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}/validations`);
      if (!response.ok) throw new Error('Failed to fetch validations');
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
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      toast({
        title: "Field updated",
        description: "The field has been successfully updated.",
      });
    }
  });

  if (projectLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h1>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline">Back to Project</Button>
          </Link>
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

  // Get validation for a specific field
  const getValidation = (fieldName: string) => {
    return validations.find(v => v.fieldName === fieldName);
  };

  const handleEdit = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleSave = async (fieldName: string) => {
    const validation = getValidation(fieldName);
    if (validation) {
      await updateValidationMutation.mutateAsync({
        id: validation.id,
        data: {
          extractedValue: editValue,
          validationStatus: "manual",
          manuallyVerified: true
        }
      });
    }
    setEditingField(null);
    setEditValue("");
  };

  const handleValidate = async (fieldName: string) => {
    const validation = getValidation(fieldName);
    if (validation) {
      await updateValidationMutation.mutateAsync({
        id: validation.id,
        data: {
          validationStatus: "valid",
          manuallyVerified: true
        }
      });
    }
  };

  const renderFieldWithValidation = (fieldName: string, value: any) => {
    const validation = getValidation(fieldName);
    const isEditing = editingField === fieldName;
    
    return (
      <div key={fieldName} className="flex items-center gap-3 p-3 border rounded-lg">
        <div className="flex-1">
          <Label className="text-sm font-medium text-gray-700">{fieldName}</Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={() => handleSave(fieldName)}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-900">{String(value)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(fieldName, String(value))}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {validation && (
          <div className="flex items-center gap-2">
            {validation.validationStatus === 'valid' ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="bg-red-100 text-red-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {validation.validationStatus}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleValidate(fieldName)}
                >
                  Validate
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{session.sessionName}</h1>
            <p className="text-gray-600">{session.description}</p>
          </div>
          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
            {session.status}
          </Badge>
        </div>

        {/* Project Schema Fields */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Schema Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.schemaFields.map((field) => {
              const value = extractedData[field.fieldName];
              if (value !== undefined) {
                return renderFieldWithValidation(field.fieldName, value);
              }
              return null;
            })}
          </CardContent>
        </Card>

        {/* Collections */}
        {project.collections.map((collection) => {
          const collectionData = extractedData[collection.collectionName];
          if (!collectionData || !Array.isArray(collectionData)) return null;

          return (
            <Card key={collection.id} className="mb-8">
              <CardHeader>
                <CardTitle>{collection.collectionName}</CardTitle>
                <p className="text-sm text-gray-600">{collection.description}</p>
              </CardHeader>
              <CardContent>
                {collectionData.map((item, index) => (
                  <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-4">Item {index + 1}</h4>
                    <div className="space-y-4">
                      {collection.properties.map((property) => {
                        const value = item[property.propertyName];
                        if (value !== undefined) {
                          const fieldName = `${collection.collectionName}.${property.propertyName}`;
                          return renderFieldWithValidation(fieldName, value);
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}