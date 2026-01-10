/**
 * Google Gemini AI Integration Module
 * 
 * Provides integration with Google's Gemini AI API for document data extraction.
 * Handles AI-powered tool testing and content generation for the extraction workflow.
 * 
 * Key Functions:
 * - testAIOnlyTool: Tests AI tools with sample documents and inputs
 * - Document content processing with structured prompts
 * - JSON response parsing and validation
 * 
 * Configuration:
 * - Uses GEMINI_API_KEY or GOOGLE_API_KEY environment variable
 * - Defaults to gemini-1.5-flash model for fast processing
 * 
 * Response Format:
 * - Returns structured JSON with extractedValue, validationStatus, reasoning, etc.
 * - Handles markdown code block removal from AI responses
 */

import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

// Simple AI client setup - must pass apiKey as object property
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

const EMBEDDING_MODEL = "text-embedding-004";

export async function generateDocumentEmbedding(content: string): Promise<{ embedding: number[]; contentHash: string }> {
  try {
    const contentHash = crypto.createHash("sha256").update(content).digest("hex");
    const truncatedContent = content.slice(0, 8000);
    
    const response = await genAI.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: truncatedContent,
    });
    
    const embedding = response.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error("No embedding returned from Gemini");
    }
    
    return { embedding, contentHash };
  } catch (error) {
    console.error("Embedding generation error:", error);
    throw error;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findSimilarSessions(
  newDocumentContent: string,
  existingEmbeddings: Array<{ sessionId: string; embedding: number[] }>,
  threshold: number = 0.7
): Promise<Array<{ sessionId: string; similarity: number }>> {
  const { embedding: newEmbedding } = await generateDocumentEmbedding(newDocumentContent);
  
  const similarities = existingEmbeddings.map(({ sessionId, embedding }) => ({
    sessionId,
    similarity: cosineSimilarity(newEmbedding, embedding),
  }));
  
  return similarities
    .filter(s => s.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

export interface ReferenceToolMapping {
  valueName: string;
  stepName: string;
  stepType: string;
  toolId: string | null;
  inputValues: any;
  dataType: string;
  isIdentifier: boolean;
  description: string | null;
}

export interface SuggestedStep {
  stepName: string;
  stepType: "page" | "data_table";
  description: string;
  values: Array<{
    valueName: string;
    dataType: string;
    description: string;
    isIdentifier?: boolean;
    toolKey?: string;
    reference?: {
      stepName: string;
      valueName: string;
      relationship: "lookup" | "aggregate" | "transform";
    };
  }>;
}

export async function analyzeDocumentForSchema(
  documentContent: string,
  referenceTools?: ReferenceToolMapping[]
): Promise<{
  suggestedSteps: SuggestedStep[];
}> {
  // Build reference tool context for the AI
  let referenceToolsContext = "";
  if (referenceTools && referenceTools.length > 0) {
    const toolsByCategory = new Map<string, ReferenceToolMapping[]>();
    for (const tool of referenceTools) {
      // Normalize step types: DB uses "info_page"/"data_table", AI uses "page"/"data_table"
      const isInfoPage = tool.stepType === 'page' || tool.stepType === 'info_page' || tool.stepType === 'infoPage';
      const category = isInfoPage ? 'Info Page Fields' : 'Data Table Columns';
      if (!toolsByCategory.has(category)) {
        toolsByCategory.set(category, []);
      }
      toolsByCategory.get(category)!.push(tool);
    }
    
    referenceToolsContext = `\n\nAVAILABLE REFERENCE TOOLS (use these field names and configurations when applicable):
${Array.from(toolsByCategory.entries()).map(([category, tools]) => 
  `${category}:\n${tools.map(t => `  - "${t.valueName}" (${t.dataType})${t.toolId ? ` [has tool]` : ''}`).join('\n')}`
).join('\n\n')}

IMPORTANT: When suggesting fields, try to match field names to reference tools above. Set "toolKey" to the exact reference field name if it matches (case-insensitive).`;
  }

  const prompt = `You are an expert document analysis AI that designs extraction schemas for legal and business documents.

Analyze the following document and create a comprehensive extraction schema with properly structured workflow steps.
${referenceToolsContext}

DOCUMENT CONTENT:
${documentContent.slice(0, 15000)}

RESPOND WITH JSON (no markdown):
{
  "suggestedSteps": [
    {
      "stepName": "Step name (e.g., 'Project Info', 'Risks', 'Deliverables')",
      "stepType": "page" or "data_table",
      "description": "What this step extracts",
      "values": [
        {
          "valueName": "Field name",
          "dataType": "TEXT|NUMBER|DATE|BOOLEAN|TEXTAREA|CHOICE",
          "description": "Field purpose",
          "isIdentifier": true/false,
          "toolKey": "matching reference tool name if applicable",
          "reference": {
            "stepName": "Referenced step name",
            "valueName": "Referenced field name", 
            "relationship": "lookup|aggregate|transform"
          }
        }
      ]
    }
  ]
}

SCHEMA DESIGN GUIDELINES:

1. STEP TYPES:
   - "page" (Info Page): Single-value extraction for document metadata, summary info, key dates, parties involved
   - "data_table" (Data Table): Multi-row extraction for repeating items like line items, risks, requirements, deliverables

2. STEP ORGANIZATION:
   - Start with an Info Page for document-level metadata (title, date, parties, reference numbers)
   - Add Data Tables for each distinct type of repeating data found in the document
   - Consider adding analysis/scoring tables that reference primary data tables

3. DATA TABLE IDENTIFIERS:
   - Every data_table MUST have exactly ONE field with "isIdentifier": true as the first value
   - This identifier field uniquely identifies each row (e.g., "Risk ID", "Item Number", "Deliverable ID")

4. CROSS-STEP REFERENCES:
   - Use "reference" to link fields between steps for derived calculations
   - Example: A "Risk Score" table can reference a "Risks" table
   - Relationships:
     * "lookup": Pull value from another step based on identifier
     * "aggregate": Calculate based on multiple values (sum, count, average)
     * "transform": Apply calculation/logic to referenced value

5. FIELD NAMING:
   - Use clear, concise field names (e.g., "Project Name", "Start Date", "Risk Level")
   - Match reference tool names when available for automatic tool assignment

6. DATA TYPES:
   - TEXT: Short text values (names, IDs, categories)
   - TEXTAREA: Long text (descriptions, summaries, notes)
   - NUMBER: Numeric values (amounts, quantities, scores)
   - DATE: Date values
   - BOOLEAN: Yes/No values
   - CHOICE: Categorical with limited options

Create a schema that comprehensively captures all extractable information from this document type.`;

  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  let text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse AI schema response:", text);
    return {
      suggestedSteps: [{
        stepName: "Document Info",
        stepType: "page",
        description: "Basic document information",
        values: [
          { valueName: "Document Title", dataType: "TEXT", description: "Title of the document" },
          { valueName: "Document Date", dataType: "DATE", description: "Date of the document" }
        ]
      }]
    };
  }
}

export async function testAIOnlyTool(
  toolDescription: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  testInputs: Record<string, any>,
  sampleDocuments: any[]
): Promise<any[]> {
  try {
    // Build simple prompt
    let prompt = `Task: ${toolDescription}\n\nInputs:\n`;
    
    for (const param of inputParameters) {
      const inputValue = testInputs[param.name];
      
      if (param.type === "text") {
        prompt += `${param.name}: ${inputValue || "Not provided"}\n`;
      } else if (param.type === "document") {
        const selectedDocIds = Array.isArray(inputValue) ? inputValue : [];
        const selectedDocs = sampleDocuments.filter(doc => selectedDocIds.includes(doc.id));
        
        if (selectedDocs.length > 0) {
          selectedDocs.forEach(doc => {
            prompt += `${param.name}: ${doc.extractedContent || doc.sampleText || 'No content'}\n`;
          });
        } else {
          prompt += `${param.name}: No documents\n`;
        }
      } else {
        prompt += `${param.name}: ${inputValue || "Not provided"}\n`;
      }
    }

    prompt += `\nRespond with JSON array: [{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "doc"}]`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Clean and parse JSON response (remove markdown code blocks if present)
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleanText);
    return Array.isArray(parsed) ? parsed : [parsed];

  } catch (error) {
    console.error("AI tool test error:", error);
    throw error;
  }
}

export async function generateFunctionCode(
  name: string,
  description: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  functionType: "SCRIPT" | "AI_ONLY" | "CODE",
  aiAssistanceRequired: boolean,
  aiAssistancePrompt?: string,
  outputType: 'single' | 'multiple' = 'single'
): Promise<string> {
  try {
    const prompt = `Create a Python function for Excel data extraction.

Function Name: ${name}
Description: ${description}
Function Type: ${functionType}
Output Type: ${outputType}

Input Parameters:
${inputParameters.map(p => `- ${p.name} (${p.type}): ${p.description}`).join('\n')}

${aiAssistanceRequired && aiAssistancePrompt ? `Additional Instructions: ${aiAssistancePrompt}` : ''}

Generate a Python function that:
1. Takes the specified input parameters
2. Processes Excel data using text parsing (no pandas)
3. Returns results in the required format
4. Handles errors gracefully

Return only the Python function code, no explanations.`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });
    
    console.log("🔍 Raw response:", JSON.stringify(response, null, 2));
    let code = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!code) {
      throw new Error("No code generated from AI response");
    }
    
    code = code.trim();
    
    // Clean code blocks if present
    if (code.startsWith('```python')) {
      code = code.replace(/^```python\s*/, '').replace(/\s*```$/, '');
    } else if (code.startsWith('```')) {
      code = code.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return code;

  } catch (error) {
    console.error("Function generation error:", error);
    throw error;
  }
}