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
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

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

      } else {
        await createKnowledgeDocument.mutateAsync(data);

      }
      setEditingDocument(null);
      setKnowledgeDialogOpen(false);
    } catch (error) {
      toast({ title: "Failed to save document", variant: "destructive" });
    }
  };

  const handleDeleteKnowledgeDocument = async (id: string) => {
    if (deletingDocId === id) return; // Prevent double-click
    
    setDeletingDocId(id);
    try {
      await deleteKnowledgeDocument.mutateAsync(id);

    } catch (error) {
      toast({ title: "Failed to delete document", variant: "destructive" });
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleSaveExtractionRule = async (data: any) => {
    try {
      
      if (editingRule) {
        await updateExtractionRule.mutateAsync({ id: editingRule.id, ...data });

      } else {
        await createExtractionRule.mutateAsync(data);

      }
      setEditingRule(null);
    } catch (error) {
      toast({ title: "Failed to save rule", variant: "destructive" });
    }
  };

  const handleDeleteExtractionRule = async (id: string) => {
    if (deletingRuleId === id) return; // Prevent double-click
    
    setDeletingRuleId(id);
    try {
      await deleteExtractionRule.mutateAsync(id);

    } catch (error) {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    } finally {
      setDeletingRuleId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };



  return (
    <div className="bg-slate-900 dark:bg-slate-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-100 dark:text-gray-100">Knowledge & Rules</h2>
          <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
            Manage extraction rules and knowledge base for this project
          </p>
        </div>
      </div>

      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800 dark:bg-slate-800 border-slate-700">
          <TabsTrigger value="knowledge" className="text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white">Knowledge Base</TabsTrigger>
          <TabsTrigger value="rules" className="text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white">Extraction Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-6">
          <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-gray-100 dark:text-gray-100">
                  <BookOpen className="h-5 w-5" />
                  Knowledge Documents ({knowledgeDocuments.length})
                </CardTitle>
                <Button
                  onClick={() => {
                    setEditingDocument(null);
                    setKnowledgeDialogOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-gray-300 dark:text-gray-300">
              {knowledgeLoading ? (
                <div className="text-center py-8">Loading knowledge documents...</div>
              ) : knowledgeDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-500 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-100 dark:text-gray-100 mb-2">
                    No knowledge documents uploaded
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mb-6">
                    Upload reference documents, policies, and guidelines to improve extraction accuracy
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingDocument(null);
                      setKnowledgeDialogOpen(true);
                    }}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Knowledge Documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledgeDocuments.map((doc) => (
                    <div key={doc.id} className="border border-slate-600 dark:border-slate-600 rounded-lg p-4 hover:bg-slate-700 dark:hover:bg-slate-700 bg-slate-750 dark:bg-slate-750">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <FileIcon className="h-5 w-5 text-blue-400 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-100 dark:text-gray-100">{doc.displayName || doc.fileName}</h4>
                              <Badge variant="secondary" className="text-xs bg-slate-600 text-gray-300">
                                {doc.fileType.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400 dark:text-gray-400 mb-2">{doc.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
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
                            disabled={deletingDocId === doc.id}
                            className="text-gray-300 hover:text-white hover:bg-slate-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKnowledgeDocument(doc.id)}
                            disabled={deletingDocId === doc.id}
                            className="text-gray-300 hover:text-white hover:bg-slate-600"
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
          <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-gray-100 dark:text-gray-100">
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
            <CardContent className="text-gray-300 dark:text-gray-300">
              {rulesLoading ? (
                <div className="text-center py-8">Loading extraction rules...</div>
              ) : extractionRules.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-500 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-100 dark:text-gray-100 mb-2">
                    No extraction rules defined
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mb-6">
                    Define custom rules for data validation, classification, and formatting
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRule(null);
                      setRuleDialogOpen(true);
                    }}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Extraction Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {extractionRules.map((rule) => (
                    <div key={rule.id} className="border border-slate-600 dark:border-slate-600 rounded-lg p-4 hover:bg-slate-700 dark:hover:bg-slate-700 bg-slate-750 dark:bg-slate-750">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 mt-1">
                            {rule.isActive ? (
                              <CheckCircle className="h-5 w-5 text-green-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-100 dark:text-gray-100">{rule.ruleName}</h4>
                              {rule.targetField && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-gray-300">
                                  Target: {rule.targetField}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 dark:text-gray-400 mb-2">{rule.ruleContent}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
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
                            disabled={deletingRuleId === rule.id}
                            className="text-gray-300 hover:text-white hover:bg-slate-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExtractionRule(rule.id)}
                            className="text-gray-300 hover:text-white hover:bg-slate-600"
                            disabled={deletingRuleId === rule.id}
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
        project={project}
      />

      <ExtractionRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        onSave={handleSaveExtractionRule}
        rule={editingRule}
        isLoading={createExtractionRule.isPending || updateExtractionRule.isPending}
        project={project}
      />
    </div>
  );
}
