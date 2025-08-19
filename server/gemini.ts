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
  console.log('*** FUNCTION ENTRY TEST ***');
  try {
    console.log('🚀 ========== GENERATE FUNCTION CODE CALLED ==========');
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
    console.log('🔍 Raw inputParameters:', JSON.stringify(inputParameters, null, 2));

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
      
      // Get the enhanced Excel function generator prompt with full training
      const systemPrompt = `You are an expert Python developer. You MUST create a function with this EXACT signature:
def extract_function(Column_Name, Excel_File):

CRITICAL EXCEL DOCUMENT FORMAT TRAINING:

EXCEL FILE FORMAT IN THIS SYSTEM:
Excel files are NOT provided as file paths or pandas-compatible files. Instead, they are provided as TEXT STRINGS with this exact format:

=== Sheet: SheetName1 ===
Column1 Column2 Column3 Column4
value1  value2  value3  value4
value5  value6  value7  value8

=== Sheet: SheetName2 ===  
HeaderA HeaderB HeaderC
dataA1  dataB1  dataC1
dataA2  dataB2  dataC2

MANDATORY EXCEL PARSING RULES:
1. NEVER use pandas.ExcelFile() or pd.read_excel() - the input is a TEXT STRING, not a file path
2. Parse sheets using the delimiter pattern: === Sheet: SheetName ===
3. Split sheet content by newlines to get rows
4. Split each row by tab character \\t to get columns
5. First row after sheet delimiter is the header row with column names
6. Use regular expressions or string splitting for parsing

CORRECT EXCEL PARSING EXAMPLE:
import re

def parse_excel_text(excel_text):
    # Split by sheet delimiter, keeping sheet names
    sheets_data = re.split(r'===\\s*Sheet:\\s*(.*?)\\s*===', excel_text)
    sheets = {}
    
    # Process pairs of sheet_name, sheet_content
    for i in range(1, len(sheets_data), 2):
        sheet_name = sheets_data[i].strip()
        sheet_content = sheets_data[i+1].strip()
        
        if sheet_content:
            # Split into rows and get headers
            rows = sheet_content.split('\\n')
            headers = [h.strip() for h in rows[0].split('\\t')] if rows else []
            sheets[sheet_name] = {
                'headers': headers,
                'rows': rows[1:] if len(rows) > 1 else []
            }
    
    return sheets

FUNCTION SIGNATURE REQUIREMENT:
def extract_function(Column_Name, Excel_File):
    
    # NEW DATA SCHEMA: Column_Name comes as array of objects with identifierId and name
    # Example: [{"identifierId": 1, "name": "Annual Pre-6.4.1988 GMP Component"}, {"identifierId": 2, "name": "Date Of Birth"}]
    
    # CRITICAL: Always iterate through Column_Name array and extract the 'name' field:
    results = []
    
    for column_item in Column_Name:
        # Handle new schema format with identifierId and name properties
        if isinstance(column_item, dict):
            column_name = column_item.get("name", "")
            identifier_id = column_item.get("identifierId", 0)
        else:
            # Fallback for legacy string format
            column_name = str(column_item)
            identifier_id = 0
        
        # Your extraction logic here using column_name
        # Return result object with reference to original column_item
        result = {
            "extractedValue": "your_extracted_value_here",
            "validationStatus": "valid",
            "aiReasoning": f"Processing column '{column_name}'",
            "confidenceScore": 1.0,
            "documentSource": column_item  # Reference the original input
        }
        results.append(result)
    
    # Parse Excel text content (NOT a file path!)  
    sheets = parse_excel_text(Excel_File)
    
    return results  # Return the list of result objects

COMMON MISTAKES TO AVOID:
❌ Using pandas.ExcelFile(Excel_File) - will fail because Excel_File is text, not file path
❌ Trying to read Excel_File as a file - it's a string with sheet delimiters
❌ Expecting .xlsx/.xls file format - it's already converted to text with === delimiters
❌ Not handling the specific === Sheet: Name === delimiter format
❌ Not splitting by tab characters for column separation

CRITICAL REQUIREMENTS:
1. Function name MUST be "extract_function"  
2. Parameters MUST be exactly: Column_Name, Excel_File
3. OUTPUT TYPE = "${(outputType || 'single').toUpperCase()}"

${(outputType || 'single') === 'multiple' ? `
MULTIPLE OUTPUTS - MUST ITERATE:
- Use for loop to process array parameter
- Generate multiple results (one per array item)
- Return list of result objects
` : `
SINGLE OUTPUT - NO ITERATION:
- Process parameters as whole
- Generate one result only
- Return single result in array
`}

PARAMETER DETAILS:
${inputParameters.map(p => {
  if (p.type === 'data' && (p as any).sampleData?.rows) {
    const sampleRows = (p as any).sampleData.rows;
    
    // NEW SCHEMA FORMAT TRAINING - Data comes as array with identifierId and name properties
    const exampleData = sampleRows.map((row, index) => {
      const firstColumnName = Object.keys(row)[0] || 'Column Name';
      return {
        identifierId: index + 1,
        name: row[firstColumnName] || `Example ${index + 1}`
      };
    });
    
    return `Column_Name: Contains data from "${p.name}" - NEW SCHEMA FORMAT: Array of objects with identifierId and name properties.
    Format: ${JSON.stringify(exampleData)}
    
    CRITICAL: Column_Name parameter will be provided as array of objects like:
    [{"identifierId": 1, "name": "Column Name 1"}, {"identifierId": 2, "name": "Column Name 2"}]
    
    To process this data:
    - Use for loop to iterate: for column_item in Column_Name:
    - Extract name: column_name = column_item.get("name", "")
    - Use identifierId for tracking: identifier_id = column_item.get("identifierId", 0)`;
  } else if (p.type === 'document') {
    return `Excel_File: Contains document data from "${p.name}" - String with Excel format "=== Sheet: Name ===" followed by data`;
  }
  return `Column_Name/Excel_File: Contains ${p.type} data from "${p.name}"`;
}).join('\n')}

RETURN FORMAT: List of objects with keys: extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource

Return JSON: {"functionCode": "complete_function_code", "metadata": {"parametersUsed": [${inputParameters.map(p => `"${p.name}"`).join(', ')}]}}`;

      const userPrompt = `Generate function: ${name}
Description: ${description}

Requirements:
- Function signature: def extract_function(Column_Name, Excel_File)
- ${(outputType || 'single') === 'multiple' ? 'Iterate through Column_Name array parameter to generate multiple results' : 'Process Column_Name input to generate single result'}
- Use Python syntax: None (not null), True/False (not true/false)
- Handle errors gracefully
- Return proper field validation format`;

      console.log('*** BEFORE PROMPT LOGGING ***');
      console.log('🤖 FULL AI PROMPT BEING SENT TO GEMINI:');
      console.log('='.repeat(80));
      console.log('SYSTEM PROMPT:');
      console.log(systemPrompt);
      console.log('='.repeat(80));
      console.log('USER PROMPT:');
      console.log(userPrompt);
      console.log('='.repeat(80));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      console.log('🤖 GEMINI AI RESPONSE:');
      console.log('='.repeat(80));
      console.log('Raw response text:');
      console.log(response.text);
      console.log('='.repeat(80));
      console.log('Full response object:');
      console.log(JSON.stringify(response, null, 2));
      console.log('='.repeat(80));
      
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
      
      console.log('🎯 Generated Python function metadata:', result.metadata);
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

CRITICAL EXCEL DOCUMENT FORMAT TRAINING:

EXCEL FILE FORMAT IN THIS SYSTEM:
Excel files are NOT provided as file paths or pandas-compatible files. Instead, they are provided as TEXT STRINGS with this exact format:

=== Sheet: SheetName1 ===
Column1 Column2 Column3 Column4
value1  value2  value3  value4
value5  value6  value7  value8

=== Sheet: SheetName2 ===  
HeaderA HeaderB HeaderC
dataA1  dataB1  dataC1
dataA2  dataB2  dataC2

MANDATORY EXCEL PARSING RULES:
1. NEVER use pandas.ExcelFile() or pd.read_excel() - the input is a TEXT STRING, not a file path
2. Parse sheets using the delimiter pattern: === Sheet: SheetName ===
3. Split sheet content by newlines to get rows
4. Split each row by tab character \\t to get columns
5. First row after sheet delimiter is the header row with column names
6. Use regular expressions or string splitting for parsing

CORRECT EXCEL PARSING EXAMPLE:
import re

def parse_excel_text(excel_text):
    # Split by sheet delimiter, keeping sheet names
    sheets_data = re.split(r'===\\s*Sheet:\\s*(.*?)\\s*===', excel_text)
    sheets = {}
    
    # Process pairs of sheet_name, sheet_content
    for i in range(1, len(sheets_data), 2):
        sheet_name = sheets_data[i].strip()
        sheet_content = sheets_data[i+1].strip()
        
        if sheet_content:
            # Split into rows and get headers
            rows = sheet_content.split('\\n')
            headers = [h.strip() for h in rows[0].split('\\t')] if rows else []
            sheets[sheet_name] = {
                'headers': headers,
                'rows': rows[1:] if len(rows) > 1 else []
            }
    
    return sheets

COMMON MISTAKES TO AVOID:
❌ Using pandas.ExcelFile(Excel_File) - will fail because Excel_File is text, not file path
❌ Trying to read Excel_File as a file - it's a string with sheet delimiters
❌ Expecting .xlsx/.xls file format - it's already converted to text with === delimiters
❌ Not handling the specific === Sheet: Name === delimiter format
❌ Not splitting by tab characters for column separation

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
1. Fix the issues identified in the debug recommendations (especially pandas usage)
2. Maintain compatibility with field_validations schema format
3. Use the exact parameter names: ${inputParameters.map(p => p.name).join(', ')}
4. Improve error handling and validation based on the debug feedback
5. Ensure the function returns accurate results for the test inputs provided
6. MUST use text parsing instead of pandas for Excel data

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

Generate an improved Python function that addresses all the issues mentioned in the debug recommendations, especially replacing pandas usage with proper text parsing.`;

      const userPrompt = `Please generate an improved version of the function that fixes the issues identified:

Function Name: ${toolName}
Description: ${toolDescription}
Parameters: ${inputParameters.map(p => `${p.name} (${p.type}): ${p.description}`).join(', ')}

Apply the debug recommendations to create a better, more accurate function.`;

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