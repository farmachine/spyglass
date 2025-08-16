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
  aiAssistancePrompt?: string
): Promise<{ functionCode: string; metadata: any }> {
  try {
    if (functionType === "AI_ONLY") {
      // Generate AI-only prompt
      const systemPrompt = `You are an expert at creating AI prompts for data extraction tasks.
Generate a comprehensive AI prompt that will be used to extract data from documents.

Requirements:
- The prompt should be detailed and specific
- It should reference the input parameters using @-key syntax
- It should always output valid JSON format
- It should handle edge cases and missing data gracefully

Input Parameters:
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Function Description: ${description}

Respond with JSON in this format:
{
  "functionCode": "the AI prompt as a string",
  "metadata": {
    "outputFormat": "description of expected output format",
    "inputValidation": "validation rules for inputs",
    "errorHandling": "how errors are handled"
  }
}`;

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
                  errorHandling: { type: "string" }
                },
                required: ["outputFormat", "inputValidation", "errorHandling"]
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: `Generate an AI prompt for: ${name}`
      });

      const result = JSON.parse(response.text || "{}");
      return result;
    } else {
      // Generate Python script
      const systemPrompt = `You are an expert Python developer creating data extraction functions.
Generate a Python function that processes data and outputs to the field_validations database schema.

Requirements:
- Function must be named "extract_function"
- Must accept parameters: document_content, target_fields, identifier_references
- Must use the input parameters defined by the user
- Must output data compatible with field_validations schema
- Must handle errors gracefully
- Must return structured data as JSON
${aiAssistanceRequired ? '- Must include AI assistance as the final step using the provided prompt' : ''}

Input Parameters:
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Function Description: ${description}

${aiAssistanceRequired ? `AI Assistance Prompt: ${aiAssistancePrompt}` : ''}

Respond with JSON in this format:
{
  "functionCode": "complete Python function code as a string",
  "metadata": {
    "inputValidation": "validation rules",
    "outputFormat": "expected output format", 
    "dependencies": ["list", "of", "required", "libraries"],
    "errorHandling": "error handling approach"
  }
}`;

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
                  errorHandling: { type: "string" }
                },
                required: ["inputValidation", "outputFormat", "dependencies", "errorHandling"]
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: `Generate Python function for: ${name}`
      });

      const result = JSON.parse(response.text || "{}");
      return result;
    }
  } catch (error) {
    throw new Error(`Failed to generate function code: ${error}`);
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