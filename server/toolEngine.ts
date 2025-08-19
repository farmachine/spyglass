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
}

export class ToolEngine {
  
  /**
   * Generate tool content (AI prompt or Python code)
   */
  async generateToolContent(tool: Omit<Tool, 'id' | 'functionCode' | 'aiPrompt'>): Promise<{ content: string }> {
    const prompt = this.buildGenerationPrompt(tool);
    
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt
    });
    
    let content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Clean markdown code blocks
    if (content.startsWith('```python') || content.startsWith('```')) {
      content = content.replace(/^```(?:python)?\s*/, '').replace(/\s*```$/, '').trim();
    }
    
    return { content };
  }
  
  /**
   * Test tool with given inputs
   */
  async testTool(tool: Tool, inputs: Record<string, any>): Promise<ToolResult[]> {
    if (tool.toolType === "AI_ONLY") {
      return this.testAITool(tool, inputs);
    } else {
      return this.testCodeTool(tool, inputs);
    }
  }
  
  /**
   * Test AI-based tool
   */
  private async testAITool(tool: Tool, inputs: Record<string, any>): Promise<ToolResult[]> {
    try {
      const prompt = this.buildTestPrompt(tool, inputs);
      
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      
      let result = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Clean markdown if present
      if (result.startsWith('```json')) {
        result = result.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      }
      
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [parsed];
      
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
      return `Create an AI prompt for the following task:

Task: ${tool.name}
Description: ${tool.description}
Input Parameters:
${paramList}

Create a clear, specific prompt that will instruct an AI to extract the required information and return results in this JSON format:
[{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "source"}]

Return only the prompt text, no explanations.`;
    } else {
      return `Create a Python function for the following task:

Task: ${tool.name}  
Description: ${tool.description}
Input Parameters:
${paramList}

Requirements:
- Use only standard Python libraries (no pandas)
- Handle Excel files with openpyxl if needed
- Return results that can be JSON serialized
- Include proper error handling
- Function should be self-contained

Return only the Python function code, no explanations.`;
    }
  }
  
  /**
   * Build test prompt for AI tools
   */
  private buildTestPrompt(tool: Tool, inputs: Record<string, any>): string {
    const aiPrompt = tool.aiPrompt || tool.description;
    const inputsText = Object.entries(inputs).map(([key, value]) => `${key}: ${value}`).join('\n');
    
    return `${aiPrompt}

Input Data:
${inputsText}

Respond with JSON array: [{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "doc"}]`;
  }
  
  /**
   * Build Python test script for CODE tools
   */
  private buildCodeTestScript(tool: Tool, inputs: Record<string, any>): string {
    const inputsJson = JSON.stringify(inputs);
    const parametersJson = JSON.stringify(tool.inputParameters);
    
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
    inputs = ${inputsJson}
    parameters = ${parametersJson}
    
    # Map inputs to function arguments
    func_to_call = globals()[function_name]
    args = []
    for param in parameters:
        param_name = param['name']
        if param_name in inputs:
            args.append(inputs[param_name])
    
    # Execute function
    result = func_to_call(*args)
    
    # Format output
    output = {
        "extractedValue": result,
        "validationStatus": "valid",
        "aiReasoning": f"Function {function_name} executed successfully",
        "confidenceScore": 95,
        "documentSource": "CODE_FUNCTION"
    }
    
    print(json.dumps([output]))
    
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
          const result = JSON.parse(stdout.trim());
          resolve(Array.isArray(result) ? result : [result]);
        } catch (parseError) {
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