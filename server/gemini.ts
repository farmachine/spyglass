import { GoogleGenAI } from "@google/genai";

// Simple AI client setup
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenAI(apiKey);

export async function testAIOnlyTool(
  toolDescription: string,
  inputParameters: Array<{ name: string; type: string; description: string }>,
  testInputs: Record<string, any>,
  sampleDocuments: any[]
): Promise<any[]> {
  try {
    // Build simple prompt
    let prompt = `Task: ${toolDescription}\n\nInputs:\n`;
    
    for (const param of inputParameters) {
      const inputValue = testInputs[param.name];
      
      if (param.type === "text") {
        prompt += `${param.name}: ${inputValue || "Not provided"}\n`;
      } else if (param.type === "document") {
        const selectedDocIds = Array.isArray(inputValue) ? inputValue : [];
        const selectedDocs = sampleDocuments.filter(doc => selectedDocIds.includes(doc.id));
        
        if (selectedDocs.length > 0) {
          selectedDocs.forEach(doc => {
            prompt += `${param.name}: ${doc.extractedContent || doc.sampleText || 'No content'}\n`;
          });
        } else {
          prompt += `${param.name}: No documents\n`;
        }
      } else {
        prompt += `${param.name}: ${inputValue || "Not provided"}\n`;
      }
    }

    prompt += `\nRespond with JSON array: [{"extractedValue": "result", "validationStatus": "valid", "aiReasoning": "explanation", "confidenceScore": 95, "documentSource": "doc"}]`;

    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt
    });
    const text = response.text;
    
    // Clean and parse JSON response (remove markdown code blocks if present)
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleanText);
    return Array.isArray(parsed) ? parsed : [parsed];

  } catch (error) {
    console.error("AI tool test error:", error);
    throw error;
  }
}