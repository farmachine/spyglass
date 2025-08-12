import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Bug, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ExtractionSession } from "@shared/schema";

// Component to display parsed schema fields from the extraction prompt
function SchemaFieldsDisplay({ session }: { session: ExtractionSession }) {
  const [parsedFields, setParsedFields] = useState<any[]>([]);

  // Parse the extraction prompt to extract schema field information
  const parseSchemaFields = () => {
    if (!session.extractionPrompt) return [];

    try {
      const prompt = session.extractionPrompt;
      
      // Look for JSON schema section in the prompt
      const jsonSchemaMatch = prompt.match(/```json\s*\n([\s\S]*?)\n```/);
      if (!jsonSchemaMatch) return [];

      const jsonContent = jsonSchemaMatch[1];
      const schema = JSON.parse(jsonContent);
      
      const fields: any[] = [];
      
      // Extract schema fields
      if (schema.schema_fields) {
        schema.schema_fields.forEach((field: any) => {
          fields.push({
            ...field,
            type: 'schema_field',
            collection_name: null
          });
        });
      }
      
      // Extract collection properties
      if (schema.collections) {
        schema.collections.forEach((collection: any) => {
          if (collection.properties) {
            collection.properties.forEach((prop: any) => {
              fields.push({
                ...prop,
                type: 'collection_property',
                collection_name: collection.collection_name
              });
            });
          }
        });
      }
      
      return fields;
    } catch (error) {
      console.error('Error parsing schema fields:', error);
      return [];
    }
  };

  const fields = parseSchemaFields();

  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No schema fields found in extraction prompt.</p>
        <p className="text-sm mt-2">Schema information should be available after running an extraction.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm">
          <span className="font-medium">Total Fields:</span> {fields.length}
        </div>
        <div className="text-sm">
          <span className="font-medium">Schema Fields:</span> {fields.filter(f => f.type === 'schema_field').length}
        </div>
        <div className="text-sm">
          <span className="font-medium">Collection Properties:</span> {fields.filter(f => f.type === 'collection_property').length}
        </div>
      </div>

      {/* Fields List */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {field.collection_name ? `${field.collection_name}.${field.field_name || field.property_name}` : field.field_name}
                  </CardTitle>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded ${field.type === 'schema_field' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {field.type === 'schema_field' ? 'Schema Field' : 'Collection Property'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                      {field.field_type || field.property_type}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {field.field_id || field.property_id}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Description */}
              {field.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                </div>
              )}
              
              {/* Choices for CHOICE fields */}
              {(field.field_type === 'CHOICE' || field.property_type === 'CHOICE') && field.choices && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Choices</h4>
                  <div className="flex flex-wrap gap-1">
                    {field.choices.map((choice: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">
                        {choice}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Extraction Rules */}
              {field.extraction_rules && field.extraction_rules.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Extraction Rules</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {field.extraction_rules.map((rule: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-orange-500 mr-2">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Knowledge Documents */}
              {field.knowledge_documents && field.knowledge_documents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Knowledge Documents</h4>
                  <div className="flex flex-wrap gap-1">
                    {field.knowledge_documents.map((doc: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

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
        <Tabs defaultValue="schema" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schema" className="flex items-center gap-2">
              Schema Fields
            </TabsTrigger>
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
          </TabsList>

          <TabsContent value="schema">
            <Card>
              <CardHeader>
                <CardTitle>Target Schema Fields</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fields selected for extraction with their extraction rules and knowledge documents
                </p>
              </CardHeader>
              <CardContent>
                <SchemaFieldsDisplay session={session} />
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      )}
    </div>
  );
}