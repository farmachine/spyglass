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
    console.log('Beautifying JSON, input length:', jsonString.length);
    
    try {
      // Clean and sanitize the input
      let cleanJson = sanitizeJsonString(jsonString);
      console.log('After sanitization, length:', cleanJson.length);
      
      // Try to find and extract valid JSON
      const jsonMatch = extractJsonFromString(cleanJson);
      console.log('JSON extraction result:', jsonMatch ? `Found ${jsonMatch.length} chars` : 'null');
      if (!jsonMatch) {
        console.log('No JSON found in cleaned string');
        return cleanJson; // Return cleaned input if no JSON found
      }
      
      console.log('Extracted JSON length:', jsonMatch.length);
      
      // Parse and format the JSON
      const parsed = JSON.parse(jsonMatch);
      const formatted = JSON.stringify(parsed, null, 2);
      console.log('Successfully formatted JSON, output length:', formatted.length);
      return formatted;
    } catch (error) {
      console.warn('JSON parsing failed:', error);
      console.log('Error details:', error instanceof Error ? error.message : String(error));
      
      // Final fallback - return sanitized input
      const fallback = sanitizeJsonString(jsonString);
      console.log('Returning fallback, length:', fallback.length);
      return fallback;
    }
  };

  // Sanitize JSON string by removing problematic characters and markdown
  const sanitizeJsonString = (str: string): string => {
    let cleaned = str.trim();
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.replace(/^\s*```/gm, '');
    cleaned = cleaned.replace(/```\s*$/gm, '');
    
    // Remove control characters that cause JSON parsing issues
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Fix common JSON issues
    cleaned = cleaned.replace(/\\n/g, '\\\\n'); // Escape newlines in strings
    cleaned = cleaned.replace(/\\t/g, '\\\\t'); // Escape tabs in strings
    cleaned = cleaned.replace(/\\r/g, '\\\\r'); // Escape carriage returns
    
    return cleaned.trim();
  };

  // Extract JSON content from a string
  const extractJsonFromString = (str: string): string | null => {
    console.log('Looking for JSON in string. First 200 chars:', str.substring(0, 200));
    console.log('Last 200 chars:', str.substring(str.length - 200));
    
    const jsonStart = str.indexOf('{');
    console.log('JSON start position:', jsonStart);
    
    if (jsonStart === -1) {
      console.log('No opening brace found, checking for alternative formats...');
      // Try to find array start as well
      const arrayStart = str.indexOf('[');
      console.log('Array start position:', arrayStart);
      if (arrayStart === -1) return null;
      
      // Handle array format
      return extractArrayFromString(str, arrayStart);
    }
    
    // Find the matching closing brace
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let jsonEnd = -1;
    
    for (let i = jsonStart; i < str.length; i++) {
      const char = str[i];
      
      if (!escaped && char === '"') {
        inString = !inString;
      }
      
      if (!inString && !escaped) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
      }
      
      escaped = !escaped && char === '\\' && inString;
    }
    
    console.log('Brace counting completed. jsonEnd:', jsonEnd, 'braceCount:', braceCount);
    
    if (jsonEnd === -1) {
      console.log('JSON appears truncated, attempting repair...');
      // JSON is truncated, try to repair it
      return repairTruncatedJson(str.substring(jsonStart));
    }
    
    console.log('Found complete JSON from', jsonStart, 'to', jsonEnd);
    return str.substring(jsonStart, jsonEnd + 1);
  };

  // Helper function to extract JSON arrays
  const extractArrayFromString = (str: string, startPos: number): string | null => {
    let bracketCount = 0;
    let inString = false;
    let escaped = false;
    let arrayEnd = -1;
    
    for (let i = startPos; i < str.length; i++) {
      const char = str[i];
      
      if (!escaped && char === '"') {
        inString = !inString;
      }
      
      if (!inString && !escaped) {
        if (char === '[') bracketCount++;
        if (char === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            arrayEnd = i;
            break;
          }
        }
      }
      
      escaped = !escaped && char === '\\' && inString;
    }
    
    if (arrayEnd === -1) {
      console.log('Array is truncated, attempting repair...');
      return repairTruncatedJson(str.substring(startPos));
    }
    
    return str.substring(startPos, arrayEnd + 1);
  };

  // Helper function to repair truncated JSON
  const repairTruncatedJson = (jsonStr: string): string => {
    try {
      let repaired = jsonStr.trim();
      
      // Remove incomplete final line if it looks malformed
      const lines = repaired.split('\n');
      const lastLine = lines[lines.length - 1]?.trim();
      
      // If last line looks incomplete (unmatched quotes, no colon, etc.)
      if (lastLine && lastLine.includes('"')) {
        const quoteCount = (lastLine.match(/"/g) || []).length;
        if (quoteCount % 2 === 1 || (!lastLine.includes(':') && !lastLine.endsWith('}'))) {
          // Remove the incomplete last line
          lines.pop();
          repaired = lines.join('\n');
        }
      }
      
      // Count braces and add missing closing braces
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (!escaped && char === '"') {
          inString = !inString;
        }
        
        if (!inString && !escaped) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        escaped = !escaped && char === '\\' && inString;
      }
      
      // Close any unclosed braces
      while (braceCount > 0) {
        repaired += '\n}';
        braceCount--;
      }
      
      return repaired;
    } catch (error) {
      return jsonStr;
    }
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
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Mode: {showFormatted ? 'Formatted JSON' : 'Raw Response'} | 
                      Length: {session.aiResponse.length.toLocaleString()} characters
                    </div>
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