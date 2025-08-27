import { storage } from './storage';

/**
 * Centralized function to load reference documents with their content
 * Handles both knowledge documents and test documents
 */
export async function loadReferenceDocuments(
  documentIds: string[] | undefined,
  projectId: string
): Promise<string> {
  console.log('📚 Loading reference documents...');
  console.log(`  Document IDs: ${documentIds?.join(', ') || 'None specified'}`);
  console.log(`  Project ID: ${projectId}`);
  
  const allDocContents: string[] = [];
  
  try {
    // If specific document IDs provided, load those
    if (documentIds && documentIds.length > 0) {
      console.log(`  Loading ${documentIds.length} specific documents...`);
      
      for (const docId of documentIds) {
        // Try loading as knowledge document first
        const knowledgeDoc = await storage.getKnowledgeDocument(docId);
        if (knowledgeDoc) {
          // Try extractedContent first, fallback to documentContent, then content
          const content = knowledgeDoc.extractedContent || 
                         knowledgeDoc.documentContent || 
                         knowledgeDoc.content ||
                         '';
          
          if (content) {
            console.log(`    ✅ Loaded knowledge document: ${knowledgeDoc.fileName} (${content.length} chars)`);
            allDocContents.push(`=== Document: ${knowledgeDoc.fileName || knowledgeDoc.displayName} ===\n${content}`);
          } else {
            console.log(`    ⚠️ Knowledge document has no content: ${knowledgeDoc.fileName}`);
          }
        } else {
          // Try as test document
          const testDoc = await storage.getTestDocument(docId);
          if (testDoc) {
            const content = testDoc.extractedContent || 
                           testDoc.extracted_content || 
                           testDoc.sampleData ||
                           '';
            
            if (content) {
              console.log(`    ✅ Loaded test document: ${testDoc.fileName} (${content.length} chars)`);
              allDocContents.push(`=== Document: ${testDoc.fileName} ===\n${content}`);
            } else {
              console.log(`    ⚠️ Test document has no content: ${testDoc.fileName}`);
            }
          } else {
            console.log(`    ❌ Document not found: ${docId}`);
          }
        }
      }
    } else {
      // Load all knowledge documents for the project as fallback
      console.log(`  Loading all knowledge documents for project...`);
      const knowledgeDocs = await storage.getKnowledgeDocuments(projectId);
      console.log(`  Found ${knowledgeDocs.length} knowledge documents`);
      
      for (const doc of knowledgeDocs) {
        const content = doc.extractedContent || 
                       doc.documentContent || 
                       doc.content ||
                       '';
        
        if (content) {
          console.log(`    ✅ Loaded: ${doc.fileName} (${content.length} chars)`);
          allDocContents.push(`=== Document: ${doc.fileName || doc.displayName} ===\n${content}`);
        } else {
          console.log(`    ⚠️ No content for: ${doc.fileName}`);
        }
      }
    }
    
    const combinedContent = allDocContents.join('\n\n---\n\n');
    console.log(`📚 ✅ Combined reference content: ${combinedContent.length} chars from ${allDocContents.length} documents`);
    
    if (combinedContent.length > 0) {
      console.log(`📚 Preview of content:\n${combinedContent.substring(0, 500)}...`);
    }
    
    return combinedContent;
    
  } catch (error) {
    console.error('❌ Error loading reference documents:', error);
    return '';
  }
}

/**
 * Extract document IDs from various input formats
 */
export function extractDocumentIds(input: any): string[] {
  if (!input) return [];
  
  // Direct array of IDs
  if (Array.isArray(input)) {
    return input.filter(id => typeof id === 'string');
  }
  
  // Single ID as string
  if (typeof input === 'string' && input.length > 0) {
    // Check if it's a UUID format
    if (input.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return [input];
    }
  }
  
  return [];
}