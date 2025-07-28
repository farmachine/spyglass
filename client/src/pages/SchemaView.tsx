import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SchemaData {
  project: any;
  schema_fields: any[];
  collections: any[];
  knowledge_documents: any[];
  extraction_rules: any[];
}

export default function SchemaView() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [, setLocation] = useLocation();
  
  // Get mode from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const extractionMode = urlParams.get('mode') as 'automated' | 'debug' | null;
  
  // Debug logging to check mode value
  console.log('DEBUG: URL search params:', window.location.search);
  console.log('DEBUG: extractionMode from URL:', extractionMode);

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  const { data: schemaData, isLoading: schemaLoading } = useQuery<SchemaData>({
    queryKey: [`/api/projects/${session?.projectId}/schema-data`],
    enabled: !!session?.projectId,
  });

  // Query for saved session documents
  const { data: sessionDocuments, isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: [`/api/sessions/${sessionId}/documents`],
    enabled: !!sessionId,
  });

  // State for document content
  const [documentContent, setDocumentContent] = useState<{
    text: string;
    count: number;
  } | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  
  // State for storing Gemini response and processing status
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [savedValidations, setSavedValidations] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-load document content using database records or Gemini API when session is available
  useEffect(() => {
    const loadDocumentContentWithGemini = async () => {
      if (!session || !sessionId || !session.projectId) return;
      
      // First, check if we have saved session documents in the database
      if (sessionDocuments && sessionDocuments.length > 0) {
        console.log('DEBUG: Found saved session documents in database:', sessionDocuments.length);
        const text = sessionDocuments.map((doc: any, index: number) => 
          `--- DATABASE DOCUMENT ${index + 1}: ${doc.fileName} (${doc.wordCount} words) ---\n${doc.extractedContent}`
        ).join('\n\n--- DOCUMENT SEPARATOR ---\n\n');
        setDocumentContent({
          text,
          count: sessionDocuments.length
        });
        console.log('DEBUG: document content set from database session documents');
        return;
      }
      
      // Check if we already have Gemini-extracted content
      if (session.extractedData) {
        try {
          console.log('DEBUG: session.extractedData exists, parsing...', session.extractedData);
          
          // Handle both string and object formats
          let extractedData;
          if (typeof session.extractedData === 'string') {
            extractedData = JSON.parse(session.extractedData);
          } else {
            extractedData = session.extractedData;
          }
          
          console.log('DEBUG: parsed extractedData:', extractedData);
          
          // Check for the actual format: { success: true, extracted_texts: [...] }
          if (extractedData?.success && extractedData?.extracted_texts && Array.isArray(extractedData.extracted_texts)) {
            const text = extractedData.extracted_texts.map((doc: any, index: number) => 
              `--- DOCUMENT ${index + 1}: ${doc.file_name} ---\n${doc.text_content}`
            ).join('\n\n--- DOCUMENT SEPARATOR ---\n\n');
            setDocumentContent({
              text,
              count: extractedData.extracted_texts.length
            });
            console.log('DEBUG: document content set from .extracted_texts array');
            return;
          }
          
          // Check multiple possible formats for document content (legacy support)
          if (extractedData?.documents && Array.isArray(extractedData.documents)) {
            const text = extractedData.documents.map((doc: any, index: number) => 
              `--- DOCUMENT ${index + 1}: ${doc.file_name} ---\n${doc.extracted_text}`
            ).join('\n\n--- DOCUMENT SEPARATOR ---\n\n');
            setDocumentContent({
              text,
              count: extractedData.documents.length
            });
            console.log('DEBUG: document content set from .documents array');
            return;
          }
          
          // Check if it's just the text content directly
          if (typeof extractedData === 'string' && extractedData.length > 0) {
            setDocumentContent({
              text: extractedData,
              count: session.documents?.length || 1
            });
            console.log('DEBUG: document content set from direct string');
            return;
          }
          
        } catch (parseError) {
          console.error("Failed to parse existing session extractedData:", parseError);
        }
      }

      // If no extracted content, trigger Gemini-based document extraction automatically
      if (session.documents && session.documents.length > 0 && session.status !== 'text_extracted') {
        console.log('Auto-triggering Gemini document content extraction...');
        setIsLoadingDocuments(true);
        setError(null); // Clear any previous errors
        
        try {
          // Use the extract-text endpoint which uses Gemini API for content extraction
          const response = await apiRequest(`/api/sessions/${sessionId}/extract-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.message) {
            console.log('Document extraction completed, refreshing session data...');
            // Refresh the session data to get the updated extractedData
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } catch (error) {
          console.error('Gemini document extraction failed:', error);
          setError('Document extraction failed. Please try refreshing the page or uploading documents again.');
          setIsLoadingDocuments(false);
        }
      }
    };

    loadDocumentContentWithGemini();
  }, [session, sessionId, sessionDocuments]);

  // Auto-trigger extraction when in automated mode and schema is ready
  useEffect(() => {
    const autoTriggerExtraction = async () => {
      if (extractionMode === 'automated' && schemaData && !isProcessing && !geminiResponse) {
        console.log('AUTO-TRIGGER: Starting automatic Gemini extraction in automated mode');
        
        if (!documentContent) {
          console.log('AUTO-TRIGGER: Waiting for document content to be available...');
          return;
        }
        
        setIsProcessing(true);
        try {
          const fullPrompt = generateSchemaMarkdown(schemaData!, documentContent.text, documentContent.count);
          
          console.log('AUTO-TRIGGER: Generated extraction prompt with document content');
          
          // Make actual API call to Gemini
          const response = await apiRequest(`/api/sessions/${sessionId}/gemini-extraction`, {
            method: 'POST',
            body: JSON.stringify({ 
              prompt: fullPrompt,
              projectId: session.projectId 
            }),
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.success) {
            setGeminiResponse(`=== GEMINI AI EXTRACTION RESULTS ===

${response.extractedData || response.result || 'No response data received'}

=== END RESULTS ===`);
            console.log('AUTO-TRIGGER: Gemini extraction completed successfully');
          } else {
            setGeminiResponse(`=== GEMINI API ERROR ===

${response.error || 'Unknown error occurred'}

=== END ERROR ===`);
          }
        } catch (error) {
          console.error('AUTO-TRIGGER: Gemini extraction failed:', error);
          setGeminiResponse(`=== API CALL ERROR ===

${error instanceof Error ? error.message : 'Unknown error'}

=== END ERROR ===`);
        } finally {
          setIsProcessing(false);
        }
      }
    };

    autoTriggerExtraction();
  }, [extractionMode, schemaData, documentContent, isProcessing, geminiResponse, sessionId, session?.projectId]);

  // Auto-trigger database save when in automated mode and extraction is complete
  useEffect(() => {
    const autoTriggerSave = async () => {
      if (extractionMode === 'automated' && geminiResponse && !isSavingToDatabase && !savedValidations && !isProcessing) {
        console.log('AUTO-TRIGGER: Starting automatic database save in automated mode');
        
        setIsSavingToDatabase(true);
        try {
          // Extract JSON from geminiResponse
          let jsonText = null;
          
          // Pattern 1: Look for ```json blocks
          let jsonMatch = geminiResponse.match(/```json\s*\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
          } else {
            // Pattern 2: Look for object starting with { and ending with }
            const lines = geminiResponse.split('\n');
            let objectStart = -1;
            let objectEnd = -1;
            let braceCount = 0;
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('{') && objectStart === -1) {
                objectStart = i;
                braceCount = 1;
                for (let j = 1; j < line.length; j++) {
                  if (line[j] === '{') braceCount++;
                  if (line[j] === '}') braceCount--;
                }
                if (braceCount === 0) {
                  objectEnd = i;
                  break;
                }
              } else if (objectStart !== -1) {
                for (let j = 0; j < line.length; j++) {
                  if (line[j] === '{') braceCount++;
                  if (line[j] === '}') braceCount--;
                }
                if (braceCount === 0) {
                  objectEnd = i;
                  break;
                }
              }
            }
            
            if (objectStart !== -1 && objectEnd !== -1) {
              jsonText = lines.slice(objectStart, objectEnd + 1).join('\n');
            }
          }

          if (jsonText) {
            console.log('AUTO-TRIGGER: Extracted JSON text, sending to database');
            
            const response = await apiRequest(`/api/sessions/${sessionId}/save-validations`, {
              method: 'POST',
              body: JSON.stringify({ extractedData: jsonText }),
              headers: { 'Content-Type': 'application/json' }
            });

            if (response.success) {
              setSavedValidations(response.validations || []);
              console.log('AUTO-TRIGGER: Database save completed successfully');
              
              // In automated mode, automatically redirect to session view
              console.log('AUTO-TRIGGER: Redirecting to session review in automated mode');
              setTimeout(() => {
                setLocation(`/sessions/${sessionId}`);
              }, 2000); // Give user 2 seconds to see completion message
            } else {
              console.error('AUTO-TRIGGER: Database save failed:', response.message);
            }
          } else {
            console.error('AUTO-TRIGGER: Could not extract JSON from Gemini response');
          }
        } catch (error) {
          console.error('AUTO-TRIGGER: Database save failed:', error);
        } finally {
          setIsSavingToDatabase(false);
        }
      }
    };

    autoTriggerSave();
  }, [extractionMode, geminiResponse, isSavingToDatabase, savedValidations, isProcessing, sessionId]);

  // Function to generate markdown from schema data
  const generateSchemaMarkdown = (data: SchemaData, documentText: string, documentCount: number) => {
    let markdown = `# AI EXTRACTION TASK\n\n`;
    markdown += `You are an expert data extraction AI. Your task is to analyze the documents below and extract structured data according to the schema provided.\n\n`;
    markdown += `## DOCUMENTS TO PROCESS\n\n`;
    markdown += `Number of documents: ${documentCount}\n`;
    markdown += `Document separator: "--- DOCUMENT SEPARATOR ---"\n\n`;
    markdown += `${documentText}\n\n`;
    markdown += `--- END OF DOCUMENTS ---\n\n\n`;
    markdown += `# EXTRACTION SCHEMA\n\n`;
    markdown += `Project: ${data.project?.name || 'Unknown'}\n`;
    markdown += `Description: ${data.project?.description || 'No description'}\n`;
    markdown += `Main Object: ${data.project?.mainObjectName || 'Session'}\n\n`;
    
    // Project Schema Fields
    markdown += `## PROJECT SCHEMA FIELDS\n\n`;
    markdown += `**INSTRUCTION:** Extract these fields from the entire document set. Use extraction rules to adjust confidence scores. Reference knowledge documents for validation and conflict detection.\n\n`;
    
    const schemaFieldsData = {
      schema_fields: data.schema_fields.map(field => {
        const specificRules = data.extraction_rules
          .filter(rule => rule.targetFields?.includes(field.fieldName))
          .map(rule => rule.ruleContent);
        const globalRules = data.extraction_rules
          .filter(rule => !rule.targetFields || rule.targetFields.length === 0)
          .map(rule => rule.ruleContent);
        const allRules = [...specificRules, ...globalRules];
        
        return {
          field_name: field.fieldName,
          type: field.fieldType,
          "AI guidance": field.description,
          "Extraction Rules": allRules.length > 0 ? allRules.join(' | ') : "No rules",
          "Knowledge Documents": data.knowledge_documents.length > 0 ? 
            data.knowledge_documents.map(doc => doc.displayName).join(', ') : 
            "None",
          "Auto Verification": `${field.autoVerificationConfidence || 80}%`
        };
      })
    };
    
    markdown += `\`\`\`json\n${JSON.stringify(schemaFieldsData, null, 2)}\n\`\`\`\n\n`;
    
    // Collections
    markdown += `## COLLECTIONS (ARRAYS OF OBJECTS)\n\n`;
    markdown += `**INSTRUCTION:** Extract arrays of objects matching these collection structures. Apply extraction rules to individual properties and use knowledge documents to validate each extracted object. Count ALL instances across documents accurately.\n\n`;
    
    const collectionsData = {
      collections: data.collections.map(collection => ({
        collection_name: collection.collectionName,
        description: collection.description,
        properties: collection.properties?.map((prop: any) => {
          const dotNotation = `${collection.collectionName}.${prop.propertyName}`;
          const arrowNotation = `${collection.collectionName} --> ${prop.propertyName}`;
          const specificRules = data.extraction_rules
            .filter(rule => {
              return rule.targetFields?.includes(dotNotation) || rule.targetFields?.includes(arrowNotation);
            })
            .map(rule => rule.ruleContent);
          const globalRules = data.extraction_rules
            .filter(rule => !rule.targetFields || rule.targetFields.length === 0)
            .map(rule => rule.ruleContent);
          const allRules = [...specificRules, ...globalRules];
          
          return {
            property_name: prop.propertyName,
            type: prop.propertyType,
            "AI guidance": prop.description,
            "Extraction Rules": allRules.length > 0 ? allRules.join(' | ') : "No rules",
            "Knowledge Documents": data.knowledge_documents.length > 0 ? 
              data.knowledge_documents.map(doc => doc.displayName).join(', ') : 
              "None",
            "Auto Verification": `${prop.autoVerificationConfidence || 80}%`
          };
        }) || []
      }))
    };
    
    markdown += `\`\`\`json\n${JSON.stringify(collectionsData, null, 2)}\n\`\`\`\n\n`;
    
    // Knowledge Documents
    markdown += `## KNOWLEDGE DOCUMENTS\n\n`;
    markdown += `**INSTRUCTION:** Use these documents as reference material for validation and conflict detection. When extracted values conflict with knowledge document requirements, reduce confidence scores and explain the conflict in ai_reasoning.\n\n`;
    
    if (data.knowledge_documents.length > 0) {
      data.knowledge_documents.forEach((doc, index) => {
        const allFields = [
          ...data.schema_fields.map(field => field.fieldName),
          ...data.collections.flatMap(collection => 
            collection.properties?.map((prop: any) => `${collection.collectionName}.${prop.propertyName}`) || []
          )
        ];
        
        markdown += `### KNOWLEDGE DOCUMENT ${index + 1}: ${doc.displayName}\n\n`;
        markdown += `${doc.content || 'No content available'}\n\n`;
        markdown += `**Applies to fields:** ${allFields.join(', ') || 'No fields configured'}\n\n`;
      });
    } else {
      markdown += `No knowledge documents configured\n\n`;
    }
    
    // Extraction Rules
    markdown += `## EXTRACTION RULES\n\n`;
    markdown += `**INSTRUCTION:** Apply these rules to modify confidence scores for matching values. Global rules apply to all fields, targeted rules apply to specific properties. Rule-based adjustments should be reflected in confidence_score and explained in ai_reasoning.\n\n`;
    
    if (data.extraction_rules.length > 0) {
      data.extraction_rules.forEach((rule, index) => {
        const isGlobalRule = !rule.targetFields || rule.targetFields.length === 0;
        markdown += `### ${isGlobalRule ? 'GLOBAL RULE' : 'TARGETED RULE'} ${index + 1}: ${rule.ruleName || `Rule ${index + 1}`}\n\n`;
        markdown += `**Applies to:** ${isGlobalRule ? 
          'ALL SCHEMA FIELDS AND COLLECTION PROPERTIES (Auto-mapped)' : 
          rule.targetFields?.join(', ') || 'Not specified'
        }\n\n`;
        markdown += `**Rule Content:** ${rule.ruleContent}\n\n`;
      });
    } else {
      markdown += `No extraction rules configured\n\n`;
    }
    
    // Summary
    markdown += `## EXTRACTION SUMMARY\n\n`;
    markdown += `Schema Fields: ${data.schema_fields.length}\n`;
    markdown += `Collections: ${data.collections.length}\n`;
    markdown += `Knowledge Documents: ${data.knowledge_documents.length}\n`;
    markdown += `Extraction Rules: ${data.extraction_rules.length}\n\n`;
    
    // AI Processing Instructions
    markdown += `## AI PROCESSING INSTRUCTIONS\n\n`;
    markdown += `### CORE EXTRACTION PROCESS:\n`;
    markdown += `1. Extract data according to schema structure above\n`;
    markdown += `2. Count ALL instances across ALL documents accurately\n`;
    markdown += `3. Apply extraction rules to modify confidence scores as specified\n`;
    markdown += `4. Use knowledge documents for validation and conflict detection\n\n`;
    
    markdown += `### CONFIDENCE SCORING (confidence_score 0-100):\n`;
    markdown += `- Base: High confidence (85-95) for clear extractions\n`;
    markdown += `- Apply extraction rule adjustments per rule content\n`;
    markdown += `- Reduce confidence for knowledge document conflicts\n`;
    markdown += `- IMPORTANT: Set confidence_score to 0 for missing, empty, or "Not set" values\n`;
    markdown += `- Let content and rules determine final percentage\n\n`;
    
    markdown += `### AI REASONING (ai_reasoning):\n`;
    markdown += `Give reasoning for the score. If knowledge documents and/or extraction rules had influence, please reference which ones in a human-friendly way. Please also include follow up questions that the user can ask the information provider for clarification on the data value.\n\n`;
    
    markdown += `### VALIDATION STATUS (validation_status):\n`;
    markdown += `CRITICAL: Set validation_status based on confidence score vs Auto Verification threshold:\n`;
    markdown += `- "verified": confidence_score >= Auto Verification percentage AND confidence_score > 0\n`;
    markdown += `- "unverified": confidence_score < Auto Verification percentage OR confidence_score = 0\n`;
    markdown += `IMPORTANT: 0% confidence MUST ALWAYS be "unverified" regardless of threshold\n`;
    markdown += `Examples:\n`;
    markdown += `- Auto Verification 80%, confidence_score 85 → "verified"\n`;
    markdown += `- Auto Verification 50%, confidence_score 27 → "unverified"\n`;
    markdown += `- Auto Verification 0%, confidence_score 0 → "unverified"\n`;
    markdown += `- Any field with 0% confidence → "unverified"\n\n`;
    
    markdown += `### OUTPUT:\n`;
    markdown += `JSON format below with confidence_score, ai_reasoning, and validation_status for each field.\n\n`;
    
    // JSON Schema
    markdown += `## REQUIRED JSON OUTPUT SCHEMA\n\n`;
    
    const outputSchema = {
      "field_validations": [
        // Schema fields
        ...data.schema_fields.map(field => ({
          "field_type": "schema_field",
          "field_id": field.id,
          "field_name": field.fieldName,
          "description": field.description || 'No description',
          "extracted_value": null,
          "confidence_score": 95,
          "ai_reasoning": "See AI REASONING (ai_reasoning) in AI PROCESSING INSTRUCTIONS",
          "document_source": "document_name.pdf",
          "validation_status": `Set based on confidence_score vs ${field.autoVerificationConfidence || 80}% threshold`,
          "record_index": 0
        })),
        // Collection properties
        ...data.collections.flatMap(collection => 
          collection.properties?.map((prop: any) => ({
            "field_type": "collection_property",
            "field_id": prop.id,
            "field_name": `${collection.collectionName}.${prop.propertyName}`,
            "collection_name": collection.collectionName,
            "description": prop.description || 'No description',
            "extracted_value": null,
            "confidence_score": 95,
            "ai_reasoning": "See AI REASONING (ai_reasoning) in AI PROCESSING INSTRUCTIONS",
            "document_source": "document_name.pdf",
            "validation_status": `Set based on confidence_score vs ${prop.autoVerificationConfidence || 80}% threshold`,
            "record_index": 0
          })) || []
        )
      ]
    };
    
    markdown += `\`\`\`json\n${JSON.stringify(outputSchema, null, 2)}\n\`\`\`\n\n`;
    
    return markdown;
  };



  // Function to call Gemini directly using consolidated document content
  const handleGeminiExtraction = async () => {
    if (!documentContent) {
      setGeminiResponse("=== ERROR ===\n\nNo document content available. Please wait for document extraction to complete.\n\n=== END ERROR ===");
      return;
    }
    
    setIsProcessing(true);
    try {
      const fullPrompt = generateSchemaMarkdown(schemaData!, documentContent.text, documentContent.count);
      
      // Enhanced debug logging
      console.log('SCHEMA VIEW DEBUG - Consolidated document content:', {
        documentCount: documentContent.count,
        documentTextLength: documentContent.text.length,
        documentTextPreview: documentContent.text.substring(0, 300)
      });
      
      // Make actual API call to Gemini
      const response = await apiRequest(`/api/sessions/${sessionId}/gemini-extraction`, {
        method: 'POST',
        body: JSON.stringify({ 
          prompt: fullPrompt,
          projectId: session.projectId 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.success) {
        setGeminiResponse(`=== GEMINI AI EXTRACTION RESULTS ===

${response.extractedData || response.result || 'No response data received'}

=== END RESULTS ===`);
      } else {
        setGeminiResponse(`=== GEMINI API ERROR ===

${response.error || 'Unknown error occurred'}

=== END ERROR ===`);
      }
    } catch (error) {
      console.error('Gemini extraction failed:', error);
      setGeminiResponse(`=== API CALL ERROR ===

${error instanceof Error ? error.message : 'Unknown error'}

=== END ERROR ===`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to save extraction results to database
  const handleSaveToDatabase = async () => {
    if (!geminiResponse) {
      alert('No extraction results to save. Please run extraction first.');
      return;
    }

    setIsSavingToDatabase(true);
    try {
      // Extract JSON from geminiResponse - try multiple extraction patterns
      let jsonText = null;
      
      // Pattern 1: Look for ```json blocks
      let jsonMatch = geminiResponse.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else {
        // Pattern 2: Look for object starting with { and ending with } (balanced braces)
        const lines = geminiResponse.split('\n');
        let objectStart = -1;
        let objectEnd = -1;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('{') && objectStart === -1) {
            objectStart = i;
            braceCount = 1;
            // Count braces in the same line
            for (let j = 1; j < line.length; j++) {
              if (line[j] === '{') braceCount++;
              if (line[j] === '}') braceCount--;
            }
            if (braceCount === 0) {
              objectEnd = i;
              break;
            }
          } else if (objectStart !== -1) {
            // Count braces to find the end
            for (let j = 0; j < line.length; j++) {
              if (line[j] === '{') braceCount++;
              if (line[j] === '}') braceCount--;
            }
            if (braceCount === 0) {
              objectEnd = i;
              break;
            }
          }
        }
        
        if (objectStart !== -1 && objectEnd !== -1) {
          jsonText = lines.slice(objectStart, objectEnd + 1).join('\n').trim();
        }
      }

      if (!jsonText) {
        console.error('Failed to extract JSON. Response preview:', geminiResponse.substring(0, 1000));
        throw new Error('No valid JSON found in extraction results');
      }

      console.log('Extracted JSON text length:', jsonText.length);
      console.log('JSON starts with:', jsonText.substring(0, 100));
      console.log('JSON ends with:', jsonText.substring(Math.max(0, jsonText.length - 100)));
      
      // Check for truncation indicators
      if (jsonText.includes('[TRUNCATED]') || jsonText.includes('…') || jsonText.endsWith('...')) {
        console.error('WARNING: JSON appears to be truncated!');
        setError('Response was truncated. Please try again or contact support.');
        return;
      }
      
      // More aggressive JSON cleaning to handle malformed responses
      let cleanedJsonText = jsonText
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/\.\.\./g, '') // Remove ellipsis that might truncate strings
        .replace(/…\[TRUNCATED\]/g, '') // Remove truncation markers
        .trim();
      
      // Find the last complete closing brace for objects
      let lastClosingBrace = cleanedJsonText.lastIndexOf('}');
      if (lastClosingBrace > 0) {
        cleanedJsonText = cleanedJsonText.substring(0, lastClosingBrace + 1);
      }
      
      console.log('Cleaned JSON text length:', cleanedJsonText.length);
      console.log('Cleaned JSON text (last 100 chars):', cleanedJsonText.substring(Math.max(0, cleanedJsonText.length - 100)));
      
      const parsedJson = JSON.parse(cleanedJsonText);
      
      // Extract the field_validations array from the response
      let extractedData;
      if (parsedJson.field_validations && Array.isArray(parsedJson.field_validations)) {
        extractedData = parsedJson.field_validations;
      } else if (Array.isArray(parsedJson)) {
        extractedData = parsedJson;
      } else {
        throw new Error('Invalid JSON structure - expected field_validations array or direct array');
      }
      
      // Ensure extractedData is an array
      const validationsArray = Array.isArray(extractedData) ? extractedData : [extractedData];
      
      console.log('Parsed validations:', validationsArray.length, 'items');
      
      // Save to database
      const response = await apiRequest(`/api/sessions/${sessionId}/save-validations`, {
        method: 'POST',
        body: JSON.stringify({ validations: validationsArray }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        setSavedValidations(validationsArray);
        console.log('Validation results saved successfully:', response);
      } else {
        throw new Error(response.error || 'Failed to save validation results');
      }
    } catch (error) {
      console.error('Save to database failed:', error);
      alert(`Failed to save to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  if (sessionLoading || schemaLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        Loading schema and rules data...
      </div>
    );
  }

  if (!schemaData) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        No schema data found.
      </div>
    );
  }

  if (isLoadingDocuments) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'monospace',
        backgroundColor: '#fff3cd',
        border: '2px solid #856404',
        margin: '20px'
      }}>
        <h2>🔄 AUTO-LOADING DOCUMENT CONTENT...</h2>
        <p>Automatically extracting text from uploaded documents...</p>
        <p>This may take a few moments for large documents.</p>
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
      {/* Header with Mode Display */}
      <div style={{ 
        margin: '0 0 20px 0', 
        padding: '15px', 
        backgroundColor: '#e7f3ff',
        border: '2px solid #0066cc',
        fontWeight: 'bold'
      }}>
        {extractionMode && (
          <div style={{ 
            marginBottom: '10px', 
            padding: '8px 12px', 
            backgroundColor: extractionMode === 'debug' ? '#f8d7da' : '#d1ecf1',
            border: `2px solid ${extractionMode === 'debug' ? '#dc3545' : '#0c63e4'}`,
            borderRadius: '4px',
            color: extractionMode === 'debug' ? '#721c24' : '#0c63e4',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {extractionMode === 'automated' ? '🤖 AUTOMATED MODE' : '🔧 DEBUG MODE'}
          </div>
        )}
        === STEP 1 COMPLETE: Document Content Extracted ===
        Session: {session?.sessionName || 'Unnamed Session'}
        Project: {schemaData.project?.name || 'Unnamed Project'}
        Main Object: {schemaData.project?.mainObjectName || 'Session'}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          margin: '0 0 20px 0', 
          padding: '15px', 
          backgroundColor: '#f8d7da',
          border: '2px solid #dc3545',
          color: '#721c24',
          fontWeight: 'bold'
        }}>
          === ERROR ===
          {error}
        </div>
      )}

      {/* Document Content Display */}
      {documentContent && (
        <div style={{ 
          margin: '0 0 40px 0', 
          padding: '15px', 
          backgroundColor: sessionDocuments && sessionDocuments.length > 0 ? '#d1f2eb' : '#fff9c4',
          border: `2px solid ${sessionDocuments && sessionDocuments.length > 0 ? '#27ae60' : '#d69e2e'}`,
          fontWeight: 'bold'
        }}>
          === {sessionDocuments && sessionDocuments.length > 0 ? 'DATABASE-STORED' : 'EXTRACTED'} DOCUMENT CONTENT ({documentContent.count} DOCUMENTS) ===
          <div style={{ 
            marginTop: '10px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            maxHeight: '400px',
            overflowY: 'auto',
            fontSize: '11px',
            fontWeight: 'normal',
            fontFamily: 'monospace',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap'
          }}>
            {documentContent.text}
          </div>
          <div style={{ 
            marginTop: '10px', 
            fontSize: '12px',
            fontStyle: 'italic', 
            color: '#666',
            fontWeight: 'normal'
          }}>
            Total characters: {documentContent.text.length} | Documents: {documentContent.count}
          </div>
        </div>
      )}

      <div style={{ 
        margin: '0 0 40px 0', 
        padding: '15px', 
        backgroundColor: '#e7f3ff',
        border: '2px solid #0066cc',
        fontWeight: 'bold'
      }}>
        {extractionMode && (
          <div style={{ 
            marginBottom: '10px', 
            padding: '8px 12px', 
            backgroundColor: extractionMode === 'debug' ? '#f8d7da' : '#d1ecf1',
            border: `2px solid ${extractionMode === 'debug' ? '#dc3545' : '#0c63e4'}`,
            borderRadius: '4px',
            color: extractionMode === 'debug' ? '#721c24' : '#0c63e4',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {extractionMode === 'automated' ? '🤖 AUTOMATED MODE' : '🔧 DEBUG MODE'}
          </div>
        )}
        === STEP 2: PROJECT SCHEMA & AI PROCESSING CONFIGURATION ===
      </div>



      {/* Project Schema Fields */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '10px', 
        backgroundColor: '#f8f9fa',
        border: '2px solid #6c757d',
        fontWeight: 'bold'
      }}>
        === PROJECT SCHEMA FIELDS ===
      </div>
      
      <div style={{ 
        margin: '10px 0 20px 0', 
        padding: '12px', 
        backgroundColor: '#e3f2fd',
        border: '1px solid #1976d2',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>INSTRUCTION:</strong> Extract these fields from the entire document set. Use extraction rules to adjust confidence scores. Reference knowledge documents for validation and conflict detection.
      </div>

      <div style={{ marginBottom: '40px' }}>
        {JSON.stringify({
          schema_fields: schemaData.schema_fields.map(field => {
            // Get rules that specifically target this field
            const specificRules = schemaData.extraction_rules
              .filter(rule => rule.targetFields?.includes(field.fieldName))
              .map(rule => rule.ruleContent);
            
            // Get rules with no target fields (auto-apply to all)
            const globalRules = schemaData.extraction_rules
              .filter(rule => !rule.targetFields || rule.targetFields.length === 0)
              .map(rule => rule.ruleContent);
            
            // Combine all applicable rules
            const allRules = [...specificRules, ...globalRules];
            
            return {
              field_name: field.fieldName,
              type: field.fieldType,
              "AI guidance": field.description,
              "Extraction Rules": allRules.length > 0 ? allRules.join(' | ') : "No rules",
              "Knowledge Documents": schemaData.knowledge_documents.length > 0 ? 
                schemaData.knowledge_documents.map(doc => doc.displayName).join(', ') : 
                "None"
            };
          })
        }, null, 2)}
      </div>

      {/* Collections */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '10px', 
        backgroundColor: '#f8f9fa',
        border: '2px solid #6c757d',
        fontWeight: 'bold'
      }}>
        === COLLECTIONS (ARRAYS OF OBJECTS) ===
      </div>
      
      <div style={{ 
        margin: '10px 0 20px 0', 
        padding: '12px', 
        backgroundColor: '#e8f5e8',
        border: '1px solid #388e3c',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>INSTRUCTION:</strong> Extract arrays of objects matching these collection structures. Apply extraction rules to individual properties and use knowledge documents to validate each extracted object. Count ALL instances across documents accurately.
      </div>

      <div style={{ marginBottom: '40px' }}>
        {JSON.stringify({
          collections: schemaData.collections.map(collection => ({
            collection_name: collection.collectionName,
            description: collection.description,
            properties: collection.properties?.map((prop: any) => {
              // Get rules that specifically target this property (handle both dot and arrow notation)
              const specificRules = schemaData.extraction_rules
                .filter(rule => {
                  const dotNotation = `${collection.collectionName}.${prop.propertyName}`;
                  const arrowNotation = `${collection.collectionName} --> ${prop.propertyName}`;
                  return rule.targetFields?.includes(dotNotation) || rule.targetFields?.includes(arrowNotation);
                })
                .map(rule => rule.ruleContent);
              
              // Get rules with no target fields (auto-apply to all)
              const globalRules = schemaData.extraction_rules
                .filter(rule => !rule.targetFields || rule.targetFields.length === 0)
                .map(rule => rule.ruleContent);
              
              // Combine all applicable rules
              const allRules = [...specificRules, ...globalRules];
              
              return {
                property_name: prop.propertyName,
                type: prop.propertyType,
                "AI guidance": prop.description,
                "Extraction Rules": allRules.length > 0 ? allRules.join(' | ') : "No rules",
                "Knowledge Documents": schemaData.knowledge_documents.length > 0 ? 
                  schemaData.knowledge_documents.map(doc => doc.displayName).join(', ') : 
                  "None"
              };
            }) || []
          }))
        }, null, 2)}
      </div>

      {/* Knowledge Documents */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '10px', 
        backgroundColor: '#f8f9fa',
        border: '2px solid #6c757d',
        fontWeight: 'bold'
      }}>
        === KNOWLEDGE DOCUMENTS ===
      </div>
      
      <div style={{ 
        margin: '10px 0 20px 0', 
        padding: '12px', 
        backgroundColor: '#fff3e0',
        border: '1px solid #f57c00',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>INSTRUCTION:</strong> Use these documents as reference material for validation and conflict detection. When extracted values conflict with knowledge document requirements, reduce confidence scores and explain the conflict in ai_reasoning.
      </div>

      <div style={{ marginBottom: '40px' }}>
        {schemaData.knowledge_documents.length > 0 ? (
          schemaData.knowledge_documents.map((doc, index) => {
            // Get all fields that this knowledge document applies to (which is all of them)
            const allFields = [
              ...schemaData.schema_fields.map(field => field.fieldName),
              ...schemaData.collections.flatMap(collection => 
                collection.properties?.map((prop: any) => `${collection.collectionName}.${prop.propertyName}`) || []
              )
            ];
            
            return (
              <div key={index} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                  KNOWLEDGE DOCUMENT {index + 1}: {doc.displayName}
                </div>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  marginBottom: '10px'
                }}>
                  {doc.content || 'No content available'}
                </div>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: '#e8f5e8',
                  border: '1px solid #28a745',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  <strong>Applies to fields:</strong> {allFields.join(', ') || 'No fields configured'}
                </div>
              </div>
            );
          })
        ) : (
          <div>No knowledge documents configured</div>
        )}
      </div>

      {/* Extraction Rules */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '10px', 
        backgroundColor: '#f8f9fa',
        border: '2px solid #6c757d',
        fontWeight: 'bold'
      }}>
        === EXTRACTION RULES ===
      </div>
      
      <div style={{ 
        margin: '10px 0 20px 0', 
        padding: '12px', 
        backgroundColor: '#fce4ec',
        border: '1px solid #c2185b',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>INSTRUCTION:</strong> Apply these rules to modify confidence scores for matching values. Global rules apply to all fields, targeted rules apply to specific properties. Rule-based adjustments should be reflected in confidence_score and explained in ai_reasoning.
      </div>

      <div style={{ marginBottom: '40px' }}>
        {schemaData.extraction_rules.length > 0 ? (
          schemaData.extraction_rules.map((rule, index) => {
            const isGlobalRule = !rule.targetFields || rule.targetFields.length === 0;
            return (
              <div key={index} style={{ 
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: isGlobalRule ? '#e8f5e8' : '#f8f9fa',
                border: `2px solid ${isGlobalRule ? '#28a745' : '#6c757d'}`,
                borderRadius: '4px'
              }}>
                <div style={{ fontWeight: 'bold', color: isGlobalRule ? '#155724' : '#495057' }}>
                  {isGlobalRule ? '🌐 GLOBAL RULE' : '🎯 TARGETED RULE'} {index + 1}: {rule.ruleName || `Rule ${index + 1}`}
                </div>
                <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <strong>Applies to:</strong> {isGlobalRule ? 
                    'ALL SCHEMA FIELDS AND COLLECTION PROPERTIES (Auto-mapped)' : 
                    rule.targetFields?.join(', ') || 'Not specified'
                  }
                </div>
                <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <strong>Rule Content:</strong> {rule.ruleContent}
                </div>
              </div>
            );
          })
        ) : (
          <div>No extraction rules configured</div>
        )}
      </div>

      {/* Summary */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '15px', 
        backgroundColor: '#d4edda',
        border: '2px solid #155724',
        fontWeight: 'bold'
      }}>
        === EXTRACTION SUMMARY ===
        Schema Fields: {schemaData.schema_fields.length}
        Collections: {schemaData.collections.length}
        Knowledge Documents: {schemaData.knowledge_documents.length}
        Extraction Rules: {schemaData.extraction_rules.length}
        === END CONFIGURATION ===
      </div>

      {/* AI Processing Instructions */}
      <div style={{ 
        margin: '60px 0 20px 0', 
        padding: '20px', 
        backgroundColor: '#fff3cd',
        border: '3px solid #856404',
        fontWeight: 'bold'
      }}>
        === AI PROCESSING INSTRUCTIONS ===
        <div style={{ fontWeight: 'normal', marginTop: '15px', lineHeight: '1.6' }}>
          <strong>CORE EXTRACTION PROCESS:</strong>
          <br/>
          1. Extract data according to schema structure above
          <br/>
          2. Count ALL instances across ALL documents accurately
          <br/>
          3. Apply extraction rules to modify confidence scores as specified
          <br/>
          4. Use knowledge documents for validation and conflict detection
          <br/><br/>
          
          <strong>CONFIDENCE SCORING (confidence_score 0-100):</strong>
          <br/>
          • Base: High confidence (85-95) for clear extractions
          <br/>
          • Apply extraction rule adjustments per rule content
          <br/>
          • Reduce confidence for knowledge document conflicts
          <br/>
          • Let content and rules determine final percentage
          <br/><br/>
          
          <strong>AI REASONING (ai_reasoning):</strong>
          <br/>
          Give reasoning for the score. If knowledge documents and/or extraction rules had influence, please reference which ones in a human-friendly way. Please also include follow up questions that the user can ask the information provider for clarification on the data value.
          <br/><br/>
          
          <strong>OUTPUT:</strong> JSON format below with confidence_score and ai_reasoning for each field.
        </div>
      </div>

      {/* JSON Schema for AI Output */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '20px', 
        backgroundColor: '#f8f9fa',
        border: '3px solid #495057',
        fontWeight: 'bold'
      }}>
        === REQUIRED JSON OUTPUT SCHEMA ===
        <div style={{ fontWeight: 'normal', marginTop: '15px' }}>
          <pre style={{ 
            backgroundColor: '#ffffff',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
{JSON.stringify({
  "field_validations": [
    // Schema fields (one per field) - ACTUAL PROJECT DATA
    ...schemaData.schema_fields.map(field => ({
      "field_type": "schema_field",
      "field_id": field.id, // ACTUAL ID: e.g. "abc123-def456-ghi789"
      "field_name": field.fieldName, // ACTUAL NAME: e.g. "Contract Title"
      "description": field.description || 'No description', // ACTUAL DESCRIPTION
      "extracted_value": null, // AI FILLS: extracted text value
      "confidence_score": 95, // AI FILLS: 0-100 confidence
      "ai_reasoning": "AI explains extraction process here", 
      "document_source": "document_name.pdf", // AI FILLS: source file
      "validation_status": "pending", // AI SETS: valid/invalid/pending
      "record_index": 0 // Always 0 for schema fields
    })),
    // Collection properties (multiple instances) - ACTUAL PROJECT DATA  
    ...schemaData.collections.flatMap(collection => 
      collection.properties?.map((prop: any) => ({
        "field_type": "collection_property", 
        "field_id": prop.id, // ACTUAL ID: e.g. "xyz789-abc123-def456"
        "field_name": `${collection.collectionName}.${prop.propertyName}`, // e.g. "Parties.Name"
        "collection_name": collection.collectionName, // ACTUAL: e.g. "Parties"
        "description": prop.description || 'No description', // ACTUAL DESCRIPTION
        "extracted_value": null, // AI FILLS: extracted value for this instance
        "confidence_score": 95, // AI FILLS: 0-100 confidence  
        "ai_reasoning": "See AI REASONING (ai_reasoning) in AI PROCESSING INSTRUCTIONS",
        "document_source": "document_name.pdf", // AI FILLS: source file
        "validation_status": "pending", // AI SETS: valid/invalid/pending
        "record_index": 0 // AI INCREMENTS: 0, 1, 2... for multiple instances
      })) || []
    )
  ]
}, null, 2)}
          </pre>
        </div>
      </div>

      {/* Complete Generated Prompt Display */}
      {session?.extractedText && schemaData && (
        <div style={{ 
          margin: '40px 0',
          padding: '20px',
          backgroundColor: '#e7f3ff',
          border: '3px solid #0066cc',
          borderRadius: '8px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '18px',
            marginBottom: '15px',
            color: '#0066cc'
          }}>
            📄 COMPLETE PROMPT TO BE SENT TO AI
          </div>
          <pre style={{ 
            whiteSpace: 'pre-wrap',
            fontSize: '11px',
            backgroundColor: '#ffffff',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            lineHeight: '1.4'
          }}>
            {generateSchemaMarkdown(schemaData, session.extractedText, session.documents?.length || 0)}
          </pre>
        </div>
      )}

      {/* Next Step Button */}
      <div style={{ 
        margin: '40px 0', 
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#d4edda',
        border: '2px solid #155724'
      }}>
        {extractionMode && (
          <div style={{ 
            marginBottom: '10px', 
            padding: '8px 12px', 
            backgroundColor: extractionMode === 'debug' ? '#f8d7da' : '#d1ecf1',
            border: `2px solid ${extractionMode === 'debug' ? '#dc3545' : '#0c63e4'}`,
            borderRadius: '4px',
            color: extractionMode === 'debug' ? '#721c24' : '#0c63e4',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {extractionMode === 'automated' ? '🤖 AUTOMATED MODE' : '🔧 DEBUG MODE'}
          </div>
        )}
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          STEP 2 COMPLETE: Schema & Prompt Generated
        </div>
        <button 
          onClick={handleGeminiExtraction}
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: isProcessing ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing ? 'PROCESSING...' : 'START EXTRACTION'}
        </button>
      </div>

      {/* Display Gemini Response */}
      {geminiResponse && (
        <div style={{ 
          margin: '40px 0',
          padding: '20px',
          backgroundColor: '#d4edda',
          border: '3px solid #155724',
          borderRadius: '8px'
        }}>
          {extractionMode && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '8px 12px', 
              backgroundColor: extractionMode === 'debug' ? '#f8d7da' : '#d1ecf1',
              border: `2px solid ${extractionMode === 'debug' ? '#dc3545' : '#0c63e4'}`,
              borderRadius: '4px',
              color: extractionMode === 'debug' ? '#721c24' : '#0c63e4',
              fontSize: '14px',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {extractionMode === 'automated' ? '🤖 AUTOMATED MODE' : '🔧 DEBUG MODE'}
            </div>
          )}
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '18px',
            marginBottom: '15px',
            color: '#155724'
          }}>
            ✅ STEP 3 COMPLETE: AI Extraction Results
          </div>
          <pre style={{ 
            whiteSpace: 'pre-wrap',
            fontSize: '11px',
            backgroundColor: '#ffffff',
            padding: '15px',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '800px',
            lineHeight: '1.4',
            fontFamily: 'monospace',
            wordWrap: 'break-word',
            wordBreak: 'break-word'
          }}>
            {geminiResponse}
          </pre>
          
          {/* Save to Database Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={handleSaveToDatabase}
              disabled={isSavingToDatabase}
              style={{
                backgroundColor: isSavingToDatabase ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                borderRadius: '4px',
                cursor: isSavingToDatabase ? 'not-allowed' : 'pointer',
                opacity: isSavingToDatabase ? 0.7 : 1
              }}
            >
              {isSavingToDatabase ? 'SAVING TO DATABASE...' : 'SAVE TO DATABASE'}
            </button>
          </div>
        </div>
      )}

      {/* Display Saved Validations Table */}
      {savedValidations && (
        <div style={{ 
          margin: '40px 0',
          padding: '20px',
          backgroundColor: '#e7f3ff',
          border: '3px solid #0066cc',
          borderRadius: '8px'
        }}>
          {extractionMode && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '8px 12px', 
              backgroundColor: extractionMode === 'debug' ? '#f8d7da' : '#d1ecf1',
              border: `2px solid ${extractionMode === 'debug' ? '#dc3545' : '#0c63e4'}`,
              borderRadius: '4px',
              color: extractionMode === 'debug' ? '#721c24' : '#0c63e4',
              fontSize: '14px',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {extractionMode === 'automated' ? '🤖 AUTOMATED MODE' : '🔧 DEBUG MODE'}
            </div>
          )}
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '18px',
            marginBottom: '15px',
            color: '#0066cc'
          }}>
            💾 STEP 4 COMPLETE: Saved Field Validations
          </div>
          <div style={{ 
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '600px'
          }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>Field Type</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>Field Name</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>Extracted Value</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>Confidence</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Document Source</th>
                </tr>
              </thead>
              <tbody>
                {savedValidations.map((validation, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      {validation.field_type}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #dee2e6', fontWeight: 'bold' }}>
                      {validation.field_name}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #dee2e6' }}>
                      {validation.extracted_value || 'null'}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: validation.confidence_score >= 80 ? '#d4edda' : 
                                       validation.confidence_score >= 50 ? '#fff3cd' : '#f8d7da',
                        color: validation.confidence_score >= 80 ? '#155724' : 
                               validation.confidence_score >= 50 ? '#856404' : '#721c24',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {validation.confidence_score}%
                      </span>
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #dee2e6' }}>
                      {validation.validation_status}
                    </td>
                    <td style={{ padding: '8px', fontSize: '11px', color: '#6c757d' }}>
                      {validation.document_source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#6c757d' }}>
            Total validations saved: {savedValidations.length}
          </div>
          
          {/* Redirect to Session Review Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => {
                // Navigate to session review page with correct route structure
                const projectId = new URLSearchParams(window.location.search).get('projectId') || schemaData?.project?.id;
                window.location.href = `/projects/${projectId}/sessions/${sessionId}`;
              }}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Review Session Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}