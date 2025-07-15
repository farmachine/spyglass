import React, { useState } from "react";
import { ArrowLeft, Edit3, Save, X, FileText, CheckCircle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import type { ProjectWithDetails, ExtractionSession } from "@shared/schema";

interface SessionViewProps {
  session: ExtractionSession;
  project: ProjectWithDetails;
}

export default function SessionView({ session, project }: SessionViewProps) {
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (!session.extractedData) return {};
    
    try {
      const parsed = typeof session.extractedData === 'string' 
        ? JSON.parse(session.extractedData) 
        : session.extractedData;
      
      // Handle the nested structure from AI extraction
      if (parsed.processed_documents && parsed.processed_documents[0]?.extraction_result?.extracted_data) {
        return parsed.processed_documents[0].extraction_result.extracted_data;
      }
      
      return parsed.extracted_data || parsed;
    } catch {
      return {};
    }
  });

  const handleSaveField = async (fieldKey: string) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/data`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extractedData: formData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save data');
      }
      
      // Remove field from editing set
      setEditingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldKey);
        return newSet;
      });
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save field. Please try again.');
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch(`/api/sessions/${session.id}/data`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extractedData: formData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify session');
      }
      
      // The API already sets status to 'verified' in the backend
      alert('Session verified successfully!');
      window.location.reload(); // Refresh to show updated status
    } catch (error) {
      console.error('Error verifying session:', error);
      alert('Failed to verify session. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleFieldEdit = (fieldKey: string) => {
    setEditingFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
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

  const renderFormField = (fieldName: string, fieldType: string, value: any, fieldKey: string) => {
    const isFieldEditing = editingFields.has(fieldKey);
    const commonProps = {
      id: fieldName,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        updateFormField(fieldName, e.target.value),
      disabled: !isFieldEditing
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

  const renderCollectionField = (
    collectionName: string,
    index: number,
    propertyName: string,
    propertyType: string,
    value: any,
    fieldKey: string
  ) => {
    const isFieldEditing = editingFields.has(fieldKey);
    const commonProps = {
      id: `${collectionName}-${index}-${propertyName}`,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        updateCollectionItem(collectionName, index, propertyName, e.target.value),
      disabled: !isFieldEditing
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
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${project.id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-medium text-gray-900">{session.sessionName}</h1>
                <p className="text-sm text-gray-500">{project.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={session.status === 'verified' ? 'default' : 'secondary'}>
                {session.status === 'verified' ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                ) : (
                  session.status
                )}
              </Badge>
              {session.status !== 'verified' && (
                <Button 
                  onClick={handleVerify} 
                  size="sm"
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Verify
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extracted Data
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Review and edit the extracted data from {session.documentCount} document(s)
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Schema Fields */}
            {project.schemaFields.length > 0 && (
              <div>
                <h4 className="text-lg font-medium mb-4">Document Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {project.schemaFields.map(field => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.fieldName} className="text-sm font-medium">
                        {field.fieldName}
                      </Label>
                      <div className="flex items-center gap-2">
                        {renderFormField(field.fieldName, field.fieldType, formData[field.fieldName], field.fieldName)}
                        <div className="flex gap-1">
                          {editingFields.has(field.fieldName) ? (
                            <>
                              <Button
                                onClick={() => handleSaveField(field.fieldName)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => toggleFieldEdit(field.fieldName)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => toggleFieldEdit(field.fieldName)}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
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
                  <Separator className="my-8" />
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-lg font-medium">{collection.collectionName}</h4>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground">{collection.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {collectionData.length} item(s) found
                      </p>
                    </div>
                    <Button 
                      onClick={() => addCollectionItem(collection.collectionName)}
                      size="sm"
                      variant="outline"
                    >
                      Add {collection.collectionName.slice(0, -1)}
                    </Button>
                  </div>

                  {collectionData.length > 0 ? (
                    <div className="space-y-4">
                      {collectionData.map((item: any, index: number) => (
                        <Card key={index} className="relative">
                          <CardContent className="pt-6">
                            <Button
                              onClick={() => removeCollectionItem(collection.collectionName, index)}
                              size="sm"
                              variant="destructive"
                              className="absolute top-4 right-4"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {collection.properties.map(property => (
                                <div key={property.id} className="space-y-2">
                                  <Label 
                                    htmlFor={`${collection.collectionName}-${index}-${property.propertyName}`}
                                    className="text-sm font-medium"
                                  >
                                    {property.propertyName}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    {renderCollectionField(
                                      collection.collectionName,
                                      index,
                                      property.propertyName,
                                      property.propertyType,
                                      item[property.propertyName],
                                      `${collection.collectionName}-${index}-${property.propertyName}`
                                    )}
                                    <div className="flex gap-1">
                                      {editingFields.has(`${collection.collectionName}-${index}-${property.propertyName}`) ? (
                                        <>
                                          <Button
                                            onClick={() => handleSaveField(`${collection.collectionName}-${index}-${property.propertyName}`)}
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                          >
                                            <Save className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            onClick={() => toggleFieldEdit(`${collection.collectionName}-${index}-${property.propertyName}`)}
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          onClick={() => toggleFieldEdit(`${collection.collectionName}-${index}-${property.propertyName}`)}
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
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
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-muted-foreground">
                        No {collection.collectionName.toLowerCase()} data was extracted from the documents
                      </p>
                      <Button 
                        onClick={() => addCollectionItem(collection.collectionName)}
                        size="sm"
                        variant="outline"
                        className="mt-4"
                      >
                        Add {collection.collectionName.slice(0, -1)} Manually
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Information Text */}
            <div className="text-center pt-8">
              <p className="text-sm text-gray-500 mb-4">
                Click the edit icon next to any field to modify the extracted data. Use the "Verify" button when all data is correct.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}