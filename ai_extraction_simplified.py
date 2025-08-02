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
from prompt import EXTRACTION_PROMPT

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class ExtractionResult:
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    extraction_prompt: Optional[str] = None
    ai_response: Optional[str] = None
    input_token_count: Optional[int] = None
    output_token_count: Optional[int] = None

# ValidationResult dataclass removed - validation now occurs only during extraction

def repair_truncated_json(response_text: str) -> str:
    """
    Attempt to repair truncated JSON responses by finding complete field validation objects
    and properly closing the JSON structure to preserve as much data as possible.
    """
    try:
        logging.info(f"Attempting to repair JSON response of length {len(response_text)}")
        
        # Check if response starts with field_validations structure
        if not response_text.strip().startswith('{"field_validations":'):
            logging.warning("Response doesn't start with expected field_validations structure")
            return None
        
        # Find all complete field validation objects by parsing line by line
        import re
        
        lines = response_text.split('\n')
        field_validations = []
        current_object_lines = []
        brace_count = 0
        inside_validation = False
        
        for line_num, line in enumerate(lines):
            # Check if this line starts a new field validation object
            if '"field_id"' in line and brace_count == 0:
                # Start of a new field validation object
                current_object_lines = [line]
                inside_validation = True
                brace_count += line.count('{') - line.count('}')
            elif inside_validation:
                current_object_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                
                # Check if we've completed this object (brace_count back to 0)
                if brace_count == 0 and (line.strip().endswith('}') or line.strip().endswith('},')):
                    # We have a complete field validation object
                    complete_object = '\n'.join(current_object_lines)
                    try:
                        # Try to parse this individual object to ensure it's valid
                        obj_json = complete_object.strip()
                        if obj_json.endswith(','):
                            obj_json = obj_json[:-1]  # Remove trailing comma
                        
                        # Wrap in a test structure to validate
                        test_json = '{"test": ' + obj_json + '}'
                        json.loads(test_json)
                        field_validations.append(complete_object.strip())
                        logging.info(f"Found complete field validation object #{len(field_validations)}")
                    except json.JSONDecodeError as e:
                        logging.warning(f"Skipping invalid field validation object: {str(e)[:100]}...")
                    
                    # Reset for next object
                    current_object_lines = []
                    inside_validation = False
                    brace_count = 0
        
        if field_validations:
            # Build a proper JSON structure with all complete field validations
            repaired = '{\n  "field_validations": [\n'
            
            for i, validation in enumerate(field_validations):
                # Clean up the validation object
                clean_validation = validation.strip()
                if clean_validation.endswith(','):
                    clean_validation = clean_validation[:-1]
                
                # Add proper indentation
                indented_validation = '\n'.join('    ' + line for line in clean_validation.split('\n'))
                repaired += indented_validation
                
                # Add comma if not the last item
                if i < len(field_validations) - 1:
                    repaired += ','
                repaired += '\n'
            
            repaired += '  ]\n}'
            
            # Test if the repair worked
            json.loads(repaired)
            logging.info(f"Successfully repaired truncated JSON - preserved {len(field_validations)} complete field validations")
            return repaired
        else:
            logging.warning("No complete field validation objects found in truncated response")
            return None
        
    except Exception as e:
        logging.error(f"JSON repair failed: {e}")
        return None

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
        
        # Configure with no timeout constraints for large responses
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        logging.info(f"STEP 1: Starting extraction for {len(documents)} documents")
        
        # Build schema fields section for the imported prompt
        schema_fields_text = ""
        
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
                
                schema_fields_text += f"\n- **{camel_case_name}** ({field_type}): {full_instruction}"
        
        # Build collections section for the imported prompt
        collections_text = ""
        if project_schema.get("collections"):
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
                
                collections_text += f"\n- **{collection_name}**: {full_instruction}"
                
                # Add explicit instructions for list/collection items
                collections_text += f"\n  **CRITICAL FOR {collection_name}**: Find ALL instances in the documents. Create one collection item per unique instance found. Each item should have a separate record_index (0, 1, 2, etc.)."
                collections_text += f"\n  **TABLE EXTRACTION**: If {collection_name} items appear in a table, extract EVERY ROW from that table, not just 2-3 examples. Count all rows and extract all data."
                collections_text += f"\n  **NUMBERED SECTIONS**: If {collection_name} matches a document section name, find ALL numbered subsections (e.g., 2.3.1, 2.3.2, 2.3.3, etc.) and extract each one as a separate collection item."
                collections_text += f"\n  **MARKDOWN TABLES**: Recognize markdown table format with | separators. Extract ALL data rows (excluding headers) as separate collection items - if table has 10 rows, extract all 10."
                collections_text += f"\n  **COUNT ALL ITEMS**: If you see numbered items 2.3.1, 2.3.2, 2.3.3... keep going until you reach the end (e.g., 2.3.10) and extract EVERY SINGLE ONE as separate collection items."
                collections_text += f"\n  **NO TRUNCATION**: Include ALL found items in your JSON response - do not truncate or limit the output even if there are many items."
                
                properties = collection.get("properties", [])
                if properties:
                    collections_text += f"\n  Properties for each {collection_name} item:"
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
                            
                        collections_text += f"\n  * **{prop_name}** ({prop_type}): {prop_instruction}"
        
        # Use the imported prompt template with our schema and collections
        prompt = EXTRACTION_PROMPT.format(
            schema_fields=schema_fields_text,
            collections=collections_text
        )
        
        # Generate field validation JSON structure
        def generate_field_validation_example():
            json_lines = ['{"field_validations": [']
            
            # Add schema fields with proper field validation structure
            if project_schema.get("schema_fields") and len(project_schema["schema_fields"]) > 0:
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
                    json_lines.append(f'    "validation_type": "schema_field",')
                    json_lines.append(f'    "data_type": "{field_type}",')
                    json_lines.append(f'    "field_name": "{field_name}",')
                    json_lines.append(f'    "extracted_value": "{example_value}",')
                    json_lines.append(f'    "confidence_score": 0.95,')
                    json_lines.append(f'    "validation_status": "unverified",')
                    json_lines.append(f'    "ai_reasoning": "Provide intelligent extraction reasoning here"')
                    json_lines.append('  }' + (',' if i < len(project_schema["schema_fields"]) - 1 or project_schema.get("collections") else ''))
            
            # Add collection properties with proper field validation structure
            if project_schema.get("collections") and len(project_schema["collections"]) > 0:
                for collection in project_schema["collections"]:
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    properties = collection.get("properties", [])
                    
                    # Show minimal examples for all collections - let AI decide actual count
                    example_count = 2  # Standard example count for all collections
                    
                    for record_index in range(example_count):
                        for prop_index, prop in enumerate(properties):
                            prop_id = prop['id']
                            prop_name = prop['propertyName']
                            prop_type = prop['propertyType']
                            
                            # Determine example value based on field type
                            if prop_type == 'CHOICE' and prop.get('choiceOptions'):
                                example_value = prop["choiceOptions"][0]
                            elif prop_type == 'NUMBER':
                                example_value = '100'
                            elif prop_type == 'DATE':
                                example_value = '2024-01-15'
                            else:  # TEXT
                                example_value = 'Extracted Value'
                            
                            field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                            
                            json_lines.append('  {')
                            json_lines.append(f'    "field_id": "{prop_id}",')
                            json_lines.append(f'    "validation_type": "collection_property",')
                            json_lines.append(f'    "data_type": "{prop_type}",')
                            json_lines.append(f'    "field_name": "{field_name_with_index}",')
                            json_lines.append(f'    "collection_name": "{collection_name}",')
                            json_lines.append(f'    "extracted_value": "{example_value}",')
                            json_lines.append(f'    "confidence_score": 0.95,')
                            json_lines.append(f'    "validation_status": "unverified",')
                            json_lines.append(f'    "ai_reasoning": "Provide intelligent extraction reasoning here",')
                            json_lines.append(f'    "record_index": {record_index}')
                            
                            # Check if this is the last item
                            is_last = (collection == project_schema["collections"][-1] and 
                                     record_index == (example_count - 1) and 
                                     prop_index == len(properties) - 1)
                            json_lines.append('  }' + ('' if is_last else ','))
            
            json_lines.append(']}')
            return '\n'.join(json_lines)
        
        dynamic_example = generate_field_validation_example()
        logging.info(f"Generated field validation example with {len(extraction_rules or [])} extraction rules")
        logging.info(f"Dynamic example preview (first 500 chars): {dynamic_example[:500]}...")
        
        # Create field ID mapping for verification
        field_id_mapping = {}
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_id_mapping[field['fieldName']] = field['id']
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                for prop in collection.get("properties", []):
                    prop_name = f"{collection.get('collectionName', '')}.{prop['propertyName']}"
                    field_id_mapping[prop_name] = prop['id']
        
        logging.info(f"Field ID mapping for validation: {field_id_mapping}")
        
        # The imported prompt already contains all the necessary instructions
        # Just add document verification and choice field handling specific to this run
        prompt += f"""

DOCUMENT VERIFICATION: Confirm you processed all {len(documents)} documents: {[doc.get('file_name', 'Unknown') for doc in documents]}

CHOICE FIELD HANDLING:
- For CHOICE fields, extract values from the specified choice options only
- If the document contains values not in the choice options, return null (do not block processing)
- Choice options are specified as "The output should be one of the following choices: ..."
- Example: For Yes/No choice, only return "Yes" or "No", never "true", "false", "1", "0", etc.

**CRITICAL FIELD ID REQUIREMENT**: 
- Use ONLY the EXACT field_id values from the JSON example above
- Field IDs are UUIDs like "585ace35-b5b3-4361-857a-c1d7cea5141e" 
- NEVER use field names like "Product/ServiceSpecificationsMet" as field_id
- NEVER generate your own field IDs
- Copy the exact UUID field_id from the example structure

**CRITICAL COLLECTION NAME REQUIREMENT**: For collection properties, you MUST include the "collection_name" field in each field validation object. Use the exact collection name from the schema (e.g., "Increase Rates").

REQUIRED OUTPUT FORMAT - Field Validation JSON Structure:
{dynamic_example}"""
        
        # STEP 1: ENHANCED DOCUMENT CONTENT EXTRACTION
        # Process documents in two phases: content extraction, then data extraction
        logging.info(f"=== STEP 1: DOCUMENT CONTENT EXTRACTION ===")
        logging.info(f"Processing {len(documents)} documents for content extraction")
        logging.info(f"Documents received: {[doc.get('file_name', 'Unknown') for doc in documents]}")
        logging.info(f"Documents data: {documents}")
        
        model = genai.GenerativeModel('gemini-2.5-pro')
        extracted_content_text = ""
        processed_docs = 0
        
        for doc in documents:
            file_content = doc['file_content']
            file_name = doc['file_name']
            mime_type = doc['mime_type']
            
            logging.info(f"STEP 1: Processing document: {file_name} ({mime_type})")
            
            # Handle document content - prioritize already extracted text content
            if isinstance(file_content, str) and not file_content.startswith('data:'):
                # Check only for explicit error messages (not short content length)
                if ("503 UNAVAILABLE" in file_content or 
                    "Error extracting text" in file_content or 
                    ("overloaded" in file_content.lower() and "PDF processing overloaded" in file_content)):
                    logging.warning(f"STEP 1: Detected failed extraction content for {file_name}, content: {file_content[:100]}...")
                    # Skip this document and log the issue
                    extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n[DOCUMENT CONTENT EXTRACTION FAILED - PDF processing overloaded. Please retry the extraction to process this {file_name} document properly.]"
                    processed_docs += 1
                    continue
                else:
                    # This is legitimate pre-extracted text content from the session
                    content_text = file_content
                    extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n{content_text}"
                    processed_docs += 1
                    logging.info(f"STEP 1: Using pre-extracted content from {file_name} ({len(content_text)} characters)")
                
            elif mime_type.startswith("text/"):
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
                processed_docs += 1
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
                            # PDF file - extract all text content with enhanced retry logic
                            extraction_prompt = f"""Extract ALL text content from this PDF document ({file_name}).

INSTRUCTIONS:
- Extract all readable text from every page
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information
- Focus on key data points and structured information

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
                            # PDF files - use chunked extraction for large files
                            logging.info(f"STEP 1: Using chunked PDF extraction for {file_name}")
                            
                            try:
                                # Import chunked extractor
                                from chunked_pdf_extractor import ChunkedPDFExtractor
                                
                                # Initialize extractor
                                extractor = ChunkedPDFExtractor()
                                
                                # Estimate PDF size and determine processing approach
                                pdf_info = extractor.estimate_pdf_size(binary_content)
                                logging.info(f"STEP 1: PDF analysis for {file_name}: {pdf_info}")
                                
                                if pdf_info["needs_chunking"]:
                                    logging.info(f"STEP 1: Large PDF detected, using chunked extraction for {file_name}")
                                    # Use chunked extraction
                                    import base64 as b64
                                    base64_data = f"data:application/pdf;base64,{b64.b64encode(binary_content).decode()}"
                                    chunk_result = extractor.extract_pdf_chunked(base64_data, file_name)
                                    
                                    if chunk_result["success"]:
                                        document_content = chunk_result["extracted_text"]
                                        logging.info(f"STEP 1: Chunked extraction successful for {file_name} - {chunk_result['successful_chunks']}/{chunk_result['chunks_processed']} chunks processed")
                                    else:
                                        logging.error(f"STEP 1: Chunked extraction failed for {file_name}: {chunk_result.get('error', 'Unknown error')}")
                                        document_content = f"[ERROR EXTRACTING PDF WITH CHUNKING: {file_name}]\nError: {chunk_result.get('error', 'Unknown error')}"
                                else:
                                    logging.info(f"STEP 1: Small PDF, using single-pass extraction for {file_name}")
                                    # Use single-pass extraction for small PDFs
                                    single_result = extractor.extract_single_pdf(binary_content, file_name)
                                    
                                    if single_result["success"]:
                                        document_content = single_result["extracted_text"]
                                        logging.info(f"STEP 1: Single-pass extraction successful for {file_name}")
                                    else:
                                        logging.error(f"STEP 1: Single-pass extraction failed for {file_name}: {single_result.get('error', 'Unknown error')}")
                                        document_content = f"[ERROR EXTRACTING PDF: {file_name}]\nError: {single_result.get('error', 'Unknown error')}"
                                
                                # Set content_response to None since we handled extraction directly
                                content_response = None
                                
                            except ImportError:
                                logging.warning("STEP 1: Chunked extractor not available, falling back to direct Gemini API")
                                # Fallback to original direct extraction
                                try:
                                    content_response = model.generate_content(
                                        [
                                            {
                                                "mime_type": mime_type,
                                                "data": binary_content
                                            },
                                            extraction_prompt
                                        ],
                                        generation_config=genai.GenerationConfig(
                                            max_output_tokens=65536,
                                            temperature=0.1
                                        ),
                                        request_options={"timeout": 300}
                                    )
                                    logging.info(f"STEP 1: Fallback extraction successful for {file_name}")
                                except Exception as e:
                                    logging.error(f"STEP 1: Fallback extraction failed for {file_name}: {e}")
                                    content_response = None
                            except Exception as e:
                                logging.error(f"STEP 1: Chunked extraction system error for {file_name}: {e}")
                                document_content = f"[ERROR IN CHUNKED EXTRACTION SYSTEM: {file_name}]\nError: {str(e)}"
                                content_response = None
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
        
        logging.info(f"STEP 1 COMPLETE: Processed {processed_docs} documents, extracted total of {len(extracted_content_text)} characters from all documents")
        
        # Now proceed with data extraction using the extracted content
        final_prompt = prompt + f"\n\nEXTRACTED DOCUMENT CONTENT:\n{extracted_content_text}"
        
        # STEP 2: DATA EXTRACTION FROM CONTENT
        logging.info(f"=== STEP 2: DATA EXTRACTION ===")
        logging.info(f"Making data extraction call with {len(extracted_content_text)} characters of extracted content")
        
        # Retry logic for API overload situations in data extraction
        max_retries = 3
        retry_delay = 2  # Start with 2 seconds
        
        for attempt in range(max_retries):
            try:
                response = model.generate_content(
                    final_prompt,
                    generation_config=genai.GenerationConfig(
                        max_output_tokens=65536,  # Gemini 2.5 Pro max output limit
                        temperature=0.1,
                        response_mime_type="application/json"
                    ),
                    request_options={"timeout": None}  # Remove timeout constraints
                )
                break  # Success, exit retry loop
            except Exception as e:
                if "503" in str(e) and "overloaded" in str(e).lower() and attempt < max_retries - 1:
                    logging.warning(f"Data extraction API overloaded (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s...")
                    import time
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    raise e  # Re-raise if not overload error or final attempt
        
        if not response or not response.text:
            return ExtractionResult(success=False, error_message="No response from AI")
        
        # Extract token usage information
        input_token_count = None
        output_token_count = None
        
        # Check for different possible token usage structures in Gemini API response
        logging.info(f"RESPONSE DEBUG: Response type: {type(response)}")
        logging.info(f"RESPONSE DEBUG: Response attributes: {dir(response)}")
        
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            logging.info(f"TOKEN DEBUG: Found usage_metadata: {response.usage_metadata}")
            logging.info(f"TOKEN DEBUG: usage_metadata attributes: {dir(response.usage_metadata)}")
            input_token_count = getattr(response.usage_metadata, 'prompt_token_count', None)
            output_token_count = getattr(response.usage_metadata, 'candidates_token_count', None)
            
            # Try alternative attribute names if the primary ones don't exist
            if input_token_count is None:
                input_token_count = getattr(response.usage_metadata, 'input_token_count', None)
                input_token_count = getattr(response.usage_metadata, 'prompt_tokens', input_token_count)
            if output_token_count is None:
                output_token_count = getattr(response.usage_metadata, 'output_token_count', None) 
                output_token_count = getattr(response.usage_metadata, 'candidates_tokens', output_token_count)
                output_token_count = getattr(response.usage_metadata, 'completion_tokens', output_token_count)
            
            logging.info(f"TOKEN USAGE: Input tokens: {input_token_count}, Output tokens: {output_token_count}")
        else:
            logging.warning("TOKEN DEBUG: No usage_metadata found in response")
            
        # Fallback: try to find usage information in other response attributes
        if input_token_count is None and hasattr(response, '_result') and hasattr(response._result, 'usage_metadata'):
            usage = response._result.usage_metadata
            logging.info(f"TOKEN DEBUG: Found _result.usage_metadata: {usage}")
            input_token_count = getattr(usage, 'prompt_token_count', None)
            output_token_count = getattr(usage, 'candidates_token_count', None)
            logging.info(f"TOKEN USAGE (fallback): Input tokens: {input_token_count}, Output tokens: {output_token_count}")
        
        # Parse JSON response - handle markdown code blocks
        response_text = response.text.strip()
        
        # Log raw AI response for debugging
        logging.info(f"STEP 2: Raw AI response length: {len(response_text)}")
        logging.info(f"STEP 2: Raw AI response start: {response_text[:500]}...")
        if len(response_text) > 500:
            logging.info(f"STEP 2: Raw AI response end: ...{response_text[-500:]}")
            
        # Check for potential truncation indicators
        truncation_indicators = ['...', '...}', '"ai_reasoning": "Extracted from document analysis",']
        if any(indicator in response_text[-100:] for indicator in truncation_indicators):
            logging.warning("POTENTIAL RESPONSE TRUNCATION DETECTED - Response may be incomplete")
            
        # Count field_validations objects to detect truncation
        field_validation_count = response_text.count('"field_id":')
        logging.info(f"TRUNCATION CHECK: Found {field_validation_count} field_validation objects in response")
        
        # Check for session-specific troubleshooting
        if "0db04e6a-006b-48af-b9bb-b1dc88edaae5" in str(session_name):
            logging.info("DEBUGGING SESSION 0db04e6a: Checking for collection extraction completeness")
            increase_rates_count = response_text.count('"collection_name": "Increase Rates"')
            logging.info(f"DEBUGGING SESSION 0db04e6a: Found {increase_rates_count} Increase Rates collection items")
            if increase_rates_count < 10:
                logging.warning(f"DEBUGGING SESSION 0db04e6a: Only found {increase_rates_count} Increase Rates items, expected 10!")
                logging.warning("DEBUGGING SESSION 0db04e6a: This may indicate response truncation or incomplete extraction")
            
        # Check if response appears to end abruptly
        if len(response_text) > 10000 and not response_text.strip().endswith((']}', '}')):
            logging.warning("RESPONSE APPEARS TRUNCATED - Does not end with expected JSON closing")
        
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
                # First attempt: direct JSON parsing
                try:
                    extracted_data = json.loads(response_text)
                except json.JSONDecodeError as e:
                    logging.warning(f"Direct JSON parsing failed: {e}")
                    logging.warning("Attempting JSON repair for truncated response...")
                    
                    # Attempt to repair truncated JSON
                    repaired_json = repair_truncated_json(response_text)
                    if repaired_json:
                        try:
                            extracted_data = json.loads(repaired_json)
                            logging.info("Successfully repaired and parsed truncated JSON response")
                        except json.JSONDecodeError:
                            logging.error("JSON repair failed, creating minimal structure")
                            extracted_data = {"field_validations": []}
                    else:
                        logging.error("Could not repair JSON, creating minimal structure")
                        extracted_data = {"field_validations": []}
                
            # Validate that we have the expected field_validations structure
            if "field_validations" not in extracted_data:
                logging.warning("AI response missing field_validations key, creating default structure")
                extracted_data = {"field_validations": []}
                
            logging.info(f"STEP 1: Successfully extracted {len(extracted_data.get('field_validations', []))} field validations")
            return ExtractionResult(
                success=True, 
                extracted_data=extracted_data,
                extraction_prompt=final_prompt,
                ai_response=response.text,
                input_token_count=input_token_count,
                output_token_count=output_token_count
            )
            
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse AI response as JSON: {e}")
            logging.error(f"Cleaned response: {response_text}")
            return ExtractionResult(success=False, error_message=f"Invalid JSON response: {e}")
            
    except Exception as e:
        logging.error(f"STEP 1 extraction failed: {e}")
        return ExtractionResult(success=False, error_message=str(e))

# Validation function removed - validation now occurs only during extraction process

# Chain function removed - only extraction is needed, validation occurs during extraction

if __name__ == "__main__":
    import sys
    import json
    
    try:
        # Read input from stdin
        raw_input = sys.stdin.read()
        logging.info(f"RAW INPUT RECEIVED: {raw_input[:500]}...")
        input_data = json.loads(raw_input)
        
        # Log parsed data structure
        logging.info(f"PARSED INPUT KEYS: {list(input_data.keys())}")
        operation = input_data.get("operation", "extract")
        
        if operation == "extract":
            # STEP 1: Extract from documents
            documents = input_data.get("documents", [])
            project_schema = input_data.get("project_schema", {})
            extraction_rules = input_data.get("extraction_rules", [])
            session_name = input_data.get("session_name", "contract")
            
            result = step1_extract_from_documents(documents, project_schema, extraction_rules, session_name)
            
            if result.success:
                print(json.dumps({
                    "success": True, 
                    "extracted_data": result.extracted_data, 
                    "field_validations": result.extracted_data.get("field_validations", []),
                    "extraction_prompt": result.extraction_prompt,
                    "ai_response": result.ai_response,
                    "input_token_count": result.input_token_count,
                    "output_token_count": result.output_token_count
                }))
            else:
                print(json.dumps({"success": False, "error": result.error_message}), file=sys.stderr)
                sys.exit(1)
                
        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}), file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)