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
      
      // Check for data input parameters with sample data
      const dataInputs = inputParameters.filter(p => p.type === 'data' && p.sampleData);
      
      // Special handling for worksheet extraction functions
      if (name.toLowerCase().includes('worksheet') || description.toLowerCase().includes('worksheet')) {
        const worksheetFunctionCode = `def get_worksheet_from_column(column_name_data, excel_file_document):
    results = []
    
    try:
        # Parse the column_name_data if it's in JSON format
        if hasattr(column_name_data, 'get'):
            data_records = column_name_data.get('rows', [])
        elif isinstance(column_name_data, str):
            import json
            try:
                parsed_data = json.loads(column_name_data)
                data_records = parsed_data.get('rows', [])
            except:
                data_records = [{'Column Name': column_name_data}]
        else:
            data_records = [{'Column Name': str(column_name_data)}]
        
        # Process each column name record
        for i, record in enumerate(data_records):
            column_name = record.get('Column Name', '')
            
            worksheet_name = ""
            reasoning = ""
            status = "not_applicable"
            confidence = 70
            
            if excel_file_document and column_name:
                # Split content by sheets using === Sheet: format
                sheets = excel_file_document.split('=== Sheet:')
                
                for sheet_section in sheets[1:]:
                    lines = sheet_section.strip().split('\\n')
                    if lines:
                        sheet_name_line = lines[0].strip()
                        sheet_name = sheet_name_line.split('===')[0].strip()
                        
                        if len(lines) > 1:
                            headers_line = lines[1]
                            headers = headers_line.split('\\t')
                            
                            for header in headers:
                                if header.strip() == column_name or column_name in header:
                                    worksheet_name = sheet_name
                                    reasoning = f"Found column '{column_name}' in worksheet '{sheet_name}'"
                                    status = "valid"
                                    confidence = 95
                                    break
                            
                            if worksheet_name:
                                break
                
                if not worksheet_name:
                    reasoning = f"Column '{column_name}' not found in any worksheet"
                    status = "invalid"
                    confidence = 60
            else:
                reasoning = "Missing column name or Excel content"
                status = "invalid"
                confidence = 0
            
            results.append({
                "extractedValue": worksheet_name,
                "validationStatus": status,
                "aiReasoning": reasoning,
                "confidenceScore": confidence,
                "documentSource": "input"
            })
    
    except Exception as e:
        results.append({
            "extractedValue": "",
            "validationStatus": "error",
            "aiReasoning": f"Function execution error: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "error"
        })
    
    return results`;

        return {
          functionCode: worksheetFunctionCode,
          metadata: {
            outputFormat: "field_validations_array",
            inputValidation: "Validates column names against Excel content",
            errorHandling: "Handles missing data and parsing errors gracefully",
            parametersUsed: inputParameters.map(p => p.name),
            toolType: "WORKSHEET_EXTRACTION",
            description: description
          }
        };
      }

      // Generate Python script with field_validations compatibility
      const systemPrompt = `You are an expert Python developer creating data extraction functions for the extrapl platform.
Generate a Python function that processes data and outputs to the field_validations database schema.

CRITICAL: The output MUST be exactly compatible with the field_validations database schema format.

This function is designed to create: ${outputType === "single" ? "MAIN SCHEMA FIELDS (single values)" : "COLLECTION PROPERTIES (multiple records)"}

${outputType === "multiple" ? `
ITERATION REQUIREMENTS FOR MULTIPLE OUTPUT:
- MUST create a 'for each' loop when outputType is 'multiple'
- Data input parameters are provided as arrays of objects with this exact schema:
  [
    {"Identifier": "Value", "Prop 1": "Value", "Prop 2": "Value"},
    {"Identifier": "Value2", "Prop 1": "Value2", "Prop 2": "Value2"}
  ]
- The first property in each object is ALWAYS the IDENTIFIER - this is the main property to process in each iteration
- Each iteration should process one record from the data array and generate appropriate field validation results
- Use the identifier as the primary key for each extraction result
` : ''}

EXCEL DOCUMENT FORMAT:
Excel documents are ALWAYS provided in this exact format from extrapl's document extraction:

=== Sheet: SheetName1 ===
Column1 Column2 Column3 Column4
Value1  Value2  Value3  Value4
Value5  Value6  Value7  Value8

=== Sheet: SheetName2 ===
ColA    ColB    ColC
DataA   DataB   DataC

IMPORTANT: 
- Excel content is tab-separated (\t) values
- Sheet names are marked with "=== Sheet: SheetName ===" 
- First line after sheet marker is headers
- Subsequent lines are data rows
- Do NOT expect Excel cell references (A1, B2) - work with this text format
- Do NOT use pandas, openpyxl, or document parsing libraries - process the string content directly

Requirements:
- Function must be named "extract_function"
- Must accept parameters based on the user-defined input parameters: ${inputParameters.map(p => p.name).join(', ')}
- CRITICAL: All input parameters are either STRING VALUES (document content) or ARRAYS OF OBJECTS (data inputs)
- Document parameters contain pre-processed text content in the exact Excel format shown above
- Data parameters are arrays of objects where first property is the identifier
- Must use ALL input parameters defined by the user: ${inputParameters.map(p => `@${p.name}`).join(', ')}
- Must output data compatible with field_validations schema (array of objects)
- Must handle errors gracefully and return valid JSON
- Must include comprehensive error handling for all edge cases
- Function should be fully self-contained and executable
- ${outputType === "single" ? "Design for extracting single values that will become main schema fields" : "Design for extracting multiple records that will populate a collection"}
${aiAssistanceRequired ? '- Must include AI assistance as the final step using the provided prompt' : ''}

${dataInputs.length > 0 ? `
DATA INPUT PARAMETERS WITH SAMPLE DATA:
${dataInputs.map(p => `
Parameter: ${p.name}
Sample Data Schema: Array of objects where first property is the identifier
Sample Records: ${JSON.stringify(p.sampleData?.rows || [], null, 2)}
Identifier Property: ${p.sampleData?.columns?.[0] || 'N/A'}
`).join('\n')}
` : ''}

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
      
      // Simplified prompt for better reliability
      const userPrompt = `Generate a Python function named "extract_function" for: ${name}

Description: ${description}

Function signature: def extract_function(${inputParameters.map(p => p.name.replace(/\s+/g, '_')).join(', ')}):

Parameters (all are STRING values):
${inputParameters.map(p => `- ${p.name.replace(/\s+/g, '_')}: ${p.description}`).join('\n')}

Output Type: ${outputType === "multiple" ? "Multiple records" : "Single values"}

Requirements:
1. Function processes STRING input parameters (pre-extracted document content)
2. Returns array of objects in field_validations format:
   [{"extractedValue": "value", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 85, "documentSource": "input"}]
3. Use standard Python libraries only (re, json, etc.)
4. Handle errors gracefully

Return JSON with functionCode and metadata fields.`;

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