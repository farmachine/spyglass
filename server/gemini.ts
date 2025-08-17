import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateFunctionCode(
  name: string,
  description: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  functionType: "SCRIPT" | "AI_ONLY",
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
      console.log('🤖 Generating AI-only prompt function...');
      // Generate AI-only prompt with field_validations compatibility
      const systemPrompt = `You are an expert at creating AI prompts for data extraction tasks.
Generate a comprehensive AI prompt that will be used to extract data from documents.

CRITICAL: The output MUST be compatible with the field_validations database schema format.

This function is designed to create: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

Requirements:
- The prompt should be detailed and specific
- It should reference ALL input parameters using @-key syntax: ${inputParameters.map(p => `@${p.name}`).join(', ')}
- It should always output valid JSON in field_validations format
- It should handle edge cases and missing data gracefully
- Output format MUST be field_validations compatible array
- ${outputType === "single" ? "Design for extracting single values that will become main schema fields" : "Design for extracting multiple records that will populate a collection"}

Field Validations Output Format:
The function must return an array of objects with this exact structure:
[
  {
    "extractedValue": "the extracted value",
    "validationStatus": "valid|invalid|pending",
    "aiReasoning": "explanation of extraction logic",
    "confidenceScore": 95,
    "documentSource": "source identifier"
  }
]

All Input Parameters (use ALL of these in your prompt):
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Function Name: ${name}
Function Description: ${description}

Respond with JSON in this format:
{
  "functionCode": "the AI prompt as a string that outputs field_validations format",
  "metadata": {
    "outputFormat": "field_validations_array",
    "inputValidation": "validation rules for inputs",
    "errorHandling": "how errors are handled",
    "parametersUsed": ["list", "of", "all", "parameter", "names"]
  }
}`;

      console.log('📤 Sending AI prompt generation request to Gemini...');
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
                  outputFormat: { type: "string" },
                  inputValidation: { type: "string" },
                  errorHandling: { type: "string" },
                  parametersUsed: { 
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["outputFormat", "inputValidation", "errorHandling", "parametersUsed"]
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: `Generate an AI prompt for: ${name}\n\nMust use all these parameters: ${inputParameters.map(p => p.name).join(', ')}`
      });

      console.log('✅ AI prompt generation completed');
      const result = JSON.parse(response.text || "{}");
      console.log('🎯 Generated AI prompt metadata:', result.metadata);
      return result;
    } else {
      console.log('🐍 Generating Python script function...');
      // Generate Python script with field_validations compatibility
      const systemPrompt = `You are an expert Python developer creating data extraction functions.
Generate a Python function that processes data and outputs to the field_validations database schema.

CRITICAL: The output MUST be exactly compatible with the field_validations database schema format.

This function is designed to create: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

Requirements:
- Function must be named "extract_function"
- Must accept parameters: document_content, target_fields, identifier_references
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
1. Process the document_content using all provided parameters
2. Extract relevant data based on target_fields and identifier_references
3. Return results in the exact field_validations format shown above
4. Handle missing data gracefully with appropriate validation status

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
        contents: `Generate a Python function for: ${name}\n\nMust use all these parameters: ${inputParameters.map(p => p.name).join(', ')}\n\nOutput must be field_validations compatible array format.`
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