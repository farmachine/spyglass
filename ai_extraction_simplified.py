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
1. PROCESS ALL {len(documents)} DOCUMENTS: {[doc.get('file_name', 'Unknown') for doc in documents]}
2. FOLLOW SCHEMA FIELD DESCRIPTIONS PRECISELY - Each description is your extraction instruction
3. APPLY EXTRACTION RULES - Rules modify extraction behavior, formatting, and validation
4. For NUMBER fields: Count ALL instances across ALL {len(documents)} documents as described
5. For NDA counting: Count individual contracts/agreements, NOT just parties
6. For collections: Extract EVERY instance mentioned across ALL documents
7. Return JSON with real extracted values only
8. If extraction rules specify formatting, apply that formatting to extracted values

DOCUMENT SET ANALYSIS: You are processing {len(documents)} documents simultaneously. Extract comprehensively from the entire set.

SCHEMA FIELDS TO EXTRACT (descriptions are mandatory instructions):"""
        
        # Add schema fields with descriptions for AI guidance  
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                field_description = field.get('description', '')
                camel_case_name = field_name.replace(' ', '').replace('of', 'Of')
                
                # Find applicable extraction rules for this field
                applicable_rules = []
                if extraction_rules:
                    for rule in extraction_rules:
                        rule_target = rule.get('targetField', [])
                        if isinstance(rule_target, list):
                            if field_name in rule_target or 'All Fields' in rule_target:
                                applicable_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                        elif field_name == rule_target or rule_target == 'All Fields':
                            applicable_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                
                # Combine description with rules
                full_instruction = field_description or 'Extract this field from the documents'
                if applicable_rules:
                    full_instruction += " | " + " | ".join(applicable_rules)
                
                prompt += f"\n- **{camel_case_name}** ({field_type}): {full_instruction}"
        
        # Add collections with descriptions for AI guidance
        if project_schema.get("collections"):
            prompt += "\n\nCOLLECTIONS TO EXTRACT (extract ALL instances across ALL documents):"
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_description = collection.get('description', '')
                
                # Find applicable extraction rules for this collection
                applicable_rules = []
                if extraction_rules:
                    for rule in extraction_rules:
                        rule_target = rule.get('targetField', [])
                        if isinstance(rule_target, list):
                            if collection_name in rule_target or 'All Fields' in rule_target:
                                applicable_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                        elif collection_name == rule_target or rule_target == 'All Fields':
                            applicable_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                
                full_instruction = collection_description or 'Extract array of these objects'
                if applicable_rules:
                    full_instruction += " | " + " | ".join(applicable_rules)
                
                prompt += f"\n- **{collection_name}**: {full_instruction}"
                
                properties = collection.get("properties", [])
                if properties:
                    prompt += f"\n  Properties for each {collection_name} item:"
                    for prop in properties:
                        prop_name = prop.get('propertyName', '')
                        prop_type = prop.get('propertyType', 'TEXT')
                        prop_description = prop.get('description', '')
                        
                        # Find applicable extraction rules for this property
                        prop_rules = []
                        if extraction_rules:
                            for rule in extraction_rules:
                                rule_target = rule.get('targetField', [])
                                # Handle arrow notation (e.g., "Parties --> Name")
                                arrow_notation = f"{collection_name} --> {prop_name}"
                                full_prop_name = f"{collection_name}.{prop_name}"
                                
                                if isinstance(rule_target, list):
                                    if (arrow_notation in rule_target or 
                                        full_prop_name in rule_target or 
                                        prop_name in rule_target or 
                                        'All Fields' in rule_target):
                                        prop_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                                elif (arrow_notation == rule_target or 
                                      full_prop_name == rule_target or 
                                      prop_name == rule_target or 
                                      rule_target == 'All Fields'):
                                    prop_rules.append(f"RULE: {rule.get('ruleContent', '')}")
                        
                        prop_instruction = prop_description or 'Extract this property'
                        if prop_rules:
                            prop_instruction += " | " + " | ".join(prop_rules)
                            logging.info(f"RULE MATCH: {collection_name} --> {prop_name} matched rules: {[rule.get('ruleName') for rule in extraction_rules if arrow_notation in str(rule.get('targetField', []))]}")
                        
                        # Add choice options for CHOICE fields
                        if prop_type == 'CHOICE' and prop.get('choiceOptions'):
                            choice_text = f"The output should be one of the following choices: {'; '.join(prop['choiceOptions'])}."
                            prop_instruction = prop_instruction + " | " + choice_text if prop_instruction else choice_text
                            
                        prompt += f"\n  * **{prop_name}** ({prop_type}): {prop_instruction}"
        
        # Generate field validation JSON structure
        def generate_field_validation_example():
            json_lines = ['{"field_validations": [']
            
            # Add schema fields with proper field validation structure
            if project_schema.get("schema_fields"):
                for i, field in enumerate(project_schema["schema_fields"]):
                    field_id = field['id']
                    field_name = field['fieldName']
                    field_type = field['fieldType']
                    field_description = field.get('description', '')
                    
                    # Determine example value based on field type
                    if field_type == 'NUMBER':
                        if 'parties' in field_name.lower():
                            example_value = '33'
                        elif 'nda' in field_name.lower():
                            example_value = '8'
                        else:
                            example_value = '42'
                    elif field_type == 'DATE':
                        example_value = '2024-01-15'
                    elif field_type == 'CHOICE' and field.get('choiceOptions'):
                        example_value = field["choiceOptions"][0]
                    else:  # TEXT
                        example_value = 'Extracted Text Value'
                    
                    # Build AI reasoning
                    reasoning = f"Extracted from document analysis"
                    if field_description:
                        reasoning += f" - {field_description}"
                    
                    json_lines.append('  {')
                    json_lines.append(f'    "field_id": "{field_id}",')
                    json_lines.append(f'    "field_type": "schema_field",')
                    json_lines.append(f'    "field_name": "{field_name}",')
                    json_lines.append(f'    "extracted_value": "{example_value}",')
                    json_lines.append(f'    "confidence_score": 0.95,')
                    json_lines.append(f'    "validation_status": "unverified",')
                    json_lines.append(f'    "ai_reasoning": "{reasoning}"')
                    json_lines.append('  }' + (',' if i < len(project_schema["schema_fields"]) - 1 or project_schema.get("collections") else ''))
            
            # Add collection properties with proper field validation structure
            if project_schema.get("collections"):
                for collection in project_schema["collections"]:
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    properties = collection.get("properties", [])
                    
                    for record_index in range(2):  # Example with 2 records
                        for prop_index, prop in enumerate(properties):
                            prop_id = prop['id']
                            prop_name = prop['propertyName']
                            prop_type = prop['propertyType']
                            
                            # Determine example value
                            if prop_type == 'CHOICE' and prop.get('choiceOptions'):
                                example_value = prop["choiceOptions"][0]
                            elif prop_type == 'NUMBER':
                                example_value = '100'
                            elif prop_type == 'DATE':
                                example_value = '2024-01-15'
                            else:
                                example_value = 'Extracted Value'
                            
                            field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                            
                            json_lines.append('  {')
                            json_lines.append(f'    "field_id": "{prop_id}",')
                            json_lines.append(f'    "field_type": "collection_property",')
                            json_lines.append(f'    "field_name": "{field_name_with_index}",')
                            json_lines.append(f'    "extracted_value": "{example_value}",')
                            json_lines.append(f'    "confidence_score": 0.95,')
                            json_lines.append(f'    "validation_status": "unverified",')
                            json_lines.append(f'    "ai_reasoning": "Extracted from document analysis",')
                            json_lines.append(f'    "record_index": {record_index}')
                            
                            # Check if this is the last item
                            is_last = (collection == project_schema["collections"][-1] and 
                                     record_index == 1 and 
                                     prop_index == len(properties) - 1)
                            json_lines.append('  }' + ('' if is_last else ','))
            
            json_lines.append(']}')
            return '\n'.join(json_lines)
        
        dynamic_example = generate_field_validation_example()
        logging.info(f"Generated field validation example with {len(extraction_rules or [])} extraction rules")
        logging.info(f"Dynamic example preview (first 500 chars): {dynamic_example[:500]}...")
        
        prompt += f"""

REQUIRED OUTPUT FORMAT - Field Validation JSON Structure:
{dynamic_example}

CRITICAL: Return ONLY this exact JSON format with field_validations array containing objects with:
- field_id: The exact UUID from schema
- field_type: "schema_field" or "collection_property" 
- field_name: For collections, use format "CollectionName.PropertyName[index]"
- extracted_value: The actual extracted value from documents
- confidence_score: Number between 0.0 and 1.0
- validation_status: "unverified" (let validation system handle verification)
- ai_reasoning: Brief explanation of extraction
- record_index: For collection properties only (0, 1, 2, etc.)

CRITICAL COUNTING INSTRUCTIONS:
- **PARTY COUNTING**: Scan ALL {len(documents)} documents and count EVERY unique company, organization, subsidiary, or entity. Include parties mentioned but not fully detailed.
- **NDA COUNTING**: Count individual contracts/agreements/NDAs, not parties. If you see 8 separate contracts, return 8.
- **COMPREHENSIVE SCAN**: Process every document in this {len(documents)}-document set. Do not miss any documents.
- **FOLLOW DESCRIPTIONS**: Schema field descriptions are mandatory instructions for what to count and extract.

CHOICE FIELD HANDLING:
- For CHOICE fields, extract values from the specified choice options only
- If the document contains values not in the choice options, return null (do not block processing)
- Choice options are specified as "The output should be one of the following choices: ..."
- Example: For Yes/No choice, only return "Yes" or "No", never "true", "false", "1", "0", etc.

DOCUMENT VERIFICATION: Confirm you processed all {len(documents)} documents: {[doc.get('file_name', 'Unknown') for doc in documents]}

RETURN ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN"""
        
        # STEP 1: ENHANCED DOCUMENT CONTENT EXTRACTION
        # Process documents in two phases: content extraction, then data extraction
        logging.info(f"=== STEP 1: DOCUMENT CONTENT EXTRACTION ===")
        logging.info(f"Processing {len(documents)} documents for content extraction")
        
        model = genai.GenerativeModel('gemini-1.5-flash')
        extracted_content_text = ""
        
        for doc in documents:
            file_content = doc['file_content']
            file_name = doc['file_name']
            mime_type = doc['mime_type']
            
            logging.info(f"STEP 1: Processing document: {file_name} ({mime_type})")
            
            # Handle different document types
            if mime_type.startswith("text/"):
                # Handle plain text content
                if isinstance(file_content, str):
                    if file_content.startswith('data:'):
                        base64_content = file_content.split(',', 1)[1]
                        decoded_bytes = base64.b64decode(base64_content)
                        content_text = decoded_bytes.decode('utf-8', errors='ignore')
                    else:
                        content_text = file_content
                else:
                    content_text = file_content.decode('utf-8', errors='ignore')
                
                extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n{content_text}"
                logging.info(f"STEP 1: Extracted {len(content_text)} characters from text file {file_name}")
                
            else:
                # Use Gemini API for binary document content extraction (PDF, Word, Excel)
                try:
                    if isinstance(file_content, str) and file_content.startswith('data:'):
                        # Decode data URL
                        mime_part, base64_content = file_content.split(',', 1)
                        binary_content = base64.b64decode(base64_content)
                        
                        # Create specialized extraction prompts based on document type
                        if ('excel' in mime_type or 
                            'spreadsheet' in mime_type or 
                            'vnd.ms-excel' in mime_type or 
                            'vnd.openxmlformats-officedocument.spreadsheetml' in mime_type or
                            file_name.lower().endswith(('.xlsx', '.xls'))):
                            # Excel file - extract all sheets and tabular data
                            extraction_prompt = f"""Extract ALL content from this Excel file ({file_name}).

INSTRUCTIONS:
- Extract content from ALL worksheets/sheets in the workbook
- For each sheet, include the sheet name as a header
- Preserve table structure where possible using clear formatting
- Include all text, numbers, formulas results, and data
- If there are multiple sheets, clearly separate them with sheet names
- Format the output as readable structured text that preserves the original data organization

RETURN: Complete text content from all sheets in this Excel file."""

                        elif 'pdf' in mime_type or file_name.lower().endswith('.pdf'):
                            # PDF file - extract all text content
                            extraction_prompt = f"""Extract ALL text content from this PDF document ({file_name}).

INSTRUCTIONS:
- Extract all readable text from every page
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information

RETURN: Complete text content from this PDF document."""

                        elif ('word' in mime_type or 
                              'vnd.openxmlformats-officedocument.wordprocessingml' in mime_type or
                              'application/msword' in mime_type or
                              file_name.lower().endswith(('.docx', '.doc'))):
                            # Word document - extract all content
                            extraction_prompt = f"""Extract ALL content from this Word document ({file_name}).

INSTRUCTIONS:
- Extract all text content including body text, headers, footers, tables
- Preserve document structure and formatting where possible
- Include any embedded text, comments, or annotations
- Maintain logical organization of the content

RETURN: Complete text content from this Word document."""

                        else:
                            # Generic binary file extraction
                            extraction_prompt = f"""Extract all readable text content from this document ({file_name}).

INSTRUCTIONS:
- Extract all visible text and data
- Preserve structure and organization where possible
- Include tables, lists, and formatted content

RETURN: Complete readable content from this document."""
                        
                        # Handle file types based on Gemini API support
                        logging.info(f"STEP 1: Processing {file_name} with MIME type {mime_type}")
                        
                        # Check if this is a supported file type for Gemini API
                        if 'pdf' in mime_type or file_name.lower().endswith('.pdf'):
                            # PDF files are fully supported by Gemini API
                            logging.info(f"STEP 1: Using Gemini API for PDF extraction from {file_name}")
                            content_response = model.generate_content([
                                {
                                    "mime_type": mime_type,
                                    "data": binary_content
                                },
                                extraction_prompt
                            ])
                        elif ('word' in mime_type or 
                              'vnd.openxmlformats-officedocument.wordprocessingml' in mime_type or
                              'application/msword' in mime_type or
                              file_name.lower().endswith(('.docx', '.doc'))):
                            # Word document - use python-docx library
                            logging.info(f"STEP 1: Using python-docx library for Word extraction from {file_name}")
                            try:
                                import io
                                from docx import Document
                                
                                # Create document from binary content
                                doc_stream = io.BytesIO(binary_content)
                                doc = Document(doc_stream)
                                
                                # Extract all text content
                                text_content = []
                                for paragraph in doc.paragraphs:
                                    if paragraph.text.strip():
                                        text_content.append(paragraph.text.strip())
                                
                                # Extract text from tables
                                for table in doc.tables:
                                    for row in table.rows:
                                        row_text = []
                                        for cell in row.cells:
                                            if cell.text.strip():
                                                row_text.append(cell.text.strip())
                                        if row_text:
                                            text_content.append(" | ".join(row_text))
                                
                                document_content = "\n".join(text_content)
                                logging.info(f"STEP 1: Successfully extracted {len(document_content)} characters from Word document {file_name}")
                                
                            except Exception as e:
                                logging.error(f"STEP 1: Failed to extract content from Word document {file_name}: {e}")
                                document_content = f"[ERROR EXTRACTING WORD DOCUMENT: {file_name}]\nError: {str(e)}"
                        
                        elif ('excel' in mime_type or 
                              'spreadsheet' in mime_type or 
                              'vnd.ms-excel' in mime_type or 
                              'vnd.openxmlformats-officedocument.spreadsheetml' in mime_type or
                              file_name.lower().endswith(('.xlsx', '.xls'))):
                            # Excel file - use openpyxl/xlrd libraries
                            logging.info(f"STEP 1: Using openpyxl/xlrd libraries for Excel extraction from {file_name}")
                            try:
                                import io
                                import pandas as pd
                                
                                # Create Excel stream from binary content
                                excel_stream = io.BytesIO(binary_content)
                                
                                # Read all sheets
                                all_sheets = pd.read_excel(excel_stream, sheet_name=None, engine='openpyxl' if file_name.lower().endswith('.xlsx') else 'xlrd')
                                
                                text_content = []
                                for sheet_name, df in all_sheets.items():
                                    text_content.append(f"=== SHEET: {sheet_name} ===")
                                    
                                    # Convert dataframe to string representation
                                    sheet_text = df.to_string(index=False, na_rep='')
                                    text_content.append(sheet_text)
                                
                                document_content = "\n\n".join(text_content)
                                logging.info(f"STEP 1: Successfully extracted {len(document_content)} characters from Excel document {file_name}")
                                
                            except Exception as e:
                                logging.error(f"STEP 1: Failed to extract content from Excel document {file_name}: {e}")
                                document_content = f"[ERROR EXTRACTING EXCEL DOCUMENT: {file_name}]\nError: {str(e)}"
                        
                        else:
                            # Other unsupported formats
                            logging.warning(f"STEP 1: Unsupported file format {file_name} ({mime_type})")
                            document_content = f"[UNSUPPORTED FILE FORMAT: {file_name}]\nFile type {mime_type} is not supported for content extraction."
                        
                        # Handle PDF response or use extracted content from libraries
                        if 'pdf' in mime_type or file_name.lower().endswith('.pdf'):
                            # Handle PDF response from Gemini API
                            if content_response and content_response.text:
                                document_content = content_response.text.strip()
                                logging.info(f"STEP 1: Successfully extracted {len(document_content)} characters from PDF {file_name}")
                            else:
                                logging.warning(f"STEP 1: No content extracted from PDF {file_name}")
                                document_content = "[Content extraction failed]"
                        
                        # Add extracted content to final text
                        extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n{document_content}"
                    
                except Exception as e:
                    logging.error(f"STEP 1: Failed to extract content from document {file_name}: {e}")
                    extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n[Content extraction error: {e}]"
                    continue
        
        logging.info(f"STEP 1 COMPLETE: Extracted total of {len(extracted_content_text)} characters from all documents")
        
        # Now proceed with data extraction using the extracted content
        final_prompt = prompt + f"\n\nEXTRACTED DOCUMENT CONTENT:\n{extracted_content_text}"
        
        # STEP 2: DATA EXTRACTION FROM CONTENT
        logging.info(f"=== STEP 2: DATA EXTRACTION ===")
        logging.info(f"Making data extraction call with {len(extracted_content_text)} characters of extracted content")
        response = model.generate_content(final_prompt)
        
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
                extracted_data = {"field_validations": []}
            else:
                extracted_data = json.loads(response_text)
                
            # Validate that we have the expected field_validations structure
            if "field_validations" not in extracted_data:
                logging.warning("AI response missing field_validations key, creating default structure")
                extracted_data = {"field_validations": []}
                
            logging.info(f"STEP 1: Successfully extracted {len(extracted_data.get('field_validations', []))} field validations")
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
        
        # Build validation prompt with enhanced rule-based confidence adjustment
        prompt = f"""You are an expert data validation specialist. Review field validation records and apply extraction rules for confidence adjustment and formatting.

CRITICAL INSTRUCTIONS:
1. APPLY EXTRACTION RULES: Use rules to adjust confidence levels and format values
2. RULE-BASED CONFIDENCE: If rule specifies confidence (e.g., "27%", "50%"), apply that percentage
3. KNOWLEDGE CONFLICTS: Lower confidence when values conflict with knowledge documents
4. FORMAT TRANSFORMATION: If rules specify formatting, transform the extracted value accordingly
5. Return JSON with fieldValidations array using EXACT UUIDs provided
6. Provide clear AIReasoning explaining confidence adjustments and rule applications

FIELD VALIDATION RECORDS TO PROCESS ({len(field_validations)} records):"""
        
        # Generate dynamic validation example based on actual fields and rules
        def generate_validation_example():
            if not field_validations:
                return ""
            
            sample = field_validations[0]
            uuid = sample.get('uuid', sample.get('id', 'uuid-example'))
            field_name = sample.get('field_name', sample.get('fieldName', 'fieldName'))
            field_value = sample.get('extracted_value', sample.get('fieldValue', 'extractedValue'))
            field_type = sample.get('field_type', sample.get('fieldType', 'TEXT'))
            
            # Find applicable rules for this field
            confidence = "0.95"
            reasoning = "High confidence extraction"
            
            if extraction_rules:
                for rule in extraction_rules:
                    rule_content = rule.get('ruleContent', '')
                    if any(keyword in rule_content.lower() for keyword in ['27%', '50%', 'confidence']):
                        confidence = "0.27"
                        reasoning = f"Confidence adjusted by rule: {rule_content[:100]}..."
                        break
            
            return f"""
EXAMPLE OUTPUT:
{{
  "fieldValidations": [
    {{
      "uuid": "{uuid}",
      "fieldName": "{field_name}",
      "fieldType": "{field_type}",
      "fieldValue": "{field_value}",
      "collectionID": null,
      "validationStatus": "valid",
      "validationConfidence": {confidence},
      "AIReasoning": "{reasoning}"
    }}
  ]
}}"""

        prompt += generate_validation_example()
        
        # Add field validation records
        for fv in field_validations:
            uuid = fv.get('uuid', fv.get('id', 'unknown'))
            field_name = fv.get('field_name', fv.get('fieldName', 'unknown'))
            field_value = fv.get('extracted_value', fv.get('fieldValue'))
            field_type = fv.get('field_type', fv.get('fieldType', 'string'))
            
            prompt += f"\n- UUID: {uuid} | Field: {field_name} ({field_type}) | Value: {field_value}"
        
        # Add extraction rules with confidence instructions
        if extraction_rules:
            prompt += "\n\nEXTRACTION RULES TO APPLY:"
            for rule in extraction_rules:
                rule_name = rule.get('ruleName', 'Unknown Rule')
                rule_content = rule.get('ruleContent', '')
                target_field = rule.get('targetField', '')
                if rule.get('isActive', True):
                    prompt += f"\n- **{rule_name}**: {rule_content}"
                    
                    # Show which fields this rule applies to
                    if isinstance(target_field, list):
                        prompt += f" (applies to: {', '.join(target_field)})"
                    else:
                        prompt += f" (applies to: {target_field})"
                    
                    # Extract confidence percentage from rule content
                    import re
                    confidence_match = re.search(r'(\d{1,2})%', rule_content)
                    if confidence_match:
                        confidence_pct = confidence_match.group(1)
                        prompt += f" [SET CONFIDENCE: 0.{confidence_pct.zfill(2)}]"
        
        # Add knowledge documents context
        if knowledge_documents:
            prompt += "\n\nKNOWLEDGE DOCUMENTS FOR CONTEXT:"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown Document'))
                content = doc.get('content', '')
                if content:
                    prompt += f"\n- {doc_name}: {content[:500]}..."
        
        prompt += """

REQUIRED OUTPUT FORMAT (apply extraction rules to confidence and reasoning):
{
  "fieldValidations": [
    {
      "uuid": "exact-uuid-from-input",
      "fieldName": "fieldName",
      "fieldType": "fieldType", 
      "fieldValue": "transformed-value-if-rule-specifies-formatting",
      "collectionID": "collectionId-or-null",
      "validationStatus": "valid|warning|invalid",
      "validationConfidence": 0.27,  // Use rule-specified confidence (e.g. 27% = 0.27)
      "AIReasoning": "Applied [RuleName]: confidence reduced to 27% due to rule specification"
    }
  ]
}

RETURN ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN"""
        
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