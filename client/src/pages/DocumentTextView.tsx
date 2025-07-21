import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

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

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  const extractedData: TextExtractionData | null = session?.extractedData 
    ? JSON.parse(session.extractedData) 
    : null;

  if (sessionLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        Loading extracted text...
      </div>
    );
  }

  if (!extractedData || !extractedData.extracted_texts) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        No text data found.
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace', 
      fontSize: '14px',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      maxWidth: '100%',
      wordWrap: 'break-word'
    }}>
      {extractedData.extracted_texts.map((doc: any, index: number) => (
        <div key={index}>
          {/* Document separator */}
          <div style={{ 
            margin: '40px 0 20px 0', 
            padding: '10px', 
            backgroundColor: '#f5f5f5',
            border: '2px solid #333',
            fontWeight: 'bold'
          }}>
            === DOCUMENT {index + 1}: {doc.file_name} ({doc.word_count} words) ===
          </div>
          
          {/* Document content */}
          <div style={{ marginBottom: '40px' }}>
            {doc.text_content}
          </div>
          
          {/* End separator */}
          <div style={{ 
            margin: '20px 0 40px 0', 
            padding: '5px', 
            backgroundColor: '#e5e5e5',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            === END DOCUMENT {index + 1} ===
          </div>
        </div>
      ))}
      
      {/* Summary at bottom */}
      <div style={{ 
        margin: '60px 0 20px 0', 
        padding: '15px', 
        backgroundColor: '#d4edda',
        border: '2px solid #155724',
        fontWeight: 'bold'
      }}>
        === EXTRACTION SUMMARY ===
        Total Documents: {extractedData.total_documents}
        Total Words: {extractedData.total_word_count?.toLocaleString()}
        === END SUMMARY ===
      </div>
    </div>
  );
}