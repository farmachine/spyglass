import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Bug, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ExtractionSession } from "@shared/schema";

export default function DebugView() {
  const { sessionId } = useParams();
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const { data: session, isLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId
  });

  const handleCopyPrompt = async () => {
    if (session?.extractionPrompt) {
      await navigator.clipboard.writeText(session.extractionPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyResponse = async () => {
    if (session?.aiResponse) {
      await navigator.clipboard.writeText(session.aiResponse);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Bug className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Extraction Debug</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Bug className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Extraction Debug</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Session not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasDebugData = session.extractionPrompt || session.aiResponse;

  // Helper function to format token count
  const formatTokenCount = (count: number | null | undefined) => {
    if (!count) return "N/A";
    return count.toLocaleString();
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Bug className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Extraction Debug</h1>
            <p className="text-muted-foreground">{session.sessionName}</p>
          </div>
        </div>
        <Link href={`/sessions/${sessionId}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Session
          </Button>
        </Link>
      </div>

      {!hasDebugData ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Bug className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Debug Data Available</h3>
              <p className="text-muted-foreground mb-4">
                This session doesn't have extraction prompt or AI response data saved.
              </p>
              <p className="text-sm text-muted-foreground">
                Debug data is automatically captured for new extractions.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="prompt" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              AI Prompt
              {session.extractionPrompt && (
                <div className="flex gap-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {Math.round(session.extractionPrompt.length / 1000)}K chars
                  </span>
                  {session.inputTokenCount && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {formatTokenCount(session.inputTokenCount)} tokens
                    </span>
                  )}
                </div>
              )}
            </TabsTrigger>
            <TabsTrigger value="response" className="flex items-center gap-2">
              AI Response
              {session.aiResponse && (
                <div className="flex gap-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {Math.round(session.aiResponse.length / 1000)}K chars
                  </span>
                  {session.outputTokenCount && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      {formatTokenCount(session.outputTokenCount)} tokens
                    </span>
                  )}
                </div>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompt">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Extraction Prompt</CardTitle>
                  {session.extractionPrompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-2"
                    >
                      {copiedPrompt ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedPrompt ? 'Copied!' : 'Copy'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {session.extractionPrompt ? (
                  <ScrollArea className="h-[800px] w-full rounded-md border p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {session.extractionPrompt}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No extraction prompt data available for this session.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="response">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>AI Response</CardTitle>
                  {session.aiResponse && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyResponse}
                      className="flex items-center gap-2"
                    >
                      {copiedResponse ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedResponse ? 'Copied!' : 'Copy'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {session.aiResponse ? (
                  <div className="space-y-4">
                    {/* Token usage summary */}
                    {(session.inputTokenCount || session.outputTokenCount) && (
                      <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium">Input:</span> {formatTokenCount(session.inputTokenCount)} tokens
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Output:</span> {formatTokenCount(session.outputTokenCount)} tokens
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Total:</span> {formatTokenCount((session.inputTokenCount || 0) + (session.outputTokenCount || 0))} tokens
                        </div>
                      </div>
                    )}
                    
                    {/* Raw AI response */}
                    <ScrollArea className="h-[800px] w-full rounded-md border p-4">
                      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                        {session.aiResponse}
                      </pre>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No AI response data available for this session.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}