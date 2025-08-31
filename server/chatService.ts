import { GoogleGenAI } from "@google/genai";
import type { FieldValidation, ExtractionSession, WorkflowStep, StepValue, SessionDocument } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ChatContext {
  session: ExtractionSession;
  validations: FieldValidation[];
  workflowSteps: WorkflowStep[];
  stepValues: StepValue[];
  documents?: SessionDocument[];
}

export async function generateChatResponse(message: string, context: ChatContext): Promise<string> {
  try {
    // Calculate verification statistics
    const totalFields = context.validations.length;
    const verifiedFields = context.validations.filter(v => 
      v.validationStatus === 'valid' || 
      v.validationStatus === 'verified' || 
      v.validationStatus === 'extracted'
    ).length;
    const unverifiedFields = totalFields - verifiedFields;
    const verificationPercentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;

    // Get field status breakdown
    const statusCounts = {
      verified: context.validations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length,
      extracted: context.validations.filter(v => v.validationStatus === 'extracted').length,
      unverified: context.validations.filter(v => v.validationStatus === 'unverified').length,
      pending: context.validations.filter(v => v.validationStatus === 'pending').length,
      manual: context.validations.filter(v => v.validationStatus === 'manual').length,
      invalid: context.validations.filter(v => v.validationStatus === 'invalid').length,
    };

    // Group validations by step and value
    const validationsByStep: { [key: string]: { [key: string]: FieldValidation[] } } = {};
    
    context.validations.forEach(validation => {
      const step = context.workflowSteps.find(s => 
        context.stepValues.find(v => v.id === validation.valueId && v.stepId === s.id)
      );
      const value = context.stepValues.find(v => v.id === validation.valueId);
      
      if (step && value) {
        if (!validationsByStep[step.stepName]) {
          validationsByStep[step.stepName] = {};
        }
        if (!validationsByStep[step.stepName][value.valueName]) {
          validationsByStep[step.stepName][value.valueName] = [];
        }
        validationsByStep[step.stepName][value.valueName].push(validation);
      }
    });

    // Build data summary by workflow step
    let dataByStep = '';
    for (const [stepName, values] of Object.entries(validationsByStep)) {
      const step = context.workflowSteps.find(s => s.stepName === stepName);
      const stepType = step?.stepType === 'INFO_PAGE' ? 'Info Page' : 'Data Table';
      dataByStep += `\n${stepName} (${stepType}):\n`;
      
      for (const [valueName, validations] of Object.entries(values)) {
        const value = context.stepValues.find(v => v.valueName === valueName);
        const uniqueCount = new Set(validations.map(v => v.identifierId)).size;
        
        if (step?.stepType === 'DATA_TABLE') {
          // For data tables, show ALL unique values
          const allUniqueValues = [...new Set(validations
            .map(v => v.extractedValue)
            .filter(v => v !== null && v !== undefined && v !== ''))];
          
          if (allUniqueValues.length <= 10) {
            dataByStep += `  - ${valueName}: ${uniqueCount} records with values: ${allUniqueValues.join(', ')}\n`;
          } else {
            dataByStep += `  - ${valueName}: ${uniqueCount} records with ${allUniqueValues.length} unique values\n`;
            dataByStep += `    First 10 values: ${allUniqueValues.slice(0, 10).join(', ')}\n`;
          }
        } else {
          // For info pages, show the actual values
          const distinctValues = validations
            .map(v => v.extractedValue || 'No value')
            .filter((v, i, arr) => arr.indexOf(v) === i);
          dataByStep += `  - ${valueName}: ${distinctValues.join(', ')}\n`;
        }
      }
    }

    // Prepare context for AI
    const systemPrompt = `You are an AI assistant helping with document data extraction session analysis. You have access to the following session data:

SESSION INFORMATION:
- Session Name: ${context.session.sessionName}
- Status: ${context.session.status}
- Created: ${context.session.createdAt}
- Last Updated: ${context.session.updatedAt}

VALIDATION STATISTICS:
- Total Fields: ${totalFields}
- Verified Fields: ${verifiedFields} (${verificationPercentage}%)
- Unverified Fields: ${unverifiedFields}
- Status Breakdown:
  * Valid/Verified: ${statusCounts.verified}
  * Extracted (AI): ${statusCounts.extracted}
  * Unverified: ${statusCounts.unverified}
  * Pending: ${statusCounts.pending}
  * Manual: ${statusCounts.manual}
  * Invalid: ${statusCounts.invalid}

WORKFLOW STEPS AND DATA:
${dataByStep}

DOCUMENT INFORMATION:
${context.documents ? context.documents.map(doc => 
  `- ${doc.fileName} (${doc.mimeType})`
).join('\n') : 'No documents available'}

ALL EXTRACTED DATA BY STEP:
${Object.entries(validationsByStep).map(([stepName, values]) => {
  const step = context.workflowSteps.find(s => s.stepName === stepName);
  let output = `\n${stepName} (${step?.stepType === 'INFO_PAGE' ? 'Info Page' : 'Data Table'}):`;
  
  for (const [valueName, validations] of Object.entries(values)) {
    output += `\n  ${valueName} (${validations.length} records):`;
    
    // Group by unique values and count occurrences
    const valueCounts = new Map<string, number>();
    validations.forEach(v => {
      const val = v.extractedValue || 'No value';
      valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
    });
    
    // Sort by frequency
    const sortedValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedValues.length <= 20) {
      // Show all values if there are 20 or fewer unique values
      sortedValues.forEach(([val, count]) => {
        output += `\n    - "${val}" (appears ${count} time${count > 1 ? 's' : ''})`;
      });
    } else {
      // Show top 20 most common values
      output += `\n    Total unique values: ${sortedValues.length}`;
      output += `\n    Top 20 most common:`;
      sortedValues.slice(0, 20).forEach(([val, count]) => {
        output += `\n    - "${val}" (appears ${count} time${count > 1 ? 's' : ''})`;
      });
    }
  }
  return output;
}).join('\n')}

You have access to ALL extracted data from this session. When answering questions:
- You can search through all values extracted from all steps
- You can count occurrences and identify patterns
- You can cross-reference data between different steps
- You can provide specific values when asked
- You can analyze data completeness and quality
- You can identify missing or invalid data

IMPORTANT: When the user asks about specific data (like "what codes are there" or "list the pension statuses"), provide the actual extracted values from the data above. Don't just describe the structure - give the actual values.

Please provide helpful, specific answers using the actual extracted data. Be comprehensive when listing values the user asks about.

FORMATTING GUIDELINES:
- Use proper paragraph breaks (double newlines) between major topics
- Use single newlines for line breaks within sections
- Structure responses with clear sections when appropriate
- Use bullet points with - when listing items
- Keep responses well-organized and easy to read`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
    });

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat AI response error:", error);
    return "I'm having trouble processing your request right now. Please try again in a moment.";
  }
}