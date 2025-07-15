import { Brain, FileText, Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectWithDetails } from "@shared/schema";

interface KnowledgeRulesProps {
  project: ProjectWithDetails;
}

export default function KnowledgeRules({ project }: KnowledgeRulesProps) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Knowledge & Rules</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage extraction rules and knowledge base for this project
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Knowledge
        </Button>
      </div>

      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="rules">Extraction Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Knowledge Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No knowledge documents uploaded
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Upload reference documents, policies, and guidelines to improve extraction accuracy
                </p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Knowledge Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Extraction Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No extraction rules defined
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Define custom rules for data validation, classification, and formatting
                </p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Extraction Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
