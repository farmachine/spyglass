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
  sampleDocuments: any[],
  outputType: 'single' | 'multiple' = 'single'
): Promise<any[]> {
  try {
    console.log('🤖 Testing AI ONLY tool with Gemini...');
    console.log('📊 Output type:', outputType);
    
    // Build system prompt explaining input types and output constraints
    const outputInstruction = outputType === 'single' 
      ? 'CRITICAL: This tool has outputType="single" - return EXACTLY ONE result object in the array, not multiple results.'
      : 'This tool has outputType="multiple" - you can return multiple result objects if appropriate.';
    
    const systemPrompt = `You are an AI data extraction tool that processes inputs and returns results in field_validations JSON format.

Input Type Understanding:
- text inputs: These are instructions/prompts that guide your extraction
- document inputs: These are source documents from which to extract data
- data inputs: These are source data structures from which to extract data

Tool Description: ${toolDescription}

${outputInstruction}

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
      
      // Get data input parameters for array iteration examples
      const dataInputs = inputParameters.filter(p => p.type === 'data');
      
      // Removed manual override - using AI generation for all functions
      
      // MANDATORY FUNCTION SIGNATURE WITH STRICT FORMAT REQUIREMENTS
      const systemPrompt = `You are an expert Python developer. Create a function with EXACT requirements:

FUNCTION SIGNATURE (MANDATORY):
def extract_function(${inputParameters.map(p => p.name.replace(/\s+/g, '_')).join(', ')}):

CRITICAL CONSTRAINTS:
1. Use ONLY standard Python built-ins (no pandas, no external imports)
2. NO FileNotFoundError, IOError, or other specialized exceptions
3. Use only: Exception, ValueError, TypeError, AttributeError
4. OUTPUT TYPE = "${outputType.toUpperCase()}"

${outputType === 'multiple' ? `
MULTIPLE RECORDS MODE:
- Iterate through array parameter with: for record in ${dataInputs[0]?.name.replace(/\s+/g, '_')}:
- Extract field: value = record["${dataInputs[0]?.sampleData?.columns?.[0] || 'field_name'}"]
- Return multiple results (one per array item)
` : `
SINGLE RECORD MODE:
- Process input as single unit
- Return one result only
`}

MANDATORY RETURN FORMAT:
[{
  "extractedValue": "found_value_or_Not_Found",
  "validationStatus": "valid|invalid|not_found", 
  "aiReasoning": "explanation_text",
  "confidenceScore": 90,
  "documentSource": "input"
}]

PARAMETER INFO:
${inputParameters.map(p => {
  if (p.type === 'data' && p.sampleData?.rows) {
    return `${p.name.replace(/\s+/g, '_')}: Array of ${p.sampleData.rows.length} objects like ${JSON.stringify(p.sampleData.rows[0] || {})}`;
  } else if (p.type === 'document') {
    return `${p.name.replace(/\s+/g, '_')}: Text string with Excel sheets in format "=== Sheet: Name ===" + tab-separated data`;
  }
  return `${p.name.replace(/\s+/g, '_')}: ${p.type} data`;
}).join('\n')}

EXCEL PARSING PATTERN:
- Split by lines: content.splitlines()  
- Find sheets: if "=== Sheet:" in line
- Parse sheet name: line.split("=== Sheet:")[1].split("===")[0].strip()

Return JSON: {"functionCode": "complete_python_code", "metadata": {"parametersUsed": [${inputParameters.map(p => `"${p.name}"`).join(', ')}]}}`;

      const userPrompt = `Create: ${name}
Description: ${description}

Generate Python function using only built-in modules.
${outputType === 'multiple' ? 'Use iteration to process array elements.' : 'Process input as single unit.'}
Return proper field validation format with extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              functionCode: { type: "string" },
              metadata: { 
                type: "object",
                properties: {
                  outputFormat: { type: "string" },
                  parametersUsed: { 
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: userPrompt
      });

      console.log('✅ Python script generation completed');
      console.log('📄 Raw AI response:', response.text);
      console.log('📄 Full response object:', JSON.stringify(response, null, 2));
      
      if (!response.text) {
        console.error('❌ Empty response from Gemini');
        throw new Error('Empty response from Gemini AI');
      }
      
      let result;
      try {
        result = JSON.parse(response.text);
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response as JSON:', parseError);
        console.error('❌ Raw response was:', response.text);
        throw new Error('Invalid JSON response from Gemini AI');
      }
      
      if (!result.functionCode || !result.metadata) {
        console.error('❌ Missing required fields in AI response:', {
          hasFunctionCode: !!result.functionCode,
          hasMetadata: !!result.metadata,
          result: result
        });
        throw new Error('AI response missing required functionCode or metadata fields');
      }
      
      // Unescape newlines and other escape sequences for proper formatting
      result.functionCode = result.functionCode.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
      
      // Validate the function starts with the correct signature
      const expectedSignature = `def extract_function(${inputParameters.map(p => p.name.replace(/\s+/g, '_')).join(', ')}):`;
      if (!result.functionCode.includes('def extract_function(')) {
        console.error('❌ AI generated wrong function signature. Expected:', expectedSignature);
        console.error('❌ Generated code starts with:', result.functionCode.substring(0, 100));
        throw new Error('AI generated incorrect function signature - should be extract_function');
      }
      
      console.log('🎯 Generated Python function metadata:', result.metadata);
      console.log('📝 Function code preview (first 300 chars):\n' + result.functionCode.substring(0, 300) + '...');
      console.log('✅ Function signature validation passed');
      return result;
    }
  } catch (error) {
    console.error('❌ Error generating function code:', error);
    throw error;
  }
}

export async function updateFunctionCode(
  name: string,
  description: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  functionType: "SCRIPT" | "AI_ONLY" | "CODE",
  aiAssistanceRequired: boolean,
  aiAssistancePrompt: string | undefined,
  outputType: "single" | "multiple" | undefined,
  currentCode: string
): Promise<{ functionCode: string; metadata: any }> {
  try {
    console.log('🔄 Starting AI function update process...');
    console.log('📋 Function update parameters:', {
      name,
      description,
      functionType,
      outputType,
      currentCodeLength: currentCode?.length || 0
    });

    if (functionType === "AI_ONLY") {
      console.log('🤖 Updating AI-only tool prompt...');
      
      // For AI_ONLY tools, update the descriptive prompt
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
      console.log('🐍 Updating Python code function...');
      
      // Generate system prompt for updating existing code
      const systemPrompt = `You are an expert Python developer updating an existing data extraction function.
You need to modify the current function code based on new requirements while preserving the core functionality.

CRITICAL: The output MUST be exactly compatible with the field_validations database schema format.

This function is designed to create: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

CURRENT FUNCTION CODE TO UPDATE:
\`\`\`python
${currentCode}
\`\`\`

UPDATED REQUIREMENTS:
- Function Name: ${name}
- Function Description: ${description}
- Input Parameters: ${inputParameters.map(p => `@${p.name} (${p.type}): ${p.description}`).join(', ')}
- Function Type: ${functionType}
- Output Type: ${outputType}

UPDATE INSTRUCTIONS:
1. Modify the existing function to match the new name, description, and input parameters
2. Preserve the core logic where it still applies
3. Update parameter handling to match the new input parameter list
4. Ensure the function still outputs field_validations schema format
5. Improve error handling and validation if needed
6. Maintain all existing functionality that doesn't conflict with new requirements

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

Return JSON with functionCode and metadata fields.`;

      const userPrompt = `Update the existing Python function with these new requirements:

Name: ${name}
Description: ${description}
Input Parameters:
${inputParameters.map(p => `- ${p.name} (${p.type}): ${p.description}`).join('\n')}

Please update the function code while preserving the existing logic where applicable.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              functionCode: { type: "string" },
              metadata: { 
                type: "object",
                properties: {
                  outputFormat: { type: "string" },
                  parametersUsed: { 
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: userPrompt }] }
        ]
      });

      console.log('✅ Python function update completed');
      
      if (!response.text) {
        throw new Error('Empty response from Gemini AI');
      }
      
      const result = JSON.parse(response.text);
      
      if (!result.functionCode || !result.metadata) {
        throw new Error('AI response missing required functionCode or metadata fields');
      }
      
      console.log('🎯 Updated Python function metadata:', result.metadata);
      return result;
    }
  } catch (error) {
    console.error('❌ Error updating function code:', error);
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

export async function debugTool(
  toolName: string,
  toolDescription: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  testInputs: Record<string, any>,
  testResults: any[],
  debugInstructions: string,
  functionType: string,
  functionCode?: string,
  metadata?: any
): Promise<string> {
  try {
    console.log('🔧 Debugging tool with AI assistance...');
    
    const systemPrompt = `You are an expert AI debugging assistant for data extraction tools. Your job is to analyze test results and provide specific recommendations to fix issues.

Tool Information:
- Name: ${toolName}
- Description: ${toolDescription}  
- Function Type: ${functionType}
- Input Parameters: ${JSON.stringify(inputParameters, null, 2)}
- Tool Metadata: ${metadata ? JSON.stringify(metadata, null, 2) : 'No metadata available'}

CRITICAL: When analyzing Python functions, pay special attention to:
1. Parameter usage - ensure all input parameters are properly utilized
2. Data format compatibility - the output must match the expected schema format
3. Error handling - functions should handle missing or malformed input gracefully
4. String parsing logic - especially for Excel file content with "=== Sheet: [Name] ===" delimiters

You will analyze the test inputs, current results, and user's debug instructions to provide actionable debugging advice.

Provide your response as a detailed analysis with:
1. Issue Analysis: What went wrong based on the user's feedback and test results
2. Root Cause: Why the current results don't match expectations (include technical details)
3. Specific Recommendations: Concrete steps to fix the tool (include code fixes for Python functions)
4. Expected Outcome: What the corrected results should look like

Be specific and actionable in your recommendations, especially for Python code fixes.`;

    let userPrompt = `Debug Analysis Request:

Test Inputs Used:
${JSON.stringify(testInputs, null, 2)}

Current Test Results:
${JSON.stringify(testResults, null, 2)}

User's Debug Instructions:
${debugInstructions}`;

    if (functionCode) {
      userPrompt += `\n\nCurrent Function Code:
${functionCode}`;
    }

    userPrompt += `\n\nPlease analyze the issue and provide specific debugging recommendations.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: userPrompt,
    });

    console.log('Debug analysis response:', response.text);
    return response.text || 'No debugging recommendations available';

  } catch (error) {
    console.error('Debug tool error:', error);
    throw error;
  }
}

export async function generateFunctionCodeFromDebug(
  toolName: string,
  toolDescription: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  functionType: string,
  debugRecommendations: string,
  testInputs: Record<string, any>,
  testResults: any[],
  currentCode?: string
): Promise<{ functionCode: string; metadata: any }> {
  try {
    console.log('🔧 Generating improved function code based on debug recommendations...');
    
    if (functionType === "AI_ONLY") {
      console.log('🤖 Updating AI-only tool prompt based on debug feedback...');
      
      // For AI_ONLY tools, improve the descriptive prompt based on debug recommendations
      const improvedPrompt = `Extract data from the provided document using the following parameters:

Parameters:
${inputParameters.map(p => `- @${p.name} (${p.type}): ${p.description}`).join('\n')}

Tool Description: ${toolDescription}

Debug Improvements Applied:
${debugRecommendations}

Instructions:
- Use all the provided parameters to guide your extraction
- Extract relevant data based on the document content
- Apply the debug improvements to fix previous issues
- Return results in valid JSON format
- Handle missing data gracefully with appropriate status indicators`;

      return {
        functionCode: improvedPrompt,
        metadata: {
          outputFormat: "field_validations_array",
          inputValidation: "AI will validate all input parameters during extraction with improved logic",
          errorHandling: "AI handles missing data gracefully with debug improvements applied",
          parametersUsed: inputParameters.map(p => p.name),
          toolType: "AI_ONLY",
          description: toolDescription,
          debugImprovements: "Applied debug recommendations to improve extraction accuracy"
        }
      };
    } else {
      console.log('🐍 Generating improved Python code based on debug feedback...');
      
      const systemPrompt = `You are an expert Python developer fixing a data extraction function based on debug recommendations.

CRITICAL: The output MUST be exactly compatible with the field_validations database schema format.

Current Function Code:
\`\`\`python
${currentCode || 'No current code available'}
\`\`\`

Debug Analysis and Recommendations:
${debugRecommendations}

Test Inputs That Were Used:
${JSON.stringify(testInputs, null, 2)}

Current Test Results That Need Improvement:
${JSON.stringify(testResults, null, 2)}

IMPROVEMENT REQUIREMENTS:
1. Fix the issues identified in the debug recommendations
2. Maintain compatibility with field_validations schema format
3. Use the exact parameter names: ${inputParameters.map(p => p.name).join(', ')}
4. Improve error handling and validation based on the debug feedback
5. Ensure the function returns accurate results for the test inputs provided

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

Generate an improved Python function that addresses all the issues mentioned in the debug recommendations.`;

      const userPrompt = `Please generate an improved version of the function that fixes the issues identified:

Function Name: ${toolName}
Description: ${toolDescription}
Parameters: ${inputParameters.map(p => `${p.name} (${p.type}): ${p.description}`).join(', ')}

Apply the debug recommendations to create a better, more accurate function.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              functionCode: { type: "string" },
              metadata: { 
                type: "object",
                properties: {
                  outputFormat: { type: "string" },
                  parametersUsed: { 
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            required: ["functionCode", "metadata"]
          }
        },
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: userPrompt }] }
        ]
      });

      console.log('✅ Improved Python function generation completed');
      
      if (!response.text) {
        throw new Error('Empty response from Gemini AI');
      }
      
      const result = JSON.parse(response.text);
      
      if (!result.functionCode || !result.metadata) {
        throw new Error('AI response missing required functionCode or metadata fields');
      }
      
      // Add debug improvement metadata
      result.metadata.debugImprovements = "Applied debug recommendations to fix identified issues";
      
      console.log('🎯 Improved function metadata:', result.metadata);
      return result;
    }
  } catch (error) {
    console.error('❌ Error generating improved function code:', error);
    throw error;
  }
}