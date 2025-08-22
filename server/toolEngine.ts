// Unified Tool Engine - Simple 2-Branch Architecture
import { GoogleGenAI } from "@google/genai";
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const genAI = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "" 
});

export interface ToolResult {
  extractedValue: any;
  validationStatus: "valid" | "invalid";
  aiReasoning: string;
  confidenceScore: number;
  documentSource: string;
}

export interface ToolParameter {
  id: string;
  name: string;
  type: string;
  description: string;
  sampleFile?: string;
  sampleFileURL?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  toolType: "AI_ONLY" | "CODE";
  inputParameters: ToolParameter[];
  functionCode?: string;
  aiPrompt?: string;
  outputType?: "single" | "multiple";
  llmModel?: string;
  metadata?: Record<string, any>;
}

export class ToolEngine {
  
  /**
   * Fetch document content from URL using ObjectStorageService
   */
  private async fetchDocumentContent(url: string): Promise<string> {
    try {
      // Parse the URL to get bucket and object name
      const urlParts = new URL(url);
      const pathParts = urlParts.pathname.split('/');
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join('/');
      
      console.log(`📦 Fetching from bucket: ${bucketName}, object: ${objectName}`);
      
      // Use ObjectStorageService to fetch the file
      const { objectStorageClient } = await import("./objectStorage");
      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      
      // Check if file exists
      const [exists] = await objectFile.exists();
      if (!exists) {
        throw new Error(`File not found in storage: ${objectName}`);
      }
      
      // Stream the file content to a buffer
      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const fileBuffer = Buffer.concat(chunks);
      return fileBuffer.toString('base64');
    } catch (error) {
      console.error('Error fetching document from storage:', error);
      throw error;
    }
  }
  
  /**
   * Prepare inputs by fetching document content for document-type parameters
   */
  private async prepareInputs(tool: Tool, rawInputs: Record<string, any>, forAI: boolean = false): Promise<Record<string, any>> {
    const preparedInputs: Record<string, any> = {};
    // Import dependencies once at the start
    const { db } = await import('./db');
    const { sampleDocuments } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    for (const param of tool.inputParameters) {
      // Try to get input value by parameter ID first, then by name
      const paramId = (param as any).id || param.name;
      const inputValue = rawInputs[paramId] || rawInputs[param.name];
      
      // If this is a document parameter, check for extracted content first
      if (param.type === 'document' && inputValue) {
        try {
          // Check if inputValue is an array of knowledge document IDs
          if (Array.isArray(inputValue) && inputValue.length > 0) {
            // Check if these are knowledge document IDs
            const firstValue = inputValue[0];
            if (typeof firstValue === 'string' && firstValue.length === 36) { // UUID check
              console.log(`📚 Fetching knowledge document content for ${param.name}`);
              
              // Import knowledge documents schema
              const { knowledgeDocuments } = await import('@shared/schema');
              const { inArray } = await import('drizzle-orm');
              
              // Fetch knowledge documents by IDs
              const knowledgeDocs = await db
                .select()
                .from(knowledgeDocuments)
                .where(inArray(knowledgeDocuments.id, inputValue));
              
              if (knowledgeDocs.length > 0) {
                // Combine content from all selected knowledge documents
                const combinedContent = knowledgeDocs
                  .map(doc => `=== ${doc.title} ===\n${doc.content || 'No content'}`)
                  .join('\n\n');
                
                console.log(`📄 Using knowledge document content for ${param.name} (${combinedContent.length} chars)`);
                preparedInputs[param.name] = combinedContent;
              } else {
                console.log(`⚠️ No knowledge documents found for IDs: ${inputValue.join(', ')}`);
                preparedInputs[param.name] = '';
              }
            } else {
              // Not knowledge document IDs, treat as regular input
              preparedInputs[param.name] = inputValue;
            }
          } else {
            // Single value or empty, check sample_documents table for pre-extracted content
            const [sampleDoc] = await db
              .select()
              .from(sampleDocuments)
              .where(
                and(
                  eq(sampleDocuments.functionId, tool.id),
                  eq(sampleDocuments.parameterName, param.name)
                )
              );
            
            if (sampleDoc?.extractedContent) {
              console.log(`📄 Using pre-extracted content for ${param.name} (${sampleDoc.extractedContent.length} chars)`);
              preparedInputs[param.name] = sampleDoc.extractedContent;
            } else if (tool.metadata?.sampleDocumentContent?.[param.name]) {
              // Fallback to metadata if available
              const extractedContent = tool.metadata.sampleDocumentContent[param.name];
              console.log(`📄 Using pre-extracted content from metadata for ${param.name} (${extractedContent.length} chars)`);
              preparedInputs[param.name] = extractedContent;
            } else if (param.sampleFileURL) {
              // Fallback: fetch and extract content if not already stored
              console.log(`⚠️ No pre-extracted content found for ${param.name}, attempting to extract now...`);
              
              try {
                // Extract content using document_extractor.py
                const { ObjectStorageService, objectStorageClient } = await import("./objectStorage");
                const urlParts = new URL(param.sampleFileURL);
                const pathParts = urlParts.pathname.split('/');
                const bucketName = pathParts[1];
                const objectName = pathParts.slice(2).join('/');
                
                const bucket = objectStorageClient.bucket(bucketName);
                const objectFile = bucket.file(objectName);
              
                const chunks: Buffer[] = [];
                const stream = objectFile.createReadStream();
                
                await new Promise((resolve, reject) => {
                  stream.on('data', (chunk) => chunks.push(chunk));
                  stream.on('end', resolve);
                  stream.on('error', reject);
                });
                
                const fileBuffer = Buffer.concat(chunks);
                const [fileMetadata] = await objectFile.getMetadata();
                const mimeType = fileMetadata.contentType || 'application/octet-stream';
                const base64Content = fileBuffer.toString('base64');
                const dataURL = `data:${mimeType};base64,${base64Content}`;
              
                // Extract text content using document_extractor.py
                const extractionData = {
                  step: "extract_text_only",
                  documents: [{
                    fileName: param.sampleFile || 'document',
                    mimeType: mimeType,
                    dataURL: dataURL
                  }]
                };
                
                const { spawn } = await import('child_process');
                const python = spawn('python3', ['document_extractor.py']);
                
                python.stdin.write(JSON.stringify(extractionData));
                python.stdin.end();
                
                let output = '';
                let error = '';
                
                await new Promise((resolve, reject) => {
                  python.stdout.on('data', (data: any) => {
                    output += data.toString();
                  });
                  
                  python.stderr.on('data', (data: any) => {
                    error += data.toString();
                  });
                  
                  python.on('close', (code: any) => {
                    if (code !== 0) {
                      console.error('Document extraction error:', error);
                      reject(new Error(error));
                    } else {
                      resolve(undefined);
                    }
                  });
                });
                
                const result = JSON.parse(output);
                // Handle both response formats
                let extractedText = '';
                if (result.extracted_texts && result.extracted_texts[0]) {
                  extractedText = result.extracted_texts[0].text_content || '';
                } else if (result.text_content) {
                  extractedText = result.text_content;
                }
                
                console.log(`✅ Extracted ${extractedText.length} characters from ${param.sampleFile}`);
                preparedInputs[param.name] = extractedText;
              
                // Save the extracted content to sample_documents table for future use
                if (extractedText) {
                  try {
                    
                    // Check if sample document already exists
                    const [existingDoc] = await db
                      .select()
                      .from(sampleDocuments)
                      .where(
                        and(
                          eq(sampleDocuments.functionId, tool.id),
                          eq(sampleDocuments.parameterName, param.name)
                        )
                      );
                    
                    if (existingDoc) {
                      // Update existing document with extracted content
                      await db
                        .update(sampleDocuments)
                        .set({
                          extractedContent: extractedText,
                          updatedAt: new Date()
                        })
                        .where(eq(sampleDocuments.id, existingDoc.id));
                      console.log(`📝 Updated sample document with extracted content`);
                    } else {
                      // Create new sample document with extracted content
                      await db
                        .insert(sampleDocuments)
                        .values({
                          functionId: tool.id,
                          parameterName: param.name,
                          fileName: param.sampleFile || 'document',
                          fileURL: param.sampleFileURL || '',
                          extractedContent: extractedText
                        });
                      console.log(`📝 Created sample document with extracted content`);
                    }
                  } catch (saveError) {
                    console.error('Failed to save extracted content:', saveError);
                  }
                }
                
              } catch (extractError) {
                console.error(`Failed to extract content from ${param.sampleFile}:`, extractError);
                // Last resort fallback
                preparedInputs[param.name] = `[Failed to extract content from ${param.sampleFile}]`;
              }
            } else {
              preparedInputs[param.name] = inputValue;
            }
          }
        } catch (error) {
          console.error(`Failed to prepare document for ${param.name}:`, error);
          preparedInputs[param.name] = inputValue; // Fall back to original value
        }
      } else {
        preparedInputs[param.name] = inputValue;
      }
    }
    
    return preparedInputs;
  }
  
  /**
   * Generate tool content (AI prompt or Python code)
   */
  async generateToolContent(tool: Omit<Tool, 'id' | 'functionCode' | 'aiPrompt'>): Promise<{ content: string }> {
    const prompt = this.buildGenerationPrompt(tool);
    
    console.log('🤖 GEMINI AI PROMPT FOR TOOL GENERATION');
    console.log('='.repeat(80));
    console.log('📝 Tool Type:', tool.toolType);
    console.log('📝 Tool Name:', tool.name);
    console.log('📝 Tool Description:', tool.description);
    console.log('📝 Input Parameters:', tool.inputParameters.map(p => `${p.name} (${p.type})`).join(', '));
    console.log('');
    console.log('🎯 FULL PROMPT SENT TO GEMINI:');
    console.log('-'.repeat(80));
    console.log(prompt);
    console.log('-'.repeat(80));
    console.log('');
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    
    let content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log('🎉 GEMINI RESPONSE:');
    console.log('-'.repeat(80));
    console.log(content);
    console.log('-'.repeat(80));
    console.log('');
    
    // Clean markdown code blocks for Python code
    if (tool.toolType === 'CODE') {
      // Handle markdown-wrapped Python code
      if (content.includes('```python')) {
        const pythonMatch = content.match(/```python\s*([\s\S]*?)\s*```/);
        if (pythonMatch) {
          content = pythonMatch[1].trim();
        }
      } else if (content.includes('```')) {
        // Handle generic code blocks
        const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          content = codeMatch[1].trim();
        }
      }
      console.log('🧹 CLEANED PYTHON CODE (removed markdown):');
      console.log('-'.repeat(80));
      console.log(content);
      console.log('-'.repeat(80));
    }
    
    return { content };
  }
  
  /**
   * Test tool with given inputs
   */
  async testTool(tool: Tool, inputs: Record<string, any>): Promise<ToolResult[]> {
    // Prepare inputs by fetching document content if needed
    const forAI = tool.toolType === "AI_ONLY";
    const preparedInputs = await this.prepareInputs(tool, inputs, forAI);
    
    if (tool.toolType === "AI_ONLY") {
      return this.testAITool(tool, preparedInputs);
    } else {
      return this.testCodeTool(tool, preparedInputs);
    }
  }
  
  /**
   * Test AI-based tool
   */
  private async testAITool(tool: Tool, inputs: Record<string, any>): Promise<ToolResult[]> {
    try {
      // Check if we need to batch large arrays
      const dataInputs = Object.entries(inputs).filter(([key, value]) => {
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        return param?.type === 'data' && Array.isArray(value);
      });
      
      // If we have large arrays, process in batches
      if (dataInputs.length > 0 && tool.outputType === 'multiple') {
        const [dataKey, dataArray] = dataInputs[0];
        if (Array.isArray(dataArray) && dataArray.length > 20) {
          console.log(`📦 Large array detected (${dataArray.length} items). Processing in batches...`);
          
          const BATCH_SIZE = 20; // Process 20 items at a time
          const allResults: ToolResult[] = [];
          
          for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
            const batch = dataArray.slice(i, Math.min(i + BATCH_SIZE, dataArray.length));
            const batchEnd = Math.min(i + BATCH_SIZE, dataArray.length);
            console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: items ${i + 1}-${batchEnd} of ${dataArray.length}`);
            
            // Create inputs for this batch
            const batchInputs = { ...inputs };
            batchInputs[dataKey] = batch;
            
            // Process batch
            const batchPrompt = this.buildTestPrompt(tool, batchInputs);
            
            const response = await genAI.models.generateContent({
              model: tool.llmModel || "gemini-2.0-flash",
              contents: batchPrompt
            });
            
            let batchResult = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            // Clean and parse batch results
            if (batchResult.includes('```json')) {
              const jsonMatch = batchResult.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                batchResult = jsonMatch[1].trim();
              }
            }
            
            try {
              const parsed = JSON.parse(batchResult);
              const results = Array.isArray(parsed) ? parsed : [parsed];
              allResults.push(...results);
              console.log(`    ✅ Batch processed: ${results.length} results`);
            } catch (e) {
              console.error(`    ❌ Failed to parse batch results:`, e);
              // Add placeholder results for failed batch
              for (let j = 0; j < batch.length; j++) {
                allResults.push({
                  extractedValue: "Processing Error",
                  validationStatus: "invalid",
                  aiReasoning: "Failed to process this item in batch",
                  confidenceScore: 0,
                  documentSource: "ERROR"
                });
              }
            }
          }
          
          console.log(`✅ All batches complete. Total results: ${allResults.length}`);
          return allResults;
        }
      }
      
      // Normal processing for small arrays or non-array inputs
      const prompt = this.buildTestPrompt(tool, inputs);
      
      console.log('🧪 GEMINI AI PROMPT FOR TOOL TESTING');
      console.log('='.repeat(80));
      console.log('📝 Tool Name:', tool.name);
      console.log('📝 Tool AI Prompt:', tool.aiPrompt);
      console.log('📝 Test Inputs:', JSON.stringify(inputs, null, 2).slice(0, 1000) + '...');
      console.log('');
      console.log('🎯 FULL TEST PROMPT SENT TO GEMINI:');
      console.log('-'.repeat(80));
      console.log(prompt.slice(0, 2000) + '...');
      console.log('-'.repeat(80));
      console.log('');
      
      // Use the tool's configured llmModel, not from inputs
      const llmModel = tool.llmModel || "gemini-2.0-flash";
      console.log('🤖 Using LLM Model from tool configuration:', llmModel);
      
      const response = await genAI.models.generateContent({
        model: llmModel,
        contents: prompt
      });
      
      let result = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log('🎉 GEMINI TEST RESPONSE:');
      console.log('-'.repeat(80));
      console.log(result.slice(0, 1000) + '...');
      console.log('-'.repeat(80));
      console.log('');
      
      // Clean markdown if present
      if (result.includes('```json')) {
        // Extract JSON content between markdown blocks
        const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          result = jsonMatch[1].trim();
        }
      } else if (result.includes('```')) {
        // Handle generic code blocks
        const codeMatch = result.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          result = codeMatch[1].trim();
        }
      }
      
      console.log('🧹 CLEANED TEST RESULT:');
      console.log('-'.repeat(80));
      console.log(result);
      console.log('-'.repeat(80));
      
      const parsed = JSON.parse(result);
      let results = Array.isArray(parsed) ? parsed : [parsed];
      
      // Check if we have data type parameters with arrays
      const dataInputs = Object.entries(inputs).filter(([key, value]) => {
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        return param?.type === 'data' && Array.isArray(value);
      });
      
      if (dataInputs.length > 0 && tool.outputType === 'multiple') {
        const expectedCount = dataInputs.reduce((sum, [, value]) => 
          sum + (Array.isArray(value) ? value.length : 0), 0);
        
        console.log(`⚠️ Expected ${expectedCount} results, got ${results.length}`);
        
        // If we got fewer results than expected, pad with "Not Found" entries
        if (results.length < expectedCount) {
          console.log(`📝 Padding results to match expected count of ${expectedCount}`);
          while (results.length < expectedCount) {
            results.push({
              extractedValue: "Not Found",
              validationStatus: "invalid",
              aiReasoning: "Result not provided by AI - item may have been skipped",
              confidenceScore: 0,
              documentSource: "Missing"
            });
          }
        }
      }
      
      return results;
      
    } catch (error) {
      return [{
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: `AI processing failed: ${error instanceof Error ? error.message : String(error)}`,
        confidenceScore: 0,
        documentSource: "AI_ERROR"
      }];
    }
  }
  
  /**
   * Test code-based tool
   */
  private async testCodeTool(tool: Tool, inputs: Record<string, any>): Promise<ToolResult[]> {
    try {
      if (!tool.functionCode) {
        throw new Error('Function code not found');
      }
      
      // Write function to temporary file to avoid string escaping issues
      const tempDir = '/tmp';
      const tempFile = path.join(tempDir, `test_function_${Date.now()}.py`);
      
      const testScript = this.buildCodeTestScript(tool, inputs);
      await fs.writeFile(tempFile, testScript);
      
      try {
        const result = await this.executePythonFile(tempFile);
        await fs.unlink(tempFile); // Clean up
        return result;
      } catch (error) {
        await fs.unlink(tempFile).catch(() => {}); // Clean up on error
        throw error;
      }
      
    } catch (error) {
      return [{
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: `Code execution failed: ${error instanceof Error ? error.message : String(error)}`,
        confidenceScore: 0,
        documentSource: "CODE_ERROR"
      }];
    }
  }
  
  /**
   * Build generation prompt for AI/CODE tools
   */
  private buildGenerationPrompt(tool: Omit<Tool, 'id' | 'functionCode' | 'aiPrompt'>): string {
    const paramList = tool.inputParameters.map(p => `- ${p.name} (${p.type}): ${p.description}`).join('\n');
    
    if (tool.toolType === "AI_ONLY") {
      // Generate appropriate JSON format based on outputType
      const jsonFormat = tool.outputType === "single" 
        ? `{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "source"}`
        : `[{"extractedValue": "result1", "validationStatus": "valid", "aiReasoning": "explanation1", "confidenceScore": 95, "documentSource": "source1"}, {"extractedValue": "result2", "validationStatus": "valid", "aiReasoning": "explanation2", "confidenceScore": 90, "documentSource": "source2"}]`;
      
      const resultDescription = tool.outputType === "single"
        ? "Return the result as a single JSON object"
        : "Return results as a JSON array of objects";
      
      return `Create an AI prompt for the following task:

Task: ${tool.name}
Description: ${tool.description}
Output Type: ${tool.outputType === "single" ? "SINGLE RESULT" : "MULTIPLE RESULTS"}
Input Parameters:
${paramList}

CRITICAL REQUIREMENT:
${tool.outputType === "single" 
  ? "The prompt MUST instruct to return a SINGLE JSON OBJECT (not an array). Example format:\n" + jsonFormat
  : "The prompt MUST instruct to return a JSON ARRAY of objects. Example format:\n" + jsonFormat}

Create a detailed, specific prompt that:
1. References input parameters using backticks like \`${tool.inputParameters.map(p => p.name).join('\`, \`')}\`
2. ${tool.outputType === "single" 
     ? "Clearly states to return ONE JSON OBJECT with these keys: extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource"
     : "Clearly states to return a JSON ARRAY of objects, each with these keys: extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource"}
3. Explains what each field means:
   - extractedValue: The actual extracted data
   - validationStatus: "valid" or "invalid" based on confidence
   - aiReasoning: Explanation of extraction logic
   - confidenceScore: 0-100 confidence level
   - documentSource: Source document/page reference
4. ${tool.outputType === "single"
     ? "Emphasizes returning ONLY ONE OBJECT, not an array"
     : "Specifies to return multiple items as an array"}

Return only the prompt text, no explanations.`;
    } else {
      // Build Excel structure training - using standard extracted content format
      let excelTraining = '';
      const docParams = tool.inputParameters.filter(p => p.type === 'document');
      if (docParams.length > 0) {
        // Standard extracted content format for all Excel files
        excelTraining = `
EXCEL FILE PROCESSING INFORMATION:
All Excel files are pre-processed and extracted into a standard text format:
- The extraction preserves the table structure with headers and rows
- Column headers are in the first line, separated by delimiters
- Data rows follow, with values aligned to their respective columns
- Empty cells are preserved as empty positions
- All worksheets are extracted and labeled

STANDARD EXTRACTED CONTENT FORMAT:
The Excel content is provided as structured text like this:
"""
Worksheet: Sheet1
Row 1: Column1 | Column2 | Column3 | Column4 ...
Row 2: Value1  | Value2  | Value3  | Value4 ...
Row 3: Value1  | Value2  | Value3  | Value4 ...
...
"""

WORKING WITH EXCEL FILES:
When processing Excel files with openpyxl:
1. Use openpyxl.load_workbook(filename, data_only=True) to get calculated values
2. Access the active sheet with workbook.active or iterate through workbook.worksheets
3. Get headers from the first row: sheet[1] or sheet.iter_rows(min_row=1, max_row=1)
4. Iterate data rows starting from row 2: sheet.iter_rows(min_row=2)
5. Access cells by: cell.value (for the data), cell.row, cell.column, cell.column_letter
6. Handle None/empty cells gracefully - they are common

FINDING SPECIFIC DATA:
- To find a column: iterate headers and match by name (exact or normalized)
- To find a row: iterate rows and check key column values
- Use string normalization: str(value).strip().lower() for matching
- Check for partial matches if exact match fails

RETURN FORMAT REQUIREMENTS:
Every extracted item MUST be returned as a field validation object:
{
  "extractedValue": <the actual data value>,
  "validationStatus": "valid" or "invalid",
  "aiReasoning": <brief explanation of extraction>,
  "confidenceScore": <0-100 confidence level>,
  "documentSource": <reference like "Sheet1, Row X, Column Y">
}

Return an array of these objects: [object1, object2, ...]
`;
      }

      return `Create a Python function for the following task:

Task: ${tool.name}  
Description: ${tool.description}
Input Parameters:
${paramList}
${excelTraining}
Requirements:
- Use only standard Python libraries (no pandas)
- Handle Excel files with openpyxl if needed
- Return a JSON array of field validation objects
- Each object must have these exact fields:
  * extractedValue: The extracted data value
  * validationStatus: "valid" or "invalid" 
  * aiReasoning: Brief explanation of the extraction
  * confidenceScore: Number between 0-100
  * documentSource: Source document/location reference
- Include proper error handling
- Function should be self-contained
- Example return format: [{"extractedValue": "Column1", "validationStatus": "valid", "aiReasoning": "Extracted from first row", "confidenceScore": 100, "documentSource": "Row 1, Column A"}]

Return only the Python function code, no explanations.`;
    }
  }
  
  /**
   * Build test prompt for AI tools
   */
  private buildTestPrompt(tool: Tool, inputs: Record<string, any>): string {
    const aiPrompt = tool.aiPrompt || tool.description;
    
    // Format inputs properly, handling data arrays specially
    const formattedInputs = Object.entries(inputs).map(([key, value]) => {
      // Find the parameter definition by ID or name
      const param = tool.inputParameters.find(p => p.id === key || p.name === key);
      
      if (param?.type === 'data') {
        // For data parameters with arrays, check if value is an array
        if (Array.isArray(value)) {
          // When receiving array data (like column names from previous step)
          console.log(`📊 Processing data array for ${param.name}: ${value.length} items`);
          
          // CRITICAL: Make sure all items are processed
          // The AI needs explicit instruction about array length
          const itemsList = value.map((item, idx) => {
            if (typeof item === 'object' && item.extractedValue !== undefined) {
              // Handle result objects from previous steps
              return `Item ${idx + 1}: ${item.extractedValue}`;
            }
            return `Item ${idx + 1}: ${item}`;
          }).join('\n');
          
          return `${param.name} (${value.length} items total - PROCESS ALL ${value.length} ITEMS):
${itemsList}`;
        } else if (param.sampleData?.rows) {
          // Use sample data if available
          return `${param.name}: ${JSON.stringify(param.sampleData.rows, null, 2)}`;
        }
      }
      
      if (typeof value === 'object') {
        return `${param.name || key}: ${JSON.stringify(value, null, 2)}`;
      } else {
        return `${param.name || key}: ${value}`;
      }
    }).join('\n\n');
    
    // Add explicit instruction for array processing
    const arrayParams = tool.inputParameters.filter(p => p.type === 'data');
    let arrayInstruction = '';
    let expectedResultCount = 0;
    
    if (arrayParams.length > 0) {
      const arrayInputs = Object.entries(inputs).filter(([key, value]) => {
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        return param?.type === 'data' && Array.isArray(value);
      });
      
      if (arrayInputs.length > 0) {
        expectedResultCount = arrayInputs.reduce((sum, [, value]) => sum + (Array.isArray(value) ? value.length : 0), 0);
        
        // Log the actual count for debugging
        console.log(`🔢 EXPECTED RESULT COUNT: ${expectedResultCount} items`);
        arrayInputs.forEach(([key, value]) => {
          if (Array.isArray(value)) {
            console.log(`  - ${key}: ${value.length} items`);
            // Log first few and last few items for verification
            if (value.length > 10) {
              console.log(`    First 3: ${value.slice(0, 3).map(v => typeof v === 'object' ? v.extractedValue || JSON.stringify(v).slice(0, 50) : v).join(', ')}`);
              console.log(`    Last 3: ${value.slice(-3).map(v => typeof v === 'object' ? v.extractedValue || JSON.stringify(v).slice(0, 50) : v).join(', ')}`);
            }
          }
        });
        
        arrayInstruction = `

CRITICAL INSTRUCTION: 
- You are processing ${expectedResultCount} items from the input data
- You MUST return EXACTLY ${expectedResultCount} result objects in your JSON array
- Each input item MUST have a corresponding output object
- The output array length MUST be ${expectedResultCount}
- DO NOT stop early - process ALL ${expectedResultCount} items
- If you cannot find information for an item, still include it with "Not Found" as the extractedValue`;
      }
    }
    
    // Use the AI prompt as-is since it should already contain the correct format instructions
    // Just provide the input data
    return `${aiPrompt}

Input Data:
${formattedInputs}${arrayInstruction}`;
  }
  
  /**
   * Build Python test script for CODE tools
   */
  private buildCodeTestScript(tool: Tool, inputs: Record<string, any>): string {
    // Convert JSON to Python-compatible format (false -> False, true -> True, null -> None)
    const toPythonLiteral = (obj: any): string => {
      const json = JSON.stringify(obj);
      return json
        .replace(/\bfalse\b/g, 'False')
        .replace(/\btrue\b/g, 'True')
        .replace(/\bnull\b/g, 'None');
    };
    
    const inputsPython = toPythonLiteral(inputs);
    const parametersPython = toPythonLiteral(tool.inputParameters);
    const outputType = tool.outputType || 'single';
    
    const functionCode = tool.functionCode || "";
    return `import json
import sys
import traceback

# Generated function code
${functionCode}

# Test execution
try:
    # Extract function name
    function_name = None
    lines = """${functionCode.replace(/"/g, '\\"')}""".split('\\n')
    for line in lines:
        if line.strip().startswith('def '):
            function_name = line.split('def ')[1].split('(')[0].strip()
            break
    
    if not function_name:
        raise Exception("Could not find function definition")
    
    # Get inputs and parameters
    inputs = ${inputsPython}
    parameters = ${parametersPython}
    output_type = "${outputType}"
    
    # Debug logging
    print(f"DEBUG: Function name: {function_name}", file=sys.stderr)
    print(f"DEBUG: Inputs keys: {list(inputs.keys())}", file=sys.stderr)
    print(f"DEBUG: Input content preview: {str(inputs)[:500]}...", file=sys.stderr)
    
    # Map inputs to function arguments
    func_to_call = globals()[function_name]
    
    # Check if we should iterate over sample data
    data_params = [p for p in parameters if p.get('type') == 'data']
    has_sample_data = False
    sample_data_records = []
    
    if output_type == 'multiple' and data_params:
        # Get the first data parameter's sample data
        for param in data_params:
            param_name = param['name']
            if param_name in inputs and isinstance(inputs[param_name], list):
                sample_data_records = inputs[param_name]
                has_sample_data = True
                break
    
    if has_sample_data and output_type == 'multiple':
        # Iterate over each record in sample data
        all_results = []
        for record in sample_data_records:
            args = []
            for param in parameters:
                param_name = param['name']
                param_id = param.get('id', param_name)
                if param['type'] == 'data':
                    # Pass the current record
                    args.append(record)
                elif param_id in inputs:
                    # Pass other inputs by ID
                    args.append(inputs[param_id])
                elif param_name in inputs:
                    # Pass other inputs by name
                    args.append(inputs[param_name])
            
            # Execute function for this record
            result = func_to_call(*args)
            
            # Process result (could be single or multiple values)
            if isinstance(result, dict) and 'extractedValue' in result and 'validationStatus' in result:
                # Result is already a field validation object - use it directly
                all_results.append(result)
            elif isinstance(result, str):
                try:
                    parsed = json.loads(result)
                    if isinstance(parsed, list):
                        all_results.extend(parsed)
                    else:
                        all_results.append(parsed)
                except:
                    all_results.append({
                        "extractedValue": result,
                        "validationStatus": "valid",
                        "aiReasoning": f"Extracted for record {record.get('identifierId', 'unknown')}",
                        "confidenceScore": 95,
                        "documentSource": f"RECORD_{record.get('identifierId', 'unknown')}"
                    })
            else:
                all_results.append({
                    "extractedValue": result,
                    "validationStatus": "valid",
                    "aiReasoning": f"Extracted for record {record.get('identifierId', 'unknown')}",
                    "confidenceScore": 95,
                    "documentSource": f"RECORD_{record.get('identifierId', 'unknown')}"
                })
        
        result = all_results
    else:
        # Single execution mode
        args = []
        for param in parameters:
            param_name = param['name']
            param_id = param.get('id', param_name)
            
            # Try to find input by parameter ID first, then by name
            if param_id in inputs:
                args.append(inputs[param_id])
            elif param_name in inputs:
                args.append(inputs[param_name])
            else:
                # No input found for this parameter - this might cause an error
                pass
        
        # Execute function once
        result = func_to_call(*args)
    
    # Check if result is already in the correct format
    if isinstance(result, str):
        try:
            parsed_result = json.loads(result)
            if isinstance(parsed_result, list) and all(
                isinstance(item, dict) and 
                'extractedValue' in item and 
                'validationStatus' in item 
                for item in parsed_result
            ):
                # Result is already in field validation format
                print(result)
            elif isinstance(parsed_result, list):
                # List but not field validation format - convert each item
                output = []
                for idx, item in enumerate(parsed_result):
                    output.append({
                        "extractedValue": item,
                        "validationStatus": "valid",
                        "aiReasoning": f"Extracted item {idx+1} from {function_name}",
                        "confidenceScore": 95,
                        "documentSource": f"CODE_FUNCTION_ITEM_{idx+1}"
                    })
                print(json.dumps(output))
            else:
                # Single value or dict - wrap in field validation structure
                output = [{
                    "extractedValue": parsed_result,
                    "validationStatus": "valid",
                    "aiReasoning": f"Function {function_name} executed successfully",
                    "confidenceScore": 95,
                    "documentSource": "CODE_FUNCTION"
                }]
                print(json.dumps(output))
        except:
            # Not JSON, treat as raw value
            output = [{
                "extractedValue": result,
                "validationStatus": "valid",
                "aiReasoning": f"Function {function_name} executed successfully",
                "confidenceScore": 95,
                "documentSource": "CODE_FUNCTION"
            }]
            print(json.dumps(output))
    elif isinstance(result, list):
        # Check if it's already a list of field validation objects
        print(f"DEBUG: Result is list with {len(result)} items", file=sys.stderr)
        if len(result) > 0:
            print(f"DEBUG: First item type: {type(result[0])}", file=sys.stderr)
            if isinstance(result[0], dict):
                print(f"DEBUG: First item keys: {result[0].keys()}", file=sys.stderr)
        
        if all(isinstance(item, dict) and 'extractedValue' in item and 'validationStatus' in item for item in result):
            # Result is already in field validation format - just JSON encode it
            print(f"DEBUG: All {len(result)} items are field validation objects", file=sys.stderr)
            print(json.dumps(result))
        else:
            # List but not field validation format - convert each item
            output = []
            for idx, item in enumerate(result):
                output.append({
                    "extractedValue": item,
                    "validationStatus": "valid",
                    "aiReasoning": f"Extracted item {idx+1} from {function_name}",
                    "confidenceScore": 95,
                    "documentSource": f"CODE_FUNCTION_ITEM_{idx+1}"
                })
            print(json.dumps(output))
    else:
        # Non-string, non-list result, wrap in field validation structure
        output = [{
            "extractedValue": result,
            "validationStatus": "valid",
            "aiReasoning": f"Function {function_name} executed successfully",
            "confidenceScore": 95,
            "documentSource": "CODE_FUNCTION"
        }]
        print(json.dumps(output))
    
except Exception as e:
    error_output = {
        "extractedValue": None,
        "validationStatus": "invalid",
        "aiReasoning": f"Function execution error: {str(e)}",
        "confidenceScore": 0,
        "documentSource": "CODE_ERROR"
    }
    print(json.dumps([error_output]))
`;
  }
  
  /**
   * Execute Python file and return results
   */
  private async executePythonFile(filePath: string): Promise<ToolResult[]> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [filePath]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python execution failed (code ${code}): ${stderr}`));
          return;
        }
        
        try {
          console.log('Python stdout length:', stdout.length);
          console.log('Python stderr:', stderr);
          
          // Look for JSON array in the output - it might have debug output before it
          const jsonMatch = stdout.match(/\[[\s\S]*\](?!.*\[)/);
          let jsonStr = stdout.trim();
          
          if (jsonMatch) {
            console.log('Found JSON array in output, extracting...');
            jsonStr = jsonMatch[0];
          }
          
          const result = JSON.parse(jsonStr);
          console.log('Parsed result type:', Array.isArray(result) ? 'array' : typeof result);
          console.log('Parsed result length:', Array.isArray(result) ? result.length : 'N/A');
          resolve(Array.isArray(result) ? result : [result]);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.log('Raw stdout first 500 chars:', stdout.substring(0, 500));
          console.log('Raw stdout last 500 chars:', stdout.substring(stdout.length - 500));
          // If JSON parsing fails, return raw output
          resolve([{
            extractedValue: stdout.trim(),
            validationStatus: "valid",
            aiReasoning: "Function executed but output format may be non-standard",
            confidenceScore: 70,
            documentSource: "CODE_FUNCTION"
          }]);
        }
      });
    });
  }
}

export const toolEngine = new ToolEngine();