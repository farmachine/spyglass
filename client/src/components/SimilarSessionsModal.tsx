import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Sparkles, Copy, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SimilarSession {
  sessionId: string;
  similarity: number;
  sessionName?: string;
  sessionStatus?: string;
}

interface SchemaSuggestion {
  suggestedSteps: Array<{
    stepName: string;
    stepType: "page" | "list";
    description: string;
    values: Array<{ valueName: string; dataType: string; description: string }>;
  }>;
}

interface SimilarSessionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentContent: string;
  sessionId: string;
  mainObjectName?: string;
  onApplyTemplate: (schemaSnapshot: any) => void;
  onApplyAiSuggestion: (suggestion: SchemaSuggestion) => void;
  onSkip: () => void;
}

export function SimilarSessionsModal({
  open,
  onOpenChange,
  projectId,
  documentContent,
  sessionId,
  mainObjectName,
  onApplyTemplate,
  onApplyAiSuggestion,
  onSkip,
}: SimilarSessionsModalProps) {
  const [selectedOption, setSelectedOption] = useState<"template" | "ai" | null>(null);

  const { data: similarSessions, isLoading: loadingSimilar } = useQuery({
    queryKey: ["/api/projects", projectId, "find-similar-sessions", documentContent?.slice(0, 100)],
    queryFn: async () => {
      if (!documentContent) return { similarSessions: [] };
      return await apiRequest(`/api/projects/${projectId}/find-similar-sessions`, {
        method: "POST",
        body: JSON.stringify({ documentContent, threshold: 0.6 }),
      });
    },
    enabled: open && !!documentContent && !!projectId,
  });

  const { data: aiSuggestion, isLoading: loadingAi, refetch: generateAiSuggestion } = useQuery({
    queryKey: ["/api/projects", projectId, "suggest-schema", documentContent?.slice(0, 100)],
    queryFn: async () => {
      return await apiRequest(`/api/projects/${projectId}/suggest-schema`, {
        method: "POST",
        body: JSON.stringify({ documentContent }),
      }) as SchemaSuggestion;
    },
    enabled: false,
  });

  const copySchemaFromSessionMutation = useMutation({
    mutationFn: async (sourceSessionId: string) => {
      return await apiRequest(`/api/sessions/${sourceSessionId}/copy-schema`, {
        method: "POST",
        body: JSON.stringify({ targetSessionId: sessionId }),
      });
    },
    onSuccess: (data) => {
      if (data?.schemaSnapshot) {
        onApplyTemplate(data.schemaSnapshot);
      }
      onOpenChange(false);
    },
  });

  const handleUseTemplate = async (session: SimilarSession) => {
    setSelectedOption("template");
    copySchemaFromSessionMutation.mutate(session.sessionId);
  };

  const isApplyingTemplate = copySchemaFromSessionMutation.isPending;

  const handleGenerateAi = () => {
    setSelectedOption("ai");
    generateAiSuggestion();
  };

  const handleApplyAiSuggestion = () => {
    if (aiSuggestion) {
      onApplyAiSuggestion(aiSuggestion);
      onOpenChange(false);
    }
  };

  const hasSimilarSessions = similarSessions?.similarSessions?.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Schema Detection
          </DialogTitle>
          <DialogDescription>
            We analyzed your document and found options to speed up your workflow setup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingSimilar ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Analyzing document...</span>
            </div>
          ) : (
            <>
              {hasSimilarSessions && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Similar {mainObjectName ? mainObjectName + 's' : 'Sessions'} Found
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {mainObjectName 
                      ? `These ${mainObjectName.toLowerCase()}s had similar documents. You can re-use their extraction schema.`
                      : "These sessions had similar documents. You can use their extraction schema as a starting point."
                    }
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {similarSessions.similarSessions.map((session: SimilarSession) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{session.sessionName || "Unnamed Session"}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {Math.round(session.similarity * 100)}% match
                              </Badge>
                              {session.sessionStatus && (
                                <Badge variant="outline" className="text-xs">
                                  {session.sessionStatus}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseTemplate(session)}
                          disabled={isApplyingTemplate}
                        >
                          {isApplyingTemplate && selectedOption === "template" ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Copying...</>
                          ) : (
                            "Re-use Schema"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Wand2 className="h-4 w-4" />
                  AI Schema Generation
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Let AI analyze your document and suggest an extraction schema automatically.
                </p>

                {loadingAi ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm">Generating schema suggestions...</span>
                  </div>
                ) : aiSuggestion ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      AI suggested {aiSuggestion.suggestedSteps?.length || 0} extraction steps:
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {aiSuggestion.suggestedSteps?.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-accent/30 rounded">
                          <Badge variant={step.stepType === "page" ? "default" : "secondary"}>
                            {step.stepType === "page" ? "Info Page" : "Data Table"}
                          </Badge>
                          <span>{step.stepName}</span>
                          <span className="text-muted-foreground">({step.values.length} fields)</span>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleApplyAiSuggestion} className="w-full mt-2">
                      Apply AI Suggestion
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={handleGenerateAi} className="w-full">
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate AI Schema
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>
            Skip & Configure Manually
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SimilarSessionsModal;
