import React, { useState } from "react";
import { Database, CheckCircle, Clock, Eye, FileText, ChevronDown, ChevronRight, Edit3, Save, X, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { ProjectWithDetails, ExtractionSession } from "@shared/schema";

interface AllDataProps {
  project: ProjectWithDetails;
}

interface ExtractedDataViewProps {
  session: ExtractionSession;
  project: ProjectWithDetails;
  onSave: (sessionId: number, data: any) => void;
}

function ExtractedDataView({ session, project, onSave }: ExtractedDataViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (!session.extractedData) return {};
    
    try {
      const parsed = typeof session.extractedData === 'string' 
        ? JSON.parse(session.extractedData) 
        : session.extractedData;
      return parsed.extracted_data || parsed;
    } catch {
      return {};
    }
  });

  const handleSave = () => {
    onSave(session.id, formData);
    setIsEditing(false);
  };

  const updateFormField = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const updateCollectionItem = (collectionName: string, index: number, propertyName: string, value: any) => {
    setFormData(prev => {
      const collection = Array.isArray(prev[collectionName]) ? prev[collectionName] : [];
      const updatedCollection = [...collection];
      if (!updatedCollection[index]) updatedCollection[index] = {};
      updatedCollection[index][propertyName] = value;
      return { ...prev, [collectionName]: updatedCollection };
    });
  };

  const addCollectionItem = (collectionName: string) => {
    setFormData(prev => {
      const collection = Array.isArray(prev[collectionName]) ? prev[collectionName] : [];
      return { ...prev, [collectionName]: [...collection, {}] };
    });
  };

  const removeCollectionItem = (collectionName: string, index: number) => {
    setFormData(prev => {
      const collection = Array.isArray(prev[collectionName]) ? prev[collectionName] : [];
      const updatedCollection = collection.filter((_, i) => i !== index);
      return { ...prev, [collectionName]: updatedCollection };
    });
  };

  const renderFormField = (fieldName: string, fieldType: string, value: any) => {
    const commonProps = {
      id: fieldName,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        updateFormField(fieldName, e.target.value),
      disabled: !isEditing
    };

    switch (fieldType) {
      case 'TEXT':
        return value && value.length > 100 ? 
          <Textarea {...commonProps} rows={3} /> : 
          <Input {...commonProps} />;
      case 'NUMBER':
        return <Input {...commonProps} type="number" step="any" />;
      case 'DATE':
        return <Input {...commonProps} type="date" />;
      case 'BOOLEAN':
        return (
          <select 
            {...commonProps} 
            onChange={(e) => updateFormField(fieldName, e.target.value === 'true')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      default:
        return <Input {...commonProps} />;
    }
  };

  return (
    <Card className="mb-6" id={`session-${session.id}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {session.sessionName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {session.documentCount} document(s) • {session.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={session.status === 'verified' ? 'default' : session.status === 'completed' ? 'secondary' : 'outline'}>
              {session.status}
            </Badge>
            {isEditing ? (
              <>
                <Button onClick={handleSave} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Schema Fields */}
          {project.schemaFields.length > 0 && (
            <div>
              <h4 className="text-lg font-medium mb-4">Document Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.schemaFields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.fieldName}>{field.fieldName}</Label>
                    {renderFormField(field.fieldName, field.fieldType, formData[field.fieldName])}
                    {field.description && (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Object Collections */}
          {project.collections.map(collection => {
            const collectionData = Array.isArray(formData[collection.collectionName]) 
              ? formData[collection.collectionName] 
              : [];

            return (
              <div key={collection.id}>
                <Separator className="my-6" />
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-medium">{collection.collectionName}</h4>
                    {collection.description && (
                      <p className="text-sm text-muted-foreground">{collection.description}</p>
                    )}
                  </div>
                  {isEditing && (
                    <Button 
                      onClick={() => addCollectionItem(collection.collectionName)}
                      size="sm"
                      variant="outline"
                    >
                      Add {collection.collectionName}
                    </Button>
                  )}
                </div>

                {collectionData.length > 0 ? (
                  <div className="space-y-4">
                    {collectionData.map((item: any, index: number) => (
                      <Card key={index} className="relative">
                        <CardContent className="pt-6">
                          {isEditing && (
                            <Button
                              onClick={() => removeCollectionItem(collection.collectionName, index)}
                              size="sm"
                              variant="destructive"
                              className="absolute top-2 right-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {collection.properties.map(property => (
                              <div key={property.id} className="space-y-2">
                                <Label htmlFor={`${collection.collectionName}-${index}-${property.propertyName}`}>
                                  {property.propertyName}
                                </Label>
                                {renderCollectionField(
                                  collection.collectionName,
                                  index,
                                  property.propertyName,
                                  property.propertyType,
                                  item[property.propertyName],
                                  isEditing,
                                  updateCollectionItem
                                )}
                                {property.description && (
                                  <p className="text-xs text-muted-foreground">{property.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No {collection.collectionName.toLowerCase()} data extracted
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function renderCollectionField(
  collectionName: string,
  index: number,
  propertyName: string,
  propertyType: string,
  value: any,
  isEditing: boolean,
  updateCollectionItem: (collectionName: string, index: number, propertyName: string, value: any) => void
) {
  const commonProps = {
    id: `${collectionName}-${index}-${propertyName}`,
    value: value || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
      updateCollectionItem(collectionName, index, propertyName, e.target.value),
    disabled: !isEditing
  };

  switch (propertyType) {
    case 'TEXT':
      return value && value.length > 100 ? 
        <Textarea {...commonProps} rows={3} /> : 
        <Input {...commonProps} />;
    case 'NUMBER':
      return <Input {...commonProps} type="number" step="any" />;
    case 'DATE':
      return <Input {...commonProps} type="date" />;
    case 'BOOLEAN':
      return (
        <select 
          {...commonProps} 
          onChange={(e) => updateCollectionItem(collectionName, index, propertyName, e.target.value === 'true')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    default:
      return <Input {...commonProps} />;
  }
}

export default function AllData({ project }: AllDataProps) {
  const [selectedSession, setSelectedSession] = useState<ExtractionSession | null>(null);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSaveData = async (sessionId: number, data: any) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/data`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extractedData: data }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save data');
      }
      
      // Refresh the project data to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save data. Please try again.');
    }
  };

  const sessionsWithData = project.sessions.filter(s => s.extractedData);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">All Data</h2>
        <p className="text-sm text-gray-600 mt-1">
          View extracted data and manage all extraction sessions for this project
        </p>
      </div>

      {/* Sessions with Extracted Data */}
      {sessionsWithData.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Extracted Data</h3>
          {sessionsWithData.map(session => (
            <ExtractedDataView 
              key={session.id}
              session={session}
              project={project}
              onSave={handleSaveData}
            />
          ))}
        </div>
      )}

      {/* Sessions Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{project.sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {project.sessions.filter(s => s.status === 'verified').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {project.sessions.filter(s => s.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Extraction Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {project.sessions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No extraction sessions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload documents to start extracting data
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {project.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{session.sessionName}</h4>
                    <p className="text-sm text-gray-500">
                      {session.documentCount} document(s) • Created {formatDate(session.createdAt)}
                    </p>
                    {session.description && (
                      <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                    )}
                    {session.extractedData && (
                      <p className="text-sm text-blue-600 mt-1">✓ Data extracted and ready for review</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge
                      variant={
                        session.status === 'verified'
                          ? 'default'
                          : session.status === 'completed'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {session.status}
                    </Badge>
                    {session.extractedData && (
                      <Button
                        onClick={() => {
                          const element = document.getElementById(`session-${session.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Data
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
