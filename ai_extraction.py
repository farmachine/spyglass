#!/usr/bin/env python3
"""
SIMPLE AI EXTRACTION SYSTEM
Follows the workflow: compile prompt → AI responds → parse JSON → write to DB → render in UI
"""
import os
import json
import logging
import sys
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class ExtractionResult:
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    field_validations: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    extraction_prompt: Optional[str] = None
    ai_response: Optional[str] = None
    input_token_count: Optional[int] = None
    output_token_count: Optional[int] = None
    total_fields_processed: int = 0
    document_count: int = 0

def get_existing_verified_validations(session_id: str) -> List[Dict[str, Any]]:
    """
    Get existing verified field validations for reference in the prompt.
    This is a simplified version - in production, this would query the database.
    """
    # For now, return empty list since we're focusing on the extraction workflow
    return []

def compile_extraction_prompt(
    documents: List[Dict[str, Any]],
    schema_fields: List[Dict[str, Any]], 
    collections: List[Dict[str, Any]],
    knowledge_documents: List[Dict[str, Any]],
    extraction_rules: List[Dict[str, Any]],
    verified_validations: List[Dict[str, Any]] = None
) -> str:
    """
    Compile the extraction prompt using document content, target schema fields,
    verified field validations, and system prompt.
    """
    
    # Build system prompt
    system_prompt = """You are an expert data extraction specialist. Extract data from the provided documents and return a JSON object with the exact structure specified below.

## CRITICAL INSTRUCTIONS:
1. PROCESS ALL DOCUMENTS: Process every document provided in the document set
2. FOLLOW SCHEMA FIELD DESCRIPTIONS PRECISELY - Each description is your extraction instruction
3. APPLY EXTRACTION RULES - Rules modify extraction behavior, formatting, and validation
4. **ONLY CREATE RECORDS WHEN FOUND**: Only include field_validations for fields that actually exist in the document
5. **COLLECTION LIMIT**: For collections, extract maximum 50 items per collection to ensure reliable processing
6. Return JSON with real extracted values only
7. If extraction rules specify formatting, apply that formatting to extracted values

## FIELD TYPE DEFINITIONS:
- **TEXT**: Extract text content as specified in the field description
- **NUMBER**: Count or extract numeric values as described  
- **DATE**: Extract dates in standard format (YYYY-MM-DD)
- **CHOICE**: Select one of the predefined options
- **COLLECTION**: Extract multiple instances - create separate records for each unique item found (max 50 items per collection)
"""

    # Add document content
    document_content = "\n## DOCUMENT CONTENT:\n"
    for i, doc in enumerate(documents):
        file_name = doc.get('file_name', f'Document {i+1}')
        content = doc.get('file_content', '')
        document_content += f"\n### Document {i+1}: {file_name}\n"
        document_content += f"```\n{content}\n```\n"
    
    # Build schema fields section
    schema_section = "\n## SCHEMA FIELDS TO EXTRACT:\n"
    for field in schema_fields:
        field_name = field.get('fieldName', '')
        field_type = field.get('fieldType', 'TEXT')
        field_description = field.get('description', '')
        field_id = field.get('id', '')
        
        schema_section += f"- **{field_name}** (ID: {field_id}, {field_type}): {field_description}\n"
        
        # Add choice options if applicable
        if field_type == 'CHOICE' and field.get('choiceOptions'):
            choices = field.get('choiceOptions', [])
            if isinstance(choices, list):
                choice_text = '; '.join(choices)
            else:
                choice_text = str(choices)
            schema_section += f"  Choices: {choice_text}\n"
    
    # Build collections section
    collections_section = "\n## COLLECTIONS TO EXTRACT:\n"
    for collection in collections:
        collection_name = collection.get('collectionName', '')
        collection_description = collection.get('description', '')
        collection_id = collection.get('id', '')
        
        collections_section += f"- **{collection_name}** (ID: {collection_id}): {collection_description}\n"
        collections_section += f"  **CRITICAL**: Create separate records for each unique instance found.\n"
        
        # Add properties
        properties = collection.get('properties', [])
        if properties:
            collections_section += f"  Properties for each {collection_name} item:\n"
            for prop in properties:
                prop_name = prop.get('propertyName', '')
                prop_type = prop.get('propertyType', 'TEXT')
                prop_description = prop.get('description', '')
                prop_id = prop.get('id', '')
                
                collections_section += f"  * **{prop_name}** (ID: {prop_id}, {prop_type}): {prop_description}\n"
                
                # Add choice options if applicable
                if prop_type == 'CHOICE' and prop.get('choiceOptions'):
                    choices = prop.get('choiceOptions', [])
                    if isinstance(choices, list):
                        choice_text = '; '.join(choices)
                    else:
                        choice_text = str(choices)
                    collections_section += f"    Choices: {choice_text}\n"
    
    # Add extraction rules section
    rules_section = ""
    if extraction_rules:
        rules_section = "\n## EXTRACTION RULES:\n"
        for rule in extraction_rules:
            rule_name = rule.get('ruleName', 'Rule')
            rule_content = rule.get('ruleContent', '')
            target_field = rule.get('targetField', 'All Fields')
            
            rules_section += f"- **{rule_name}** (Applies to: {target_field}): {rule_content}\n"
    
    # Add knowledge documents section
    knowledge_section = ""
    if knowledge_documents:
        knowledge_section = "\n## KNOWLEDGE DOCUMENTS:\n"
        for doc in knowledge_documents:
            doc_name = doc.get('displayName', doc.get('fileName', 'Knowledge Document'))
            doc_content = doc.get('content', '')
            target_field = doc.get('targetField', 'All Fields')
            
            knowledge_section += f"- **{doc_name}** (Applies to: {target_field}):\n"
            knowledge_section += f"```\n{doc_content}\n```\n"
    
    # Add verified validations section for reference
    verified_section = ""
    if verified_validations:
        verified_section = "\n## VERIFIED FIELD VALIDATIONS (for reference):\n"
        for validation in verified_validations:
            field_name = validation.get('field_name', '')
            extracted_value = validation.get('extracted_value', '')
            verified_section += f"- {field_name}: {extracted_value}\n"
    
    # Output format specification
    output_format = """
## REQUIRED OUTPUT FORMAT:
Return a JSON object with this exact structure:

```json
{
  "field_validations": [
    {
      "field_id": "field-uuid-here",
      "field_name": "Field Name",
      "validation_type": "schema_field",
      "data_type": "TEXT",
      "extracted_value": "extracted value here",
      "ai_reasoning": "explanation of how and where this value was found",
      "confidence_score": 85,
      "collection_name": null,
      "record_index": null
    },
    {
      "field_id": "property-uuid-here", 
      "field_name": "Property Name",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "extracted_value": "extracted value here",
      "ai_reasoning": "explanation of extraction",
      "confidence_score": 90,
      "collection_name": "Collection Name",
      "record_index": 0
    }
  ]
}
```

**IMPORTANT**: 
- Use the field IDs provided in the schema above
- For collections, create separate records with incremental record_index (0, 1, 2, etc.)
- Only include fields that actually have extractable data
- Provide clear ai_reasoning explaining where each value was found
"""
    
    # Combine all sections
    full_prompt = (
        system_prompt + 
        document_content + 
        schema_section + 
        collections_section + 
        rules_section + 
        knowledge_section + 
        verified_section +
        output_format
    )
    
    return full_prompt

def call_gemini_ai(prompt: str) -> Dict[str, Any]:
    """
    Call Gemini AI with the compiled prompt and return the response.
    """
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {
                "success": False,
                "error": "GEMINI_API_KEY not found in environment variables"
            }
        
        # Import Google AI modules
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Use the latest Gemini model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        logging.info(f"Calling Gemini AI with prompt of length {len(prompt)}")
        
        # Generate response
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return {
                "success": False,
                "error": "Gemini API returned empty response"
            }
        
        ai_response = response.text.strip()
        logging.info(f"Received AI response of length {len(ai_response)}")
        
        # Extract token counts if available
        input_tokens = getattr(response.usage_metadata, 'prompt_token_count', None) if hasattr(response, 'usage_metadata') else None
        output_tokens = getattr(response.usage_metadata, 'candidates_token_count', None) if hasattr(response, 'usage_metadata') else None
        
        return {
            "success": True,
            "ai_response": ai_response,
            "input_token_count": input_tokens,
            "output_token_count": output_tokens
        }
        
    except Exception as e:
        logging.error(f"Gemini AI call failed: {str(e)}")
        return {
            "success": False,
            "error": f"Gemini AI call failed: {str(e)}"
        }

def parse_ai_response(ai_response: str) -> Dict[str, Any]:
    """
    Parse the AI JSON response and clean it up for database writing.
    Optimized for high-volume processing (1000+ records).
    """
    try:
        # Clean the response - remove markdown code blocks if present
        cleaned_response = ai_response.strip()
        
        # Remove markdown json code blocks
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        
        cleaned_response = cleaned_response.strip()
        
        # Parse JSON
        parsed_data = json.loads(cleaned_response)
        
        # Validate structure
        if not isinstance(parsed_data, dict) or 'field_validations' not in parsed_data:
            return {
                "success": False,
                "error": "Invalid JSON structure - missing 'field_validations' key"
            }
        
        field_validations = parsed_data.get('field_validations', [])
        if not isinstance(field_validations, list):
            return {
                "success": False,
                "error": "Invalid JSON structure - 'field_validations' must be an array"
            }
        
        # Clean and validate each field validation
        cleaned_validations = []
        for i, validation in enumerate(field_validations):
            if not isinstance(validation, dict):
                logging.warning(f"Skipping invalid validation at index {i}: not a dict")
                continue
            
            # Ensure required fields exist with defaults
            cleaned_validation = {
                "field_id": validation.get("field_id", ""),
                "field_name": validation.get("field_name", ""),
                "validation_type": validation.get("validation_type", "schema_field"),
                "data_type": validation.get("data_type", "TEXT"),
                "extracted_value": validation.get("extracted_value", ""),
                "ai_reasoning": validation.get("ai_reasoning", ""),
                "confidence_score": validation.get("confidence_score", 50),
                "collection_name": validation.get("collection_name", None),
                "record_index": validation.get("record_index", None)
            }
            
            # Validate field_id is present
            if not cleaned_validation["field_id"]:
                logging.warning(f"Skipping validation with missing field_id: {validation}")
                continue
            
            cleaned_validations.append(cleaned_validation)
        
        logging.info(f"Successfully parsed {len(cleaned_validations)} field validations")
        
        return {
            "success": True,
            "field_validations": cleaned_validations,
            "total_fields_processed": len(cleaned_validations)
        }
        
    except json.JSONDecodeError as e:
        logging.error(f"JSON parsing failed: {str(e)}")
        logging.error(f"AI response: {ai_response[:500]}...")
        return {
            "success": False,
            "error": f"JSON parsing failed: {str(e)}",
            "ai_response_preview": ai_response[:500]
        }
    except Exception as e:
        logging.error(f"Response parsing failed: {str(e)}")
        return {
            "success": False,
            "error": f"Response parsing failed: {str(e)}"
        }

def run_full_document_extraction(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main extraction function that follows the complete workflow:
    1. Compile prompt using document content, target schema fields, verified field validations & system prompt
    2. AI responds with JSON body of field validations
    3. System parses the JSON body to clean it up ready for writing to DB
    4. Return data ready for database writing and UI rendering
    """
    try:
        logging.info("Starting full document extraction workflow")
        
        # Extract input data
        session_id = input_data.get('session_id', '')
        project_id = input_data.get('project_id', '')
        schema_fields = input_data.get('schema_fields', [])
        collections = input_data.get('collections', [])
        knowledge_documents = input_data.get('knowledge_documents', [])
        extraction_rules = input_data.get('extraction_rules', [])
        session_data = input_data.get('session_data', {})
        
        # Get documents from session data
        documents = session_data.get('documents', [])
        if not documents:
            return ExtractionResult(
                success=False,
                error_message="No documents found in session data"
            ).__dict__
        
        logging.info(f"Processing {len(documents)} documents")
        logging.info(f"Schema fields: {len(schema_fields)}")
        logging.info(f"Collections: {len(collections)}")
        logging.info(f"Knowledge documents: {len(knowledge_documents)}")
        logging.info(f"Extraction rules: {len(extraction_rules)}")
        
        # Step 1: Get existing verified field validations for reference
        verified_validations = get_existing_verified_validations(session_id)
        
        # Step 2: Compile extraction prompt
        extraction_prompt = compile_extraction_prompt(
            documents=documents,
            schema_fields=schema_fields,
            collections=collections,
            knowledge_documents=knowledge_documents,
            extraction_rules=extraction_rules,
            verified_validations=verified_validations
        )
        
        logging.info(f"Compiled extraction prompt: {len(extraction_prompt)} characters")
        
        # Step 3: Call AI with compiled prompt
        ai_result = call_gemini_ai(extraction_prompt)
        
        if not ai_result.get("success"):
            return ExtractionResult(
                success=False,
                error_message=ai_result.get("error", "AI call failed"),
                extraction_prompt=extraction_prompt
            ).__dict__
        
        ai_response = ai_result.get("ai_response", "")
        input_token_count = ai_result.get("input_token_count", 0)
        output_token_count = ai_result.get("output_token_count", 0)
        
        # Step 4: Parse and clean AI response for database writing
        parse_result = parse_ai_response(ai_response)
        
        if not parse_result.get("success"):
            return ExtractionResult(
                success=False,
                error_message=parse_result.get("error", "Response parsing failed"),
                extraction_prompt=extraction_prompt,
                ai_response=ai_response,
                input_token_count=input_token_count,
                output_token_count=output_token_count
            ).__dict__
        
        field_validations = parse_result.get("field_validations", [])
        total_fields_processed = parse_result.get("total_fields_processed", 0)
        
        # High-volume processing optimization for 1000+ records
        if total_fields_processed > 100:
            logging.info(f"High-volume processing mode: {total_fields_processed} validations")
            # Optimize memory usage for large datasets
            import gc
            gc.collect()
        
        # Step 5: Return data ready for database writing and UI rendering
        result = ExtractionResult(
            success=True,
            extracted_data={},  # Keep for compatibility
            field_validations=field_validations,
            extraction_prompt=extraction_prompt,
            ai_response=ai_response,
            input_token_count=input_token_count,
            output_token_count=output_token_count,
            total_fields_processed=total_fields_processed,
            document_count=len(documents)
        )
        
        logging.info(f"Extraction completed successfully: {total_fields_processed} fields processed")
        return result.__dict__
        
    except Exception as e:
        logging.error(f"Full document extraction failed: {str(e)}")
        return ExtractionResult(
            success=False,
            error_message=f"Extraction workflow failed: {str(e)}"
        ).__dict__

if __name__ == "__main__":
    # Handle command line execution
    try:
        input_data = json.loads(sys.stdin.read())
        result = run_full_document_extraction(input_data)
        print(json.dumps(result))
    except Exception as e:
        error_result = ExtractionResult(
            success=False,
            error_message=f"Script execution failed: {str(e)}"
        ).__dict__
        print(json.dumps(error_result))