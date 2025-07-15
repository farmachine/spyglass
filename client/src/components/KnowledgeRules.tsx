import { useState } from "react";
import { Brain, FileText, Plus, BookOpen, Edit, Trash2, Calendar, FileIcon, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useKnowledgeDocuments,
  useCreateKnowledgeDocument,
  useUpdateKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useExtractionRules,
  useCreateExtractionRule,
  useUpdateExtractionRule,
  useDeleteExtractionRule,
} from "@/hooks/useKnowledge";
import KnowledgeDocumentDialog from "./KnowledgeDocumentDialog";
import ExtractionRuleDialog from "./ExtractionRuleDialog";
import type { ProjectWithDetails, KnowledgeDocument, ExtractionRule } from "@shared/schema";

interface KnowledgeRulesProps {
  project: ProjectWithDetails;
}

export default function KnowledgeRules({ project }: KnowledgeRulesProps) {
  const { toast } = useToast();
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocument | null>(null);
  const [editingRule, setEditingRule] = useState<ExtractionRule | null>(null);

  // Knowledge Documents
  const { data: knowledgeDocuments = [], isLoading: knowledgeLoading } = useKnowledgeDocuments(project.id);
  const createKnowledgeDocument = useCreateKnowledgeDocument(project.id);
  const updateKnowledgeDocument = useUpdateKnowledgeDocument();
  const deleteKnowledgeDocument = useDeleteKnowledgeDocument();

  // Extraction Rules
  const { data: extractionRules = [], isLoading: rulesLoading } = useExtractionRules(project.id);
  const createExtractionRule = useCreateExtractionRule(project.id);
  const updateExtractionRule = useUpdateExtractionRule();
  const deleteExtractionRule = useDeleteExtractionRule();

  const handleSaveKnowledgeDocument = async (data: any) => {
    try {
      if (editingDocument) {
        await updateKnowledgeDocument.mutateAsync({ id: editingDocument.id, ...data });
        toast({ title: "Document updated successfully" });
      } else {
        await createKnowledgeDocument.mutateAsync(data);
        toast({ title: "Document added successfully" });
      }
      setEditingDocument(null);
    } catch (error) {
      toast({ title: "Failed to save document", variant: "destructive" });
    }
  };

  const handleDeleteKnowledgeDocument = async (id: number) => {
    try {
      await deleteKnowledgeDocument.mutateAsync(id);
      toast({ title: "Document deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete document", variant: "destructive" });
    }
  };

  const handleSaveExtractionRule = async (data: any) => {
    try {
      if (editingRule) {
        await updateExtractionRule.mutateAsync({ id: editingRule.id, ...data });
        toast({ title: "Rule updated successfully" });
      } else {
        await createExtractionRule.mutateAsync(data);
        toast({ title: "Rule created successfully" });
      }
      setEditingRule(null);
    } catch (error) {
      toast({ title: "Failed to save rule", variant: "destructive" });
    }
  };

  const handleDeleteExtractionRule = async (id: number) => {
    try {
      await deleteExtractionRule.mutateAsync(id);
      toast({ title: "Rule deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case "validation": return "bg-blue-100 text-blue-800";
      case "formatting": return "bg-green-100 text-green-800";
      case "classification": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Knowledge & Rules</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage extraction rules and knowledge base for this project
          </p>
        </div>
      </div>

      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="rules">Extraction Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Knowledge Documents ({knowledgeDocuments.length})
                </CardTitle>
                <Button
                  onClick={() => {
                    setEditingDocument(null);
                    setKnowledgeDialogOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {knowledgeLoading ? (
                <div className="text-center py-8">Loading knowledge documents...</div>
              ) : knowledgeDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No knowledge documents uploaded
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Upload reference documents, policies, and guidelines to improve extraction accuracy
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingDocument(null);
                      setKnowledgeDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Knowledge Documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledgeDocuments.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <FileIcon className="h-5 w-5 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{doc.fileName}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {doc.fileType.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                              <span>{formatFileSize(doc.fileSize)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingDocument(doc);
                              setKnowledgeDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKnowledgeDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Extraction Rules ({extractionRules.length})
                </CardTitle>
                <Button
                  onClick={() => {
                    setEditingRule(null);
                    setRuleDialogOpen(true);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="text-center py-8">Loading extraction rules...</div>
              ) : extractionRules.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No extraction rules defined
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Define custom rules for data validation, classification, and formatting
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRule(null);
                      setRuleDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Extraction Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {extractionRules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 mt-1">
                            {rule.isActive ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{rule.ruleName}</h4>
                              <Badge className={getRuleTypeColor(rule.ruleType)}>
                                {rule.ruleType}
                              </Badge>
                              {rule.targetField && (
                                <Badge variant="outline" className="text-xs">
                                  Target: {rule.targetField}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{rule.ruleContent}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(rule.createdAt).toLocaleDateString()}
                              </span>
                              <span>{rule.isActive ? "Active" : "Inactive"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setRuleDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExtractionRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <KnowledgeDocumentDialog
        open={knowledgeDialogOpen}
        onOpenChange={setKnowledgeDialogOpen}
        onSave={handleSaveKnowledgeDocument}
        document={editingDocument}
        isLoading={createKnowledgeDocument.isPending || updateKnowledgeDocument.isPending}
      />

      <ExtractionRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        onSave={handleSaveExtractionRule}
        rule={editingRule}
        isLoading={createExtractionRule.isPending || updateExtractionRule.isPending}
      />
    </div>
  );
}
