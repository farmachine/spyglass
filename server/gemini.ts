import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function testAIOnlyTool(
  toolDescription: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  testInputs: Record<string, any>,
  sampleDocuments: any[]
): Promise<any[]> {
  try {
    console.log('🤖 Testing AI ONLY tool with Gemini...');
    
    // Build system prompt explaining input types
    const systemPrompt = `You are an AI data extraction tool that processes inputs and returns results in field_validations JSON format.

Input Type Understanding:
- text inputs: These are instructions/prompts that guide your extraction
- document inputs: These are source documents from which to extract data
- data inputs: These are source data structures from which to extract data

Tool Description: ${toolDescription}

You must return an array of field_validation objects with this exact structure:
[{
  "id": "unique-id",
  "sessionId": "test-session",
  "validationType": "schema_field",
  "dataType": "TEXT",
  "fieldId": "extracted-field-name",
  "extractedValue": "extracted value",
  "validationStatus": "valid|pending|invalid",
  "aiReasoning": "explanation of extraction reasoning",
  "confidenceScore": 0-100,
  "documentSource": "source document name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}]

IMPORTANT: Return ONLY valid JSON array, no additional text.`;

    // Build user prompt with inputs
    let userPrompt = `Process the following inputs:\n\n`;
    
    // Process each input parameter
    for (const param of inputParameters) {
      const inputValue = testInputs[param.name];
      
      if (param.type === "text") {
        userPrompt += `${param.name} (instruction): ${inputValue || "Not provided"}\n`;
      } else if (param.type === "document") {
        // For document inputs, get content from selected sample documents
        const selectedDocIds = Array.isArray(inputValue) ? inputValue : [];
        const selectedDocs = sampleDocuments.filter(doc => selectedDocIds.includes(doc.id));
        
        if (selectedDocs.length > 0) {
          userPrompt += `${param.name} (documents):\n`;
          selectedDocs.forEach((doc, index) => {
            userPrompt += `Document ${index + 1}: ${doc.fileName || 'Sample Document'}\n`;
            userPrompt += `Content: ${doc.extractedContent || doc.sampleText || 'No content available'}\n\n`;
          });
        } else {
          userPrompt += `${param.name} (documents): No documents selected\n`;
        }
      } else if (param.type === "data") {
        userPrompt += `${param.name} (source data): ${inputValue || "Not provided"}\n`;
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      },
      contents: userPrompt
    });

    const result = JSON.parse(response.text || "[]");
    
    // Ensure result is an array
    if (!Array.isArray(result)) {
      throw new Error("AI response is not an array");
    }

    console.log('✅ AI tool test completed successfully');
    return result;

  } catch (error) {
    console.error("Error testing AI tool:", error);
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
  outputType?: "single" | "multiple"
): Promise<{ functionCode: string; metadata: any }> {
  try {
    console.log('🧠 Starting AI function generation process...');
    console.log('📋 Function generation parameters:', {
      name,
      description,
      functionType,
      outputType,
      aiAssistanceRequired,
      inputParametersCount: inputParameters.length,
      inputParameters: inputParameters.map(p => ({ name: p.name, type: p.type }))
    });

    if (functionType === "AI_ONLY") {
      console.log('🤖 Creating AI-only tool (no Python code generation)...');
      
      // For AI_ONLY tools, create a descriptive prompt instead of Python code
      const aiPrompt = `Extract data from the provided document using the following parameters:

Parameters:
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Tool Description: ${description}
Output Type: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

Instructions:
- Use all the provided parameters to guide your extraction
- Extract relevant data based on the document content
- Return results in valid JSON format
- Handle missing data gracefully with appropriate status indicators
${aiAssistanceRequired ? `\nAdditional AI Instructions: ${aiAssistancePrompt}` : ''}`;

      return {
        functionCode: aiPrompt,
        metadata: {
          outputFormat: "field_validations_array",
          inputValidation: "AI will validate all input parameters during extraction",
          errorHandling: "AI handles missing data gracefully with appropriate status indicators",
          parametersUsed: inputParameters.map(p => p.name),
          toolType: "AI_ONLY",
          description: description
        }
      };
    } else {
      console.log('🐍 Generating Python code function...');
      // Generate Python script with field_validations compatibility
      const systemPrompt = `You are an expert Python developer creating data extraction functions.
Generate a Python function that processes data and outputs to the field_validations database schema.

CRITICAL: The output MUST be exactly compatible with the field_validations database schema format.

This function is designed to create: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

Requirements:
- Function must be named "extract_function"
- Must accept parameters based on the user-defined input parameters: ${inputParameters.map(p => p.name).join(', ')}
- CRITICAL: All input parameters are STRING VALUES of already-extracted document content, NOT binary document data
- Input parameters contain pre-processed text content from documents (Excel, Word, PDF, etc.) that has already been extracted
- Do NOT use pandas, openpyxl, or any document parsing libraries - work with the string content provided
- Must use ALL input parameters defined by the user: ${inputParameters.map(p => `@${p.name}`).join(', ')}
- Must output data compatible with field_validations schema (array of objects)
- Must handle errors gracefully and return valid JSON
- Must include comprehensive error handling for all edge cases
- Function should be fully self-contained and executable
- ${outputType === "single" ? "Design for extracting single values that will become main schema fields" : "Design for extracting multiple records that will populate a collection"}
${aiAssistanceRequired ? '- Must include AI assistance as the final step using the provided prompt' : ''}

Field Validations Output Schema (EXACT format required):
[
  {
    "extractedValue": "string - the actual extracted value",
    "validationStatus": "string - valid|invalid|pending", 
    "aiReasoning": "string - explanation of extraction logic",
    "confidenceScore": "number - 0-100 confidence percentage",
    "documentSource": "string - source identifier"
  }
]

All Input Parameters (use ALL of these in your function):
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Function Name: ${name}
Function Description: ${description}

${aiAssistanceRequired ? `AI Assistance Prompt: ${aiAssistancePrompt}` : ''}

The function should:
1. Process the input string parameters (which contain already-extracted document content)
2. Extract relevant data by analyzing the string content using pattern matching, text processing, or data parsing
3. Return results in the exact field_validations format shown above
4. Handle missing data gracefully with appropriate validation status
5. IMPORTANT: Do NOT attempt to read binary files or use document parsing libraries - work only with the provided string content

Respond with JSON in this format:
{
  "functionCode": "complete Python function code as a string that returns field_validations format",
  "metadata": {
    "inputValidation": "validation rules",
    "outputFormat": "field_validations_array", 
    "dependencies": ["list", "of", "required", "libraries"],
    "errorHandling": "error handling approach",
    "parametersUsed": ["list", "of", "all", "parameter", "names"]
  }
}`;

      console.log('📤 Sending Python script generation request to Gemini...');
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              functionCode: { type: "string" },
              metadata: { 
                type: "object",
                properties: {
                  inputValidation: { type: "string" },
                  outputFormat: { type: "string" }, 
                  dependencies: { 
                    type: "array",
                    items: { type: "string" }
                  },
                  errorHandling: { type: "string" },
                  parametersUsed: { 
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["inputValidation", "outputFormat", "dependencies", "errorHandling", "parametersUsed"]
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: `Generate a Python function for: ${name}

Function signature should be: def extract_function(${inputParameters.map(p => p.name).join(', ')}):

CRITICAL: All parameters are STRING VALUES containing already-extracted document content.
- Do NOT use pandas, openpyxl, or document parsing libraries
- Work only with the provided string content
- Use pattern matching, text processing, or JSON/CSV parsing on strings

Must use all these parameters: ${inputParameters.map(p => p.name).join(', ')}

Output must be field_validations compatible array format.`
      });

      console.log('✅ Python script generation completed');
      const result = JSON.parse(response.text || "{}");
      console.log('🎯 Generated Python function metadata:', result.metadata);
      return result;
    }
  } catch (error) {
    console.error('❌ Error generating function code:', error);
    throw error;
  }
}

export async function analyzeSentiment(text: string): Promise<any> {
  // Keep existing function for compatibility
  try {
    const systemPrompt = `You are a sentiment analysis expert. 
Analyze the sentiment of the text and provide a rating
from 1 to 5 stars and a confidence score between 0 and 1.
Respond with JSON in this format: 
{'rating': number, 'confidence': number}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            rating: { type: "number" },
            confidence: { type: "number" },
          },
          required: ["rating", "confidence"],
        },
      },
      contents: text,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    throw new Error(`Failed to analyze sentiment: ${error}`);
  }
}