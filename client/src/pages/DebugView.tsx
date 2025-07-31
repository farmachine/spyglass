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
  const [showFormatted, setShowFormatted] = useState(true);

  // Function to beautify JSON response
  const beautifyJson = (jsonString: string): string => {
    try {
      // Remove all markdown code blocks and clean the string
      let cleanJson = jsonString.trim();
      
      // Handle various markdown formats - more aggressive cleaning
      cleanJson = cleanJson.replace(/```json\s*/g, '');
      cleanJson = cleanJson.replace(/```\s*/g, '');
      cleanJson = cleanJson.replace(/^\s*```/gm, '');
      cleanJson = cleanJson.replace(/```\s*$/gm, '');
      
      // Remove any extra whitespace and newlines at start/end
      cleanJson = cleanJson.trim();
      
      // Try to find JSON content more intelligently
      let jsonStart = cleanJson.indexOf('{');
      let jsonEnd = -1;
      
      if (jsonStart !== -1) {
        // Count braces to find the matching closing brace
        let braceCount = 0;
        for (let i = jsonStart; i < cleanJson.length; i++) {
          if (cleanJson[i] === '{') braceCount++;
          if (cleanJson[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
        
        if (jsonEnd !== -1) {
          cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
        } else {
          // JSON might be truncated - try to repair it
          cleanJson = repairTruncatedJson(cleanJson.substring(jsonStart));
        }
      }
      
      // Parse and stringify with proper formatting
      const parsed = JSON.parse(cleanJson);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.warn('JSON parsing failed, attempting repair:', error);
      
      // Try to repair truncated JSON
      let fallback = jsonString.trim();
      
      // Remove markdown blocks
      fallback = fallback.replace(/```json\s*/g, '');
      fallback = fallback.replace(/```\s*/g, '');
      
      // Find JSON start
      const start = fallback.indexOf('{');
      if (start !== -1) {
        fallback = fallback.substring(start);
        fallback = repairTruncatedJson(fallback);
        
        // Try parsing the repaired JSON
        try {
          const parsed = JSON.parse(fallback);
          return JSON.stringify(parsed, null, 2);
        } catch (repairError) {
          console.warn('Repair failed, returning cleaned original');
        }
      }
      
      return fallback;
    }
  };

  // Helper function to repair truncated JSON
  const repairTruncatedJson = (jsonStr: string): string => {
    try {
      // Remove any incomplete trailing content that might cause parsing issues
      let repaired = jsonStr.trim();
      
      // Check for unterminated strings and fix them
      const lines = repaired.split('\n');
      const repairedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // If we hit an incomplete line, stop processing
        if (line.includes('"') && !isValidJsonLine(line)) {
          // Try to complete the line
          const quoteCount = (line.match(/"/g) || []).length;
          if (quoteCount % 2 === 1) {
            // Odd number of quotes - likely truncated string
            const lastQuoteIndex = line.lastIndexOf('"');
            line = line.substring(0, lastQuoteIndex + 1);
          }
          repairedLines.push(line);
          break;
        }
        repairedLines.push(line);
      }
      
      repaired = repairedLines.join('\n');
      
      // Ensure proper JSON structure closure
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (!escaped && char === '"') {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        escaped = !escaped && char === '\\';
      }
      
      // Add missing closing braces
      while (braceCount > 0) {
        repaired += '\n}';
        braceCount--;
      }
      
      return repaired;
    } catch (error) {
      return jsonStr;
    }
  };

  // Helper to check if a line has valid JSON structure
  const isValidJsonLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === '{' || trimmed === '}' || trimmed === ',' || trimmed.endsWith(',')) {
      return true;
    }
    
    // Check for key-value pair pattern
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return false;
    
    const key = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();
    
    // Key should be quoted
    if (!key.startsWith('"') || !key.endsWith('"')) return false;
    
    // Value should be complete (not cut off mid-string)
    if (value.startsWith('"') && !value.endsWith('"') && !value.endsWith('",')) {
      return false;
    }
    
    return true;
  };

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
      const textToCopy = showFormatted ? beautifyJson(session.aiResponse) : session.aiResponse;
      await navigator.clipboard.writeText(textToCopy);
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
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {Math.round(session.extractionPrompt.length / 1000)}K chars
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="response" className="flex items-center gap-2">
              AI Response
              {session.aiResponse && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {Math.round(session.aiResponse.length / 1000)}K chars
                </span>
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
                  <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant={showFormatted ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowFormatted(!showFormatted)}
                      >
                        {showFormatted ? 'Show Raw' : 'Show Formatted'}
                      </Button>
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
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {session.aiResponse ? (
                  <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                        <code 
                          className="language-json text-gray-800 dark:text-gray-200"
                          style={{
                            color: '#1f2937',
                            '--json-key-color': '#0f766e',
                            '--json-string-color': '#dc2626', 
                            '--json-number-color': '#1e40af',
                            '--json-boolean-color': '#7c2d12'
                          } as React.CSSProperties}
                        >
                          {showFormatted ? beautifyJson(session.aiResponse) : session.aiResponse}
                        </code>
                      </pre>
                    </div>
                  </ScrollArea>
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