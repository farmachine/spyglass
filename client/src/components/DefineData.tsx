import { useState } from "react";
import { Settings, Plus, Edit, Trash2, Database, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectWithDetails } from "@shared/schema";

interface DefineDataProps {
  project: ProjectWithDetails;
}

export default function DefineData({ project }: DefineDataProps) {
  const [activeTab, setActiveTab] = useState("schema");

  const fieldTypeColors = {
    TEXT: "bg-blue-100 text-blue-800",
    NUMBER: "bg-green-100 text-green-800",
    DATE: "bg-purple-100 text-purple-800",
    BOOLEAN: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Define Data Schema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure the data structure and fields for extraction
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schema">Project Schema</TabsTrigger>
          <TabsTrigger value="collections">Object Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Global Project Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.schemaFields.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No schema fields defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define global fields that apply to the entire document set
                  </p>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schema Field
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.schemaFields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium">{field.fieldName}</TableCell>
                        <TableCell>
                          <Badge className={fieldTypeColors[field.fieldType as keyof typeof fieldTypeColors]}>
                            {field.fieldType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {field.description || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Object Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.collections.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No object collections defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define object types (like Employees, Assets, etc.) with their properties
                  </p>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Collection
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {project.collections.map((collection) => (
                    <Card key={collection.id} className="border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{collection.collectionName}</CardTitle>
                            {collection.description && (
                              <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {collection.properties.length === 0 ? (
                          <div className="text-center py-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-2">No properties defined</p>
                            <Button variant="outline" size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Property
                            </Button>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Property Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {collection.properties.map((property) => (
                                <TableRow key={property.id}>
                                  <TableCell className="font-medium">{property.propertyName}</TableCell>
                                  <TableCell>
                                    <Badge className={fieldTypeColors[property.propertyType as keyof typeof fieldTypeColors]}>
                                      {property.propertyType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-600">
                                    {property.description || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button variant="ghost" size="sm">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
