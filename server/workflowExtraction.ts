// Workflow-based extraction system
import { Storage } from "./storage";
import { ToolEngine } from "./toolEngine";
import { ExcelWizardryFunction } from "@shared/schema";

export interface WorkflowExtractionResult {
  stepId: string;
  stepName: string;
  stepType: "list" | "page";
  values: Array<{
    valueId: string;
    valueName: string;
    dataType: string;
    extractedValue: any;
    validationStatus: "valid" | "invalid" | "pending";
    aiReasoning?: string;
    confidenceScore: number;
    documentSource?: string;
  }>;
}

export class WorkflowExtractionEngine {
  private storage: Storage;
  private toolEngine: ToolEngine;

  constructor(storage: Storage) {
    this.storage = storage;
    this.toolEngine = new ToolEngine();
  }

  /**
   * Extract a value that may return multiple records
   */
  private async extractValueWithMultipleRecords(
    value: any,
    documentContent: Record<string, string>,
    extractedReferences: Record<string, any>,
    projectId: string,
    sessionId: string,
    step: any
  ): Promise<any[]> {
    if (!value.toolId) {
      return [{
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: "No extraction tool configured",
        confidenceScore: 0
      }];
    }

    // Get the tool configuration
    const tool = await this.storage.getExcelWizardryFunction(value.toolId);
    if (!tool) {
      return [{
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: "Extraction tool not found",
        confidenceScore: 0
      }];
    }

    // Prepare inputs for the tool
    const inputs = await this.prepareToolInputs(
      value.inputValues || {},
      documentContent,
      extractedReferences
    );

    // Execute the tool
    try {
      const toolConfig = {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        toolType: tool.toolType,
        inputParameters: tool.inputParameters || [],
        functionCode: tool.functionCode,
        aiPrompt: tool.aiPrompt || tool.description,
        outputType: tool.outputType,
        llmModel: tool.llmModel,
        metadata: tool.metadata || {}
      };

      console.log('🔍 FUNCTION INPUTS:', {
        valueName: value.valueName,
        toolName: tool.name,
        documentKeys: Object.keys(documentContent),
        documentContentLength: Object.values(documentContent)[0]?.length || 0,
        stepLevelInputValues: value.inputValues,
        preparedInputs: inputs,
        preparedInputKeys: Object.keys(inputs),
        firstDocumentPreview: Object.values(documentContent)[0]?.substring(0, 200)
      });

      // Log the actual document content being passed
      console.log('📄 DOCUMENT CONTENT:', {
        documentId: Object.keys(documentContent)[0],
        contentLength: Object.values(documentContent)[0]?.length,
        contentPreview: Object.values(documentContent)[0]?.substring(0, 500)
      });

      const toolResults = await this.toolEngine.testTool(toolConfig, inputs);
      
      console.log('📊 FUNCTION EXECUTION RESULTS:');
      console.log(JSON.stringify(toolResults, null, 2));
      
      // For list steps with multiple outputs, return all records
      if (step.stepType === "list" && tool.outputType === "multiple" && toolResults.length > 0) {
        return toolResults.map((result, index) => ({
          valueId: `${value.id}_${index}`,
          valueName: value.valueName,
          dataType: value.dataType,
          extractedValue: result.extractedValue,
          validationStatus: result.validationStatus || "valid",
          aiReasoning: result.aiReasoning || "",
          confidenceScore: result.confidenceScore || 1,
          documentSource: result.documentSource
        }));
      } else {
        // Single result
        const result = toolResults[0] || {
          extractedValue: null,
          validationStatus: "invalid",
          aiReasoning: "No result from tool",
          confidenceScore: 0
        };
        
        return [{
          valueId: value.id,
          valueName: value.valueName,
          dataType: value.dataType,
          extractedValue: result.extractedValue,
          validationStatus: result.validationStatus || "valid",
          aiReasoning: result.aiReasoning || "",
          confidenceScore: result.confidenceScore || 1,
          documentSource: result.documentSource
        }];
      }
    } catch (error) {
      console.error(`Error executing tool for ${value.valueName}:`, error);
      return [{
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidenceScore: 0
      }];
    }
  }

  /**
   * Extract a single value using its configured tool
   */
  private async extractValue(
    value: any,
    documentContent: Record<string, string>,
    extractedReferences: Record<string, any>,
    projectId: string,
    sessionId: string
  ): Promise<any> {
    if (!value.toolId) {
      return {
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: "No extraction tool configured",
        confidenceScore: 0
      };
    }

    // Get the tool configuration
    const tool = await this.storage.getExcelWizardryFunction(value.toolId);
    if (!tool) {
      return {
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: "Extraction tool not found",
        confidenceScore: 0
      };
    }

    // Prepare inputs for the tool
    const inputs = await this.prepareToolInputs(
      value.inputValues || {},
      documentContent,
      extractedReferences
    );

    // Execute the tool
    try {
      const toolConfig = {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        toolType: tool.toolType,
        inputParameters: tool.inputParameters || [],
        functionCode: tool.functionCode,
        aiPrompt: tool.aiPrompt || tool.description,
        outputType: tool.outputType,
        llmModel: tool.llmModel,
        metadata: tool.metadata || {}
      };

      const toolResults = await this.toolEngine.testTool(toolConfig, inputs);
      const result = toolResults[0] || {
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: "No result from tool",
        confidenceScore: 0
      };
      
      return {
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: result.extractedValue,
        validationStatus: result.validationStatus,
        aiReasoning: result.aiReasoning,
        confidenceScore: result.confidenceScore,
        documentSource: result.documentSource
      };
    } catch (error) {
      console.error(`Error executing tool for ${value.valueName}:`, error);
      return {
        valueId: value.id,
        valueName: value.valueName,
        dataType: value.dataType,
        extractedValue: null,
        validationStatus: "invalid",
        aiReasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidenceScore: 0
      };
    }
  }

  /**
   * Execute extraction for a single value
   */
  async executeSingleValue(
    projectId: string,
    sessionId: string,
    documentContent: Record<string, string>,
    stepId: string,
    valueId: string,
    selectedDocumentId?: string
  ): Promise<WorkflowExtractionResult[]> {
    console.log(`🔄 Starting single value extraction for value ${valueId} in step ${stepId}`);
    
    // Get the specific step
    const step = await this.storage.getWorkflowStep(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }
    
    // Get all values for this step
    const stepValues = await this.storage.getStepValues(step.id);
    const targetValue = stepValues.find(v => v.id === valueId);
    
    if (!targetValue) {
      throw new Error(`Value ${valueId} not found in step ${stepId}`);
    }
    
    // Get previously extracted values from this step (for reference)
    const extractedReferences: Record<string, any> = {};
    
    // Get validations for this collection to find previously extracted values
    const session = await this.storage.getExtractionSession(sessionId);
    const validations = await this.storage.getFieldValidations(sessionId);
    
    // Build reference map from previous extractions
    for (const prevValue of stepValues) {
      if (prevValue.orderIndex < targetValue.orderIndex) {
        const fieldName = `${step.stepName}.${prevValue.valueName}[0]`;
        const validation = validations.find(v => v.fieldName === fieldName);
        if (validation?.extractedValue) {
          const refKey = `@${prevValue.valueName}`;
          extractedReferences[refKey] = validation.extractedValue;
          console.log(`  📌 Added reference ${refKey} = ${validation.extractedValue}`);
        }
      }
    }
    
    // If a specific document is selected, filter content
    let filteredContent = documentContent;
    if (selectedDocumentId) {
      filteredContent = { [selectedDocumentId]: documentContent[selectedDocumentId] };
    }
    
    // Extract just this single value - but it may return multiple records
    const extractedValues = await this.extractValueWithMultipleRecords(
      targetValue,
      filteredContent,
      extractedReferences,
      projectId,
      sessionId,
      step
    );
    
    // Return result in the same format
    return [{
      stepId: step.id,
      stepName: step.stepName,
      stepType: step.stepType,
      values: extractedValues
    }];
  }

  /**
   * Execute extraction for all workflow steps
   */
  async executeWorkflow(
    projectId: string,
    sessionId: string,
    documentContent: Record<string, string> // Map of document IDs to extracted content
  ): Promise<WorkflowExtractionResult[]> {
    console.log(`🔄 Starting workflow extraction for session ${sessionId}`);
    
    // Get workflow steps for the project
    const workflowSteps = await this.storage.getWorkflowSteps(projectId);
    if (!workflowSteps || workflowSteps.length === 0) {
      console.log('No workflow steps found for project');
      return [];
    }

    const results: WorkflowExtractionResult[] = [];
    const extractedReferences: Record<string, any> = {}; // Store extracted values for reference

    // Process each step sequentially
    for (const step of workflowSteps.sort((a, b) => a.orderIndex - b.orderIndex)) {
      console.log(`📋 Processing step: ${step.stepName} (${step.stepType})`);
      
      // Get values for this step
      const stepValues = await this.storage.getStepValues(step.id);
      
      const stepResult: WorkflowExtractionResult = {
        stepId: step.id,
        stepName: step.stepName,
        stepType: step.stepType,
        values: []
      };

      // Process each value
      for (const value of stepValues.sort((a, b) => a.orderIndex - b.orderIndex)) {
        console.log(`  📝 Processing value: ${value.valueName}`);
        
        if (!value.toolId) {
          console.log(`    ⚠️ No tool ID for value ${value.valueName}`);
          stepResult.values.push({
            valueId: value.id,
            valueName: value.valueName,
            dataType: value.dataType,
            extractedValue: null,
            validationStatus: "invalid",
            aiReasoning: "No extraction tool configured",
            confidenceScore: 0
          });
          continue;
        }

        // Get the tool configuration
        const tool = await this.storage.getExcelWizardryFunction(value.toolId);
        if (!tool) {
          console.log(`    ⚠️ Tool not found: ${value.toolId}`);
          stepResult.values.push({
            valueId: value.id,
            valueName: value.valueName,
            dataType: value.dataType,
            extractedValue: null,
            validationStatus: "invalid",
            aiReasoning: "Extraction tool not found",
            confidenceScore: 0
          });
          continue;
        }

        // Prepare inputs for the tool
        const inputs = await this.prepareToolInputs(
          value.inputValues || {},
          documentContent,
          extractedReferences
        );

        // Execute the tool
        try {
          const toolConfig = {
            id: tool.id,
            name: tool.name,
            description: tool.description,
            toolType: tool.toolType,
            inputParameters: tool.inputParameters || [],
            functionCode: tool.functionCode,
            aiPrompt: tool.aiPrompt || tool.description,
            outputType: tool.outputType,
            llmModel: tool.llmModel,
            metadata: tool.metadata || {}
          };

          const toolResults = await this.toolEngine.testTool(toolConfig, inputs);
          
          // Handle single vs multiple output types
          if (step.stepType === "list" && tool.outputType === "multiple") {
            // For list steps with multiple outputs, create multiple records
            for (let i = 0; i < toolResults.length; i++) {
              const result = toolResults[i];
              stepResult.values.push({
                valueId: `${value.id}_${i}`,
                valueName: value.valueName,
                dataType: value.dataType,
                extractedValue: result.extractedValue,
                validationStatus: result.validationStatus,
                aiReasoning: result.aiReasoning,
                confidenceScore: result.confidenceScore,
                documentSource: result.documentSource
              });
            }
          } else {
            // For page steps or single outputs
            const result = toolResults[0] || {
              extractedValue: null,
              validationStatus: "invalid",
              aiReasoning: "No result from tool",
              confidenceScore: 0
            };
            
            stepResult.values.push({
              valueId: value.id,
              valueName: value.valueName,
              dataType: value.dataType,
              extractedValue: result.extractedValue,
              validationStatus: result.validationStatus,
              aiReasoning: result.aiReasoning,
              confidenceScore: result.confidenceScore,
              documentSource: result.documentSource
            });
          }

          // Store extracted value for reference by other values
          if (value.isIdentifier && toolResults[0]?.extractedValue) {
            extractedReferences[`@${step.stepName}.${value.valueName}`] = toolResults[0].extractedValue;
          }
          
        } catch (error) {
          console.error(`    ❌ Tool execution failed:`, error);
          stepResult.values.push({
            valueId: value.id,
            valueName: value.valueName,
            dataType: value.dataType,
            extractedValue: null,
            validationStatus: "invalid",
            aiReasoning: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            confidenceScore: 0
          });
        }
      }

      results.push(stepResult);
    }

    return results;
  }

  /**
   * Prepare inputs for tool execution
   */
  private async prepareToolInputs(
    inputValues: Record<string, any>,
    documentContent: Record<string, string>,
    extractedReferences: Record<string, any>
  ): Promise<Record<string, any>> {
    // Simple approach: just pass the document content directly
    // The function will receive it as the first parameter
    const documentContentValue = Object.values(documentContent)[0] || "";
    
    console.log('📋 Preparing inputs - Document content length:', documentContentValue.length);
    
    // Return a simple object with the document content
    // The key doesn't matter since we're passing by position in the Python script
    return {
      document: documentContentValue
    };
  }

  /**
   * Save extraction results to field validations
   */
  async saveExtractionResults(
    sessionId: string,
    results: WorkflowExtractionResult[]
  ): Promise<void> {
    console.log(`💾 Saving extraction results for session ${sessionId}`);
    console.log('📊 FULL RESULTS TO SAVE:', JSON.stringify(results, null, 2));
    
    for (const stepResult of results) {
      console.log(`  📝 Processing step: ${stepResult.stepName} (${stepResult.stepType})`);
      console.log(`    Values to save: ${stepResult.values.length}`);
      
      // Track record index for list-type steps
      let recordIndex = 0;
      
      for (const value of stepResult.values) {
        // Parse record index from valueId if it contains underscore (for multiple records)
        const valueIdParts = value.valueId.split('_');
        if (valueIdParts.length > 1) {
          recordIndex = parseInt(valueIdParts[valueIdParts.length - 1]) || 0;
        }
        
        // Create or update field validation record
        const fieldName = stepResult.stepType === "list" 
          ? `${stepResult.stepName}.${value.valueName}[${recordIndex}]` 
          : value.valueName;
        
        await this.storage.createFieldValidation({
          sessionId,
          fieldId: valueIdParts[0], // Use base valueId without index suffix
          fieldName,
          fieldValue: value.extractedValue,
          extractedValue: value.extractedValue,
          originalExtractedValue: value.extractedValue,
          validationStatus: value.validationStatus,
          validationType: stepResult.stepType === "list" ? "collection_property" : "schema_field",
          dataType: value.dataType || "TEXT", // Add dataType field
          aiReasoning: value.aiReasoning || "",
          originalAiReasoning: value.aiReasoning || "",
          confidenceScore: value.confidenceScore,
          originalConfidenceScore: value.confidenceScore,
          documentSource: value.documentSource,
          collectionName: stepResult.stepType === "list" ? stepResult.stepName : undefined,
          recordIndex: stepResult.stepType === "list" ? recordIndex : undefined
        });
      }
    }
  }
}