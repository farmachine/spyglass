#!/usr/bin/env python3

"""
UNIFIED AI EXTRACTION ORCHESTRATOR
Single file that handles all extraction processes with proper orchestration
"""

import json
import sys
import os
import base64
from typing import Dict, List, Any, Optional, Tuple
from google import genai
from google.genai import types

# Initialize Gemini client
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise Exception("GEMINI_API_KEY environment variable not set")

client = genai.Client(api_key=api_key)

def extract_document_text(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract text content from various document types"""
    extracted_texts = []
    
    for doc in documents:
        try:
            # Handle data URL format (data:application/pdf;base64,...)
            if doc['file_content'].startswith('data:'):
                content = doc['file_content'].split(',')[1]
            else:
                content = doc['file_content']
            
            file_name = doc['file_name']
            mime_type = doc['mime_type']
            binary_content = base64.b64decode(content)
            
            # Handle Excel files with pandas
            if ('excel' in mime_type or 
                'spreadsheet' in mime_type or 
                'vnd.ms-excel' in mime_type or 
                'vnd.openxmlformats-officedocument.spreadsheetml' in mime_type or
                file_name.lower().endswith(('.xlsx', '.xls'))):
                
                try:
                    import pandas as pd
                    import io
                    
                    # Read Excel file using pandas
                    excel_data = pd.read_excel(io.BytesIO(binary_content), sheet_name=None)
                    
                    extracted_content = f"Excel file content from {file_name}:\n\n"
                    
                    for sheet_name, df in excel_data.items():
                        extracted_content += f"=== SHEET: {sheet_name} ===\n"
                        extracted_content += df.to_string(index=False, na_rep='')
                        extracted_content += "\n\n"
                    
                    text_content = extracted_content
                    
                except Exception as pandas_error:
                    text_content = f"Error processing Excel file: {str(pandas_error)}"
                    
            # Handle Word documents
            elif ('word' in mime_type or 
                  'vnd.openxmlformats-officedocument.wordprocessingml' in mime_type or
                  file_name.lower().endswith(('.docx', '.doc'))):
                
                try:
                    from docx import Document
                    import io
                    
                    doc = Document(io.BytesIO(binary_content))
                    paragraphs = [paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()]
                    text_content = '\n'.join(paragraphs)
                    
                except Exception as docx_error:
                    text_content = f"Error processing Word document: {str(docx_error)}"
                    
            # Handle PDFs and other files with Gemini API
            else:
                extraction_prompt = f"""Extract ALL text content from this document ({file_name}).

INSTRUCTIONS:
- Extract all readable text from every page
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information

RETURN: Complete text content from this document."""

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(
                            data=binary_content,
                            mime_type=mime_type
                        ),
                        extraction_prompt
                    ],
                    config=types.GenerateContentConfig(
                        max_output_tokens=1000000,
                        temperature=0.1
                    )
                )
                
                text_content = response.text if response and response.text else "Failed to extract content"
            
            extracted_texts.append({
                "file_name": file_name,
                "text_content": text_content,
                "word_count": len(text_content.split()) if text_content else 0
            })
            
        except Exception as e:
            extracted_texts.append({
                "file_name": doc.get('file_name', 'unknown'),
                "text_content": f"Error extracting content: {str(e)}",
                "word_count": 0
            })
    
    return extracted_texts

def build_extraction_prompt(documents: List[Dict], schema: Dict, rules: List[Dict], knowledge_docs: List[Dict]) -> str:
    """Build comprehensive extraction prompt"""
    
    # Document content section
    prompt = "=== DOCUMENTS TO PROCESS ===\n\n"
    for i, doc in enumerate(documents, 1):
        prompt += f"--- DOCUMENT {i}: {doc['file_name']} ---\n"
        prompt += f"{doc['text_content']}\n\n"
    prompt += "--- END OF DOCUMENTS ---\n\n"
    
    # Schema section
    prompt += "=== EXTRACTION SCHEMA ===\n\n"
    prompt += "PROJECT SCHEMA FIELDS:\n"
    for field in schema.get('schema_fields', []):
        prompt += f"- {field['fieldName']} ({field['fieldType']}): {field.get('description', 'No description')}\n"
        if field.get('autoVerificationConfidence'):
            prompt += f"  Auto-verification threshold: {field['autoVerificationConfidence']}%\n"
    
    prompt += "\nCOLLECTIONS:\n"
    for collection in schema.get('collections', []):
        prompt += f"- {collection['collectionName']}:\n"
        for prop in collection.get('properties', []):
            prompt += f"  - {prop['propertyName']} ({prop['propertyType']}): {prop.get('description', 'No description')}\n"
            if prop.get('autoVerificationConfidence'):
                prompt += f"    Auto-verification threshold: {prop['autoVerificationConfidence']}%\n"
    
    # Rules section
    if rules:
        prompt += "\n=== EXTRACTION RULES ===\n\n"
        for rule in rules:
            prompt += f"RULE: {rule['ruleName']}\n"
            prompt += f"Content: {rule['ruleContent']}\n"
            if rule.get('targetProperty'):
                prompt += f"Applies to: {rule['targetProperty']}\n"
            prompt += "\n"
    
    # Knowledge documents section
    if knowledge_docs:
        prompt += "\n=== KNOWLEDGE DOCUMENTS ===\n\n"
        for doc in knowledge_docs:
            prompt += f"KNOWLEDGE: {doc['documentName']}\n"
            prompt += f"Content: {doc.get('content', 'No content available')}\n\n"
    
    # Instructions
    prompt += """
=== EXTRACTION INSTRUCTIONS ===

Extract structured data from the documents according to the schema above.

IMPORTANT GUIDELINES:
1. Return JSON format with field_validations array
2. For schema fields: use field_type="schema_field" 
3. For collection properties: use field_type="collection_property" with record_index
4. Set confidence_score based on extraction quality and rules
5. Apply auto-verification thresholds from schema
6. Include detailed ai_reasoning for each field

JSON OUTPUT FORMAT:
{
  "field_validations": [
    {
      "field_type": "schema_field",
      "field_id": "field-uuid",
      "field_name": "Field Name",
      "extracted_value": "extracted value or null",
      "confidence_score": 95,
      "validation_status": "verified" or "unverified",
      "ai_reasoning": "explanation of extraction"
    },
    {
      "field_type": "collection_property", 
      "field_id": "property-uuid",
      "field_name": "Collection.Property[0]",
      "collection_name": "Collection",
      "record_index": 0,
      "extracted_value": "value",
      "confidence_score": 85,
      "validation_status": "verified",
      "ai_reasoning": "reasoning"
    }
  ]
}

START EXTRACTION:
"""
    return prompt

def process_gemini_prompt(prompt: str) -> Dict[str, Any]:
    """Process a direct Gemini prompt and return results"""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=10000000,
                temperature=0.1,
                response_mime_type="text/plain"
            )
        )
        
        if response and response.text:
            return {
                "success": True,
                "extractedData": response.text.strip(),
                "message": "Gemini extraction completed"
            }
        else:
            return {
                "success": False,
                "error": "No response received from Gemini API"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Gemini API error: {str(e)}"
        }

def extract_structured_data(documents: List[Dict], schema: Dict, rules: List[Dict], knowledge_docs: List[Dict]) -> Dict[str, Any]:
    """Main extraction function that processes documents and returns structured data"""
    try:
        # Step 1: Extract text from documents
        print("STEP 1: Extracting text from documents", file=sys.stderr)
        extracted_texts = extract_document_text(documents)
        
        # Step 2: Build comprehensive prompt
        print("STEP 2: Building extraction prompt", file=sys.stderr)
        prompt = build_extraction_prompt(extracted_texts, schema, rules, knowledge_docs)
        
        # Step 3: Send to Gemini for structured extraction
        print("STEP 3: Processing with Gemini AI", file=sys.stderr)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=10000000,
                temperature=0.1,
                response_mime_type="text/plain"
            )
        )
        
        if not response or not response.text:
            return {"success": False, "error": "No response from Gemini API"}
        
        # Step 4: Parse JSON response
        print("STEP 4: Parsing extraction results", file=sys.stderr)
        response_text = response.text.strip()
        
        # Handle markdown code blocks
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
        
        try:
            extracted_data = json.loads(response_text)
            return {
                "success": True,
                "field_validations": extracted_data.get("field_validations", []),
                "extracted_texts": extracted_texts,
                "message": f"Successfully extracted {len(extracted_data.get('field_validations', []))} field validations"
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON response: {str(e)}",
                "raw_response": response_text[:1000]
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Extraction failed: {str(e)}"
        }

def validate_field_records(field_validations: List[Dict], rules: List[Dict], knowledge_docs: List[Dict]) -> Dict[str, Any]:
    """Validate existing field records using rules and knowledge documents"""
    try:
        print("VALIDATION: Processing field validations", file=sys.stderr)
        
        # Build validation prompt
        validation_prompt = "=== FIELD VALIDATION TASK ===\n\n"
        validation_prompt += "Review and validate the following extracted field data:\n\n"
        
        for fv in field_validations:
            validation_prompt += f"Field: {fv.get('fieldName', 'Unknown')}\n"
            validation_prompt += f"Current Value: {fv.get('extractedValue', 'null')}\n"
            validation_prompt += f"Current Confidence: {fv.get('confidenceScore', 0)}%\n\n"
        
        # Add rules context
        if rules:
            validation_prompt += "\n=== VALIDATION RULES ===\n\n"
            for rule in rules:
                validation_prompt += f"RULE: {rule['ruleName']}\n"
                validation_prompt += f"Content: {rule['ruleContent']}\n\n"
        
        # Add knowledge context  
        if knowledge_docs:
            validation_prompt += "\n=== KNOWLEDGE CONTEXT ===\n\n"
            for doc in knowledge_docs:
                validation_prompt += f"KNOWLEDGE: {doc['documentName']}\n"
                validation_prompt += f"Content: {doc.get('content', '')}\n\n"
        
        validation_prompt += """
=== VALIDATION INSTRUCTIONS ===

Review each field and update validation_status and confidence_score based on:
1. Rule compliance
2. Knowledge document alignment  
3. Data quality assessment

Return JSON with updated field validations:
{
  "fieldValidations": [
    {
      "uuid": "field-uuid",
      "validationStatus": "verified" or "unverified", 
      "validationConfidence": 85,
      "AIReasoning": "Detailed reasoning for validation decision"
    }
  ]
}

START VALIDATION:
"""
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=validation_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=1000000,
                temperature=0.1
            )
        )
        
        if not response or not response.text:
            return {"success": False, "error": "No validation response from Gemini"}
        
        # Parse validation results
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        
        try:
            validation_results = json.loads(response_text)
            return {
                "success": True,
                "fieldValidations": validation_results.get("fieldValidations", []),
                "message": f"Validated {len(validation_results.get('fieldValidations', []))} fields"
            }
        except json.JSONDecodeError:
            return {"success": False, "error": "Failed to parse validation JSON"}
            
    except Exception as e:
        return {"success": False, "error": f"Validation failed: {str(e)}"}

def main():
    """Main orchestrator function"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        operation = data.get('operation', 'extract')
        session_id = data.get('session_id', data.get('sessionId', 'unknown'))
        
        # Log orchestrator usage
        print(f"ORCHESTRATOR: Processing operation '{operation}' for session {session_id}", file=sys.stderr)
        
        if operation == 'extract_text':
            # Simple text extraction
            documents = data.get('documents', [])
            print(f"ORCHESTRATOR: Text extraction for {len(documents)} documents", file=sys.stderr)
            extracted_texts = extract_document_text(documents)
            result = {
                "success": True,
                "extracted_texts": extracted_texts
            }
            
        elif operation == 'gemini_prompt':
            # Direct Gemini prompt processing
            prompt = data.get('prompt', '')
            print(f"ORCHESTRATOR: Gemini prompt processing for session {session_id}", file=sys.stderr)
            result = process_gemini_prompt(prompt)
            result['sessionId'] = data.get('sessionId')
            result['projectId'] = data.get('projectId')
            
        elif operation == 'extract':
            # Full extraction pipeline
            documents = data.get('files', data.get('documents', []))
            schema = data.get('project_schema', {})
            rules = data.get('extraction_rules', [])
            knowledge_docs = data.get('knowledge_documents', [])
            
            print(f"ORCHESTRATOR: Full extraction for {len(documents)} documents with {len(rules)} rules", file=sys.stderr)
            result = extract_structured_data(documents, schema, rules, knowledge_docs)
            
        elif operation == 'validate':
            # Field validation
            field_validations = data.get('field_validations', [])
            rules = data.get('extraction_rules', [])
            knowledge_docs = data.get('knowledge_documents', [])
            
            print(f"ORCHESTRATOR: Validating {len(field_validations)} fields with {len(rules)} rules", file=sys.stderr)
            result = validate_field_records(field_validations, rules, knowledge_docs)
            
        else:
            print(f"ORCHESTRATOR: Unknown operation '{operation}'", file=sys.stderr)
            result = {"success": False, "error": f"Unknown operation: {operation}"}
        
        # Log completion
        print(f"ORCHESTRATOR: Operation '{operation}' completed successfully: {result.get('success', False)}", file=sys.stderr)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        print(f"ORCHESTRATOR ERROR: {str(e)}", file=sys.stderr)
        error_result = {
            "success": False,
            "error": f"Orchestrator error: {str(e)}"
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()