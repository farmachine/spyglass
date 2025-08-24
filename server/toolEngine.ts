// Unified Tool Engine - Simple 2-Branch Architecture
import { GoogleGenAI } from "@google/genai";
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { storage } from './storage';

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
      if (param.type === 'document') {
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
                  .map(doc => `=== ${doc.displayName || doc.fileName} ===\n${doc.content || 'No content'}`)
                  .join('\n\n');
                
                console.log(`📄 Using knowledge document content for ${param.name} (${combinedContent.length} chars)`);
                console.log(`📄 First 500 chars of content: ${combinedContent.substring(0, 500)}`);
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
            // Always check sample_documents table for pre-extracted content first
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
            } else if (inputValue && typeof inputValue === 'string') {
              // If we have a non-empty string value, use it
              preparedInputs[param.name] = inputValue;
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
                    file_name: param.sampleFile || 'document',
                    mime_type: mimeType,
                    file_content: dataURL
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
  async testTool(
    tool: Tool, 
    inputs: Record<string, any>,
    documentContent?: string,
    knowledgeDocuments?: any,
    progressCallback?: (current: number, total: number, message?: string) => void
  ): Promise<ToolResult[]> {
    console.log('🚀 ToolEngine.testTool called');
    console.log('  Tool Name:', tool.name);
    console.log('  Tool Type:', tool.toolType);
    console.log('  Output Type:', tool.outputType);
    
    // Prepare inputs by fetching document content if needed
    const forAI = tool.toolType === "AI_ONLY";
    const preparedInputs = await this.prepareInputs(tool, inputs, forAI);
    
    console.log('  Prepared inputs keys:', Object.keys(preparedInputs));
    
    if (tool.toolType === "AI_ONLY") {
      console.log('  → Calling testAITool');
      return this.testAITool(tool, preparedInputs, progressCallback);
    } else {
      console.log('  → Calling testCodeTool');
      return this.testCodeTool(tool, preparedInputs);
    }
  }
  
  /**
   * Test AI-based tool
   */
  private async testAITool(
    tool: Tool, 
    inputs: Record<string, any>,
    progressCallback?: (current: number, total: number, message?: string) => void
  ): Promise<ToolResult[]> {
    try {
      console.log('🔍 testAITool - Inputs received:', Object.keys(inputs));
      console.log('🔍 testAITool - Tool output type:', tool.outputType);
      
      // Log each input to understand what we're working with
      for (const [key, value] of Object.entries(inputs)) {
        if (Array.isArray(value)) {
          console.log(`  📊 Input "${key}" is an array with ${value.length} items`);
          if (value.length > 0) {
            console.log(`    First item type: ${typeof value[0]}`);
            if (typeof value[0] === 'object') {
              console.log(`    First item structure:`, Object.keys(value[0]));
            }
          }
        } else if (typeof value === 'string') {
          console.log(`  📝 Input "${key}" is a string (${value.length} chars)`);
        } else {
          console.log(`  🔢 Input "${key}" is type: ${typeof value}`);
        }
      }
      
      // Check if we need to batch large arrays
      const dataInputs = Object.entries(inputs).filter(([key, value]) => {
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        const isDataParam = param?.type === 'data';
        const isArray = Array.isArray(value);
        console.log(`  Checking "${key}": param type="${param?.type}", isArray=${isArray}, isDataParam=${isDataParam}`);
        return isDataParam && isArray;
      });
      
      console.log(`🔍 Found ${dataInputs.length} data inputs that are arrays`);
      
      // For AI tools, we send ALL data in one call to minimize API requests
      // NO BATCHING for AI tools - send everything at once
      const AI_BATCH_THRESHOLD = 999999; // Effectively disable batching for AI tools
      const AI_BATCH_SIZE = 999999; // Process ALL items at once for AI tools
      
      // If we have large arrays, check if we need special handling
      if (dataInputs.length > 0 && tool.outputType === 'multiple') {
        const [dataKey, dataArray] = dataInputs[0];
        
        // For AI tools, send ALL items in a single request
        if (tool.toolType === 'AI' && Array.isArray(dataArray) && dataArray.length > 0) {
          console.log(`📦 AI Tool: Processing ALL ${dataArray.length} items in a SINGLE API call...`);
          
          // Process ALL items in a single batch for AI tools
          const batch = dataArray; // Use the entire array as one batch
          const allResults: ToolResult[] = [];
          
          // No loop needed - process everything at once
          {
            const i = 0;
            const batchEnd = dataArray.length;
            const batchNumber = 1;
            const totalBatches = 1;
            
            console.log(`  Processing batch ${batchNumber}: items ${i + 1}-${batchEnd} of ${dataArray.length}`);
            
            // Report progress if callback provided
            if (progressCallback) {
              progressCallback(i, dataArray.length, `Processing batch ${batchNumber} of ${totalBatches}`);
            }
            
            // Create inputs for this batch
            const batchInputs = { ...inputs };
            batchInputs[dataKey] = batch;
            
            // Process batch
            // Build a more specific prompt for batch processing
            let batchPrompt: string;
            
            // Check if this is a merged data batch (has objects with multiple properties)
            const isMergedData = batch.length > 0 && typeof batch[0] === 'object' && 
                                 batch[0] !== null && !Array.isArray(batch[0]) && 
                                 Object.keys(batch[0]).length > 1;
            
            if (isMergedData) {
              // Special prompt for merged data (like Column Names + Worksheet Names)
              const sampleItem = batch[0];
              const fieldNames = Object.keys(sampleItem);
              
              console.log(`    🔄 Processing merged data with fields: ${fieldNames.join(', ')}`);
              console.log(`    📊 First item:`, JSON.stringify(sampleItem, null, 2));
              
              // For merged data, we need to provide both column names and worksheet context
              const primaryFieldName = fieldNames[0]; // "Column Names"
              const contextFieldName = fieldNames[1]; // "Worksheet Name"
              
              // Check if we have identifierIds (for tracking which record each item corresponds to)
              const hasIdentifierId = batch.length > 0 && batch[0].identifierId !== undefined;
              
              console.log(`    📋 Processing merged data with primary field: "${primaryFieldName}" and context field: "${contextFieldName}"`);
              console.log(`    📊 Has identifierIds: ${hasIdentifierId}`);
              console.log(`    📊 Sample data:`, batch.slice(0, 3));
              
              // Log the actual data being sent
              console.log(`    📊 Building prompt for ${batch.length} items with merged data`);
              console.log(`    📊 First item in batch:`, batch[0]);
              console.log(`    📊 Last item in batch:`, batch[batch.length - 1]);
              
              // Override the tool prompt for merged data to ensure proper handling
              const basePrompt = tool.aiPrompt || '';
              
              // Check if the base prompt already has proper structure for batch processing
              const hasProperBatchStructure = basePrompt.includes('exactly the same number') || 
                                             basePrompt.includes('exactly the same length');
              
              console.log(`    📊 Base prompt has proper batch structure: ${hasProperBatchStructure}`);
              
              // Use the base prompt but format the data correctly for it
              // The base prompt expects a "List Item" parameter, so we need to format our data accordingly
              const formattedData = batch.map(item => ({
                identifierId: item.identifierId,
                "Column Names": item[primaryFieldName],
                "Worksheet Name": item[contextFieldName]
              }));
              
              console.log(`    📊 Formatted ${formattedData.length} items for AI processing`);
              
              batchPrompt = `${basePrompt}

Input Data:
List Item (${formattedData.length} items total - PROCESS ALL ${formattedData.length} ITEMS):
${formattedData.map((item, idx) => 
  `Item ${idx + 1}: ${JSON.stringify(item)}`
).join('\n')}`;
            } else {
              // Standard prompt for simple data
              // Check if items have identifierId
              const hasIdentifierId = batch.length > 0 && 
                                     typeof batch[0] === 'object' && 
                                     batch[0] !== null && 
                                     'identifierId' in batch[0];
              
              batchPrompt = `${tool.aiPrompt || ''}

You are processing a batch of ${batch.length} items. Each item needs to be processed individually.

INPUT DATA (${batch.length} items):
${JSON.stringify(batch, null, 2)}

REQUIRED OUTPUT FORMAT:
Return a JSON array with exactly ${batch.length} objects, one for each input item, in the same order.
Each object must follow this schema:
{${hasIdentifierId ? '\n  "identifierId": "the identifierId from the input item (CRITICAL: copy this exactly from the input data)",' : ''}
  "extractedValue": "the extracted or mapped value, or 'Not Found' if nothing matches",
  "validationStatus": "valid" or "invalid",
  "aiReasoning": "brief explanation of your finding",
  "confidenceScore": number between 0-100,
  "documentSource": "source document or reference"
}

IMPORTANT:
- Process ALL ${batch.length} items
- Return exactly ${batch.length} results in the same order as input
- Each result must have all ${hasIdentifierId ? '6' : '5'} required fields${hasIdentifierId ? ' (including identifierId)' : ''}
- If no match is found, use extractedValue: "Not Found"

Process each item and return the complete array of results.`;
            }
            
            // Add delay between batches to respect Gemini API rate limits
            // Gemini 2.0 Flash has different limits: 60 requests/minute = 1 request per second
            // Add a small delay between each batch to stay under limits
            if (i > 0) {
              // Wait 2 seconds between batches to ensure we stay well under the 60 req/min limit
              console.log(`  ⏳ Waiting 2 seconds before next batch...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
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
              
              console.log(`    🔍 AI returned ${results.length} results`);
              console.log(`    🔍 First result:`, results[0]);
              if (results.length > 1) {
                console.log(`    🔍 Last result:`, results[results.length - 1]);
              }
              
              // Validate that we got the expected number of results
              if (results.length !== batch.length) {
                console.error(`    ⚠️ CRITICAL: Batch returned ${results.length} results but expected ${batch.length}`);
                console.error(`    ⚠️ This means AI did not process all items!`);
                // Pad with "Not Found" results if needed
                while (results.length < batch.length) {
                  results.push({
                    extractedValue: "Not Found",
                    validationStatus: "invalid",
                    aiReasoning: "AI did not return a result for this item",
                    confidenceScore: 0,
                    documentSource: "Missing Result"
                  });
                }
              }
              
              allResults.push(...results);
              console.log(`    ✅ Batch processed: ${results.length} results`);
              
              // Report progress after batch completes
              if (progressCallback) {
                const itemsProcessed = Math.min(i + batch.length, dataArray.length);
                progressCallback(itemsProcessed, dataArray.length, `Completed batch ${batchNumber} of ${totalBatches}`);
              }
              
              // Log the actual results from this batch
              console.log(`    📋 Batch Results:`);
              results.forEach((result: any, idx: number) => {
                const itemIndex = i + idx;
                const inputItem = batch[idx];
                const extractedValue = result.extractedValue || result.result || 'no result';
                // Format the input item properly for logging
                const inputDisplay = typeof inputItem === 'object' ? JSON.stringify(inputItem) : inputItem;
                console.log(`      • Item ${itemIndex + 1}: ${inputDisplay} → "${extractedValue}"`);
              });
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
          } // End of single batch processing block
          
          console.log(`✅ Processing complete. Total results: ${allResults.length}`);
          return allResults;
        } else if (Array.isArray(dataArray) && dataArray.length > AI_BATCH_THRESHOLD) {
          // Original batching logic for non-AI tools (if needed)
          console.log(`📦 Non-AI Tool: Array detected (${dataArray.length} items). Processing in batches...`);
          // Keep existing batching logic here for non-AI tools if needed
        }
      }
      
      // Normal processing for small arrays or non-array inputs
      // But first check if we have input arrays that need tracking
      let inputArrayLength = 0;
      let inputIdentifiers: any[] = [];
      
      // Check for array inputs to track expected output count
      for (const [key, value] of Object.entries(inputs)) {
        if (Array.isArray(value) && value.length > 0) {
          const param = tool.inputParameters.find(p => p.id === key || p.name === key);
          if (param?.type === 'data') {
            inputArrayLength = value.length;
            inputIdentifiers = value;
            console.log(`📊 Found input array "${key}" with ${inputArrayLength} items`);
            break;
          }
        }
      }
      
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
      console.log('Result length:', result.length, 'characters');
      console.log('First 500 chars:', result.slice(0, 500));
      console.log('Last 500 chars:', result.slice(-500));
      console.log('-'.repeat(80));
      
      const parsed = JSON.parse(result);
      let results = Array.isArray(parsed) ? parsed : [parsed];
      
      console.log(`✅ Parsed results: ${Array.isArray(parsed) ? 'array' : 'object'} with ${results.length} items`);
      if (results.length > 0) {
        console.log(`  First result identifierId: ${results[0].identifierId}`);
        console.log(`  First result extractedValue: ${results[0].extractedValue}`);
        if (results.length > 1) {
          console.log(`  Last result identifierId: ${results[results.length - 1].identifierId}`);
          console.log(`  Last result extractedValue: ${results[results.length - 1].extractedValue}`);
        }
      }
      
      // Check if we have data type parameters with arrays (reuse from batching check)
      const dataInputsCheck = Object.entries(inputs).filter(([key, value]) => {
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        return param?.type === 'data' && Array.isArray(value);
      });
      
      if (dataInputsCheck.length > 0 && tool.outputType === 'multiple') {
        const expectedCount = dataInputsCheck.reduce((sum, [, value]) => 
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
      
      console.log(`🎯 Returning ${results.length} results from testAITool`);
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
        console.log(`🐍 CODE TOOL RESULTS: ${result?.length || 0} items returned`);
        if (result && result.length > 0) {
          console.log(`  First item:`, result[0]);
          if (result.length > 10) {
            console.log(`  ... total of ${result.length} items`);
          }
        }
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
   * Run tool for extraction workflow - wrapper for external use
   */
  async runToolForExtraction(
    toolId: string,
    inputs: Record<string, any>,
    sessionId: string,
    projectId: string
  ): Promise<ToolResult[]> {
    console.log('🎯 runToolForExtraction called', { toolId, sessionId, projectId });
    
    // Get the tool from storage
    const tool = await storage.getExcelWizardryFunction(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    console.log('📦 Tool found:', tool.name);
    
    // Execute the tool
    return this.testTool(tool, inputs);
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
            if (typeof item === 'object') {
              if (item.extractedValue !== undefined) {
                // Handle result objects from previous steps
                return `Item ${idx + 1}: ${item.extractedValue}`;
              } else {
                // Handle objects with multiple fields (like merged data)
                return `Item ${idx + 1}: ${JSON.stringify(item)}`;
              }
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
    
    print(f"DEBUG: output_type={output_type}, data_params count={len(data_params)}", file=sys.stderr)
    
    if output_type == 'multiple' and data_params:
        # Get the first data parameter's sample data
        for param in data_params:
            param_name = param['name']
            param_id = param.get('id', param_name)
            print(f"DEBUG: Checking param '{param_name}' (id={param_id}) for sample data", file=sys.stderr)
            
            # Check both by name and by ID
            if param_name in inputs:
                input_data = inputs[param_name]
                print(f"DEBUG: Found input for '{param_name}', type={type(input_data).__name__}", file=sys.stderr)
                # Handle data structure with 'rows' property
                if isinstance(input_data, dict) and 'rows' in input_data:
                    sample_data_records = input_data['rows']
                    has_sample_data = True
                    print(f"DEBUG: Found {len(sample_data_records)} rows in data structure", file=sys.stderr)
                    break
                elif isinstance(input_data, list):
                    sample_data_records = input_data
                    has_sample_data = True
                    print(f"DEBUG: Found list with {len(sample_data_records)} items", file=sys.stderr)
                    break
            elif param_id in inputs:
                input_data = inputs[param_id]
                print(f"DEBUG: Found input for id '{param_id}', type={type(input_data).__name__}", file=sys.stderr)
                # Handle data structure with 'rows' property
                if isinstance(input_data, dict) and 'rows' in input_data:
                    sample_data_records = input_data['rows']
                    has_sample_data = True
                    print(f"DEBUG: Found {len(sample_data_records)} rows in data structure", file=sys.stderr)
                    break
                elif isinstance(input_data, list):
                    sample_data_records = input_data
                    has_sample_data = True
                    print(f"DEBUG: Found list with {len(sample_data_records)} items", file=sys.stderr)
                    break
    
    print(f"DEBUG: has_sample_data={has_sample_data}, records to process={len(sample_data_records)}", file=sys.stderr)
    
    if has_sample_data and output_type == 'multiple':
        # Iterate over each record in sample data
        print(f"DEBUG: Iterating over {len(sample_data_records)} records", file=sys.stderr)
        all_results = []
        for i, record in enumerate(sample_data_records):
            print(f"DEBUG: Processing record {i+1}/{len(sample_data_records)}: {str(record)[:100]}...", file=sys.stderr)
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
                else:
                    # Handle missing parameter - provide None to maintain argument count
                    print(f"WARNING: No input found for parameter '{param_name}' (id: {param_id})", file=sys.stderr)
                    args.append(None)
            
            # Debug log the arguments
            print(f"DEBUG: Calling {function_name} with {len(args)} args", file=sys.stderr)
            for i, arg in enumerate(args):
                if i < len(parameters):
                    param_info = parameters[i]
                    if arg is None:
                        print(f"  Arg {i} ({param_info['name']}): None - MISSING INPUT!", file=sys.stderr)
                    else:
                        arg_preview = str(arg)[:100] if arg else "None"
                        print(f"  Arg {i} ({param_info['name']}): {arg_preview}", file=sys.stderr)
            
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

// Export convenience function for extraction
export async function runToolForExtraction(
  toolId: string,
  inputs: Record<string, any>,
  sessionId: string,
  projectId: string
): Promise<ToolResult[]> {
  return toolEngine.runToolForExtraction(toolId, inputs, sessionId, projectId);
}