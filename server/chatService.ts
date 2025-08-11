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

FIELD DETAILS:
${context.validations.slice(0, 20).map(v => 
  `- ${v.fieldName}: ${v.extractedValue || 'No value'} (Status: ${v.validationStatus}, Confidence: ${v.confidenceScore}%)`
).join('\n')}
${context.validations.length > 20 ? `... and ${context.validations.length - 20} more fields` : ''}

PROJECT SCHEMA:
${context.projectFields.map(f => `- ${f.fieldName} (${f.fieldType}): ${f.description || 'No description'}`).join('\n')}

COLLECTIONS:
${context.collections.map(c => `- ${c.collectionName}: ${c.description || 'No description'}`).join('\n')}

Please provide helpful insights about this session data. Answer questions about:
- Verification status and progress
- Data quality and completeness
- Specific field values and their confidence scores
- Patterns in the extracted data
- Suggestions for improving data quality

Keep responses concise and focused on the user's question. Use the session data to provide accurate, specific information.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: message,
    });

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat AI response error:", error);
    return "I'm having trouble processing your request right now. Please try again in a moment.";
  }
}