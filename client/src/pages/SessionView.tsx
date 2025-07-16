import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Upload, Database, Brain, Settings, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    queryFn: () => apiRequest(`/api/projects/${projectId}`)
  });

  const { data: session, isLoading: sessionLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}`)
  });

  const { data: validations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/validations`)
  });

  const updateValidationMutation = useMutation({
    mutationFn: async (params: { id: number; data: Partial<FieldValidation> }) => {
      return apiRequest(`/api/validations/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(params.data)
      });
    },
    onSuccess: async () => {
      // First invalidate and wait for the validations to update
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'validations'] });
      
      // Also invalidate the AllData project-level validation query
      await queryClient.invalidateQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Force refetch of the AllData query
      await queryClient.refetchQueries({ queryKey: ['/api/validations/project', projectId] });
      
      // Small delay to ensure query cache is updated
      setTimeout(async () => {
        const updatedValidations = queryClient.getQueryData<FieldValidation[]>(['/api/sessions', sessionId, 'validations']);
        if (updatedValidations && updatedValidations.length > 0) {
          const allVerified = updatedValidations.every(v => v.validationStatus === 'valid');
          const newStatus = allVerified ? 'verified' : 'in_progress';
          
          // Update session status in database
          await apiRequest(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          
          // Invalidate session query to update UI
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          
          // Invalidate project query to update AllData component
          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
        }
      }, 100);
      
      toast({
        title: "Field updated",
        description: "The field verification has been updated.",
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

  // Parse extracted data from the session
  let extractedData: any = {};
  try {
    if (session.extractedData) {
      const parsedData = JSON.parse(session.extractedData);
      // Check if it's the new nested structure or simple flat structure
      if (parsedData.processed_documents && parsedData.processed_documents[0]) {
        extractedData = parsedData.processed_documents[0].extraction_result?.extracted_data || {};
      } else {
        // Simple flat structure for sample/legacy data
        extractedData = parsedData;
      }
    }
  } catch (error) {
    console.error('Failed to parse extracted data:', error);
  }

  // Get validation for a specific field
  const getValidation = (fieldName: string) => {
    return validations.find(v => v.fieldName === fieldName);
  };

  // Get session status based on field verification
  const getSessionStatus = () => {
    if (validations.length === 0) return 'in_progress';
    const allVerified = validations.every(v => v.validationStatus === 'valid');
    return allVerified ? 'verified' : 'in_progress';
  };

  const handleEdit = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    
    // Handle date field formatting
    const fieldType = getFieldType(fieldName);
    if (fieldType === 'DATE') {
      // If the current value is null, undefined, or "null", set empty string
      if (!currentValue || currentValue === 'null' || currentValue === 'undefined') {
        setEditValue('');
      } else {
        // Try to parse and format the date properly
        try {
          const date = new Date(currentValue);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD for date input
            const formattedDate = date.toISOString().split('T')[0];
            setEditValue(formattedDate);
          } else {
            setEditValue('');
          }
        } catch (error) {
          setEditValue('');
        }
      }
    } else {
      // For non-date fields, handle null/undefined values
      setEditValue(currentValue === 'null' || currentValue === 'undefined' ? '' : currentValue);
    }
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

  const handleVerificationToggle = async (fieldName: string, isVerified: boolean) => {
    const validation = getValidation(fieldName);
    if (validation) {
      await updateValidationMutation.mutateAsync({
        id: validation.id,
        data: {
          validationStatus: isVerified ? "valid" : "pending",
          manuallyVerified: isVerified
        }
      });
    }
  };

  const getFieldType = (fieldName: string) => {
    // Check schema fields first
    for (const field of project.schemaFields) {
      if (field.fieldName === fieldName) {
        return field.fieldType;
      }
    }
    
    // Check collection properties
    for (const collection of project.collections) {
      if (fieldName.startsWith(collection.collectionName + '.')) {
        const propertyName = fieldName.split('.')[1].split('[')[0]; // Remove [index] if present
        const property = collection.properties.find(p => p.propertyName === propertyName);
        if (property) {
          return property.propertyType;
        }
      }
    }
    
    return 'TEXT'; // Default fallback
  };

  const formatDateForDisplay = (value: any) => {
    if (!value || value === 'null' || value === 'undefined') {
      return 'Not set';
    }
    
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // Format as a readable date
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (error) {
      // If parsing fails, return the original value
    }
    
    return String(value);
  };

  const getFieldDisplayName = (fieldName: string) => {
    // Check schema fields first
    for (const field of project.schemaFields) {
      if (field.fieldName === fieldName) {
        return field.fieldName; // Use the actual field name as display name
      }
    }
    
    // Check collection properties
    for (const collection of project.collections) {
      if (fieldName.startsWith(collection.collectionName + '.')) {
        const parts = fieldName.split('.');
        const propertyPart = parts[1]; // e.g., "Name[0]" or "Name"
        const basePropertyName = propertyPart.split('[')[0]; // Remove [index] if present
        const indexMatch = propertyPart.match(/\[(\d+)\]/);
        const index = indexMatch ? parseInt(indexMatch[1]) : null;
        
        if (index !== null) {
          return `${collection.collectionName}.${basePropertyName}[${index}]`;
        } else {
          return `${collection.collectionName}.${basePropertyName}`;
        }
      }
    }
    
    return fieldName; // Fallback to original name
  };

  const renderFieldWithValidation = (fieldName: string, value: any) => {
    const validation = getValidation(fieldName);
    const isEditing = editingField === fieldName;
    const fieldType = getFieldType(fieldName);
    const displayName = getFieldDisplayName(fieldName);
    
    return (
      <div key={fieldName} className="flex items-center gap-3 p-3 border rounded-lg">
        <div className="flex-1">
          <Label className="text-sm font-medium text-gray-700">{displayName}</Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              {fieldType === 'DATE' ? (
                <Input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              ) : fieldType === 'NUMBER' ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              ) : fieldType === 'BOOLEAN' ? (
                <Select value={editValue} onValueChange={setEditValue}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
              )}
              <Button size="sm" onClick={() => handleSave(fieldName)}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-900">
                {fieldType === 'DATE' ? formatDateForDisplay(value) : String(value)}
              </span>
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
        
        <div className="flex items-center gap-2">
          {validation ? (
            <>
              <Checkbox
                id={`verify-${fieldName}`}
                checked={validation.validationStatus === 'valid'}
                onCheckedChange={(checked) => handleVerificationToggle(fieldName, checked === true)}
              />
              <Label htmlFor={`verify-${fieldName}`} className="text-sm">
                {validation.validationStatus === 'valid' ? 'Verified' : 'Unverified'}
              </Label>
            </>
          ) : (
            <div className="text-xs text-gray-400">No validation data</div>
          )}
        </div>
      </div>
    );
  };

  const navItems = [
    { id: "upload", label: `New ${project?.mainObjectName || "Session"}`, icon: Upload, href: `/projects/${projectId}?tab=upload` },
    { id: "data", label: `All ${project?.mainObjectName || "Session"} Data`, icon: Database, href: `/projects/${projectId}?tab=all-data` },
    { id: "knowledge", label: "Knowledge/Rules", icon: Brain, href: `/projects/${projectId}?tab=knowledge` },
    { id: "define", label: "Define Data", icon: Settings, href: `/projects/${projectId}?tab=define` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {session.sessionName}
              </h1>
              {session.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {session.description}
                </p>
              )}
            </div>
            <Badge variant={getSessionStatus() === 'verified' ? 'default' : 'secondary'}>
              {getSessionStatus() === 'verified' ? 'Verified' : 'In Progress'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200">
          <div className="p-6">
            <div className="mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {project.name}
              </div>
              <div className="text-sm text-gray-600">
                {project.description || "Data extraction project"}
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === 'data'; // Highlight "All Data" since we're in session view
                
                return (
                  <Link key={item.id} href={item.href}>
                    <button
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 ml-[-1px]"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                      {item.label}
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            {/* Session Header */}
            <div className="flex items-center gap-4 mb-8">
              <Link href={`/projects/${projectId}?tab=all-data`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to All {project?.mainObjectName || "Session"} Data
                </Button>
              </Link>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{project?.mainObjectName || "Session"} Review</h2>
                <p className="text-gray-600">Review and verify extracted {(project?.mainObjectName || "session").toLowerCase()} data</p>
              </div>
            </div>

        {/* Project Schema Fields */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Schema Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.schemaFields.map((field) => {
              const value = extractedData[field.fieldName];
              const validation = validations.find(v => v.fieldName === field.fieldName);
              
              // Show field if it has a value OR if there's a validation for it
              if (value !== undefined || validation) {
                return renderFieldWithValidation(field.fieldName, value ?? validation?.extractedValue ?? null);
              }
              return null;
            })}
          </CardContent>
        </Card>

        {/* Collections */}
        {project.collections.map((collection) => {
          const collectionData = extractedData[collection.collectionName];
          
          // Get all validations for this collection
          const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
          
          // Determine how many instances we need to show
          const dataLength = collectionData ? collectionData.length - 1 : -1;
          const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
          const maxRecordIndex = Math.max(dataLength, ...validationIndices, -1);
          
          if (maxRecordIndex < 0) return null;

          return (
            <Card key={collection.id} className="mb-8">
              <CardHeader>
                <CardTitle>{collection.collectionName}</CardTitle>
                <p className="text-sm text-gray-600">{collection.description}</p>
              </CardHeader>
              <CardContent>
                {Array.from({ length: maxRecordIndex + 1 }, (_, index) => {
                  const item = collectionData?.[index] || {};
                  
                  return (
                    <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-4">Item {index + 1}</h4>
                      <div className="space-y-4">
                        {collection.properties.map((property) => {
                          const value = item[property.propertyName];
                          const fieldName = `${collection.collectionName}.${property.propertyName}[${index}]`;
                          const validation = validations.find(v => v.fieldName === fieldName);
                          
                          // Show property if it has a value OR if there's a validation for it
                          if (value !== undefined || validation) {
                            return renderFieldWithValidation(fieldName, value ?? validation?.extractedValue ?? null);
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
          </div>
        </div>
      </div>
    </div>
  );
}