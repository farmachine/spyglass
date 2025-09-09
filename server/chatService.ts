import { GoogleGenAI } from "@google/genai";
import type { FieldValidation, ExtractionSession, ProjectSchemaField, ObjectCollection, CollectionProperty } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ChatContext {
  session: ExtractionSession;
  validations: FieldValidation[];
  projectFields: ProjectSchemaField[];
  collections: ObjectCollection[];
  collectionProperties: CollectionProperty[];
}

export async function generateChatResponse(message: string, context: ChatContext): Promise<string> {
  try {
    // Separate schema fields from collection fields
    const schemaValidations = context.validations.filter(v => v.validationType === 'schema_field');
    const collectionValidations = context.validations.filter(v => v.validationType === 'collection_property');
    
    // Calculate verification statistics
    const totalFields = context.validations.length;
    const verifiedFields = context.validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const unverifiedFields = totalFields - verifiedFields;
    const verificationPercentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;

    // Get field status breakdown
    const statusCounts = {
      verified: context.validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length,
      unverified: context.validations.filter(v => v.validationStatus === 'unverified').length,
      pending: context.validations.filter(v => v.validationStatus === 'pending').length,
      manual: context.validations.filter(v => v.validationStatus === 'manual').length,
    };

    // Group collection validations by collection name for cross-validation analysis
    const collectionGroups: { [key: string]: FieldValidation[] } = {};
    collectionValidations.forEach(validation => {
      const collectionName = validation.collectionName || 'Unknown';
      if (!collectionGroups[collectionName]) {
        collectionGroups[collectionName] = [];
      }
      collectionGroups[collectionName].push(validation);
    });

    // Prepare context for AI
    const systemPrompt = `You are an AI assistant helping with document data extraction session analysis. You have access to the following session data:

SESSION INFORMATION:
- Session Name: ${context.session.sessionName}
- Status: ${context.session.status}
- Created: ${context.session.createdAt}
- Last Updated: ${context.session.updatedAt}

VALIDATION STATISTICS:
- Total Fields: ${totalFields}
- Verified Fields: ${verifiedFields} (${verificationPercentage}%)
- Unverified Fields: ${unverifiedFields}
- Status Breakdown:
  * Verified: ${statusCounts.verified}
  * Unverified: ${statusCounts.unverified}
  * Pending: ${statusCounts.pending}
  * Manual: ${statusCounts.manual}

EXTRACTED DATA:
${schemaValidations.map(v => {
  // Find the field name from the project fields based on fieldId
  const field = context.projectFields.find(f => f.id === v.fieldId);
  const fieldName = field?.fieldName || `Field ${v.fieldId}`;
  return `- ${fieldName}: ${v.extractedValue || 'No value'} (Status: ${v.validationStatus}, Confidence: ${v.confidenceScore}%)`;
}).join('\n')}

COLLECTION DATA (Cross-validation capable):
${Object.entries(collectionGroups).map(([collectionName, validations]) => {
  const recordCount = Math.max(...validations.map(v => v.recordIndex || 0)) + 1;
  return `\n${collectionName} Collection (${recordCount} records):
${validations.slice(0, 10).map(v => {
    // Use the fieldName from validation if available (already formatted properly)
    // Otherwise try to find the property name from collection properties
    let propName = 'Unknown Property';
    
    if (v.fieldName) {
      // Extract just the property name from the formatted fieldName (e.g., "Collection.PropertyName[0]" -> "PropertyName")
      const parts = v.fieldName.split('.');
      if (parts.length > 1) {
        propName = parts[parts.length - 1].split('[')[0];
      } else {
        propName = v.fieldName;
      }
    } else {
      // Fallback to finding property by ID
      const prop = context.collectionProperties.find(p => p.id === v.fieldId);
      propName = prop?.propertyName || 'Unknown Property';
    }
    
    return `  - Record ${v.recordIndex}: ${propName} = ${v.extractedValue || 'No value'} (Status: ${v.validationStatus}, Confidence: ${v.confidenceScore}%)`;
  }).join('\n')}${validations.length > 10 ? `\n  ... and ${validations.length - 10} more fields in this collection` : ''}`;
}).join('\n')}

PROJECT SCHEMA:
${context.projectFields.map(f => `- ${f.fieldName} (${f.fieldType}): ${f.description || 'No description'}`).join('\n')}

COLLECTIONS:
${context.collections.map(c => `- ${c.collectionName}: ${c.description || 'No description'}`).join('\n')}

You can perform cross-validation analysis on collection data by comparing values across records within collections and between different collections. You have access to all extracted data across all tabs/collections.

Please provide helpful insights about this session data. Answer questions about:
- Verification status and progress
- Data quality and completeness
- Specific field values and their confidence scores
- Patterns in the extracted data
- Cross-validation checks across collection records
- Inconsistencies or conflicts between related data points
- Suggestions for improving data quality
- Comparative analysis across collection records

FORMATTING GUIDELINES:
- Use proper paragraph breaks (double newlines) between major topics
- Use single newlines for line breaks within sections
- Structure responses with clear sections when appropriate
- Use bullet points with - when listing items
- Keep responses well-organized and easy to read

Keep responses concise and focused on the user's question. Use the session data to provide accurate, specific information about ALL available data.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
    });

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat AI response error:", error);
    return "I'm having trouble processing your request right now. Please try again in a moment.";
  }
}