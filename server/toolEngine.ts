/**
 * Tool Engine - AI and Code Extraction Orchestrator
 * 
 * Unified tool execution engine that handles both AI-powered and code-based data extraction.
 * Supports two main tool types: AI_ONLY (using Gemini) and CODE (Python functions).
 * 
 * Key Features:
 * - Tool testing and validation with sample documents
 * - Dynamic Python function execution in sandboxed environment
 * - AI prompt engineering and response parsing
 * - Document content fetching from object storage
 * - Error handling and debugging support
 * 
 * Architecture:
 * - Two-branch design: AI tools vs Code tools
 * - Python subprocess execution for CODE tools
 * - Google Gemini API integration for AI tools
 * - Structured JSON response format for both types
 * 
 * Security:
 * - Sandboxed Python execution environment
 * - Input validation and sanitization
 * - Error containment and logging
 */

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
  operationType?: "createSingle" | "updateSingle" | "createMultiple" | "updateMultiple";
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
    const { loadReferenceDocuments, extractDocumentIds } = await import('./referenceDocumentLoader');
    
    // Check for project ID in inputs for reference document loading
    const projectId = rawInputs.projectId || '';
    
    // CRITICAL: Universal 'user_document' placeholder resolver (before any type-specific logic)
    // This fixes the issue where param.type !== 'document' but value is 'user_document'
    const resolveUserDocumentPlaceholder = (value: any): any => {
      const sessionDocContent = rawInputs.sessionDocumentContent;
      
      if (typeof value === 'string') {
        if (value === 'user_document' || value === '@user_document') {
          if (sessionDocContent) {
            console.log(`🔄 Resolved 'user_document' placeholder with session content (${sessionDocContent.length} chars)`);
            return sessionDocContent;
          } else {
            console.log(`⚠️ 'user_document' placeholder found but no sessionDocumentContent available`);
            return '';
          }
        }
      } else if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'string' && (item === 'user_document' || item === '@user_document')) {
            if (sessionDocContent) {
              console.log(`🔄 Resolved 'user_document' placeholder in array with session content (${sessionDocContent.length} chars)`);
              return sessionDocContent;
            } else {
              console.log(`⚠️ 'user_document' placeholder in array found but no sessionDocumentContent available`);
              return '';
            }
          }
          return item;
        });
      }
      return value;
    };
    
    for (const param of tool.inputParameters) {
      // Try to get input value by parameter ID first, then by name
      const paramId = (param as any).id || param.name;
      let inputValue = rawInputs[paramId] || rawInputs[param.name];
      
      // UNIVERSAL: Apply user_document placeholder resolution first (regardless of param.type)
      inputValue = resolveUserDocumentPlaceholder(inputValue);
      
      // Set resolved value for both param.name and paramId to cover all access patterns
      preparedInputs[param.name] = inputValue;
      if (paramId !== param.name) {
        preparedInputs[paramId] = inputValue;
      }
      
      console.log(`📝 Set ${param.name} (${paramId}) = ${typeof inputValue === 'string' ? `${inputValue.length} chars` : JSON.stringify(inputValue).substring(0, 100)}`);
      
      // Special handling for Reference Document parameter
      if (param.name === 'Reference Document' || paramId === '0.4uir69thnel' || paramId === 'Reference Document') {
        console.log(`🔍 Processing reference document for parameter: ${param.name} (${paramId})`);
        
        // Check various input keys for reference documents
        const refDocValue = rawInputs['Reference Document'] || 
                           rawInputs['0.4uir69thnel'] || 
                           rawInputs[paramId] || 
                           inputValue;
        
        // Extract document IDs from the value
        const documentIds = extractDocumentIds(refDocValue);
        console.log(`📚 Extracted document IDs:`, documentIds);
        
        // Load reference documents with their content
        const content = await loadReferenceDocuments(documentIds.length > 0 ? documentIds : undefined, projectId);
        
        // Set the content for the parameter and also common reference keys
        preparedInputs[param.name] = content;
        preparedInputs['Reference Document'] = content;
        preparedInputs['0.4uir69thnel'] = content;
        
        console.log(`✅ Set reference document content: ${content.length} chars`);
        if (content.length > 0) {
          console.log(`📄 Content preview: ${content.substring(0, 300)}...`);
        }
      } else if (param.type === 'document') {
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
                // Use centralized loader for better content extraction
                const content = await loadReferenceDocuments(inputValue, projectId);
                preparedInputs[param.name] = content;
                
                console.log(`📄 Using knowledge document content for ${param.name} (${content.length} chars)`);
                if (content.length > 0) {
                  console.log(`📄 First 500 chars of content: ${content.substring(0, 500)}`);
                }
              } else {
                console.log(`⚠️ No knowledge documents found for IDs: ${inputValue.join(', ')}`);
                preparedInputs[param.name] = '';
              }
            } else {
              // Not knowledge document IDs, treat as regular input
              preparedInputs[param.name] = inputValue;
            }
          } else {
            // Document-specific handling (placeholder resolution is now handled universally above)
            {
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
                const python = spawn('python3', ['services/document_extractor.py']);
                
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
          }
      } else {
        // Handle regular parameters (including references from previous steps)
        if (inputValue !== undefined && inputValue !== null && inputValue !== '') {
          preparedInputs[param.name] = inputValue;
          console.log(`📝 Set ${param.name} = ${typeof inputValue === 'string' ? inputValue.substring(0, 100) : JSON.stringify(inputValue).substring(0, 100)}`);
        } else {
          // If no value provided, set empty string to avoid undefined
          // The data should already be in rawInputs with the correct parameter name
          // from the ID-based mapping in the calling code
          preparedInputs[param.name] = '';
          console.log(`⚠️ No value provided for parameter ${param.name}, setting to empty string`);
        }
      }
    }
    
    // CRITICAL: Preserve special fields that start with __ (like __infoPageFields)
    // These are metadata fields that need to flow through to the AI prompt
    for (const [key, value] of Object.entries(rawInputs)) {
      if (key.startsWith('__')) {
        preparedInputs[key] = value;
        console.log(`🔒 Preserved special field: ${key}`, Array.isArray(value) ? `(${value.length} items)` : '');
      }
    }
    
    // CRITICAL: Always preserve sessionDocumentContent for document resolution
    if (rawInputs.sessionDocumentContent) {
      preparedInputs.sessionDocumentContent = rawInputs.sessionDocumentContent;
      console.log(`📊 Preserved sessionDocumentContent (${rawInputs.sessionDocumentContent.length} chars)`);
    }
    
    // CRITICAL: Also preserve data fields that routes.ts sends for column extraction
    // These are essential for maintaining the data chain across columns
    const criticalDataFields = ['Input Data', 'List Item', 'previousData'];
    for (const dataField of criticalDataFields) {
      if (rawInputs[dataField] && !preparedInputs[dataField]) {
        preparedInputs[dataField] = rawInputs[dataField];
        const fieldInfo = Array.isArray(rawInputs[dataField]) 
          ? `(${rawInputs[dataField].length} records)` 
          : `(${typeof rawInputs[dataField]})`;
        console.log(`📊 Preserved critical data field: ${dataField} ${fieldInfo}`);
      }
    }
    
    // LAST-MILE GUARD: Check for any remaining 'user_document' placeholders and replace them
    const containsUserDocumentToken = JSON.stringify(preparedInputs).includes('"user_document"');
    if (containsUserDocumentToken && rawInputs.sessionDocumentContent) {
      console.log(`🚨 LAST-MILE GUARD: Found remaining 'user_document' tokens, applying final replacement`);
      for (const [key, value] of Object.entries(preparedInputs)) {
        if (typeof value === 'string' && (value === 'user_document' || value === '@user_document')) {
          preparedInputs[key] = rawInputs.sessionDocumentContent;
          console.log(`🔄 Last-mile replaced ${key}: 'user_document' -> ${rawInputs.sessionDocumentContent.length} chars`);
        }
      }
    } else if (containsUserDocumentToken) {
      console.log(`⚠️ LAST-MILE GUARD: Found 'user_document' tokens but no sessionDocumentContent available`);
    }
    
    return preparedInputs;
  }
  
  /**
   * Generate tool content (AI prompt or Python code)
   */
  async generateToolContent(tool: Omit<Tool, 'id' | 'functionCode' | 'aiPrompt'> & { llmModel?: string }): Promise<{ content: string }> {
    const prompt = this.buildGenerationPrompt(tool);
    const modelToUse = tool.llmModel || "gemini-1.5-flash";
    
    console.log('🤖 GEMINI AI PROMPT FOR TOOL GENERATION');
    console.log('='.repeat(80));
    console.log('📝 Tool Type:', tool.toolType);
    console.log('📝 Tool Name:', tool.name);
    console.log('📝 Tool Description:', tool.description);
    console.log('📝 Input Parameters:', tool.inputParameters.map(p => `${p.name} (${p.type})`).join(', '));
    console.log('📝 Model:', modelToUse);
    console.log('');
    console.log('🎯 FULL PROMPT SENT TO GEMINI:');
    console.log('-'.repeat(80));
    console.log(prompt);
    console.log('-'.repeat(80));
    console.log('');
    
    // Only use JSON response format for AI prompts, not for CODE generation
    const config = tool.toolType === 'AI_ONLY' 
      ? {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      : {
          temperature: 0.1,
          maxOutputTokens: 8192
        };
    
    const response = await genAI.models.generateContent({
      model: modelToUse,
      config,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
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
    progressCallback?: (current: number, total: number, message?: string) => void,
    stepId?: string,
    orderIndex?: number,
    sessionId?: string
  ): Promise<ToolResult[]> {
    console.log(`\n🚀 TOOL ENGINE - testTool() called`);
    console.log(`   Tool Name: ${tool.name}`);
    console.log(`   Tool Type: ${tool.toolType}`);
    console.log(`   Tool ID: ${tool.id}`);
    console.log(`   Operation Type: ${tool.operationType}`);
    console.log(`   Input Keys:`, Object.keys(inputs));
    console.log(`   Step ID: ${stepId || 'not provided'}`);
    console.log(`   Order Index: ${orderIndex !== undefined ? orderIndex : 'not provided'}`);
    
    // Check for multi-field extraction
    if (inputs.__infoPageFields) {
      console.log(`   📋 Multi-field extraction detected:`, inputs.__infoPageFields);
    }
    
    // CRITICAL: Automatically inject incremental data for UPDATE operations
    const isUpdateOperation = tool.operationType?.toLowerCase().includes('update');
    
    // Use passed parameters or fall back to inputs
    const effectiveStepId = stepId || inputs.stepId || inputs.valueConfiguration?.stepId;
    const valueId = inputs.valueId || inputs.valueConfiguration?.valueId;
    const effectiveOrderIndex = orderIndex !== undefined ? orderIndex : inputs.valueConfiguration?.orderIndex;
    
    if (isUpdateOperation && effectiveStepId && effectiveOrderIndex !== undefined && effectiveOrderIndex > 0) {
      console.log(`\n🔄 AUTO-INJECTING INCREMENTAL DATA FOR UPDATE OPERATION`);
      console.log(`   Step ID: ${effectiveStepId}`);
      console.log(`   Value ID: ${valueId}`);
      console.log(`   Order Index: ${effectiveOrderIndex}`);
      console.log(`   Session ID: ${sessionId || 'not provided'}`);
      console.log(`   Tool operationType: ${tool.operationType}`);
      
      // Build incremental data automatically
      const incrementalData = await this.buildIncrementalData(effectiveStepId, valueId, effectiveOrderIndex, sessionId);
      
      if (incrementalData.length > 0) {
        console.log(`   ✅ Injecting ${incrementalData.length} rows of incremental data`);
        
        // Find the data input parameter name from tool configuration
        let dataParamName = 'Input Data'; // Default name
        
        // Look for a data-type parameter in the tool
        const dataParam = tool.inputParameters.find(p => p.type === 'data');
        if (dataParam) {
          dataParamName = dataParam.name;
          console.log(`   Using data parameter: ${dataParamName}`);
        }
        
        // CRITICAL FIX: Only inject incremental data if there's no existing data from routes
        // routes.ts builds comprehensive previousData that should take precedence
        if (!inputs[dataParamName] || (Array.isArray(inputs[dataParamName]) && inputs[dataParamName].length === 0)) {
          inputs[dataParamName] = incrementalData;
          console.log(`   📊 Incremental data injected as "${dataParamName}" (no existing data)`);
        } else {
          console.log(`   ⚠️ PRESERVING EXISTING DATA: "${dataParamName}" already has ${Array.isArray(inputs[dataParamName]) ? inputs[dataParamName].length : 'non-array'} items from routes`);
          console.log(`   📊 NOT replacing with incremental data (would have been ${incrementalData.length} rows)`);
        }
        
        // CRITICAL: Also clear any other data parameters that might contain test data
        // Look for common data parameter names and clear them
        const dataParameterNames = ['List Items', 'List Item', 'data', 'records', 'items', 'rows'];
        for (const paramName of dataParameterNames) {
          if (paramName !== dataParamName && inputs[paramName]) {
            console.log(`   🗑️ Clearing test data from "${paramName}" parameter (was ${Array.isArray(inputs[paramName]) ? inputs[paramName].length : 'non-array'} items)`);
            delete inputs[paramName];
          }
        }
        
        // Log sample for debugging
        console.log(`   Sample incremental data (first row):`, incrementalData[0]);
      } else {
        console.log(`   ⚠️ No incremental data available (first column or no previous data)`);
      }
    } else if (isUpdateOperation) {
      console.log(`   ℹ️ UPDATE operation but missing context for incremental data`);
      console.log(`     - stepId: ${stepId}`);
      console.log(`     - orderIndex: ${orderIndex}`);
    }
    
    // Clean triage between AI and CODE tools
    const forAI = tool.toolType === "AI_ONLY";
    console.log(`   For AI: ${forAI}`);
    
    const preparedInputs = await this.prepareInputs(tool, inputs, forAI);
    
    // Log detailed input data for debugging
    console.log(`📊 DETAILED RAW INPUTS being sent to tool:`);
    console.log('='.repeat(80));
    Object.entries(preparedInputs).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        console.log(`📋 ${key}: Array with ${value.length} items`);
        value.slice(0, 3).forEach((item, index) => {
          if (typeof item === 'object') {
            console.log(`   [${index}]: ${JSON.stringify(item)}`);
          } else {
            console.log(`   [${index}]: ${item}`);
          }
        });
        if (value.length > 3) {
          console.log(`   ... and ${value.length - 3} more items`);
        }
      } else if (typeof value === 'string' && value.length > 200) {
        console.log(`📄 ${key}: String (${value.length} chars)`);
        console.log(`   Preview: "${value.substring(0, 200)}..."`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`📝 ${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`📝 ${key}: ${value}`);
      }
    });
    console.log('='.repeat(80));
    
    // Route to appropriate handler
    if (tool.toolType === "AI_ONLY") {
      console.log(`   ✅ Routing to AI tool handler (testAITool)`);
      return this.testAITool(tool, preparedInputs, progressCallback);
    } else {
      console.log(`   📦 Routing to CODE tool handler (testCodeTool)`);
      return this.testCodeTool(tool, preparedInputs);
    }
  }
  
  /**
   * Test AI-based tool - Clean, architecture-respecting implementation
   */
  private async testAITool(
    tool: Tool, 
    inputs: Record<string, any>,
    progressCallback?: (current: number, total: number, message?: string) => void
  ): Promise<ToolResult[]> {
    console.log(`\n🤖 AI TOOL HANDLER - testAITool() called`);
    console.log(`   Tool: ${tool.name}`);
    console.log(`   Operation Type: ${tool.operationType || 'not set'}`);
    console.log(`   Has __infoPageFields: ${!!inputs.__infoPageFields}`);
    
    // CRITICAL DEBUG: Log all input keys to see what we have
    console.log(`   🚨 INPUT KEYS RECEIVED:`, Object.keys(inputs));
    if (inputs['Input Data']) {
      console.log(`   🚨 'Input Data' EXISTS with ${inputs['Input Data'].length} records`);
    }
    if (inputs.previousData) {
      console.log(`   🚨 'previousData' EXISTS with ${inputs.previousData.length} records`);
    }
    
    if (inputs.__infoPageFields) {
      console.log(`   Multi-field extraction fields:`, inputs.__infoPageFields);
    }
    
    try {
      // Check if this is a CREATE operation
      const isCreateOperation = tool.operationType?.includes('create');
      console.log(`   Is CREATE operation: ${isCreateOperation}`);
      
      // 1. Find data input array if exists (required for UPDATE, optional for CREATE)
      const dataInput = this.findDataInput(tool, inputs);
      let inputArray: any[] = [];
      
      if (isCreateOperation) {
        // CREATE operations don't require data input
        if (dataInput && Array.isArray(dataInput.value)) {
          // If data is provided, use it (but it's optional)
          inputArray = dataInput.value.slice(0, 50);
          console.log(`🆕 CREATE operation with ${inputArray.length} reference records`);
        } else {
          // No data input for CREATE operation - this is normal
          console.log(`🆕 CREATE operation without data input - will generate new records`);
          inputArray = [];
        }
      } else {
        // UPDATE operations typically require data input, but handle first extraction case
        if (!dataInput || !Array.isArray(dataInput.value)) {
          // For initial extractions, UPDATE tools can work without existing data
          console.log(`⚠️ UPDATE operation without data input - treating as initial extraction`);
          inputArray = [];
        } else {
          // 2. Limit to 50 records for performance
          const AI_RECORD_LIMIT = 50;
          inputArray = dataInput.value.slice(0, AI_RECORD_LIMIT);
          console.log(`🔄 UPDATE operation with ${inputArray.length} records`);
          
          // CRITICAL: Log if inputArray has identifierIds for debugging
          if (inputArray.length > 0) {
            const hasIdentifierIds = inputArray[0].identifierId !== undefined;
            console.log(`📊 InputArray has identifierIds: ${hasIdentifierIds}`);
            if (hasIdentifierIds) {
              console.log(`📊 First 3 identifierIds in inputArray:`);
              inputArray.slice(0, 3).forEach((item, idx) => {
                console.log(`   [${idx}] ${item.identifierId}`);
              });
            }
          }
        }
      }
      
      // 3. Build prompt using tool's AI prompt template
      const prompt = this.buildAIPrompt(tool, inputs, inputArray);
      
      // 4. Log the prompt for debugging
      console.log('\n📝 FULL AI EXTRACTION PROMPT (for debugging multi-field issue):');
      console.log('='.repeat(80));
      console.log('Tool:', tool.name);
      console.log('Type:', tool.toolType);
      console.log('Has __infoPageFields:', !!inputs.__infoPageFields);
      if (inputs.__infoPageFields) {
        console.log('Multi-field extraction fields:', inputs.__infoPageFields);
      }
      console.log('='.repeat(80));
      console.log(prompt);
      console.log('='.repeat(80));
      console.log('END OF PROMPT');
      
      // 5. Call Gemini API
      if (progressCallback) {
        const total = inputArray.length || 1; // For CREATE without data, use 1
        progressCallback(0, total, 'Processing with AI...');
      }
      
      // Calculate token limit based on batch size
      // For large batches, we need more tokens to handle the response
      const batchSize = inputArray?.length || 1;
      const tokensPerRecord = 500; // Estimate 500 tokens per record for descriptions
      const baseTokens = 8192;
      const calculatedTokens = Math.max(baseTokens, batchSize * tokensPerRecord);
      const maxTokenLimit = 32768; // Gemini's max limit
      const finalTokenLimit = Math.min(calculatedTokens, maxTokenLimit);
      
      console.log(`📊 Batch size: ${batchSize}, Token limit: ${finalTokenLimit}`);
      
      const response = await genAI.models.generateContent({
        model: tool.llmModel || "gemini-2.0-flash",
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: finalTokenLimit
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      });
      
      // 6. Extract and parse response
      const rawResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Log the response size and content
      console.log(`📏 AI Response Size: ${rawResponse.length} characters`);
      
      // Always log the full response if it's under 2000 chars (to debug empty results)
      if (rawResponse.length < 2000) {
        console.log('📝 Full AI Response:');
        console.log(rawResponse);
      }
      
      // Log a snippet of the raw response around the problematic position if large
      if (rawResponse.length > 24335) {
        console.log('Raw AI response around position 24335:');
        console.log(rawResponse.substring(24300, Math.min(24400, rawResponse.length)));
      }
      
      // If response is very large, log the beginning and end
      if (rawResponse.length > 10000) {
        console.log('Response start (first 500 chars):');
        console.log(rawResponse.substring(0, 500));
        console.log('Response end (last 500 chars):');
        console.log(rawResponse.substring(rawResponse.length - 500));
      }
      
      const parsedResults = this.parseAIResponse(rawResponse);
      console.log(`📦 Parsed ${parsedResults.length} results from AI response`);
      
      // Enhanced logging for column extraction debugging
      const valueConfig = inputs['valueConfiguration'];
      const columnName = valueConfig?.valueName || 'Unknown';
      console.log(`🎯 COLUMN EXTRACTION DEBUG for "${columnName}":`);
      console.log(`   Step: ${valueConfig?.stepName || 'Unknown'}`);
      console.log(`   Results count: ${parsedResults.length}`);
      
      if (parsedResults.length > 0) {
        // Log first few results with extracted values
        console.log(`   First 3 results for column "${columnName}":`);
        parsedResults.slice(0, 3).forEach((result, idx) => {
          console.log(`   [${idx}] identifierId: ${result.identifierId || 'none'}, value: "${result.extractedValue}"`);
        });
        
        // Check if all values are the same (potential bug indicator)
        const uniqueValues = new Set(parsedResults.map(r => r.extractedValue));
        if (uniqueValues.size === 1 && parsedResults.length > 1) {
          console.log(`⚠️ WARNING: All ${parsedResults.length} records have the SAME value for column "${columnName}": "${parsedResults[0].extractedValue}"`);
          console.log(`⚠️ This might indicate the AI is not extracting column-specific data!`);
        } else {
          console.log(`✅ Found ${uniqueValues.size} unique values for column "${columnName}"`);
        }
      }
      
      // 7. Map results based on operation type
      let results: ToolResult[];
      
      // Debug logging for multi-field detection
      console.log(`🔍 Checking multi-field extraction conditions:`);
      console.log(`   - Has __infoPageFields: ${!!inputs.__infoPageFields}`);
      console.log(`   - inputArray.length: ${inputArray.length}`);
      console.log(`   - isCreateOperation: ${isCreateOperation}`);
      
      // Check for multi-field extraction (Info Page fields)
      if (inputs.__infoPageFields && inputArray.length === 0) {
        // Multi-field extraction: AI returns results with identifierIds from __infoPageFields
        console.log(`📋 Multi-field extraction: processing ${parsedResults.length} field results`);
        results = parsedResults.map((item: any) => ({
          identifierId: item.identifierId, // CRITICAL: Preserve the identifierId from AI response
          extractedValue: item.extractedValue !== undefined ? item.extractedValue : item.value || item,
          validationStatus: item.validationStatus || "valid",
          aiReasoning: item.aiReasoning || "",
          confidenceScore: item.confidenceScore || 85,
          documentSource: item.documentSource || ""
        }));
        console.log(`✅ Multi-field extraction mapped ${results.length} results with identifierIds`);
      } else if (isCreateOperation) {
        // CREATE operations: AI generates new records
        results = parsedResults.map((item: any) => ({
          identifierId: null, // New records don't have identifierIds yet
          extractedValue: item.extractedValue !== undefined ? item.extractedValue : item.value || item,
          validationStatus: item.validationStatus || "pending",
          aiReasoning: item.aiReasoning || "",
          confidenceScore: item.confidenceScore || 85,
          documentSource: item.documentSource || ""
        }));
        console.log(`🆕 CREATE operation generated ${results.length} new records`);
      } else {
        // UPDATE operations: Map to existing records OR handle Input Data
        if (inputArray.length === 0) {
          // Check if we have Input Data parameter with identifierIds
          const inputDataParam = inputs['Input Data'];
          if (inputDataParam && Array.isArray(inputDataParam) && inputDataParam.length > 0 && inputDataParam[0].identifierId) {
            console.log(`🔄 UPDATE operation with Input Data: ${inputDataParam.length} records with identifierIds`);
            console.log(`🔄 AI returned ${parsedResults.length} values`);
            
            // Log the first few identifierIds to verify they exist
            console.log(`📊 Input Data identifierIds (first 3):`);
            inputDataParam.slice(0, 3).forEach((item: any, idx: number) => {
              console.log(`   [${idx}] identifierId: ${item.identifierId}`);
            });
            
            // Check if AI returned any identifierIds
            const aiReturnedIds = parsedResults.filter((r: any) => r.identifierId).length;
            console.log(`🔍 AI returned ${aiReturnedIds} results with identifierIds out of ${parsedResults.length} total`);
            
            // Map AI results by identifierId (AI should return matching identifierIds)
            if (parsedResults.length > 0) {
              // Create a map of AI results by identifierId
              const resultMap = new Map<string, any>();
              parsedResults.forEach((result: any) => {
                if (result.identifierId) {
                  resultMap.set(result.identifierId, result);
                }
              });
              
              // Map Input Data records to results using identifierId
              results = inputDataParam.map((record: any) => {
                const aiResult = resultMap.get(record.identifierId);
                
                if (aiResult) {
                  // Found matching AI result by identifierId
                  return {
                    identifierId: record.identifierId,
                    extractedValue: aiResult.extractedValue || aiResult.value || null,
                    validationStatus: aiResult.validationStatus || "valid",
                    aiReasoning: aiResult.aiReasoning || `Extracted value: ${aiResult.extractedValue || 'none'}`,
                    confidenceScore: aiResult.confidenceScore || 85,
                    documentSource: aiResult.documentSource || ""
                  };
                } else {
                  // No AI result for this identifierId - use fallback by index
                  const index = inputDataParam.indexOf(record);
                  const fallbackResult = parsedResults[index % parsedResults.length];
                  
                  return {
                    identifierId: record.identifierId,
                    extractedValue: fallbackResult?.extractedValue || fallbackResult?.value || null,
                    validationStatus: fallbackResult?.validationStatus || "invalid",
                    aiReasoning: fallbackResult?.aiReasoning || "No matching result found",
                    confidenceScore: fallbackResult?.confidenceScore || 50,
                    documentSource: fallbackResult?.documentSource || ""
                  };
                }
              });
              console.log(`✅ Mapped ${results.length} records using identifierIds (${resultMap.size} direct matches)`);
            } else {
              // No AI results - create placeholder records
              results = inputDataParam.map((record: any) => ({
                identifierId: record.identifierId,
                extractedValue: null,
                validationStatus: "invalid",
                aiReasoning: "No value extracted",
                confidenceScore: 0,
                documentSource: ""
              }));
              console.log(`⚠️ Created ${results.length} placeholder records (no AI results)`);
            }
          } else {
            // No Input Data with identifierIds - map what we have
            results = this.mapResultsToInputs(parsedResults, inputArray);
            console.log(`🔄 UPDATE operation processed ${results.length} records`);
          }
        } else {
          // We have existing records to update - use normal mapping
          results = this.mapResultsToInputs(parsedResults, inputArray);
          console.log(`🔄 UPDATE operation processed ${results.length} records`);
        }
      }
      
      if (progressCallback) {
        const total = inputArray.length || results.length || 1;
        progressCallback(total, total, 'Complete');
      }
      
      console.log(`✅ AI extraction complete: ${results.length} results`);
      return results;
      
    } catch (error) {
      console.error('❌ AI tool error:', error);
      
      // Return error results based on operation type
      const isCreateOperation = tool.operationType?.includes('create');
      
      if (!isCreateOperation) {
        // For UPDATE operations, maintain identifierId mapping
        const dataInput = this.findDataInput(tool, inputs);
        if (dataInput && Array.isArray(dataInput.value)) {
          return dataInput.value.map((item: any) => ({
            identifierId: item.identifierId || null,
            extractedValue: null,
            validationStatus: "invalid" as const,
            aiReasoning: `AI processing failed: ${error instanceof Error ? error.message : String(error)}`,
            confidenceScore: 0,
            documentSource: "ERROR"
          }));
        }
      }
      
      // For CREATE operations or when no data input, just throw the error
      throw error;
    }
  }
  
  /**
   * Find the data input parameter from inputs
   */
  private findDataInput(tool: Tool, inputs: Record<string, any>): { key: string; value: any } | null {
    console.log(`🔍 DEBUG findDataInput - Looking for data input...`);
    console.log(`   Available input keys: [${Object.keys(inputs).join(', ')}]`);
    
    // Debug: Log tool.inputParameters structure
    console.log(`   Tool has ${tool.inputParameters?.length || 0} input parameters defined`);
    if (tool.inputParameters && tool.inputParameters.length > 0) {
      console.log(`   Tool input parameters:`, tool.inputParameters.map(p => `${p.name} (type: ${p.type})`));
    }
    
    // First try to find by parameter type
    if (tool.inputParameters && Array.isArray(tool.inputParameters)) {
      for (const [key, value] of Object.entries(inputs)) {
        console.log(`   Checking key: "${key}", type: ${typeof value}, isArray: ${Array.isArray(value)}`);
        const param = tool.inputParameters.find(p => p.id === key || p.name === key);
        if (param) {
          console.log(`     Found matching parameter: ${param.name} (type: ${param.type})`);
        }
        if (param?.type === 'data' && Array.isArray(value)) {
          console.log(`📊 ✅ Found data parameter "${key}" with ${value.length} items`);
          return { key, value };
        }
      }
    }
    
    // Fallback: Look for common data keys used by extraction endpoints
    const dataKeys = ['Input Data', 'List Item', 'data', 'records', 'items', 'rows', 'previousData'];
    console.log(`   Checking fallback data keys: [${dataKeys.join(', ')}]`);
    for (const key of dataKeys) {
      if (inputs[key]) {
        console.log(`     Key "${key}" exists: ${typeof inputs[key]}, isArray: ${Array.isArray(inputs[key])}, length: ${Array.isArray(inputs[key]) ? inputs[key].length : 'N/A'}`);
        if (Array.isArray(inputs[key])) {
          console.log(`📊 ✅ Found data in fallback key: "${key}" with ${inputs[key].length} items`);
          if (inputs[key].length > 0) {
            console.log(`     Sample record:`, inputs[key][0]);
          }
          return { key, value: inputs[key] };
        }
      }
    }
    
    console.log(`⚠️ ❌ No data input found. Debugging why...`);
    console.log(`   Available keys: ${Object.keys(inputs).join(', ')}`);
    console.log(`   Full inputs structure for debugging:`);
    for (const [key, value] of Object.entries(inputs)) {
      if (Array.isArray(value)) {
        console.log(`     "${key}": Array with ${value.length} items`);
        if (value.length > 0) {
          console.log(`       First item:`, value[0]);
        }
      } else if (typeof value === 'object' && value !== null) {
        console.log(`     "${key}": Object with keys [${Object.keys(value).join(', ')}]`);
      } else if (typeof value === 'string' && value.length > 100) {
        console.log(`     "${key}": String (${value.length} chars) - "${value.substring(0, 100)}..."`);
      } else {
        console.log(`     "${key}": ${typeof value} - ${JSON.stringify(value)}`);
      }
    }
    
    return null;
  }
  
  /**
   * Build AI prompt from tool template and inputs
   * This is the STANDARDIZED prompt structure for ALL AI tools
   */
  private buildAIPrompt(tool: Tool, inputs: Record<string, any>, dataArray: any[] = []): string {
    const basePrompt = tool.aiPrompt || '';
    
    // Check for multi-field Info Page extraction - preserve them before deleting
    const infoPageFields = inputs.__infoPageFields;
    if (infoPageFields) {
      console.log('📋 Preserving multi-field definitions for prompt:', infoPageFields.length, 'fields');
      // DO NOT DELETE __infoPageFields - we need it later to detect multi-field extraction
    }
    
    // Extract value configuration - this tells us what field is being extracted
    const valueConfig = inputs['valueConfiguration'];
    const valueName = valueConfig?.valueName || '';
    const valueDescription = valueConfig?.description || '';
    const stepName = valueConfig?.stepName || '';
    const inputValues = valueConfig?.inputValues || {};
    
    // STANDARDIZED INPUT EXTRACTION
    // Process all tool parameters to build the input values section
    const processedInputs: Record<string, string> = {};
    
    // Process each tool parameter to find its value
    for (const param of tool.inputParameters || []) {
      const paramId = param.id;
      const paramName = param.name;
      
      // Check for value in multiple places (in priority order)
      let paramValue = 
        inputs[paramName] ||                    // Direct by name
        inputs[paramId] ||                      // Direct by ID
        inputValues[paramId] ||                 // From value configuration by ID
        inputValues[paramName] ||               // From value configuration by name
        '';
      
      // Handle different parameter types
      if (param.type === 'document') {
        // Document content should already be loaded and available in inputs
        if (paramValue && typeof paramValue === 'string' && paramValue.length > 0) {
          processedInputs[paramName] = paramValue;
          console.log(`📄 Found document content for ${paramName}: ${paramValue.length} chars`);
        }
      } else if (param.type === 'text') {
        // Text instructions - skip pure data references
        if (typeof paramValue === 'string') {
          // Skip pure data references (single token starting with @)
          if (paramValue.startsWith('@') && paramValue.split(' ').length === 1) {
            console.log(`⏭️ Skipping data reference for ${paramName}: ${paramValue}`);
          } else if (paramValue.trim().length > 0) {
            processedInputs[paramName] = paramValue;
            console.log(`📝 Found text input for ${paramName}: "${paramValue}"`);
          }
        }
      } else if (param.type === 'data') {
        // Data arrays are handled separately (dataArray parameter)
        console.log(`📊 Data parameter ${paramName} will use provided dataArray`);
      }
    }
    
    // BUILD STANDARDIZED PROMPT STRUCTURE
    // This structure is IDENTICAL for all AI tools
    let prompt = '';
    
    // SECTION 1: Tool Function (the AI prompt template)
    prompt += `📝 AI EXTRACTION PROMPT:
================================================================================
=== TOOL FUNCTION ===
\`\`\`text
${basePrompt.trim()}
\`\`\`

=== REQUIRED OUTPUT FORMAT ===
CRITICAL: You MUST return ONLY a valid JSON array. Do NOT include any text, markdown, or explanations.
Your entire response must be a properly formatted JSON array that can be parsed by JSON.parse().
Example format:
[
  {
    "extractedValue": "Example Value",
    "validationStatus": "valid",
    "aiReasoning": "Found this value in the document",
    "confidenceScore": 95,
    "documentSource": "Section 1, Page 1"
  }
]

`;
    
    // SECTION 2: Input Values (the actual parameters being used)
    prompt += `=== INPUT VALUES ===

`;
    
    // CRITICAL: Add which specific column/field is being extracted
    if (valueName && !infoPageFields) {
      // This is a single column extraction (not multi-field Info Page)
      prompt += `**🚨 CRITICAL EXTRACTION INSTRUCTION 🚨**
================================================================================
**COLUMN TO EXTRACT**: ${valueName}
${valueDescription ? `**COLUMN DESCRIPTION**: ${valueDescription}` : ''}
${stepName ? `**FROM STEP**: ${stepName}` : ''}

⚠️ MANDATORY RULES:
1. You MUST extract ONLY the "${valueName}" column - nothing else
2. IGNORE all other columns even if they appear in the context
3. Each record in your response MUST contain ONLY the value for "${valueName}"
4. If you see data for other columns, DO NOT EXTRACT THEM
5. Focus exclusively on finding values for "${valueName}"

❌ WRONG: Extracting values from other columns
✅ RIGHT: Extracting ONLY values that belong to "${valueName}"

This is a SINGLE COLUMN extraction for: ${valueName}
================================================================================

`;
    }
    
    // Add all processed inputs in a consistent order
    // Sort by parameter order for consistency
    const sortedParams = [...(tool.inputParameters || [])].sort((a, b) => {
      // Put text params first, then documents, then data
      const typeOrder = { text: 0, document: 1, data: 2 };
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 3;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
    
    for (const param of sortedParams) {
      const value = processedInputs[param.name];
      if (value) {
        prompt += `**${param.name}**: ${value}

`;
      }
    }
    
    // Add field definitions for multi-field Info Page extraction
    if (infoPageFields && Array.isArray(infoPageFields) && infoPageFields.length > 0) {
      prompt += `
=== MULTIPLE FIELDS TO EXTRACT ===
You must extract the following ${infoPageFields.length} fields from the provided information.
IMPORTANT: Each field has a unique identifierId that MUST be included in your response for proper mapping.

`;
      infoPageFields.forEach((field: any, idx: number) => {
        const fieldId = field.identifierId || `field_${idx}`;
        prompt += `**Field ${idx + 1}: ${field.name}**
- Identifier ID: ${fieldId}
- Data Type: ${field.dataType}
- Description: ${field.description || 'Extract this field'}

`;
      });
      
      prompt += `IMPORTANT: Return a JSON array with exactly ${infoPageFields.length} objects, one for each field listed above, in the same order.
Each object must have these properties:
- identifierId: The EXACT Identifier ID from the field definition above
- extractedValue: The value extracted for this field
- validationStatus: Either "valid" or "invalid"
- aiReasoning: Your explanation for the extraction
- confidenceScore: A number between 0 and 100
- documentSource: Where in the document this was found

Example response format:
[
  {"identifierId": "${infoPageFields[0]?.identifierId || 'field_0'}", "extractedValue": "...", "validationStatus": "valid", "aiReasoning": "...", "confidenceScore": 95, "documentSource": "..."}${infoPageFields.length > 1 ? ',\n  {"identifierId": "' + (infoPageFields[1]?.identifierId || 'field_1') + '", "extractedValue": "...", "validationStatus": "valid", "aiReasoning": "...", "confidenceScore": 90, "documentSource": "..."}' : ''}
]

`;
    }
    
    // Add List Items (the data to process) - only if data is provided
    if (dataArray && dataArray.length > 0) {
      // Check if this is a column extraction with existing data
      const hasMultipleColumns = dataArray.length > 0 && dataArray[0] && Object.keys(dataArray[0]).length > 2; // More than just identifierId
      
      if (hasMultipleColumns && valueName && !infoPageFields) {
        prompt += `**CONTEXT**: The following data shows existing records with other columns already extracted.

🎯 YOUR SPECIFIC TASK: Extract ONLY the "${valueName}" value for each record.

Example: If the data has columns like "Red Flag Name", "Finding", "Risk Level" and you're extracting "Risk Level":
- ❌ DO NOT extract "Red Flag Name" values
- ❌ DO NOT extract "Finding" values  
- ✅ ONLY extract "Risk Level" values

The "${valueName}" column you're extracting is DIFFERENT from the other columns shown.
Look for information that specifically relates to "${valueName}" based on the document content.

`;
      }
      
      prompt += `**List Items** (${dataArray.length} items to process):
\`\`\`json
${JSON.stringify(dataArray, null, 2)}
\`\`\`

`;
      
      // Add critical instruction for identifierId preservation ONLY for UPDATE operations
      const hasIdentifierIds = dataArray.some(item => item.identifierId);
      const isCreateOperation = tool.operationType?.toLowerCase().includes('create');
      
      console.log(`   📊 Data array has identifierIds: ${hasIdentifierIds}`);
      console.log(`   📊 Is CREATE operation: ${isCreateOperation}`);
      console.log(`   📊 Will add identifierId requirement: ${hasIdentifierIds && !isCreateOperation}`);
      
      if (hasIdentifierIds && !isCreateOperation) {
        // Only add identifierId requirement for UPDATE operations
        console.log(`   ✅ Adding CRITICAL REQUIREMENT for identifierId preservation`);
        prompt += `=== 🚨 CRITICAL REQUIREMENT - YOU MUST RETURN ${dataArray.length} RESULTS 🚨 ===

📊 INPUT: You received ${dataArray.length} records
📊 OUTPUT: You MUST return EXACTLY ${dataArray.length} results (one for each input record)

Each item in the list above has an "identifierId" field. You MUST:
1. Return EXACTLY ${dataArray.length} results - one result for EACH input record
2. Include the EXACT SAME "identifierId" in your response for each item
3. Each result MUST have its corresponding identifierId from the input
4. The identifierId links the extracted value to the correct row/record

MANDATORY RESPONSE FORMAT:
[
${dataArray.slice(0, 2).map(item => `  {"identifierId": "${item.identifierId}", "extractedValue": "...", "validationStatus": "valid", "aiReasoning": "...", "confidenceScore": 95, "documentSource": "..."}`).join(',\n')}${dataArray.length > 2 ? ',\n  ... (continue for all ' + dataArray.length + ' records)' : ''}
]

⚠️ IMPORTANT: 
- If you return fewer than ${dataArray.length} results, the extraction will FAIL
- Each input record needs its own individual extracted value
- Do NOT return a single generic value for all records
- Look at the context data for each record to extract the appropriate value

`;
      } else if (isCreateOperation) {
        // For CREATE operations, clarify that identifierIds in input are for reference only
        prompt += `**Note**: This is a CREATE operation. The identifierIds in the input data are for reference only. You will generate NEW records based on the instructions provided. Do NOT include identifierIds in your response.

`;
      }
    } else if (tool.operationType?.includes('create')) {
      // For CREATE operations without data, add note about generating new records
      prompt += `**Note**: This is a CREATE operation. You will generate new records based on the document and instructions provided.

`;
    }
    
    // NO additional instructions or requirements added here
    // Each tool's aiPrompt contains its own specific output format requirements
    
    return prompt;
  }
  
  /**
   * Parse AI response and extract JSON
   */
  private parseAIResponse(rawResponse: string): any[] {
    let cleanJson = rawResponse.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleanJson = codeBlockMatch[1].trim();
    }
    
    // Find JSON array boundaries
    const jsonStart = cleanJson.indexOf('[');
    const jsonEnd = cleanJson.lastIndexOf(']');
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
    }
    
    try {
      const parsed = JSON.parse(cleanJson);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error: any) {
      console.error('Initial JSON parse error:', error);
      console.log(`JSON parse failed at position: ${error.message}`);
      console.log(`Response length: ${cleanJson.length} characters`);
      
      // Try to fix common JSON issues
      try {
        // More aggressive approach to fix malformed JSON
        let fixedJson = cleanJson;
        
        // If the error mentions a position, try to truncate there
        const positionMatch = error.message?.match(/position (\d+)/);
        if (positionMatch) {
          const errorPosition = parseInt(positionMatch[1]);
          console.log(`Attempting to recover by truncating at error position ${errorPosition}`);
          
          // Find the last complete object before the error position
          const beforeError = cleanJson.substring(0, errorPosition);
          const lastCompleteObject = beforeError.lastIndexOf('},');
          if (lastCompleteObject > 0) {
            fixedJson = cleanJson.substring(0, lastCompleteObject + 1) + ']';
            console.log(`Truncated at last complete object at position ${lastCompleteObject}`);
          }
        } else {
          // First, try to find where the JSON actually ends (before any trailing text)
          const lastValidBrace = fixedJson.lastIndexOf('"}');
          if (lastValidBrace > 0 && lastValidBrace < fixedJson.length - 10) {
            // There might be extra content after the JSON
            const nextBracket = fixedJson.indexOf(']', lastValidBrace);
            if (nextBracket > 0) {
              fixedJson = fixedJson.substring(0, nextBracket + 1);
              console.log('Truncated JSON at position', nextBracket + 1);
            }
          }
        }
        
        // Fix unescaped characters within string values
        // Split by quote boundaries and process each segment
        const segments = fixedJson.split('"');
        for (let i = 1; i < segments.length; i += 2) {
          // Every odd-indexed segment is inside quotes (string content)
          if (segments[i]) {
            // Escape newlines, tabs, and quotes within string values
            segments[i] = segments[i]
              .replace(/\\/g, '\\\\')  // Escape backslashes first
              .replace(/\n/g, '\\n')   // Escape newlines
              .replace(/\r/g, '\\r')   // Escape carriage returns
              .replace(/\t/g, '\\t');  // Escape tabs
          }
        }
        fixedJson = segments.join('"');
        
        // Try parsing the fixed JSON
        const parsed = JSON.parse(fixedJson);
        console.log('Successfully parsed after fixing escape sequences');
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (fixError) {
        console.error('Failed to fix JSON:', fixError);
        
        // Try one more aggressive fix - extract just the essential fields
        try {
          const essentialPattern = /"identifierId"\s*:\s*"([^"]+)".*?"extractedValue"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/gs;
          const matches = [...cleanJson.matchAll(essentialPattern)];
          
          if (matches.length > 0) {
            const results = matches.map(match => ({
              identifierId: match[1],
              extractedValue: match[2] || null,
              validationStatus: "valid",
              aiReasoning: "Extracted from malformed JSON response",
              confidenceScore: 0.5,
              documentSource: "RECOVERED"
            }));
            console.log(`Recovered ${results.length} records from malformed JSON`);
            return results;
          }
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError);
        }
      }
      
      // Try to extract individual objects as fallback
      console.log('Attempting to extract individual objects from malformed JSON...');
      const objects = [];
      
      // More robust regex to find objects with identifierId and extractedValue
      const objectPattern = /\{[^{}]*"identifierId"\s*:\s*"[^"]+",.*?"extractedValue"\s*:.*?\}/gs;
      const objectMatches = cleanJson.match(objectPattern);
      
      if (objectMatches) {
        for (const objStr of objectMatches) {
          try {
            // Clean up the extracted object string
            let cleanedObj = objStr
              .replace(/[\n\r]+/g, ' ')  // Replace newlines with spaces
              .replace(/\s+/g, ' ')       // Normalize whitespace
              .replace(/,\s*}/g, '}');    // Remove trailing commas
            
            const parsed = JSON.parse(cleanedObj);
            objects.push(parsed);
            console.log(`Extracted object with identifierId: ${parsed.identifierId}`);
          } catch (objError) {
            console.error('Failed to parse extracted object:', objError);
          }
        }
      }
      
      if (objects.length > 0) {
        console.log(`Successfully extracted ${objects.length} objects from malformed JSON`);
        return objects;
      }
      
      // If we still can't parse anything, throw the original error
      throw error;
    }
  }
  
  /**
   * Map AI results to input records, preserving identifierId
   */
  private mapResultsToInputs(parsedResults: any[], inputArray: any[]): ToolResult[] {
    // Create map of results by identifierId
    const resultMap = new Map<string, any>();
    for (const result of parsedResults) {
      if (result.identifierId) {
        resultMap.set(result.identifierId, result);
      }
    }
    
    // Map each input to its result - AI MUST preserve identifierIds
    return inputArray.map((input, index) => {
      const inputId = input.identifierId;
      
      // Try to find result by identifierId first
      let result = resultMap.get(inputId);
      
      // Fallback to position-based matching if AI didn't preserve IDs
      if (!result && index < parsedResults.length) {
        result = parsedResults[index];
        if (result && inputId) {
          console.warn(`⚠️ AI didn't preserve identifierId at position ${index}. Expected: ${inputId}, Got: ${result.identifierId || 'none'}`);
        }
      }
      
      if (result) {
        return {
          identifierId: inputId, // Always use input's identifierId
          extractedValue: result.extractedValue !== undefined ? result.extractedValue : null,
          validationStatus: result.validationStatus || "valid",
          aiReasoning: result.aiReasoning || "",
          confidenceScore: result.confidenceScore || 95,
          documentSource: result.documentSource || ""
        };
      }
      
      // Return "Not Found" for missing results
      return {
        identifierId: inputId,
        extractedValue: "Not Found",
        validationStatus: "invalid",
        aiReasoning: "No result from AI",
        confidenceScore: 0,
        documentSource: ""
      };
    });
  }
  
  /**
   * Test code-based tool with rich context support
   */
  private async testCodeTool(
    tool: Tool, 
    inputs: Record<string, any>,
    contextData?: {
      projectId?: string;
      sessionId?: string;
      documentIds?: string[];
      previousData?: any[];
      stepId?: string;
    }
  ): Promise<ToolResult[]> {
    try {
      if (!tool.functionCode) {
        throw new Error('Function code not found');
      }
      
      // Normalize parameter names to match what the Python function expects
      // Python functions typically use snake_case, so convert spaces to underscores
      const normalizedInputs: Record<string, any> = {};
      for (const [key, value] of Object.entries(inputs)) {
        // Convert parameter names like "Excel File" to "excel_file"
        const normalizedKey = key.replace(/\s+/g, '_').toLowerCase();
        normalizedInputs[normalizedKey] = value;
        
        // For document/file parameters, also try replacing "file" with "content"
        // since many functions expect "excel_content" instead of "excel_file"
        if (normalizedKey.includes('_file')) {
          const contentKey = normalizedKey.replace('_file', '_content');
          normalizedInputs[contentKey] = value;
          console.log(`🔄 Also adding ${contentKey} for document parameter`);
        }
        
        // Also keep the original key for backward compatibility
        normalizedInputs[key] = value;
      }
      
      console.log('🐍 Normalized inputs for Python function:', Object.keys(normalizedInputs));
      
      // Build rich context if context data is available
      let richContext: import('@shared/schema').RichExtractionContext | undefined;
      if (contextData?.projectId && contextData?.sessionId && contextData?.stepId) {
        console.log('🎯 Building rich extraction context for CODE tool...');
        richContext = await this.buildRichExtractionContext({
          projectId: contextData.projectId,
          sessionId: contextData.sessionId,
          documentIds: contextData.documentIds || [],
          inputValues: normalizedInputs,
          previousData: contextData.previousData || [],
          stepId: contextData.stepId
        });
      } else {
        console.log('⚠️ Context data not available - using legacy format');
      }
      
      // Write function to temporary file to avoid string escaping issues
      const tempDir = '/tmp';
      const tempFile = path.join(tempDir, `test_function_${Date.now()}.py`);
      
      const testScript = this.buildCodeTestScript(tool, normalizedInputs, richContext);
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
    projectId: string,
    fields?: Array<{name: string; dataType: string; description: string; identifierId?: string}> // For multi-field Info Page values with identifierIds
  ): Promise<ToolResult[]> {
    console.log('🎯 runToolForExtraction called', { toolId, sessionId, projectId, fieldsCount: fields?.length });
    
    // Get the tool from storage
    const tool = await storage.getExcelWizardryFunction(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    console.log('📦 Tool found:', tool.name, 'Type:', tool.toolType);
    console.log('📊 Fields provided:', fields?.length || 0);
    
    // If fields are provided (Info Page multi-field extraction), modify inputs to include fields info
    // CRITICAL: Add fields for BOTH AI and CODE tools to support identifier mapping
    if (fields && fields.length > 0) {
      inputs.__infoPageFields = fields;
      console.log('📋 Multi-field Info Page extraction with identifierIds for', tool.toolType, 'tool:');
      fields.forEach((f, idx) => {
        console.log(`  Field ${idx + 1}: ${f.name} (ID: ${f.identifierId})`);
      });
    }
    
    // Execute the tool
    return this.testTool(tool, inputs);
  }

  /**
   * Build generation prompt for AI/CODE tools
   */
  private buildGenerationPrompt(tool: Omit<Tool, 'id' | 'functionCode' | 'aiPrompt'>): string {
    const paramList = tool.inputParameters.map(p => `- ${p.name} (${p.type}): ${p.description}`).join('\n');
    
    if (tool.toolType === "AI_ONLY") {
      // Determine if this is a create or update operation
      const isCreate = tool.operationType?.startsWith('create');
      const isMultiple = tool.operationType?.includes('Multiple') || tool.outputType === "multiple";
      
      // Generate appropriate JSON format based on outputType
      const jsonFormat = !isMultiple 
        ? `{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "source"}`
        : `[{"extractedValue": "result1", "validationStatus": "valid", "aiReasoning": "explanation1", "confidenceScore": 95, "documentSource": "source1"}, {"extractedValue": "result2", "validationStatus": "valid", "aiReasoning": "explanation2", "confidenceScore": 90, "documentSource": "source2"}]`;
      
      const resultDescription = !isMultiple
        ? "Return the result as a single JSON object"
        : "Return results as a JSON array of objects";
      
      // Build operation-specific guidance
      const operationGuidance = isCreate 
        ? `IMPORTANT: This tool is configured to CREATE new records. 
   - Input data is for REFERENCE ONLY - use it to understand context or filter what to extract
   - DO NOT require linking or mapping to existing records
   - Each extracted item should be treated as a new, independent record
   - Focus on extracting/generating new data based on the provided documents and instructions`
        : `IMPORTANT: This tool is configured to UPDATE existing records.
   - Input data represents EXISTING records that need to be updated
   - MAINTAIN proper record linkage - preserve identifiers and order
   - Match extracted values to corresponding input records
   - Return items in the SAME ORDER as input to maintain proper record linkage`;
      
      return `Create an AI prompt for the following task:

Task: ${tool.name}
Description: ${tool.description}
Operation Type: ${isCreate ? "CREATE" : "UPDATE"} ${isMultiple ? "MULTIPLE RECORDS" : "SINGLE RECORD"}
Input Parameters:
${paramList}

${operationGuidance}

CRITICAL REQUIREMENT:
${!isMultiple 
  ? "The prompt MUST instruct to return a SINGLE JSON OBJECT (not an array). Example format:\n" + jsonFormat
  : "The prompt MUST instruct to return a JSON ARRAY of objects. Example format:\n" + jsonFormat}

Create a detailed, specific prompt that:
1. References input parameters using backticks like \`${tool.inputParameters.map(p => p.name).join('\`, \`')}\`
2. ${!isMultiple 
     ? "Clearly states to return ONE JSON OBJECT with these keys: extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource"
     : "Clearly states to return a JSON ARRAY of objects, each with these keys: extractedValue, validationStatus, aiReasoning, confidenceScore, documentSource"}
3. Explains what each field means:
   - extractedValue: The actual extracted data
   - validationStatus: "valid" or "invalid" based on confidence
   - aiReasoning: Explanation of extraction logic
   - confidenceScore: 0-100 confidence level
   - documentSource: Source document/page reference
4. ${!isMultiple
     ? "Emphasizes returning ONLY ONE OBJECT, not an array"
     : isCreate 
       ? "Specifies to return multiple items as an array, ordered as they appear in the source document"
       : "Specifies to return multiple items as an array, maintaining the SAME ORDER as input for proper record linkage"}
5. ${isCreate 
     ? "Clarifies that input data is for reference/context only - not for record linkage"
     : "Emphasizes maintaining proper record linkage and order preservation"}

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
Excel files are already extracted as text content in this format:
=== Sheet: SheetName ===
Column1\tColumn2\tColumn3...
Value1\tValue2\tValue3...

To process Excel content:
1. The excel_file parameter contains the extracted text, NOT a file path
2. Split by lines and parse tab-separated values
3. First line after "=== Sheet:" contains headers
4. Subsequent lines contain data rows
5. DO NOT use openpyxl - the content is already extracted
6. Parse the text directly using string methods

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

CRITICAL: Return items in the SAME ORDER as the input array to maintain proper record linkage.

Return an array of these objects: [object1, object2, ...]
`;
      }

      return `Create a Python function for the following task:

Task: ${tool.name}  
Description: ${tool.description}
Input Parameters:
${paramList}
${excelTraining}

PARAMETER ACCESS PATTERN:
Your function will receive parameters via **kwargs. Parameters may have multiple name variations. Use this helper to find parameters:

    def get_param(kwargs, *names):
        for name in names:
            if name in kwargs and kwargs[name] is not None:
                return kwargs[name]
        return None

    excel_file = get_param(kwargs, 'Excel File', 'excel_file', 'document', 'excel_content')
    input_data = get_param(kwargs, 'Input Data', 'input_data', 'data')

EXCEL PARSING - Sheet Name Extraction:
When parsing Excel content with sheet markers like "=== Sheet: Active deferreds ===", extract ONLY the sheet name:

    if line.startswith('=== Sheet:'):
        # Extract and clean the sheet name
        sheet_name = line.replace('=== Sheet:', '').replace('===', '').strip()
        # Result: "Active deferreds" (clean, no === markers)

INPUT DATA PARAMETER HANDLING (for UPDATE operations):
Your function receives "Input Data" with objects containing identifierId + previous column values:

    [
      {"identifierId": "abc-123", "Column Name": "First Name"},
      {"identifierId": "def-456", "Column Name": "Last Name"}
    ]

Complete Processing Pattern:
    def get_param(kwargs, *names):
        for name in names:
            if name in kwargs and kwargs[name] is not None:
                return kwargs[name]
        return None
    
    excel_file = get_param(kwargs, 'Excel File', 'excel_file', 'document', 'excel_content')
    input_data = get_param(kwargs, 'Input Data', 'input_data', 'data')
    
    # Parse Excel to extract all worksheets
    worksheets = {}
    current_sheet = None
    for line in excel_file.split('\n'):
        if line.startswith('=== Sheet:'):
            sheet_name = line.replace('=== Sheet:', '').replace('===', '').strip()
            worksheets[sheet_name] = {'headers': [], 'data': []}
            current_sheet = sheet_name
        elif current_sheet and not worksheets[current_sheet]['headers']:
            worksheets[current_sheet]['headers'] = [h.strip() for h in line.split('\t')]
    
    # Process each item from Input Data
    results = []
    for item in input_data:
        identifier = item['identifierId']
        prev_keys = [k for k in item.keys() if k != 'identifierId']
        column_value = item[prev_keys[0]] if prev_keys else None
        
        # Search ALL worksheets for the column
        found_sheet = None
        for sheet_name, sheet_data in worksheets.items():
            if column_value in sheet_data['headers']:
                found_sheet = sheet_name
                break
        
        results.append({
            "identifierId": identifier,
            "extractedValue": found_sheet,
            "validationStatus": "valid" if found_sheet else "invalid",
            "aiReasoning": f"Found in {found_sheet}" if found_sheet else "Not found",
            "confidenceScore": 100 if found_sheet else 0,
            "documentSource": found_sheet or "None"
        })
    
    return json.dumps(results)

CRITICAL INSTRUCTIONS:
You MUST return actual Python code - a complete function definition, NOT JSON data.

The function should:
- Be named 'extract_data'
- Accept parameters matching the input parameters above using *args, **kwargs for flexibility
- Use standard Python libraries (NO openpyxl - Excel content is already extracted as text)
- Process the input data according to the task description
- For UPDATE operations: preserve identifierId, use previous columns as context only
- Return a JSON array of field validation objects

Example function structure:
\`\`\`python
def extract_data(excel_file):
    import json
    
    # Parse the extracted Excel content (already in text format)
    lines = excel_file.strip().split('\n')
    
    # Find the sheet data
    data_rows = []
    headers = []
    for i, line in enumerate(lines):
        if line.startswith('=== Sheet:'):
            # Headers are on the next line
            if i + 1 < len(lines):
                headers = lines[i + 1].split('\t')
                # Data rows follow
                for j in range(i + 2, len(lines)):
                    if lines[j].strip() and not lines[j].startswith('==='):
                        data_rows.append(lines[j].split('\t'))
                    elif lines[j].startswith('==='):
                        break
    
    results = []
    # Your extraction logic here
    # Process headers and data_rows
    
    return json.dumps(results)
\`\`\`

Each result object in the array must have:
- extractedValue: The extracted data value
- validationStatus: "valid" or "invalid" 
- aiReasoning: Brief explanation of the extraction
- confidenceScore: Number between 0-100
- documentSource: Source document/location reference

IMPORTANT: Return ONLY the Python function code, starting with 'def extract_data' and ending with the return statement. Do not include any markdown formatting, explanations, or example output - just the pure Python code.`;
    }
  }
  
  /**
   * Build test prompt for AI tools
   */
  private buildTestPrompt(tool: Tool, inputs: Record<string, any>): string {
    let aiPrompt = tool.aiPrompt || tool.description;
    
    // Log what inputs we're receiving
    console.log('🔍 Building test prompt with inputs:', Object.keys(inputs));
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'string' && val.length > 100) {
        console.log(`  📄 ${key}: String with ${val.length} chars - Preview: "${val.substring(0, 100)}..."`);
      } else if (Array.isArray(val)) {
        console.log(`  📊 ${key}: Array with ${val.length} items`);
      } else if (typeof val === 'string') {
        console.log(`  📝 ${key}: "${val}"`);
      } else {
        console.log(`  🔢 ${key}: ${typeof val}`);
      }
    }
    
    // Format inputs properly, handling data arrays specially
    const formattedInputs = Object.entries(inputs).map(([key, value]) => {
      // Find the parameter definition by ID or name
      const param = tool.inputParameters.find(p => p.id === key || p.name === key);
      
      if (param?.type === 'data') {
        // For data parameters with arrays, check if value is an array
        if (Array.isArray(value)) {
          // When receiving array data (like column names from previous step)
          console.log(`📊 Processing data array for ${param.name}: ${value.length} items`);
          
          // CRITICAL: Preserve the full structure for proper identifierId mapping
          // Return as JSON array to maintain structure
          return `${param.name} (${value.length} items total - PROCESS ALL ${value.length} ITEMS):
${JSON.stringify(value, null, 2)}`;
        } else if (param.sampleData?.rows) {
          // Use sample data if available
          return `${param.name}: ${JSON.stringify(param.sampleData.rows, null, 2)}`;
        }
      } else if (param?.type === 'document') {
        // Handle document parameters specially
        if (typeof value === 'string' && value.length > 0) {
          console.log(`📚 Including reference document for ${param.name}: ${value.length} chars`);
          return `${param.name || 'Reference Document'}:
${value}`;
        } else {
          console.log(`⚠️ No reference document content for ${param.name}`);
          return `${param.name || 'Reference Document'}: [No document provided]`;
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
    
    // Check if this is an AI tool that processes list data and add appropriate instructions
    if (tool.name?.toLowerCase().includes('query') || tool.name?.toLowerCase().includes('document') || 
        (arrayParams.length > 0 && tool.toolType === 'AI_ONLY')) {
      
      // Check the tool's operation type to determine appropriate instructions
      if (tool.operationType?.includes('update')) {
        // For UPDATE operations - preserve identifierIds for record linkage
        if (!aiPrompt.includes('identifierId') && !aiPrompt.includes('REQUIRED OUTPUT FORMAT')) {
          aiPrompt += `

REQUIRED OUTPUT FORMAT:
Return a JSON array where each object contains these exact fields:
{
  "identifierId": "The identifier from the input data row (CRITICAL - preserve exactly as provided)",
  "extractedValue": "The extracted/mapped value based on the reference document",
  "validationStatus": "valid" or "invalid",
  "aiReasoning": "Brief explanation of why this mapping was chosen",
  "confidenceScore": 80-100 for clear matches, 50-79 for partial matches, <50 for uncertain,
  "documentSource": "Reference to the rule or section used for mapping"
}

⚠️⚠️⚠️ CRITICAL INSTRUCTIONS FOR UPDATE OPERATION - FAILURE TO FOLLOW WILL BREAK THE SYSTEM ⚠️⚠️⚠️
1. Each input object has an "identifierId" field - you MUST copy this EXACT value to your output
2. DO NOT GENERATE NEW UUIDs - Use the identifierId values PROVIDED in the input
3. For input object at index 0, use its identifierId for output object at index 0
4. For input object at index 1, use its identifierId for output object at index 1
5. And so on for ALL items - maintain exact 1-to-1 correspondence
6. If no value can be extracted, still include the record with "Not Found" as extractedValue
7. The identifierId is what links your output to existing database records - getting this wrong creates duplicate rows
8. Return ONLY the JSON array, no explanations or markdown formatting

⚠️ IDENTIFIERID PRESERVATION IS MANDATORY - EXAMPLES:
✅ CORRECT: Input has identifierId "b4ecc9a0-97ea-40fd-9d5d-4b5641a37e15" → Output MUST have identifierId "b4ecc9a0-97ea-40fd-9d5d-4b5641a37e15"
❌ WRONG: Input has identifierId "b4ecc9a0-97ea-40fd-9d5d-4b5641a37e15" → Output has new UUID "d24a95d6-f05f-4688-86c3-862b1c3da9a9"

STEP-BY-STEP PROCESS:
1. Read the identifierId from each input object
2. Copy it EXACTLY to your output object for that item
3. Add the extracted value and other required fields
4. Move to the next input object and repeat`;
        }
      } else if (tool.operationType?.includes('create')) {
        // For CREATE operations - no identifierId preservation needed
        if (!aiPrompt.includes('REQUIRED OUTPUT FORMAT')) {
          aiPrompt += `

REQUIRED OUTPUT FORMAT:
Return a JSON array where each object contains these exact fields:
{
  "extractedValue": "The newly extracted/created value",
  "validationStatus": "valid" or "invalid",
  "aiReasoning": "Brief explanation of the extraction logic",
  "confidenceScore": 80-100 for clear matches, 50-79 for partial matches, <50 for uncertain,
  "documentSource": "Reference to the source of extraction"
}

IMPORTANT FOR CREATE OPERATION:
1. You are creating NEW records - do NOT include "identifierId" in your output
2. Each extracted item will be assigned a new unique identifier by the system
3. Focus on extracting/creating the data values based on your tool's logic
4. Return ONLY the JSON array, no explanations or markdown formatting
5. The input data is for reference/context only - you are NOT updating existing records

EXAMPLE OUTPUT:
[{"extractedValue": "New Item 1", "validationStatus": "valid", "aiReasoning": "Found in source", "confidenceScore": 95, "documentSource": "Page 1"}]`;
        }
      } else {
        // Default case - for tools without explicit operation type, use update behavior
        // This maintains backward compatibility
        if (!aiPrompt.includes('identifierId') && !aiPrompt.includes('REQUIRED OUTPUT FORMAT')) {
          aiPrompt += `

REQUIRED OUTPUT FORMAT:
Return a JSON array where each object contains these exact fields:
{
  "identifierId": "The identifier from the input data row (preserve if provided)",
  "extractedValue": "The extracted/mapped value",
  "validationStatus": "valid" or "invalid",
  "aiReasoning": "Brief explanation",
  "confidenceScore": 0-100 confidence score,
  "documentSource": "Reference to source"
}

Note: If input includes identifierId, preserve it in your output. Otherwise, omit it.`;
        }
      }
    }
    
    // Use the AI prompt with input data
    const finalPrompt = `${aiPrompt}

Input Data:
${formattedInputs}${arrayInstruction}`;
    
    // Log if reference document is included
    console.log('🔍 CHECKING PROMPT FOR REFERENCE DOCUMENT...');
    if (finalPrompt.includes('Reference Document:')) {
      const docMatch = finalPrompt.match(/Reference Document:\s*([\s\S]{0,500})/);
      if (docMatch) {
        console.log('✅ Reference Document IS included in prompt');
        console.log('  📄 Document preview:', docMatch[1].substring(0, 300) + '...');
      }
    } else if (formattedInputs.includes('Reference Document:')) {
      console.log('✅ Reference Document IS included in formattedInputs');
      const docMatch = formattedInputs.match(/Reference Document:\s*([\s\S]{0,500})/);
      if (docMatch) {
        console.log('  📄 Document preview:', docMatch[1].substring(0, 300) + '...');
      }
    } else {
      console.log('⚠️ WARNING: No Reference Document found in prompt!');
      console.log('  Input keys provided:', Object.keys(inputs));
      console.log('  Tool expects parameters:', tool.inputParameters.map(p => `${p.name} (${p.id})`));
    }
    
    return finalPrompt;
  }
  
  /**
   * Build Python test script for CODE tools
   */
  private buildCodeTestScript(
    tool: Tool, 
    inputs: Record<string, any>,
    richContext?: import('@shared/schema').RichExtractionContext
  ): string {
    // Safe JSON transport using base64 encoding to avoid any escaping issues
    const inputsBase64 = Buffer.from(JSON.stringify(inputs)).toString('base64');
    const parametersBase64 = Buffer.from(JSON.stringify(tool.inputParameters)).toString('base64');
    const richContextBase64 = Buffer.from(JSON.stringify(richContext || {})).toString('base64');
    const outputType = tool.outputType || 'single';
    
    const functionCode = tool.functionCode || "";
    return `import json
import sys
import traceback
import inspect
import base64

# Generated function code
${functionCode}

# Test harness
try:
    # Decode and parse JSON safely using base64 transport
    inputs = json.loads(base64.b64decode('${inputsBase64}').decode('utf-8'))
    parameters = json.loads(base64.b64decode('${parametersBase64}').decode('utf-8'))
    rich_context = json.loads(base64.b64decode('${richContextBase64}').decode('utf-8'))
    
    # CRITICAL: Store rich context in namespaced key to avoid collisions
    # Legacy inputs remain unchanged
    combined_inputs = {**inputs}  # Start with legacy inputs
    
    if rich_context and any(rich_context.values()):
        print("🎯 Rich context available - adding to namespaced key", file=sys.stderr)
        print(f"  - Reference data items: {len(rich_context.get('reference data', []))}", file=sys.stderr)
        print(f"  - Reference documents: {len(rich_context.get('reference documents', []))}", file=sys.stderr)  
        print(f"  - Text inputs: {len(rich_context.get('text', []))}", file=sys.stderr)
        
        # Store rich context under namespaced key to avoid collisions
        combined_inputs['rich_context'] = rich_context
        
        # Add snake_case aliases ONLY if they don't exist in legacy inputs
        if 'reference_data' not in combined_inputs:
            combined_inputs['reference_data'] = rich_context.get('reference data', [])
        if 'reference_documents' not in combined_inputs:
            combined_inputs['reference_documents'] = rich_context.get('reference documents', [])
        if 'text' not in combined_inputs:
            combined_inputs['text'] = rich_context.get('text', [])
        
        print(f"🔧 Combined inputs keys: {list(combined_inputs.keys())}", file=sys.stderr)
    else:
        print("⚠️ Using legacy input format only", file=sys.stderr)
    
    # Use combined inputs for function execution
    inputs = combined_inputs
    
    # Extract the function name from the code
    import re
    function_match = re.search(r'def\\s+(\\w+)\\s*\\(', '''${functionCode}''')
    if not function_match:
        raise Exception("Could not find function definition in code")
    
    function_name = function_match.group(1)
    
    # Get the function from globals
    if function_name not in globals():
        raise Exception(f"Function {function_name} not found in globals")
    
    func = globals()[function_name]
    
    # Get the function's expected parameters
    sig = inspect.signature(func)
    expected_params = list(sig.parameters.keys())
    
    # Debug: Show what inputs we received
    print(f"DEBUG: Received inputs keys: {list(inputs.keys())}", file=sys.stderr)
    for key in inputs.keys():
        val = inputs[key]
        if isinstance(val, list) and len(val) > 0:
            print(f"DEBUG: Input '{key}' is array with {len(val)} items", file=sys.stderr)
            if isinstance(val[0], dict):
                print(f"DEBUG: First item of '{key}': {val[0]}", file=sys.stderr)
        elif isinstance(val, str) and len(val) > 100:
            print(f"DEBUG: Input '{key}' is string ({len(val)} chars): {val[:100]}...", file=sys.stderr)
        else:
            print(f"DEBUG: Input '{key}': {val}", file=sys.stderr)
    
    # Check if function uses *args, **kwargs pattern
    if 'args' in expected_params and 'kwargs' in expected_params:
        # Function expects *args and **kwargs, so pass inputs directly as kwargs
        print(f"🔧 Function uses *args/**kwargs pattern, passing all inputs as kwargs", file=sys.stderr)
        result = func(**inputs)
    else:
        # Filter inputs to only include parameters the function expects
        filtered_inputs = {}
        for param in expected_params:
            # Try to find the input value using various key mappings
            value = None
            
            # Direct match
            if param in inputs:
                value = inputs[param]
            # Try with underscores replaced by spaces
            elif param.replace('_', ' ') in inputs:
                value = inputs[param.replace('_', ' ')]
            # Try title case version
            elif param.replace('_', ' ').title() in inputs:
                value = inputs[param.replace('_', ' ').title()]
            # Common mappings for document parameters
            elif 'excel' in param.lower() and 'Excel File' in inputs:
                value = inputs['Excel File']
            elif 'document' in param.lower() and 'document' in inputs:
                value = inputs['document']
            elif 'content' in param.lower():
                # Try various content-related keys
                for key in ['Excel File', 'document', 'Document', 'file_content', 'content']:
                    if key in inputs:
                        value = inputs[key]
                        break
            elif 'column' in param.lower():
                # For column-related parameters, try various keys
                for key in ['column', 'Column', 'column_name', 'Column Name']:
                    if key in inputs:
                        value = inputs[key]
                        break
            
            if value is not None:
                filtered_inputs[param] = value
                # Better debugging for arrays and objects
                if isinstance(value, list):
                    print(f"✓ Mapped parameter '{param}' to array with {len(value)} items", file=sys.stderr)
                    if len(value) > 0:
                        print(f"  First item type: {type(value[0]).__name__}", file=sys.stderr)
                        if isinstance(value[0], dict):
                            print(f"  First item keys: {list(value[0].keys())}", file=sys.stderr)
                elif isinstance(value, str):
                    print(f"✓ Mapped parameter '{param}' to string ({len(value)} chars)", file=sys.stderr)
                else:
                    print(f"✓ Mapped parameter '{param}' to {type(value).__name__}", file=sys.stderr)
            else:
                print(f"⚠️ Could not find value for parameter '{param}'. Available keys: {list(inputs.keys())}", file=sys.stderr)
        
        # Call the function with filtered inputs
        result = func(**filtered_inputs)
    
    # Validate and output result
    if result is None:
        print(json.dumps([]))
    elif isinstance(result, str):
        # If string is returned, try to parse as JSON
        try:
            parsed = json.loads(result)
            print(json.dumps(parsed))
        except:
            # If not JSON, wrap in validation format
            print(json.dumps([{
                "extractedValue": result,
                "validationStatus": "valid",
                "aiReasoning": "Direct extraction",
                "confidenceScore": 95,
                "documentSource": "Generated"
            }]))
    elif isinstance(result, (list, dict)):
        print(json.dumps(result))
    else:
        # Wrap other types in validation format
        print(json.dumps([{
            "extractedValue": str(result),
            "validationStatus": "valid",
            "aiReasoning": "Direct extraction",
            "confidenceScore": 95,
            "documentSource": "Generated"
        }]))
        
except Exception as e:
    # Return error in expected format
    error_result = [{
        "extractedValue": None,
        "validationStatus": "invalid",
        "aiReasoning": f"Function execution failed: {str(e)}",
        "confidenceScore": 0,
        "documentSource": "ERROR"
    }]
    print(json.dumps(error_result))
    print(f"Error: {str(e)}", file=sys.stderr)
    print(traceback.format_exc(), file=sys.stderr)
    sys.exit(1)
`;
  }
  
  /**
   * Build incremental data automatically for UPDATE operations
   * This constructs an array with previous column data for each row
   */
  private async buildIncrementalData(
    stepId: string,
    currentValueId: string,
    currentValueOrder: number,
    sessionId?: string
  ): Promise<any[]> {
    console.log(`\n🔄 Building incremental data for UPDATE operation`);
    console.log(`   Step ID: ${stepId}`);
    console.log(`   Session ID: ${sessionId || 'not provided'}`);
    console.log(`   Current Value Order: ${currentValueOrder}`);
    
    try {
      // Get all values in this step ordered by orderIndex
      const stepValues = await storage.getStepValues(stepId);
      console.log(`   Total values in step: ${stepValues.length}`);
      
      // Filter to only previous values (lower orderIndex)
      const previousValues = stepValues.filter((v: any) => v.orderIndex < currentValueOrder);
      console.log(`   Previous values to include: ${previousValues.length}`);
      
      if (previousValues.length === 0) {
        console.log(`   ⚠️ No previous values - this is the first column`);
        return [];
      }
      
      // Get all validations for this step - FILTERED BY SESSION ID
      const validations = await storage.getValidationsByStep(stepId, sessionId);
      console.log(`   Total validations in step${sessionId ? ' for this session' : ''}: ${validations.length}`);
      
      // Get unique identifierIds (rows)
      const uniqueIdentifierIds = [...new Set(validations.map(v => v.identifierId))];
      console.log(`   Unique rows (identifierIds): ${uniqueIdentifierIds.length}`);
      
      // Build incremental data array
      const incrementalData = uniqueIdentifierIds.map(identifierId => {
        const rowData: any = { identifierId };
        
        // Add data from each previous column
        previousValues.forEach(value => {
          const validation = validations.find(
            v => v.fieldId === value.id && v.identifierId === identifierId
          );
          // Use the value's name as the key
          rowData[value.valueName] = validation?.extractedValue || null;
        });
        
        return rowData;
      });
      
      console.log(`   ✅ Built incremental data for ${incrementalData.length} rows`);
      
      // Log sample of incremental data for debugging
      if (incrementalData.length > 0) {
        console.log(`   Sample row data (first row):`, incrementalData[0]);
      }
      
      return incrementalData;
    } catch (error) {
      console.error(`   ❌ Error building incremental data:`, error);
      return [];
    }
  }

  /**
   * Build Rich Extraction Context for AI Functions
   * Transforms basic API payload into rich contextual data format expected by AI functions
   */
  private async buildRichExtractionContext({
    projectId,
    sessionId,
    documentIds,
    inputValues,
    previousData,
    stepId
  }: {
    projectId: string;
    sessionId: string;
    documentIds: string[];
    inputValues: Record<string, any>;
    previousData: any[];
    stepId: string;
  }): Promise<import('@shared/schema').RichExtractionContext> {
    
    console.log(`🔧 Building rich extraction context...`);
    console.log(`   Project: ${projectId}`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Documents: ${documentIds.length}`);
    console.log(`   Previous data records: ${previousData.length}`);
    
    try {
      const { loadReferenceDocuments } = await import('./referenceDocumentLoader');
      const { db } = await import('./db');
      const { knowledgeDocuments, sessionDocuments } = await import('@shared/schema');
      const { inArray, eq } = await import('drizzle-orm');
      
      // 1. Build reference data arrays from previousData and inputValues
      const referenceData: import('@shared/schema').ReferenceDataItem[] = [];
      
      // Add previous data with proper structure
      if (previousData && previousData.length > 0) {
        previousData.forEach((record, index) => {
          // Convert each record to proper format with recordId
          const dataItem: import('@shared/schema').ReferenceDataItem = {
            ...record,
            recordId: record.identifierId || `record_${index}`
          };
          referenceData.push(dataItem);
        });
        console.log(`   ✅ Added ${previousData.length} previous data records`);
      }
      
      // Add input values as reference data if they contain arrays/objects
      Object.entries(inputValues).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          // If it's an array of objects, add each as a reference data item
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              referenceData.push({
                ...item,
                recordId: `input_${key}_${index}`,
                sourceField: key
              });
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          // If it's a single object, add it as reference data
          referenceData.push({
            ...value,
            recordId: `input_${key}`,
            sourceField: key
          });
        }
      });
      
      // 2. Gather session documents and knowledge documents
      const referenceDocuments: import('@shared/schema').ReferenceDocument[] = [];
      const maxContentLength = 2000; // Truncate content to 2000 characters
      
      // Get session documents (user documents)
      if (documentIds.length > 0) {
        const sessionDocs = await db
          .select()
          .from(sessionDocuments)
          .where(inArray(sessionDocuments.id, documentIds));
          
        sessionDocs.forEach(doc => {
          referenceDocuments.push({
            id: doc.id,
            type: 'user',
            name: doc.fileName,
            mime: doc.mimeType || undefined,
            contentTruncated: (doc.extractedContent || '').substring(0, maxContentLength),
            source: `Session document: ${doc.fileName}`
          });
        });
        console.log(`   ✅ Added ${sessionDocs.length} session documents`);
      }
      
      // Get knowledge documents for the project
      const knowledgeDocs = await db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.projectId, projectId));
        
      knowledgeDocs.forEach(doc => {
        referenceDocuments.push({
          id: doc.id,
          type: 'knowledge',
          name: doc.displayName,
          mime: doc.fileType,
          contentTruncated: (doc.content || '').substring(0, maxContentLength),
          source: `Knowledge document: ${doc.displayName} - ${doc.description}`
        });
      });
      console.log(`   ✅ Added ${knowledgeDocs.length} knowledge documents`);
      
      // 3. Extract text inputs from user inputs and previous results
      const textInputs: string[] = [];
      
      // Add text from inputValues (exclude placeholders and document handles)
      Object.entries(inputValues).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          // Skip placeholders and document identifiers
          if (!value.startsWith('@') && 
              !value.startsWith('user_document') &&
              !value.includes('document_id:') &&
              value.length < 1000) { // Reasonable text length
            textInputs.push(`${key}: ${value}`);
          }
        }
      });
      
      // Add textual fields from previous data
      previousData.forEach((record, index) => {
        Object.entries(record).forEach(([key, value]) => {
          if (typeof value === 'string' && 
              value.trim().length > 0 && 
              key !== 'identifierId' &&
              key !== 'recordId' &&
              value.length < 500) { // Keep it concise
            textInputs.push(`Record ${index + 1} ${key}: ${value}`);
          }
        });
      });
      
      console.log(`   ✅ Extracted ${textInputs.length} text inputs`);
      
      // 4. Build and return the rich context
      const richContext: import('@shared/schema').RichExtractionContext = {
        'reference data': referenceData,
        'reference documents': referenceDocuments,
        'text': textInputs
      };
      
      console.log(`🎯 Rich context built successfully:`);
      console.log(`   - Reference data items: ${referenceData.length}`);
      console.log(`   - Reference documents: ${referenceDocuments.length}`);
      console.log(`   - Text inputs: ${textInputs.length}`);
      
      // Log size information for debugging
      const contextSize = JSON.stringify(richContext).length;
      console.log(`   - Total context size: ${contextSize} characters`);
      
      return richContext;
      
    } catch (error) {
      console.error(`❌ Error building rich extraction context:`, error);
      // Return minimal context on error
      return {
        'reference data': [],
        'reference documents': [],
        'text': []
      };
    }
  }
  
  /**
   * Execute Python file and return results
   */
  private async executePythonFile(filePath: string): Promise<ToolResult[]> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [filePath]);
      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Always log stderr for debugging
        if (error) {
          console.error('Python debug output:', error);
        }
        
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${error}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            console.error('Failed to parse Python output:', output);
            reject(new Error(`Failed to parse Python output: ${e}`));
          }
        }
      });

      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Export ToolEngine
export const toolEngine = new ToolEngine();
