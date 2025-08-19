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
      model: "gemini-1.5-flash",
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
      
      console.log('🧪 GEMINI AI PROMPT FOR TOOL TESTING');
      console.log('='.repeat(80));
      console.log('📝 Tool Name:', tool.name);
      console.log('📝 Tool AI Prompt:', tool.aiPrompt);
      console.log('📝 Test Inputs:', JSON.stringify(inputs, null, 2));
      console.log('');
      console.log('🎯 FULL TEST PROMPT SENT TO GEMINI:');
      console.log('-'.repeat(80));
      console.log(prompt);
      console.log('-'.repeat(80));
      console.log('');
      
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      
      let result = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log('🎉 GEMINI TEST RESPONSE:');
      console.log('-'.repeat(80));
      console.log(result);
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
    
    // Use the AI prompt as-is since it should already contain the correct format instructions
    // Just provide the input data
    return `${aiPrompt}

Input Data:
${inputsText}`;
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