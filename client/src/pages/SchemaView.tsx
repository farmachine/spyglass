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

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  const { data: schemaData, isLoading: schemaLoading } = useQuery<SchemaData>({
    queryKey: [`/api/projects/${session?.projectId}/schema-data`],
    enabled: !!session?.projectId,
  });

  // Function to generate markdown from schema data
  const generateSchemaMarkdown = (data: SchemaData) => {
    let markdown = `# SCHEMA FOR AI PROCESSING\n\n`;
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
            "None"
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
              "None"
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
    markdown += `- Let content and rules determine final percentage\n\n`;
    
    markdown += `### AI REASONING (ai_reasoning):\n`;
    markdown += `Give reasoning for the score. If knowledge documents and/or extraction rules had influence, please reference which ones in a human-friendly way. Please also include follow up questions that the user can ask the information provider for clarification on the data value.\n\n`;
    
    markdown += `### OUTPUT:\n`;
    markdown += `JSON format below with confidence_score and ai_reasoning for each field.\n\n`;
    
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
          "validation_status": "pending",
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
            "validation_status": "pending",
            "record_index": 0
          })) || []
        )
      ]
    };
    
    markdown += `\`\`\`json\n${JSON.stringify(outputSchema, null, 2)}\n\`\`\`\n\n`;
    
    return markdown;
  };

  // State for storing Gemini response
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to call Gemini directly
  const handleGeminiExtraction = async () => {
    setIsProcessing(true);
    try {
      const schemaMarkdown = generateSchemaMarkdown(schemaData);
      
      // For now, simulate the Gemini call with the complete prompt
      const documentText = "Document text content will be processed here";
      const fullPrompt = `${schemaMarkdown}\n\n## DOCUMENTS TO PROCESS\n\n${documentText}\n\nPlease extract the data according to the schema above and return the JSON response in the exact format specified.`;
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const simulatedResponse = `=== GEMINI AI RAW RESPONSE ===

PROMPT SENT TO GEMINI:
${fullPrompt}

=== GEMINI RESPONSE ===

This is where the actual Gemini API response would appear with the extracted JSON data according to the schema specification above.

The response would include:
- All schema fields with extracted values
- All collection properties with confidence scores
- AI reasoning for each field
- Document source references

Next step: Implement actual Gemini API call here.`;

      setGeminiResponse(simulatedResponse);
    } catch (error) {
      console.error('Gemini extraction failed:', error);
      setGeminiResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
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
      {/* Header */}
      <div style={{ 
        margin: '0 0 40px 0', 
        padding: '15px', 
        backgroundColor: '#e7f3ff',
        border: '2px solid #0066cc',
        fontWeight: 'bold'
      }}>
        === STEP 2: PROJECT SCHEMA & AI PROCESSING CONFIGURATION ===
        Session: {session?.sessionName || 'Unnamed Session'}
        Project: {schemaData.project?.name || 'Unnamed Project'}
        Main Object: {schemaData.project?.mainObjectName || 'Session'}
        === SCHEMA FOR AI PROCESSING ===
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

      {/* Next Step Button */}
      <div style={{ 
        margin: '40px 0', 
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#d4edda',
        border: '2px solid #155724'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          STEP 2 COMPLETE: Schema & Rules Configuration
        </div>
        <button 
          onClick={() => window.location.href = `/sessions/${sessionId}/text-view`}
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
          BACK: View Text
        </button>
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
            fontSize: '12px',
            backgroundColor: '#ffffff',
            padding: '15px',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '500px',
            lineHeight: '1.4'
          }}>
            {geminiResponse}
          </pre>
        </div>
      )}
    </div>
  );
}