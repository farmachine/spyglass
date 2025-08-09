#!/usr/bin/env python3
"""
EXTRACTION-ONLY AI SYSTEM
Single-step process: Extract data only (no validation, confidence scoring, or reasoning)
"""
import os
import json
import logging
import base64
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from extraction_only_prompt import EXTRACTION_ONLY_PROMPT

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class ExtractionOnlyResult:
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    extraction_prompt: Optional[str] = None
    ai_response: Optional[str] = None
    input_token_count: Optional[int] = None
    output_token_count: Optional[int] = None

def repair_truncated_json(response_text: str) -> str:
    """
    Repair function for truncated JSON responses - simplified for extraction-only format.
    """
    try:
        logging.info(f"Attempting to repair JSON response of length {len(response_text)}")
        
        # Check if response starts with field_extractions structure
        if not response_text.strip().startswith('{"field_extractions":'):
            logging.warning("Response doesn't start with expected field_extractions structure")
            # Try alternative patterns
            if '"field_extractions"' in response_text[:200]:
                logging.info("Found field_extractions key later in response, attempting repair...")
                start_idx = response_text.find('"field_extractions"')
                if start_idx > 0:
                    response_text = '{"' + response_text[start_idx:]
            else:
                return None
        
        import re
        
        lines = response_text.split('\n')
        field_extractions = []
        current_object_lines = []
        brace_count = 0
        inside_extraction = False
        in_field_extractions_array = False
        
        for line_num, line in enumerate(lines):
            # Check if we're entering the field_extractions array
            if '"field_extractions":' in line:
                in_field_extractions_array = True
                continue
                
            if not in_field_extractions_array:
                continue
                
            # Look for object start
            line_stripped = line.strip()
            if line_stripped == '{' or ('{' in line and ('"field_id"' in line or '"field_name"' in line)):
                # Start of a new field extraction object
                if line_stripped == '{':
                    current_object_lines = [line]
                else:
                    current_object_lines = [line]
                inside_extraction = True
                brace_count = line.count('{') - line.count('}')
            elif inside_extraction:
                current_object_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                
                # Check if we've completed this object
                if brace_count == 0 and (line.strip().endswith('}') or line.strip().endswith('},')):
                    # We have a complete field extraction object
                    complete_object = '\n'.join(current_object_lines)
                    try:
                        # Try to parse this individual object to ensure it's valid
                        obj_json = complete_object.strip()
                        if obj_json.endswith(','):
                            obj_json = obj_json[:-1]  # Remove trailing comma
                        
                        # Wrap in a test structure to validate
                        test_json = '{"test": ' + obj_json + '}'
                        parsed_test = json.loads(test_json)
                        
                        # Validate it has required fields
                        test_obj = parsed_test['test']
                        if 'field_id' in test_obj or 'field_name' in test_obj:
                            field_extractions.append(complete_object.strip())
                            logging.info(f"Found complete field extraction object #{len(field_extractions)}")
                        else:
                            logging.warning("Field extraction object missing required keys")
                            
                    except json.JSONDecodeError as e:
                        logging.warning(f"Skipping invalid field extraction object: {str(e)[:100]}...")
                    
                    # Reset for next object
                    current_object_lines = []
                    inside_extraction = False
                    brace_count = 0
        
        if field_extractions:
            # Build a proper JSON structure with all complete field extractions
            repaired = '{\n  "field_extractions": [\n'
            
            for i, extraction in enumerate(field_extractions):
                # Clean up the extraction object
                clean_extraction = extraction.strip()
                if clean_extraction.endswith(','):
                    clean_extraction = clean_extraction[:-1]
                
                # Add proper indentation
                indented_extraction = '\n'.join('    ' + line for line in clean_extraction.split('\n'))
                
                repaired += indented_extraction
                
                # Add comma if not the last item
                if i < len(field_extractions) - 1:
                    repaired += ','
                
                repaired += '\n'
            
            repaired += '  ]\n}'
            
            logging.info(f"Successfully repaired JSON with {len(field_extractions)} field extractions")
            return repaired
        else:
            logging.warning("No complete field extraction objects found")
            return None
            
    except Exception as e:
        logging.error(f"Error during JSON repair: {str(e)}")
        return None

def run_extraction_only(
    documents: List[Dict[str, Any]],
    schema_fields: List[Dict[str, Any]],
    extraction_rules: List[Dict[str, Any]],
    knowledge_documents: List[Dict[str, Any]],
    session_id: str,
    project_name: str = "Document Analysis"
) -> ExtractionOnlyResult:
    """
    Run extraction-only process using Google Gemini API.
    Returns only extracted data without validation, confidence scores, or reasoning.
    """
    try:
        import google.generativeai as genai
        
        # Get API key
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Use Gemini 2.0 Flash for extraction
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Prepare documents for processing
        contents = []
        document_descriptions = []
        
        for doc in documents:
            doc_name = doc.get('name', 'Unknown Document')
            doc_type = doc.get('type', 'Unknown Type')
            document_descriptions.append(f"- {doc_name} ({doc_type})")
            
            if doc.get('base64_content'):
                # Decode base64 content
                try:
                    content_bytes = base64.b64decode(doc['base64_content'])
                    
                    # Handle different document types
                    if doc_type.lower() == 'pdf':
                        # For PDF, include as binary data
                        contents.append({
                            'mime_type': 'application/pdf',
                            'data': content_bytes
                        })
                    elif doc_type.lower() in ['png', 'jpg', 'jpeg']:
                        # For images
                        mime_type = f"image/{doc_type.lower()}"
                        if doc_type.lower() == 'jpg':
                            mime_type = "image/jpeg"
                        contents.append({
                            'mime_type': mime_type,
                            'data': content_bytes
                        })
                    else:
                        # For text-based documents, decode to text
                        text_content = content_bytes.decode('utf-8', errors='ignore')
                        contents.append(f"\n\n=== {doc_name} ===\n{text_content}")
                        
                except Exception as e:
                    logging.warning(f"Error processing document {doc_name}: {str(e)}")
                    contents.append(f"\n\n=== {doc_name} (Processing Error) ===\nError: {str(e)}")
            
            elif doc.get('content'):
                # Direct text content
                contents.append(f"\n\n=== {doc_name} ===\n{doc['content']}")
        
        # Build the extraction prompt
        prompt_parts = [EXTRACTION_ONLY_PROMPT]
        
        # Add session context
        prompt_parts.append(f"\n\n## SESSION CONTEXT:")
        prompt_parts.append(f"Session ID: {session_id}")
        prompt_parts.append(f"Project: {project_name}")
        prompt_parts.append(f"Documents to process: {len(documents)}")
        prompt_parts.append("Document List:")
        prompt_parts.extend(document_descriptions)
        
        # Add schema fields
        if schema_fields:
            prompt_parts.append(f"\n\n## SCHEMA FIELDS:")
            prompt_parts.append("```json")
            prompt_parts.append(json.dumps({"schema_fields": schema_fields}, indent=2))
            prompt_parts.append("```")
        
        # Add extraction rules
        if extraction_rules:
            prompt_parts.append(f"\n\n## EXTRACTION RULES:")
            for rule in extraction_rules:
                rule_text = f"**{rule.get('field_name', 'Unknown Field')} Rule**: {rule.get('rule', 'No rule specified')}"
                prompt_parts.append(rule_text)
        
        # Add knowledge documents
        if knowledge_documents:
            prompt_parts.append(f"\n\n## KNOWLEDGE DOCUMENTS:")
            for kb_doc in knowledge_documents:
                kb_name = kb_doc.get('name', 'Unknown Document')
                kb_content = kb_doc.get('content', 'No content')
                prompt_parts.append(f"\n### Knowledge Document: {kb_name}")
                prompt_parts.append(kb_content[:2000])  # Limit knowledge doc content
        
        # Add document contents
        prompt_parts.append(f"\n\n## DOCUMENTS TO EXTRACT FROM:")
        
        final_prompt = '\n'.join(prompt_parts)
        
        # Prepare content for Gemini
        gemini_content = [final_prompt]
        
        # Add binary content (PDFs, images) to Gemini content
        for content in contents:
            if isinstance(content, dict) and 'mime_type' in content:
                gemini_content.append(content)
            else:
                gemini_content.append(content)
        
        # Call Gemini API
        logging.info(f"Calling Gemini API for extraction-only processing...")
        
        response = model.generate_content(
            gemini_content,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                top_p=0.8,
                top_k=40,
                max_output_tokens=8192,
                response_mime_type="application/json"
            )
        )
        
        response_text = response.text
        
        # Get token counts
        input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        
        logging.info(f"Gemini response received. Input tokens: {input_tokens}, Output tokens: {output_tokens}")
        
        # Try to parse the response
        try:
            parsed_response = json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.warning(f"Failed to parse JSON response: {str(e)}")
            # Try to repair truncated JSON
            repaired_json = repair_truncated_json(response_text)
            if repaired_json:
                try:
                    parsed_response = json.loads(repaired_json)
                    logging.info("Successfully repaired and parsed truncated JSON")
                except json.JSONDecodeError as repair_error:
                    logging.error(f"Failed to parse repaired JSON: {str(repair_error)}")
                    return ExtractionOnlyResult(
                        success=False,
                        error_message=f"JSON parsing failed even after repair: {str(repair_error)}",
                        extraction_prompt=final_prompt,
                        ai_response=response_text,
                        input_token_count=input_tokens,
                        output_token_count=output_tokens
                    )
            else:
                return ExtractionOnlyResult(
                    success=False,
                    error_message=f"JSON parsing failed and repair unsuccessful: {str(e)}",
                    extraction_prompt=final_prompt,
                    ai_response=response_text,
                    input_token_count=input_tokens,
                    output_token_count=output_tokens
                )
        
        # Validate the response structure
        if not isinstance(parsed_response, dict) or 'field_extractions' not in parsed_response:
            return ExtractionOnlyResult(
                success=False,
                error_message="Response missing 'field_extractions' key",
                extraction_prompt=final_prompt,
                ai_response=response_text,
                input_token_count=input_tokens,
                output_token_count=output_tokens
            )
        
        field_extractions = parsed_response['field_extractions']
        if not isinstance(field_extractions, list):
            return ExtractionOnlyResult(
                success=False,
                error_message="'field_extractions' is not a list",
                extraction_prompt=final_prompt,
                ai_response=response_text,
                input_token_count=input_tokens,
                output_token_count=output_tokens
            )
        
        logging.info(f"Extraction completed successfully. Found {len(field_extractions)} field extractions")
        
        return ExtractionOnlyResult(
            success=True,
            extracted_data=parsed_response,
            extraction_prompt=final_prompt,
            ai_response=response_text,
            input_token_count=input_tokens,
            output_token_count=output_tokens
        )
        
    except Exception as e:
        logging.error(f"Error during extraction: {str(e)}")
        return ExtractionOnlyResult(
            success=False,
            error_message=str(e),
            extraction_prompt=final_prompt if 'final_prompt' in locals() else None,
            ai_response=None
        )

if __name__ == "__main__":
    try:
        # Read input from stdin (sent from Node.js)
        import sys
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        # Extract the input parameters from the Node.js request
        documents = data.get('documents', [])
        schema_fields = data.get('schema_fields', [])
        extraction_rules = data.get('extraction_rules', [])
        knowledge_documents = data.get('knowledge_documents', [])
        session_id = data.get('session_id', 'unknown-session')
        project_name = data.get('project_name', 'Document Analysis')
        
        # Transform documents to the format expected by the extraction function
        processed_documents = []
        for doc in documents:
            processed_doc = {
                'name': doc.get('file_name', 'Unknown Document'),
                'type': doc.get('mime_type', 'text/plain').split('/')[-1],
                'base64_content': doc.get('file_content', '').split(',')[-1] if ',' in doc.get('file_content', '') else doc.get('file_content', '')
            }
            processed_documents.append(processed_doc)
        
        logging.info(f"Processing {len(processed_documents)} documents for session {session_id}")
        
        # Run the extraction-only process
        result = run_extraction_only(
            documents=processed_documents,
            schema_fields=schema_fields,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_id=session_id,
            project_name=project_name
        )
        
        # Output the result as JSON
        output = {
            'success': result.success,
            'extracted_data': result.extracted_data,
            'error_message': result.error_message,
            'extraction_prompt': result.extraction_prompt,
            'ai_response': result.ai_response,
            'input_token_count': result.input_token_count,
            'output_token_count': result.output_token_count
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        # Output error as JSON
        error_output = {
            'success': False,
            'error_message': str(e),
            'extracted_data': None
        }
        print(json.dumps(error_output))