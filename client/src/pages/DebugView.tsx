import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bug, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ExtractionSession, FieldValidation, SessionBatch } from "@shared/schema";

export default function DebugView() {
  const { sessionId } = useParams();
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const { data: session, isLoading } = useQuery<ExtractionSession>({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId
  });

  const { data: validations } = useQuery<FieldValidation[]>({
    queryKey: ['/api/sessions', sessionId, 'validations'],
    enabled: !!sessionId
  });

  const { data: sessionBatches } = useQuery<SessionBatch[]>({
    queryKey: ['/api/sessions', sessionId, 'batches'],
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

  // Calculate batch information
  const batchData = validations ? (() => {
    const batchNumbers = Array.from(new Set(validations.map(v => v.batchNumber || 1)));
    const batches = batchNumbers.map(batchNumber => ({
      batchNumber,
      validationCount: validations.filter(v => (v.batchNumber || 1) === batchNumber).length
    }));
    return {
      totalBatches: batchNumbers.length,
      batches: batches.sort((a, b) => a.batchNumber - b.batchNumber)
    };
  })() : null;

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
    if (count === null || count === undefined) return "No data";
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              AI Prompt
              {session.extractionPrompt && (
                <div className="flex gap-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {Math.round(session.extractionPrompt.length / 1000)}K chars
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${session.inputTokenCount ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {formatTokenCount(session.inputTokenCount)} tokens
                  </span>
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
                  <span className={`text-xs px-2 py-1 rounded ${session.outputTokenCount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {formatTokenCount(session.outputTokenCount)} tokens
                  </span>
                </div>
              )}
            </TabsTrigger>
            <TabsTrigger value="batches" className="flex items-center gap-2">
              Batch Information
              {batchData && (
                <div className="flex gap-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {validations?.length || 0} validations
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${batchData.totalBatches > 1 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {batchData.totalBatches} batch{batchData.totalBatches !== 1 ? 'es' : ''}
                  </span>
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

          <TabsContent value="batches">
            <Card>
              <CardHeader>
                <CardTitle>Batch Processing Information</CardTitle>
              </CardHeader>
              <CardContent>
                {batchData ? (
                  <div className="space-y-6">
                    {/* Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{validations?.length || 0}</div>
                        <div className="text-sm text-gray-600">Total Validations</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{batchData.totalBatches}</div>
                        <div className="text-sm text-gray-600">Processing Batches</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{session.inputTokenCount ? Math.round(session.inputTokenCount / 1000) : 0}K</div>
                        <div className="text-sm text-gray-600">Input Tokens</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{session.outputTokenCount ? Math.round(session.outputTokenCount / 1000) : 0}K</div>
                        <div className="text-sm text-gray-600">Output Tokens</div>
                      </div>
                    </div>

                    {/* Truncation Status */}
                    <div className="p-4 rounded-lg border">
                      {batchData.totalBatches === 1 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-green-700">No Truncation Detected</span>
                          <span className="text-sm text-gray-600">- All data processed in single batch</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="font-medium text-orange-700">Multiple Batches Detected</span>
                          <span className="text-sm text-gray-600">- AI response was truncated and required continuation</span>
                        </div>
                      )}
                    </div>

                    {/* Detailed Batch Information */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Detailed Batch Information</h3>
                      {sessionBatches && sessionBatches.length > 0 ? (
                        <div className="space-y-4">
                          {sessionBatches.map(batch => (
                            <Card key={batch.batchNumber} className="border">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">Batch {batch.batchNumber}</Badge>
                                    <span className="text-sm text-gray-600">
                                      {batch.validationCount} validation{batch.validationCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="flex gap-4 text-xs text-gray-500">
                                    <span>Input: {formatTokenCount(batch.inputTokenCount)} tokens</span>
                                    <span>Output: {formatTokenCount(batch.outputTokenCount)} tokens</span>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {batch.extractionPrompt && (
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Extraction Prompt</h4>
                                    <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-gray-50">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {batch.extractionPrompt}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                )}
                                {batch.aiResponse && (
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">AI Response</h4>
                                    <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-gray-50">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {batch.aiResponse}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {batchData.batches.map(batch => (
                            <div key={batch.batchNumber} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">Batch {batch.batchNumber}</Badge>
                                <span className="text-sm text-gray-600">
                                  {batch.validationCount} validation{batch.validationCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {((batch.validationCount / (validations?.length || 1)) * 100).toFixed(1)}% of total
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Technical Details */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Technical Details</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Session ID:</span> {session.id}
                          </div>
                          <div>
                            <span className="font-medium">Processing Status:</span> {session.status}
                          </div>
                          <div>
                            <span className="font-medium">Created:</span> {new Date(session.createdAt).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Last Updated:</span> {new Date(session.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No batch processing data available for this session.</p>
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