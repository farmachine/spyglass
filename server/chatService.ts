import { GoogleGenAI } from "@google/genai";
import type { FieldValidation, ExtractionSession, ProjectSchemaField, ObjectCollection, CollectionProperty, WorkflowStep, StepValue } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ConversationParticipant {
  id: string;
  name: string;
  email: string;
}

interface ConversationWithParticipants {
  id: string;
  name: string;
  subject?: string | null;
  participantEmail: string;
  isOriginator: boolean;
  participants: ConversationParticipant[];
}

interface ChatContext {
  session: ExtractionSession;
  validations: FieldValidation[];
  projectFields: ProjectSchemaField[];
  collections: ObjectCollection[];
  collectionProperties: CollectionProperty[];
  workflowSteps: WorkflowStep[];
  stepValues: StepValue[];
  conversations: ConversationWithParticipants[];
  projectInboxEmail: string | null;
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

    // Build step values section
    const stepValuesSection = context.workflowSteps.map(step => {
      const values = context.stepValues.filter((sv: any) => sv.stepId === step.id);
      if (values.length === 0) return '';
      return `\n${step.stepName} (${step.stepType}):
${values.map((sv: any) => `  - ${sv.fieldName}: ${sv.extractedValue || 'No value'}`).join('\n')}`;
    }).filter(Boolean).join('\n');

    // Build conversations section
    const conversationsSection = context.conversations.map(conv => {
      const participantsList = conv.participants.map(p =>
        `    - ${p.name} <${p.email}>`
      ).join('\n');
      return `- [ID: ${conv.id}] "${conv.name}" ${conv.isOriginator ? '(ORIGINATOR)' : ''}
    Subject: ${conv.subject || '(no subject)'}
    Primary: ${conv.participantEmail}
    Participants:
${participantsList}`;
    }).join('\n');

    // Prepare context for AI
    const systemPrompt = `You are an AI assistant helping with document data extraction session analysis. You have access to session data and conversation context. You can render rich data tables, draft correspondence, and help automate tasks.

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

EXTRACTED DATA (Page Fields):
${schemaValidations.map(v => {
  const field = context.projectFields.find(f => f.id === v.fieldId);
  const fieldName = field?.fieldName || `Field ${v.fieldId}`;
  return `- ${fieldName}: ${v.extractedValue || 'No value'} (Status: ${v.validationStatus}, Confidence: ${v.confidenceScore}%)`;
}).join('\n')}

STEP VALUES:
${stepValuesSection || '(No step values)'}

COLLECTION DATA (Data Tables):
${Object.entries(collectionGroups).map(([collectionName, validations]) => {
  const recordCount = Math.max(...validations.map(v => v.recordIndex || 0)) + 1;
  return `\n${collectionName} Collection (${recordCount} records):
${validations.slice(0, 100).map(v => {
    let propName = 'Unknown Property';
    if (v.fieldName) {
      const parts = v.fieldName.split('.');
      if (parts.length > 1) {
        propName = parts[parts.length - 1].split('[')[0];
      } else {
        propName = v.fieldName;
      }
    } else {
      const prop = context.collectionProperties.find(p => p.id === v.fieldId);
      propName = prop?.propertyName || 'Unknown Property';
    }
    return `  - Record ${v.recordIndex}: ${propName} = ${v.extractedValue || 'No value'} (Status: ${v.validationStatus})`;
  }).join('\n')}${validations.length > 100 ? `\n  ... and ${validations.length - 100} more fields` : ''}`;
}).join('\n')}

PROJECT SCHEMA:
${context.projectFields.map(f => `- ${f.fieldName} (${f.fieldType}): ${f.description || 'No description'}`).join('\n')}

COLLECTIONS:
${context.collections.map(c => `- ${c.collectionName}: ${c.description || 'No description'}`).join('\n')}

CONVERSATIONS:
${conversationsSection || '(No conversations)'}

---

FORMATTING INSTRUCTIONS:
- **Always use markdown tables** when presenting tabular data. Use proper | column | headers | format with alignment.
- Use **bold** for emphasis and ## headings for sections.
- Use bullet points with - for lists.
- Use > blockquotes for drafted correspondence.
- Structure responses clearly with sections and spacing.
- Keep tables clean and readable with aligned columns.

CORRESPONDENCE DRAFTING:
When the user asks you to draft a message or correspondence for someone:
1. Identify the target conversation from the CONVERSATIONS list above (match by name, email, or conversation ID).
2. Format the draft message inside a blockquote (using > prefix).
3. After the draft, on a new line, add this EXACT marker (it will be invisible to the user but used by the system):
   <!-- DRAFT_EMAIL conversationId="THE_CONVERSATION_ID" subject="THE_SUBJECT" -->
   Replace THE_CONVERSATION_ID with the actual conversation ID and THE_SUBJECT with an appropriate subject line.
4. The system will automatically show a "Send" button to the user so they can send the draft to that conversation.
5. If the user mentions a name with @, look up the corresponding conversation participant and use their conversation.

IMPORTANT: Only include the DRAFT_EMAIL marker when the user explicitly asks to draft or send a message. Do not include it for general data queries.

Please provide helpful insights about this session data. Answer questions about:
- Verification status and progress
- Data quality and completeness
- Specific field values and their confidence scores
- Patterns in the extracted data
- Cross-validation checks across collection records
- Drafting correspondence for conversation participants
- Summarizing data in rich table format

Keep responses concise and focused on the user's question.`;

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
