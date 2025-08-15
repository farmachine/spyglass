// Utility functions for @-key referencing in field configuration prompts

interface ReferenceContext {
  knowledgeDocuments?: Array<{
    id: string;
    displayName?: string;
    fileName?: string;
    description?: string;
    fileType?: string;
  }>;
  referencedFields?: Array<{
    id: string;
    fieldName?: string;
    propertyName?: string;
    description?: string;
    fieldType?: string;
    propertyType?: string;
  }>;
  referencedCollections?: Array<{
    id: string;
    collectionName: string;
    description?: string;
  }>;
  extractionRules?: Array<{
    id: string;
    ruleName: string;
    ruleContent: string;
  }>;
  suppliedDocuments?: Array<{
    fileName: string;
    fileType: string;
    fileSize?: number;
  }>;
}

/**
 * Processes prompt text and replaces @-key references with actual object properties
 * Excludes large document content to keep prompts manageable
 */
export function processPromptReferences(promptText: string, context: ReferenceContext): string {
  if (!promptText || !promptText.includes('@')) {
    return promptText;
  }

  let processedText = promptText;

  // Process @knowledge-document references
  if (context.knowledgeDocuments) {
    context.knowledgeDocuments.forEach(doc => {
      const referenceKey = `@knowledge-document:${doc.id}`;
      const replacement = `Knowledge Document: ${doc.displayName || doc.fileName} (Type: ${doc.fileType}, Description: ${doc.description || 'No description'})`;
      processedText = processedText.replace(new RegExp(referenceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
  }

  // Process @referenced-field references  
  if (context.referencedFields) {
    context.referencedFields.forEach(field => {
      const referenceKey = `@referenced-field:${field.id}`;
      const fieldName = field.fieldName || field.propertyName || 'Unknown Field';
      const fieldType = field.fieldType || field.propertyType || 'Unknown Type';
      const replacement = `Referenced Field: ${fieldName} (Type: ${fieldType}, Description: ${field.description || 'No description'})`;
      processedText = processedText.replace(new RegExp(referenceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
  }

  // Process @referenced-collection references
  if (context.referencedCollections) {
    context.referencedCollections.forEach(collection => {
      const referenceKey = `@referenced-collection:${collection.id}`;
      const replacement = `Referenced Collection: ${collection.collectionName} (Description: ${collection.description || 'No description'})`;
      processedText = processedText.replace(new RegExp(referenceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
  }

  // Process @extraction-rule references
  if (context.extractionRules) {
    context.extractionRules.forEach(rule => {
      const referenceKey = `@extraction-rule:${rule.id}`;
      const replacement = `Extraction Rule: ${rule.ruleName} - ${rule.ruleContent}`;
      processedText = processedText.replace(new RegExp(referenceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
  }

  // Process @supplied-document references (exclude content, only metadata)
  if (context.suppliedDocuments) {
    context.suppliedDocuments.forEach((doc, index) => {
      const referenceKey = `@supplied-document:${index}`;
      const replacement = `Supplied Document: ${doc.fileName} (Type: ${doc.fileType}${doc.fileSize ? `, Size: ${Math.round(doc.fileSize / 1024)}KB` : ''})`;
      processedText = processedText.replace(new RegExp(referenceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
  }

  return processedText;
}

/**
 * Extracts @-key references from prompt text for validation
 */
export function extractReferences(promptText: string): Array<{type: string, id: string}> {
  if (!promptText || !promptText.includes('@')) {
    return [];
  }

  const references: Array<{type: string, id: string}> = [];
  
  // Match @reference-type:id patterns
  const referencePattern = /@(knowledge-document|referenced-field|referenced-collection|extraction-rule|supplied-document):([a-zA-Z0-9-_]+)/g;
  let match;

  while ((match = referencePattern.exec(promptText)) !== null) {
    references.push({
      type: match[1],
      id: match[2]
    });
  }

  return references;
}

/**
 * Validates that all @-key references in the prompt have corresponding data
 */
export function validateReferences(promptText: string, context: ReferenceContext): Array<string> {
  const references = extractReferences(promptText);
  const errors: string[] = [];

  references.forEach(ref => {
    switch (ref.type) {
      case 'knowledge-document':
        if (!context.knowledgeDocuments?.find(doc => doc.id === ref.id)) {
          errors.push(`Knowledge document reference @knowledge-document:${ref.id} not found`);
        }
        break;
      case 'referenced-field':
        if (!context.referencedFields?.find(field => field.id === ref.id)) {
          errors.push(`Referenced field @referenced-field:${ref.id} not found`);
        }
        break;
      case 'referenced-collection':
        if (!context.referencedCollections?.find(col => col.id === ref.id)) {
          errors.push(`Referenced collection @referenced-collection:${ref.id} not found`);
        }
        break;
      case 'extraction-rule':
        if (!context.extractionRules?.find(rule => rule.id === ref.id)) {
          errors.push(`Extraction rule @extraction-rule:${ref.id} not found`);
        }
        break;
      case 'supplied-document':
        const docIndex = parseInt(ref.id);
        if (!context.suppliedDocuments || docIndex >= context.suppliedDocuments.length) {
          errors.push(`Supplied document @supplied-document:${ref.id} not found`);
        }
        break;
    }
  });

  return errors;
}