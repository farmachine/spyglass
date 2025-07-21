import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Eye, Copy } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ExtractlyLogo from "@/components/ExtractlyLogo";
import UserProfile from "@/components/UserProfile";

interface ExtractedText {
  file_name: string;
  text_content: string;
  word_count: number;
}

interface TextExtractionData {
  success: boolean;
  extracted_texts: ExtractedText[];
  total_documents: number;
  total_word_count: number;
}

export default function DocumentTextView() {
  const params = useParams();
  const sessionId = params.sessionId;
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  const { data: project } = useQuery<any>({
    queryKey: [`/api/projects/${session?.projectId}`],
    enabled: !!session?.projectId,
  });

  const extractedData: TextExtractionData | null = session?.extractedData 
    ? JSON.parse(session.extractedData) 
    : null;

  const copyAllText = () => {
    if (!extractedData?.extracted_texts) return;
    
    const combinedText = extractedData.extracted_texts
      .map(doc => `=== ${doc.file_name} ===\n\n${doc.text_content}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(combinedText).then(() => {
      toast({
        title: "Text copied",
        description: "All document text has been copied to your clipboard.",
      });
    });
  };

  const copyDocumentText = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Text copied",
        description: `Text from ${fileName} has been copied to your clipboard.`,
      });
    });
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading extracted text...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <ExtractlyLogo size={60} />
              </Link>
              <div className="hidden md:block text-xl font-semibold text-gray-900">
                {project?.name || 'Project'}
              </div>
            </div>
            <UserProfile />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation and Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/projects/${session?.projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Document Text Extraction</h1>
            <p className="text-gray-600 mt-1">
              Session: {session?.sessionName || 'Unnamed Session'}
            </p>
          </div>
        </div>

        {!extractedData ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No extracted text data found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Extraction Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {extractedData.total_documents}
                    </div>
                    <div className="text-sm text-gray-600">Documents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {extractedData.total_word_count.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Words</div>
                  </div>
                  <div className="text-center">
                    <Button onClick={copyAllText} variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy All Text
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Text Cards */}
            <div className="space-y-6">
              {extractedData.extracted_texts.map((doc, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {doc.file_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {doc.word_count.toLocaleString()} words
                        </Badge>
                        <Button 
                          onClick={() => copyDocumentText(doc.text_content, doc.file_name)}
                          variant="outline" 
                          size="sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                        {doc.text_content}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Next Steps */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  The text has been successfully extracted from all documents. 
                  This is the foundation for the step-by-step extraction process.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">✓ Document text extraction completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span className="text-sm text-gray-500">○ Next: AI data extraction (to be built)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span className="text-sm text-gray-500">○ Next: Data validation (to be built)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}