import { useState } from "react";
import { Link2, CheckCircle, XCircle, Loader2, FileText, ClipboardList, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SimilarSession {
  sessionId: string;
  sessionName: string;
  similarityScore: number;
  matchReason: string;
  documentCount: number;
  hasKanbanContent: boolean;
}

interface LinkResult {
  success: boolean;
  gapAnalysis: string;
  copiedTaskCount: number;
  excludedTaskCount: number;
  newTaskCount: number;
}

interface SessionLinkingModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  kanbanStepId?: string;
  onLinkComplete?: () => void;
  mainObjectName?: string;
}

export default function SessionLinkingModal({
  open,
  onClose,
  sessionId,
  kanbanStepId,
  onLinkComplete,
  mainObjectName = "Session"
}: SessionLinkingModalProps) {
  const objectName = mainObjectName.charAt(0).toUpperCase() + mainObjectName.slice(1).toLowerCase();
  const objectNameLower = mainObjectName.toLowerCase();
  const [similarSessions, setSimilarSessions] = useState<SimilarSession[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SimilarSession | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const findSimilarMutation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest(`/api/sessions/${sessionId}/find-similar`, {
        method: 'POST'
      });
      return data;
    },
    onSuccess: (data) => {
      setSimilarSessions(data.similarSessions || []);
      setSearchComplete(true);
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('Error finding similar sessions:', error);
      setSearchError(true);
      setIsSearching(false);
    }
  });

  const linkSessionMutation = useMutation({
    mutationFn: async (linkedSessionId: string) => {
      const data = await apiRequest(`/api/sessions/${sessionId}/link-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedSessionId })
      });
      return data;
    },
    onSuccess: (data) => {
      setLinkResult(data);
      // Invalidate kanban cards query to refresh the board
      if (kanbanStepId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${kanbanStepId}/kanban-cards`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps`] });
      toast({
        title: `${objectName} Linked Successfully`,
        description: `Copied ${data.copiedTaskCount} tasks from the previous ${objectNameLower}.`
      });
    },
    onError: (error) => {
      console.error('Error linking session:', error);
      toast({
        title: "Linking Failed",
        description: `Unable to link ${objectNameLower}. Please try again.`,
        variant: "destructive"
      });
    }
  });

  const handleOpen = () => {
    if (!searchComplete && !isSearching && !searchError) {
      setIsSearching(true);
      findSimilarMutation.mutate();
    }
  };

  const handleRetry = () => {
    setSearchError(false);
    setIsSearching(true);
    findSimilarMutation.mutate();
  };

  const handleLink = () => {
    if (selectedSession) {
      linkSessionMutation.mutate(selectedSession.sessionId);
    }
  };

  const handleClose = () => {
    if (linkResult && onLinkComplete) {
      onLinkComplete();
    }
    setSimilarSessions([]);
    setSearchComplete(false);
    setSearchError(false);
    setSelectedSession(null);
    setLinkResult(null);
    onClose();
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  if (open && !searchComplete && !isSearching) {
    handleOpen();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" style={{ color: '#4F63A4' }} />
            {linkResult ? `${objectName} Linked` : `Link Similar ${objectName}`}
          </DialogTitle>
          <DialogDescription>
            {linkResult 
              ? `Content from the previous ${objectNameLower} has been copied to this ${objectNameLower}.`
              : `Reuse tasks and content from a similar previous ${objectNameLower} to save time.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: '#4F63A4' }} />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Scanning previous {objectNameLower}s for similar content...
              </p>
            </div>
          )}

          {searchError && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Unable to search for similar {objectNameLower}s.<br />
                Please try again.
              </p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                <Loader2 className="h-4 w-4 mr-2" />
                Retry Search
              </Button>
            </div>
          )}

          {searchComplete && !linkResult && (
            <>
              {similarSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <FileText className="h-10 w-10 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    No similar {objectNameLower}s found in this project.<br />
                    This appears to be a unique document type.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-3">
                    {similarSessions.map((session) => (
                      <div
                        key={session.sessionId}
                        onClick={() => setSelectedSession(session)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedSession?.sessionId === session.sessionId
                            ? 'border-[#4F63A4] bg-[#4F63A4]/5 ring-2 ring-[#4F63A4]/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{session.sessionName}</h4>
                              <Badge className={getSimilarityColor(session.similarityScore)}>
                                {session.similarityScore}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {session.matchReason}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                {session.documentCount} documents
                              </span>
                              {session.hasKanbanContent && (
                                <span className="flex items-center gap-1 text-[#4F63A4]">
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  Has tasks to copy
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedSession?.sessionId === session.sessionId && (
                            <CheckCircle className="h-5 w-5 text-[#4F63A4] flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {linkResult && (
            <div className="py-6 space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-100">
                      Successfully Linked
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Content from "{selectedSession?.sessionName}" has been copied.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-[#4F63A4]">{linkResult.copiedTaskCount}</div>
                  <div className="text-xs text-gray-500 mt-1">Tasks Copied</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{linkResult.newTaskCount}</div>
                  <div className="text-xs text-gray-500 mt-1">New Tasks Added</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-gray-400">{linkResult.excludedTaskCount}</div>
                  <div className="text-xs text-gray-500 mt-1">Tasks Excluded</div>
                </div>
              </div>

              {linkResult.gapAnalysis && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Gap Analysis
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {linkResult.gapAnalysis}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {linkResult.excludedTaskCount > 0 && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {linkResult.excludedTaskCount} task(s) from the previous {objectNameLower} were not relevant to the new documents and were excluded.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!linkResult ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {similarSessions.length === 0 ? "Close" : "Skip"}
              </Button>
              {similarSessions.length > 0 && (
                <Button
                  onClick={handleLink}
                  disabled={!selectedSession || linkSessionMutation.isPending}
                  style={{ backgroundColor: '#4F63A4' }}
                  className="text-white hover:opacity-90"
                >
                  {linkSessionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Link {objectName}
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleClose} style={{ backgroundColor: '#4F63A4' }} className="text-white hover:opacity-90">
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
