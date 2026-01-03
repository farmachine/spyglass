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

// Simple AI client setup
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenAI(apiKey);

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