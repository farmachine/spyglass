import { useState } from "react";
import { Brain, FileText, Plus, BookOpen, Edit, Trash2, Calendar, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  mode?: "knowledge" | "rules";
}

export default function KnowledgeRules({ project, mode }: KnowledgeRulesProps) {
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
      setKnowledgeDialogOpen(false);
      setEditingDocument(null);
    } catch (error) {
      toast({ title: "Failed to save knowledge document", variant: "destructive" });
    }
  };

  const handleDeleteKnowledgeDocument = async (id: string) => {
    if (deletingDocId === id) return;
    
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
      setRuleDialogOpen(false);
      setEditingRule(null);
    } catch (error) {
      toast({ title: "Failed to save extraction rule", variant: "destructive" });
    }
  };

  const handleDeleteExtractionRule = async (id: string) => {
    if (deletingRuleId === id) return;
    
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

  const getHeading = () => {
    switch (mode) {
      case "knowledge":
        return "extrapl • Knowledge";
      case "rules":
        return "extrapl • Rules";
      default:
        return "Knowledge & Rules";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "knowledge":
        return "Manage knowledge documents and reference materials";
      case "rules":
        return "Configure extraction rules and validation logic";
      default:
        return "Manage extraction rules and knowledge base for this project";
    }
  };

  const renderKnowledgeSection = () => (
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
                        <h4 className="font-medium text-gray-900">{doc.displayName || doc.fileName}</h4>
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
                      disabled={deletingDocId === doc.id}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKnowledgeDocument(doc.id)}
                      disabled={deletingDocId === doc.id}
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
  );

  const renderRulesSection = () => (
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
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
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
              Create rules to guide the AI extraction process and improve accuracy
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setEditingRule(null);
                setRuleDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Extraction Rules
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {extractionRules.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{rule.ruleName}</h4>
                        <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rule.ruleContent}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </span>
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
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteExtractionRule(rule.id)}
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
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {getHeading().includes("•") ? (
              <>
                {getHeading().split(" • ")[0]} <span style={{ color: '#4F63A4' }}>•</span> {getHeading().split(" • ")[1]}
              </>
            ) : (
              getHeading()
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            {getDescription()}
          </p>
        </div>
      </div>

      {mode === "knowledge" && renderKnowledgeSection()}
      {mode === "rules" && renderRulesSection()}

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