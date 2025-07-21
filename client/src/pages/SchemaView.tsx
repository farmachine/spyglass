import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

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

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  const { data: schemaData, isLoading: schemaLoading } = useQuery<SchemaData>({
    queryKey: [`/api/projects/${session?.projectId}/schema-data`],
    enabled: !!session?.projectId,
  });

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
              "Knowledge Documents Available": schemaData.knowledge_documents.length > 0 ? 
                `${schemaData.knowledge_documents.length} document(s) with ${schemaData.knowledge_documents.reduce((total, doc) => total + (doc.content?.length || 0), 0)} total characters` : 
                "No knowledge documents"
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

      <div style={{ marginBottom: '40px' }}>
        {JSON.stringify({
          collections: schemaData.collections.map(collection => ({
            collection_name: collection.collectionName,
            description: collection.description,
            properties: collection.properties?.map((prop: any) => {
              // Get rules that specifically target this property
              const specificRules = schemaData.extraction_rules
                .filter(rule => rule.targetFields?.includes(`${collection.collectionName}.${prop.propertyName}`))
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
                "Knowledge Documents Available": schemaData.knowledge_documents.length > 0 ? 
                  `${schemaData.knowledge_documents.length} document(s) with ${schemaData.knowledge_documents.reduce((total, doc) => total + (doc.content?.length || 0), 0)} total characters` : 
                  "No knowledge documents"
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

      <div style={{ marginBottom: '40px' }}>
        {schemaData.knowledge_documents.length > 0 ? (
          schemaData.knowledge_documents.map((doc, index) => (
            <div key={index} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                KNOWLEDGE DOCUMENT {index + 1}: {doc.displayName}
              </div>
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#f5f5f5',
                border: '1px solid #ccc'
              }}>
                {doc.content || 'No content available'}
              </div>
            </div>
          ))
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

      {/* Auto-Mapping Summary */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '15px', 
        backgroundColor: '#d1ecf1',
        border: '2px solid #0c5460',
        fontWeight: 'bold'
      }}>
        === AUTO-MAPPING BEHAVIOR ===
        <div style={{ fontWeight: 'normal', marginTop: '10px' }}>
          🌐 <strong>Knowledge Documents:</strong> ALL {schemaData.knowledge_documents.length} document(s) are automatically applied to EVERY schema field and collection property
          <br/>
          🌐 <strong>Global Rules:</strong> {schemaData.extraction_rules.filter(rule => !rule.targetFields || rule.targetFields.length === 0).length} rule(s) with no target fields are automatically applied to ALL properties
          <br/>
          🎯 <strong>Targeted Rules:</strong> {schemaData.extraction_rules.filter(rule => rule.targetFields && rule.targetFields.length > 0).length} rule(s) are applied only to their specific target fields
        </div>
      </div>

      {/* Summary */}
      <div style={{ 
        margin: '40px 0 20px 0', 
        padding: '15px', 
        backgroundColor: '#d4edda',
        border: '2px solid #155724',
        fontWeight: 'bold'
      }}>
        === CONFIGURATION SUMMARY ===
        Schema Fields: {schemaData.schema_fields.length}
        Collections: {schemaData.collections.length}
        Knowledge Documents: {schemaData.knowledge_documents.length} (auto-applied to all)
        Extraction Rules: {schemaData.extraction_rules.length} ({schemaData.extraction_rules.filter(rule => !rule.targetFields || rule.targetFields.length === 0).length} global + {schemaData.extraction_rules.filter(rule => rule.targetFields && rule.targetFields.length > 0).length} targeted)
        === END CONFIGURATION ===
      </div>

      {/* Next Step Button */}
      <div style={{ 
        margin: '40px 0', 
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#fff3cd',
        border: '2px solid #856404'
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
          onClick={() => alert('Step 3: AI Extraction coming next!')}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          NEXT: AI Data Extraction (Coming Soon)
        </button>
      </div>
    </div>
  );
}