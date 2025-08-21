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
    const preparedInputs: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputValues)) {
      if (Array.isArray(value) && value[0] === "user_document") {
        // Use the first available document content
        preparedInputs[key] = Object.values(documentContent)[0] || "";
      } else if (typeof value === "string" && value.startsWith("@")) {
        // Reference to previously extracted value
        preparedInputs[key] = extractedReferences[value] || null;
      } else {
        // Direct value
        preparedInputs[key] = value;
      }
    }

    return preparedInputs;
  }

  /**
   * Save extraction results to field validations
   */
  async saveExtractionResults(
    sessionId: string,
    results: WorkflowExtractionResult[]
  ): Promise<void> {
    console.log(`💾 Saving extraction results for session ${sessionId}`);
    
    for (const stepResult of results) {
      for (const value of stepResult.values) {
        // Create or update field validation record
        const fieldName = stepResult.stepType === "list" 
          ? `${stepResult.stepName}.${value.valueName}` 
          : value.valueName;
        
        await this.storage.createFieldValidation({
          sessionId,
          fieldId: value.valueId,
          fieldName,
          fieldValue: value.extractedValue,
          extractedValue: value.extractedValue,
          originalExtractedValue: value.extractedValue,
          validationStatus: value.validationStatus,
          validationType: stepResult.stepType === "list" ? "collection_property" : "schema_field",
          aiReasoning: value.aiReasoning || "",
          originalAiReasoning: value.aiReasoning || "",
          confidenceScore: value.confidenceScore,
          originalConfidenceScore: value.confidenceScore,
          documentSource: value.documentSource,
          collectionName: stepResult.stepType === "list" ? stepResult.stepName : undefined,
          recordIndex: stepResult.stepType === "list" ? 0 : undefined
        });
      }
    }
  }
}