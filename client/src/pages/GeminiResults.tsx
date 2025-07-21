import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function GeminiResults() {
  const params = useParams();
  const sessionId = params.sessionId;

  const { data: session, isLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'monospace',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        Loading Gemini AI results...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'monospace',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        Session not found.
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        marginBottom: '20px',
        color: '#333',
        borderBottom: '2px solid #007bff',
        paddingBottom: '10px'
      }}>
        Gemini AI Raw Response
      </h1>
      
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Session: {session.sessionName}</h3>
        <p style={{ margin: '0', color: '#6c757d' }}>
          Status: {session.status} | Documents: {session.documentCount}
        </p>
      </div>

      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          color: '#495057',
          borderBottom: '1px solid #dee2e6',
          paddingBottom: '10px'
        }}>
          Raw Response from Gemini AI:
        </h3>
        
        {(() => {
          try {
            const extractedData = session.extractedData ? JSON.parse(session.extractedData) : null;
            const geminiResponse = extractedData?.geminiRawResponse;
            return geminiResponse ? (
              <pre style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                padding: '15px',
                overflow: 'auto',
                fontSize: '14px',
                lineHeight: '1.4',
                color: '#495057',
                margin: '0',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {geminiResponse}
              </pre>
            ) : (
              <div style={{
                padding: '20px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                color: '#856404'
              }}>
                No Gemini response available yet. Try running the extraction process first.
              </div>
            );
          } catch (error) {
            return (
              <div style={{
                padding: '20px',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                color: '#721c24'
              }}>
                Error loading Gemini response: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            );
          }
        })()}
      </div>

      <div style={{ 
        marginTop: '30px',
        textAlign: 'center'
      }}>
        <button 
          onClick={() => window.location.href = `/sessions/${sessionId}/schema`}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Back to Schema View
        </button>
        
        <button 
          onClick={() => window.location.href = `/sessions/${sessionId}/text-view`}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          View Document Text
        </button>
      </div>
    </div>
  );
}