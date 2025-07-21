#!/usr/bin/env python3
"""
SIMPLIFIED AI EXTRACTION SYSTEM
Two-step process: Extract → Validate
Each step can be called individually or chained together
"""
import os
import json
import logging
import base64
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class ExtractionResult:
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

@dataclass
class ValidationResult:
    success: bool
    updated_validations: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None

def step1_extract_from_documents(
    documents: List[Dict[str, Any]], 
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None,
    session_name: str = "contract"
) -> ExtractionResult:
    """
    STEP 1: Extract data from documents using AI
    
    Args:
        documents: List of document objects with file_content, file_name, mime_type
        project_schema: Schema definition with schema_fields and collections
        session_name: Name for the main object (default: "contract")
    
    Returns:
        ExtractionResult with extracted JSON data
    """
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return ExtractionResult(success=False, error_message="GEMINI_API_KEY not found")
        
        # Import Google AI modules
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        logging.info(f"STEP 1: Starting extraction for {len(documents)} documents")
        
        # Build extraction prompt with enhanced field descriptions
        prompt = f"""You are an expert data extraction specialist. Extract data from the provided documents and return a JSON object with the exact structure specified below.

CRITICAL INSTRUCTIONS:
1. Extract ONLY real data from the documents - NO sample or placeholder data
2. If data is not found, use null
3. Return JSON as a single object with the session name as the root key
4. **COUNTING FIELDS ARE CRITICAL**: For counting fields (like "Number of Parties", "Number of NDAs"), you MUST:
   - Scan through ALL documents thoroughly  
   - Count EVERY unique company/organization/party mentioned across ALL documents
   - Include subsidiaries, parent companies, and any entity that could be a party
   - Do NOT miss any parties - be comprehensive and thorough
5. PAY SPECIAL ATTENTION to field descriptions - they guide what you should extract
6. Use the exact field names specified, but output in camelCase format
7. **DOCUMENT SET ANALYSIS**: You are analyzing a SET of {len(documents)} documents - make sure to extract data from ALL of them

TARGET JSON STRUCTURE:
{{"
  "{session_name}": {{
    // Schema fields go here as properties
    // Collections go here as arrays of objects
  }}
}}

SCHEMA FIELDS TO EXTRACT:"""
        
        # Add schema fields with descriptions for AI guidance
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                field_description = field.get('description', '')
                camel_case_name = field_name.replace(' ', '').replace('of', 'Of')
                prompt += f"\n- {camel_case_name} ({field_type}): {field_description or 'Extract this field from the documents'}"
        
        # Add collections with descriptions for AI guidance
        if project_schema.get("collections"):
            prompt += "\n\nCOLLECTIONS TO EXTRACT:"
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_description = collection.get('description', '')
                prompt += f"\n- {collection_name}: {collection_description or 'Extract array of these objects'}"
                
                properties = collection.get("properties", [])
                if properties:
                    prompt += f"\n  Properties for each {collection_name} item:"
                    for prop in properties:
                        prop_name = prop.get('propertyName', '')
                        prop_type = prop.get('propertyType', 'TEXT')
                        prop_description = prop.get('description', '')
                        prompt += f"\n  * {prop_name} ({prop_type}): {prop_description or 'Extract this property'}"
        
        # Generate dynamic JSON example based on actual schema and extraction rules
        def generate_dynamic_json_example():
            json_lines = [f'{{"']
            json_lines.append(f'  "{session_name}": {{')
            
            # Add schema fields with descriptions and applicable rules
            if project_schema.get("schema_fields"):
                for field in project_schema["schema_fields"]:
                    field_name = field['fieldName']
                    field_type = field['fieldType']
                    field_description = field.get('description', '')
                    camel_case_name = field_name.replace(' ', '').replace('of', 'Of')
                    
                    # Find applicable extraction rules
                    applicable_rules = []
                    if extraction_rules:
                        for rule in extraction_rules:
                            rule_target = rule.get('targetField', [])
                            if isinstance(rule_target, list):
                                if field_name in rule_target or 'All Fields' in rule_target:
                                    applicable_rules.append(rule.get('ruleContent', ''))
                            elif field_name == rule_target or rule_target == 'All Fields':
                                applicable_rules.append(rule.get('ruleContent', ''))
                    
                    # Determine output format based on field type
                    if field_type == 'NUMBER':
                        if 'parties' in field_name.lower():
                            output_format = '33'  # Example showing high party count
                        elif 'nda' in field_name.lower():
                            output_format = '8'
                        else:
                            output_format = '42'
                    elif field_type == 'DATE':
                        output_format = '"2024-01-15"'
                    elif field_type == 'BOOLEAN':
                        output_format = 'true'
                    else:  # TEXT
                        output_format = '"Extracted Text Value"'
                    
                    # Build comment with description and rules
                    comment_parts = []
                    if field_description:
                        comment_parts.append(field_description)
                    if applicable_rules:
                        comment_parts.extend(applicable_rules)
                    comment = ' + '.join(comment_parts) if comment_parts else 'Extract this field from documents'
                    
                    json_lines.append(f'    "{camel_case_name}": {output_format}, // {comment}')
            
            # Add collections with properties and applicable rules
            if project_schema.get("collections"):
                for collection in project_schema["collections"]:
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    collection_description = collection.get('description', '')
                    
                    json_lines.append(f'    "{collection_name}": [ // {collection_description or "Extract array of these objects"}')
                    json_lines.append('      {')
                    
                    properties = collection.get("properties", [])
                    for i, prop in enumerate(properties):
                        prop_name = prop.get('propertyName', '')
                        prop_type = prop.get('propertyType', 'TEXT')
                        prop_description = prop.get('description', '')
                        
                        # Find applicable extraction rules for this property
                        applicable_rules = []
                        if extraction_rules:
                            for rule in extraction_rules:
                                rule_target = rule.get('targetField', [])
                                full_prop_name = f"{collection_name}.{prop_name}"
                                if isinstance(rule_target, list):
                                    if full_prop_name in rule_target or prop_name in rule_target or 'All Fields' in rule_target:
                                        applicable_rules.append(rule.get('ruleContent', ''))
                                elif full_prop_name == rule_target or prop_name == rule_target or rule_target == 'All Fields':
                                    applicable_rules.append(rule.get('ruleContent', ''))
                        
                        # Determine output format based on property type
                        if prop_type == 'NUMBER':
                            output_format = '100'
                        elif prop_type == 'DATE':
                            output_format = '"2024-01-15"'
                        elif prop_type == 'BOOLEAN':
                            output_format = 'true'
                        else:  # TEXT
                            output_format = '"Real Extracted Value"'
                        
                        # Build comment with description and rules
                        comment_parts = []
                        if prop_description:
                            comment_parts.append(prop_description)
                        if applicable_rules:
                            comment_parts.extend(applicable_rules)
                        comment = ' + '.join(comment_parts) if comment_parts else 'Extract this property'
                        
                        comma = ',' if i < len(properties) - 1 else ''
                        json_lines.append(f'        "{prop_name}": {output_format}{comma} // {comment}')
                    
                    json_lines.append('      }')
                    json_lines.append('    ],')
            
            json_lines.append('  }')
            json_lines.append('}')
            return '\n'.join(json_lines)
        
        dynamic_example = generate_dynamic_json_example()
        logging.info(f"Generated dynamic JSON example with {len(extraction_rules or [])} extraction rules")
        logging.info(f"Dynamic example preview (first 500 chars): {dynamic_example[:500]}...")
        
        prompt += f"""

DYNAMIC EXAMPLE OUTPUT FORMAT (based on your actual schema configuration):
{dynamic_example}

CRITICAL PARTY COUNTING: You MUST count parties by scanning through ALL documents and identifying EVERY unique company, organization, subsidiary, or entity that could be a party to any contract. Do not limit yourself to just the parties you extract full details for - count ALL mentions across the entire document set.

RETURN ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN"""
        
        # Use Gemini API to process all documents in single call (performance optimization)
        model = genai.GenerativeModel('gemini-1.5-flash')
        file_parts = []
        
        for doc in documents:
            file_content = doc['file_content']
            file_name = doc['file_name']
            mime_type = doc['mime_type']
            
            logging.info(f"Processing document: {file_name} ({mime_type})")
            
            # Extract text from document
            if mime_type.startswith("text/"):
                # Handle text content
                if isinstance(file_content, str):
                    if file_content.startswith('data:'):
                        base64_content = file_content.split(',', 1)[1]
                        decoded_bytes = base64.b64decode(base64_content)
                        content_text = decoded_bytes.decode('utf-8', errors='ignore')
                    else:
                        content_text = file_content
                else:
                    content_text = file_content.decode('utf-8', errors='ignore')
                
                all_document_text += f"\n\n=== DOCUMENT: {file_name} ===\n{content_text}"
                
            else:
                # Use Gemini API to extract text from binary files (PDFs, images, etc.)
                try:
                    if isinstance(file_content, str) and file_content.startswith('data:'):
                        # This is a data URL from the frontend
                        mime_part, base64_content = file_content.split(',', 1)
                        binary_content = base64.b64decode(base64_content)
                        
                        # Use Gemini to extract text from the binary file
                        logging.info(f"Using Gemini API to extract text from {file_name}")
                        
                        # Create file part for Gemini
                        file_part = {
                            "mime_type": mime_type,
                            "data": binary_content
                        }
                        
                        # Store file part for single AI call (performance optimization)
                        file_parts.append({
                            "name": file_name,
                            "part": file_part
                        })
                    
                except Exception as e:
                    logging.error(f"Failed to process document {file_name}: {e}")
                    continue
        
        # Make single AI extraction call with all documents (major performance improvement)
        if file_parts:
            logging.info(f"Making single AI extraction call with {len(file_parts)} documents")
            logging.info(f"Document names being processed: {[fp['name'] for fp in file_parts]}")
            content_parts = [prompt]
            for fp in file_parts:
                content_parts.append(fp["part"])
            response = model.generate_content(content_parts)
        else:
            logging.info(f"Making AI extraction call without documents (text only)")
            response = model.generate_content(prompt)
        
        if not response or not response.text:
            return ExtractionResult(success=False, error_message="No response from AI")
        
        # Parse JSON response - handle markdown code blocks
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json
        if response_text.startswith("```"):
            response_text = response_text[3:]   # Remove ```
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove trailing ```
        
        response_text = response_text.strip()
        
        try:
            # If empty response, create default structure
            if not response_text:
                logging.warning("Empty response from AI, creating default structure")
                extracted_data = {session_name: {}}
            else:
                extracted_data = json.loads(response_text)
                
            logging.info(f"STEP 1: Successfully extracted data with keys: {list(extracted_data.keys())}")
            return ExtractionResult(success=True, extracted_data=extracted_data)
            
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse AI response as JSON: {e}")
            logging.error(f"Cleaned response: {response_text}")
            return ExtractionResult(success=False, error_message=f"Invalid JSON response: {e}")
            
    except Exception as e:
        logging.error(f"STEP 1 extraction failed: {e}")
        return ExtractionResult(success=False, error_message=str(e))

def step2_validate_field_records(
    field_validations: List[Dict[str, Any]],
    extraction_rules: List[Dict[str, Any]] = None,
    knowledge_documents: List[Dict[str, Any]] = None
) -> ValidationResult:
    """
    STEP 2: Validate existing field records using AI
    
    Args:
        field_validations: List of field validation records with UUIDs
        extraction_rules: Optional extraction rules for context
        knowledge_documents: Optional knowledge documents for context
    
    Returns:
        ValidationResult with updated validation records
    """
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return ValidationResult(success=False, error_message="GEMINI_API_KEY not found")
        
        # Import Google AI modules
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        logging.info(f"STEP 2: Starting validation for {len(field_validations)} field records")
        
        # Build validation prompt
        prompt = """You are an expert data validation specialist. Review the provided field validation records and return updated validation scores and reasoning.

CRITICAL INSTRUCTIONS:
1. Use AI judgment to assess confidence levels (0.0 to 1.0)
2. Consider extraction rules and knowledge documents as context
3. Return JSON with fieldValidations array using the EXACT UUIDs provided
4. Set validationStatus to "valid", "warning", or "invalid"
5. Provide clear AIReasoning for each field

FIELD VALIDATION RECORDS TO REVIEW:"""
        
        # Add field validation records
        for fv in field_validations:
            uuid = fv.get('uuid', fv.get('id', 'unknown'))
            field_name = fv.get('field_name', fv.get('fieldName', 'unknown'))
            field_value = fv.get('extracted_value', fv.get('fieldValue'))
            field_type = fv.get('field_type', fv.get('fieldType', 'string'))
            
            prompt += f"\n- UUID: {uuid}"
            prompt += f"\n  Field: {field_name} ({field_type})"
            prompt += f"\n  Value: {field_value}"
        
        # Add extraction rules context
        if extraction_rules:
            prompt += "\n\nEXTRACTION RULES FOR CONTEXT:"
            for rule in extraction_rules:
                rule_name = rule.get('ruleName', 'Unknown Rule')
                rule_content = rule.get('ruleContent', '')
                target_field = rule.get('targetField', '')
                if rule.get('isActive', True):
                    prompt += f"\n- {rule_name}: {rule_content} (applies to: {target_field})"
        
        # Add knowledge documents context
        if knowledge_documents:
            prompt += "\n\nKNOWLEDGE DOCUMENTS FOR CONTEXT:"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown Document'))
                content = doc.get('content', '')
                if content:
                    prompt += f"\n- {doc_name}: {content[:500]}..."
        
        prompt += """

REQUIRED OUTPUT FORMAT (return ONLY this JSON):
{
  "fieldValidations": [
    {
      "uuid": "exact-uuid-from-input",
      "fieldName": "fieldName",
      "fieldType": "fieldType", 
      "fieldValue": "actualValue",
      "collectionID": "collectionId-or-null",
      "validationStatus": "valid|warning|invalid",
      "validationConfidence": 0.95,
      "AIReasoning": "Clear explanation of confidence level"
    }
  ]
}"""
        
        # Make AI validation call
        model = genai.GenerativeModel('gemini-1.5-flash')
        logging.info(f"Making AI validation call with {len(prompt)} character prompt")
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return ValidationResult(success=False, error_message="No response from AI")
        
        # Parse JSON response
        try:
            validation_result = json.loads(response.text.strip())
            updated_validations = validation_result.get('fieldValidations', [])
            
            logging.info(f"STEP 2: Successfully validated {len(updated_validations)} field records")
            return ValidationResult(success=True, updated_validations=updated_validations)
            
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse validation response as JSON: {e}")
            logging.error(f"Raw response: {response.text}")
            return ValidationResult(success=False, error_message=f"Invalid JSON response: {e}")
            
    except Exception as e:
        logging.error(f"STEP 2 validation failed: {e}")
        return ValidationResult(success=False, error_message=str(e))

def extract_and_validate_chain(
    documents: List[Dict[str, Any]], 
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None,
    knowledge_documents: List[Dict[str, Any]] = None,
    session_name: str = "contract"
) -> tuple[ExtractionResult, Optional[ValidationResult]]:
    """
    CHAINED PROCESS: Run both extraction and validation steps together
    
    Returns:
        Tuple of (extraction_result, validation_result)
    """
    logging.info("Starting chained extraction and validation process")
    
    # Step 1: Extract
    extraction_result = step1_extract_from_documents(documents, project_schema, extraction_rules, session_name)
    
    if not extraction_result.success:
        return extraction_result, None
    
    # Convert extraction data to field validation format (this would be done by the API)
    # For now, return just the extraction result
    # The API layer will handle creating field validation records and calling step2
    
    return extraction_result, None

if __name__ == "__main__":
    import sys
    import json
    
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        step = input_data.get("step", "extract")
        
        if step == "extract":
            # STEP 1: Extract from documents
            documents = input_data.get("files", [])
            project_schema = input_data.get("project_schema", {})
            extraction_rules = input_data.get("extraction_rules", [])
            session_name = input_data.get("session_name", "contract")
            
            result = step1_extract_from_documents(documents, project_schema, extraction_rules, session_name)
            
            if result.success:
                print(json.dumps(result.extracted_data))
            else:
                print(json.dumps({"error": result.error_message}), file=sys.stderr)
                sys.exit(1)
                
        elif step == "validate":
            # STEP 2: Validate field records
            field_validations = input_data.get("field_validations", [])
            extraction_rules = input_data.get("extraction_rules", [])
            knowledge_documents = input_data.get("knowledge_documents", [])
            
            result = step2_validate_field_records(field_validations, extraction_rules, knowledge_documents)
            
            if result.success:
                print(json.dumps(result.updated_validations))
            else:
                print(json.dumps({"error": result.error_message}), file=sys.stderr)
                sys.exit(1)
                
        else:
            print(json.dumps({"error": f"Unknown step: {step}"}), file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)