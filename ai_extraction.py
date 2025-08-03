#!/usr/bin/env python3

import json
import sys
import os
import logging
import tempfile
import base64
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class FieldValidationResult:
    field_id: str
    field_name: str
    field_type: str
    extracted_value: Any
    original_extracted_value: Any  # Store original AI value for reverting
    original_confidence_score: int  # Store original AI confidence
    original_ai_reasoning: str  # Store original AI reasoning
    validation_status: str
    ai_reasoning: str
    confidence_score: int
    document_source: str
    document_sections: List[str]
    collection_name: str = None  # Collection this field belongs to
    record_index: int = None  # Index within the collection

@dataclass
class ExtractionResult:
    extracted_data: Dict[str, Any]
    confidence_score: float
    processing_notes: str
    field_validations: List[FieldValidationResult]

def generate_human_friendly_reasoning(field_name: str, extracted_value: Any, applied_rules: List[Dict[str, Any]]) -> str:
    """
    Generate human-friendly email-style reasoning for fields with conflicts or issues.
    """
    if not applied_rules:
        return f"Successfully extracted {field_name} from document"
    
    # Start with professional email greeting
    reasoning = f"We have extracted '{extracted_value}' for {field_name}, however there are some considerations that require your attention:\n\n"
    
    # Explain the issues/conflicts
    reasoning += "IDENTIFIED CONCERNS:\n"
    for rule in applied_rules:
        rule_name = rule.get('name', 'Policy Check')
        action = rule.get('action', '')
        
        if 'Knowledge Document Conflict' in rule_name:
            reasoning += f"• Our compliance review process has flagged this value based on internal policies and procedures.\n"
            reasoning += f"• The extracted information may require additional verification due to regulatory requirements.\n"
        elif 'Inc' in rule_name.lower() or 'entity' in action.lower():
            reasoning += f"• The extracted company appears to be incorporated, which requires additional entity verification.\n"
            reasoning += f"• Our standard procedure requires enhanced due diligence for corporate entities.\n"
        else:
            reasoning += f"• {action}\n"
    
    reasoning += "\nTo help us complete the verification process, could you please clarify the following:\n\n"
    
    # Generate field-specific clarification questions
    if 'company' in field_name.lower() or 'name' in field_name.lower():
        reasoning += "1. Can you confirm the full legal name of this entity as it appears in official documentation?\n"
        reasoning += "2. What is the primary business relationship with this entity (customer, vendor, partner, etc.)?\n"
        reasoning += "3. Are there any specific compliance or regulatory considerations we should be aware of for this entity?\n"
    elif 'country' in field_name.lower() or 'jurisdiction' in field_name.lower():
        reasoning += "1. Can you confirm the governing jurisdiction for this agreement?\n"
        reasoning += "2. Are there any cross-border regulatory requirements that apply to this arrangement?\n"
        reasoning += "3. Should this be subject to any specific regional compliance procedures?\n"
    elif 'date' in field_name.lower():
        reasoning += "1. Can you confirm the exact date for this field?\n"
        reasoning += "2. Is this date subject to any specific notice requirements or conditions?\n"
        reasoning += "3. Are there any related dates or deadlines we should be tracking?\n"
    else:
        reasoning += f"1. Can you verify that '{extracted_value}' is the correct value for {field_name}?\n"
        reasoning += f"2. Are there any additional details or context we should consider for this field?\n"
        reasoning += f"3. Does this information require any special handling or approval processes?\n"
    
    reasoning += "\nThank you for your assistance in completing this review."
    
    return reasoning

def ai_validate_batch(field_validations: List[Dict[str, Any]], extraction_rules: List[Dict[str, Any]] = None, knowledge_documents: List[Dict[str, Any]] = None) -> Dict[str, tuple[int, List[Dict[str, Any]], str]]:
    """
    PURE AI VALIDATION: All validation decisions made by AI only - no programmatic rules or counting.
    
    Args:
        field_validations: List of dicts with 'field_name' and 'extracted_value' keys
        extraction_rules: List of extraction rules to apply (for context only)
        knowledge_documents: List of knowledge documents to check (for context only)
    
    Returns:
        Dict mapping field_name to (confidence, applied_rules, reasoning) tuples
    """
    if not field_validations:
        return {}
    
    logging.info(f"🤖 PURE_AI_VALIDATION: Processing {len(field_validations)} fields with AI-only validation")
    
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logging.warning("GEMINI_API_KEY not found, using default confidence for all fields")
            return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}
        
        # Import Google AI modules
        from google import genai
        from google.genai import types
        import json
        
        client = genai.Client(api_key=api_key)
        
        # Build fields summary for AI
        fields_summary = "FIELDS TO VALIDATE:\n"
        for fv in field_validations:
            fields_summary += f"- Field: {fv['field_name']} = '{fv['extracted_value']}'\n"
        
        # Add extraction rules context
        rules_context = ""
        if extraction_rules:
            rules_context = "EXTRACTION RULES:\n"
            for rule in extraction_rules:
                if rule.get("isActive", True):
                    rules_context += f"- Rule: {rule.get('ruleName', 'Unknown')}\n"
                    rules_context += f"  Target Fields: {rule.get('targetField', '')}\n"
                    rules_context += f"  Content: {rule.get('ruleContent', '')}\n\n"
        
        # Add knowledge documents context
        knowledge_context = ""
        if knowledge_documents:
            knowledge_context = "KNOWLEDGE DOCUMENTS:\n"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown'))
                content = doc.get('content', '')
                if content:
                    # Include relevant excerpts (first 800 chars to fit more context)
                    knowledge_context += f"- Document: {doc_name}\n"
                    knowledge_context += f"  Content: {content[:800]}...\n\n"
        
        # Create AI-only validation prompt
        validation_prompt = f"""You are an expert data validation specialist. Use AI judgment ONLY to analyze the extracted field values. Do not count items or apply programmatic rules.

IMPORTANT: Make ALL validation decisions using AI analysis only. Do not count collection items or apply programmatic calculations.

{fields_summary}

{rules_context}

{knowledge_context}

VALIDATION TASK:
For each field, use AI judgment to:
1. Assess extraction quality and accuracy
2. Calculate confidence percentage (0-100%) based on your analysis
3. Consider context from rules and knowledge documents
4. Provide human-friendly reasoning

CONFIDENCE GUIDELINES:
- 90-100%: Clear, well-extracted values with high confidence
- 75-89%: Good extraction with minor uncertainty
- 60-74%: Reasonable extraction but some concerns
- 40-59%: Medium confidence, some rule violations or policy conflicts
- 20-39%: Low confidence, significant issues or conflicts
- 1-19%: Very low confidence, major problems
- 0%: No value found or null extraction

CRITICAL: Use AI judgment only. Do not count collection items or apply programmatic calculations.
- Use 50% for knowledge document policy conflicts
- Vary confidence scores realistically (avoid always using 100%)

RESPONSE FORMAT:
Return a JSON object with field names as keys and validation results as values:
{{
    "field_name_1": {{
        "confidence_percentage": <integer 1-100>,
        "applied_rules": [
            {{
                "name": "<rule or policy name>",
                "action": "<description of what was applied>"
            }}
        ],
        "reasoning": "<brief explanation>"
    }},
    "field_name_2": {{
        "confidence_percentage": <integer 1-100>,
        "applied_rules": [],
        "reasoning": "<brief explanation>"
    }}
}}

Important: Process all fields efficiently. Apply rules like 'Inc.' entity ambiguity and jurisdiction conflicts from knowledge documents consistently."""

        logging.info(f"AI_VALIDATE_BATCH: Sending batch validation request for {len(field_validations)} fields")
        logging.info(f"AI_VALIDATE_BATCH: Prompt length: {len(validation_prompt)} characters")
        
        # Make AI request
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Content(role="user", parts=[types.Part(text=validation_prompt)])],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=2048,  # More tokens for batch processing
                temperature=0.1  # Low temperature for consistent validation
            )
        )
        
        logging.info(f"AI_VALIDATE_BATCH: Response received: {response.text[:200] if response.text else 'None'}...")
        
        if response.text:
            try:
                batch_results = json.loads(response.text)
                logging.info(f"AI_VALIDATE_BATCH: Successfully parsed JSON with {len(batch_results)} field results")
                
                # Process results and build return dictionary
                results = {}
                for fv in field_validations:
                    field_name = fv['field_name']
                    
                    if field_name in batch_results:
                        result = batch_results[field_name]
                        confidence = result.get("confidence_percentage", 95)
                        applied_rules = result.get("applied_rules", [])
                        reasoning = result.get("reasoning", "AI validation completed")
                        results[field_name] = (confidence, applied_rules, reasoning)
                        logging.info(f"AI_VALIDATE_BATCH: Field {field_name} -> {confidence}% confidence")
                    elif fv['extracted_value'] in [None, "", "null"]:
                        results[field_name] = (0, [], "No value extracted")
                    else:
                        # Fallback for fields not processed
                        results[field_name] = (95, [], "AI validation completed")
                
                logging.info(f"AI_VALIDATE_BATCH: Successfully validated {len(results)} fields")
                return results
            except json.JSONDecodeError as e:
                logging.error(f"AI_VALIDATE_BATCH: JSON parse error: {e}")
                logging.error(f"AI_VALIDATE_BATCH: Raw response: {response.text}")
                # Fall through to fallback
        else:
            logging.warning("🤖 PURE_AI_VALIDATION: No response from AI, using default confidence")
            return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}
            
    except Exception as e:
        logging.error(f"🤖 PURE_AI_VALIDATION: Error during validation: {e}")
        return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}

# REMOVED: calculate_knowledge_based_confidence_fallback - All validation is now AI-only

# REMOVED: check_knowledge_document_conflicts - All conflict detection is now AI-only

def extract_data_from_document(
    file_content,  # Can be bytes or str (data URL)
    file_name: str,
    mime_type: str,
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None,
    knowledge_documents: List[Dict[str, Any]] = None
) -> ExtractionResult:
    """Extract structured data from a document using AI"""
    
    logging.info("Starting AI data extraction")
    logging.info(f"PROJECT SCHEMA DEBUG: Type: {type(project_schema)}")
    logging.info(f"PROJECT SCHEMA DEBUG: Keys: {list(project_schema.keys()) if isinstance(project_schema, dict) else 'Not a dict'}")
    if isinstance(project_schema, dict):
        if "schema_fields" in project_schema:
            logging.info(f"SCHEMA FIELDS DEBUG: Type: {type(project_schema['schema_fields'])}, Length: {len(project_schema['schema_fields']) if hasattr(project_schema['schema_fields'], '__len__') else 'No len'}")
            if isinstance(project_schema['schema_fields'], list) and len(project_schema['schema_fields']) > 0:
                logging.info(f"FIRST FIELD DEBUG: Type: {type(project_schema['schema_fields'][0])}, Value: {project_schema['schema_fields'][0]}")
        if "collections" in project_schema:
            logging.info(f"COLLECTIONS DEBUG: Type: {type(project_schema['collections'])}, Length: {len(project_schema['collections']) if hasattr(project_schema['collections'], '__len__') else 'No len'}")
    
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logging.error("GEMINI_API_KEY not found")
            raise Exception("GEMINI_API_KEY not found - cannot perform extraction without API credentials")
        
        # Import Google AI modules
        try:
            import google.generativeai as genai
            from google.generativeai import types
        except ImportError as e:
            logging.error(f"Failed to import Google AI modules: {e}")
            raise Exception(f"Required Google AI modules not available: {str(e)}")
        
        # Configure the API
        genai.configure(api_key=api_key)
        
        # Build extraction prompt
        prompt = f"Extract data from this document: {file_name}\n\n"
        prompt += "CRITICAL: Extract ONLY real data from the document. Do NOT generate sample or placeholder data.\n\n"
        
        # First, identify global extraction rules that apply to all fields
        global_rules = []
        if extraction_rules:
            for rule in extraction_rules:
                # Check if rule applies to all fields
                applies_to = rule.get('appliesTo', '')
                if applies_to.lower() in ['all fields', 'all', '*']:
                    global_rules.append(rule.get('rule', ''))
        
        # Add schema fields
        if project_schema.get("schema_fields"):
            prompt += "Schema fields to extract:\n"
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                field_description = field.get('description', '')
                
                # Collect all applicable extraction rules for this field
                field_rules = []
                
                # Add global rules first
                field_rules.extend(global_rules)
                
                # Add field-specific rules from extraction_rules parameter
                if extraction_rules:
                    for rule in extraction_rules:
                        applies_to = rule.get('appliesTo', '')
                        if applies_to == field_name:
                            field_rules.append(rule.get('rule', ''))
                
                # Add field-specific rules from field's extraction_rules property
                if field.get('extraction_rules'):
                    field_rules.extend(field['extraction_rules'])
                
                # Build the field description with rules
                prompt_line = f"- {field_name} ({field_type})"
                if field_description:
                    prompt_line += f": {field_description}"
                
                if field_rules:
                    rules_text = " | ".join(field_rules)
                    prompt_line += f" | EXTRACTION RULES: {rules_text}"
                
                prompt += prompt_line + "\n"
        
        # Add collections
        if project_schema.get("collections"):
            prompt += "\nCollections to extract:\n"
            for collection in project_schema["collections"]:
                try:
                    # Debug collection structure
                    logging.info(f"COLLECTION DEBUG: Type: {type(collection)}, Keys: {list(collection.keys()) if isinstance(collection, dict) else 'Not a dict'}")
                    
                    if not isinstance(collection, dict):
                        logging.error(f"Collection is not a dict: {type(collection)} - {collection}")
                        continue
                        
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    collection_description = collection.get('description', '')
                    if collection_description:
                        prompt += f"- {collection_name}: {collection_description}\n"
                    else:
                        prompt += f"- {collection_name}:\n"
                        
                    properties = collection.get("properties", [])
                    logging.info(f"PROPERTIES DEBUG: Type: {type(properties)}, Length: {len(properties) if hasattr(properties, '__len__') else 'No len'}")
                    
                    if isinstance(properties, list):
                        for prop in properties:
                            try:
                                if not isinstance(prop, dict):
                                    logging.error(f"Property is not a dict: {type(prop)} - {prop}")
                                    continue
                                    
                                prop_name = prop.get('propertyName', '')
                                prop_type = prop.get('propertyType', 'TEXT')
                                prop_description = prop.get('description', '')
                                
                                # Collect all applicable extraction rules for this collection property
                                prop_rules = []
                                
                                # Add global rules first
                                prop_rules.extend(global_rules)
                                
                                # Add property-specific rules from extraction_rules parameter
                                if extraction_rules:
                                    for rule in extraction_rules:
                                        applies_to = rule.get('appliesTo', '')
                                        if applies_to == f"{collection_name}.{prop_name}":
                                            prop_rules.append(rule.get('rule', ''))
                                
                                # Add property-specific rules from property's extraction_rules
                                if prop.get('extraction_rules'):
                                    prop_rules.extend(prop['extraction_rules'])
                                
                                # Build the property description with rules
                                prompt_line = f"  * {prop_name} ({prop_type})"
                                if prop_description:
                                    prompt_line += f": {prop_description}"
                                
                                if prop_rules:
                                    rules_text = " | ".join(prop_rules)
                                    prompt_line += f" | EXTRACTION RULES: {rules_text}"
                                
                                prompt += prompt_line + "\n"
                            except Exception as prop_error:
                                logging.error(f"Error processing property: {prop_error}")
                                continue
                    else:
                        logging.warning(f"Properties is not a list: {type(properties)}")
                        
                except Exception as collection_error:
                    logging.error(f"Error processing collection: {collection_error}")
                    continue
        
        prompt += "\nExtraction Rules:\n"
        prompt += "1. Extract ONLY real data from the document - NO sample data\n"
        prompt += "2. If data is not found, return null\n"
        prompt += "3. Return JSON as an OBJECT with keys matching the schema field/collection names\n"
        prompt += "4. IMPORTANT: Pay careful attention to field descriptions for context\n"
        prompt += "\nExpected JSON format:\n"
        prompt += "{\n"
        
        # Add expected fields 
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                prompt += f'  "{field_name}": null,\n'
        
        # Add expected collections
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                try:
                    if not isinstance(collection, dict):
                        continue
                        
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    prompt += f'  "{collection_name}": [\n'
                    prompt += '    {\n'
                    
                    properties = collection.get("properties", [])
                    if isinstance(properties, list):
                        for prop in properties:
                            try:
                                if isinstance(prop, dict):
                                    prop_name = prop.get('propertyName', '')
                                    if prop_name:
                                        prompt += f'      "{prop_name}": null,\n'
                            except Exception:
                                continue
                    
                    prompt += '    }\n'
                    prompt += '  ],\n'
                except Exception:
                    continue
        
        prompt += "}\n"
        prompt += "\nFor NDA/Contract Documents - Party Extraction Guidelines:\n"
        prompt += "• A 'Party' is any organization, company, or individual that is signing or involved in the agreement\n"
        prompt += "• Look for company names, organization names, and individual names throughout the document\n"
        prompt += "• Parties are often mentioned in:\n"
        prompt += "  - The document header/title\n"
        prompt += "  - 'BETWEEN' clauses at the beginning\n"
        prompt += "  - Signature sections at the end\n"
        prompt += "  - 'Party A', 'Party B' references\n"
        prompt += "  - Corporate entity names (Inc., LLC, Ltd., Corp., etc.)\n"
        prompt += "• Each party should include their name, address if available, and country\n"
        prompt += "• Extract ALL parties mentioned in the document, not just the primary ones\n"
        
        # Add knowledge documents context if available
        if knowledge_documents:
            prompt += "\nKnowledge Base Context:\n"
            prompt += "The following knowledge documents contain important context and policies that may affect data extraction:\n\n"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown Document'))
                content = doc.get('content', '')
                if content and content.strip():
                    prompt += f"Document: {doc_name}\n"
                    # Include full content - token limits can be lifted
                    prompt += f"Content: {content}\n\n"
            
            prompt += "IMPORTANT: Consider the above knowledge base when extracting data. Pay attention to any policies or requirements that may affect confidence in extracted values.\n"
        
        # Handle content types and prepare the content
        if mime_type.startswith("text/"):
            # Handle text content - check if it's already a string or needs decoding
            if isinstance(file_content, str):
                if file_content.startswith('data:'):
                    # Extract base64 content from data URL
                    base64_content = file_content.split(',', 1)[1]
                    decoded_bytes = base64.b64decode(base64_content)
                    content_text = decoded_bytes.decode('utf-8', errors='ignore')
                else:
                    content_text = file_content
            else:
                content_text = file_content.decode('utf-8', errors='ignore')
            
            full_prompt = prompt + f"\n\nDocument content:\n{content_text}"
            
            # Make API call using the simplified API for text
            logging.info("Making API call to Gemini for text content")
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(full_prompt)
        else:
            # For binary files like PDFs, convert to images and process with vision model
            logging.info("Processing PDF by converting to images for Gemini Vision")
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Decode base64 content to bytes
            if isinstance(file_content, str) and file_content.startswith('data:'):
                # Extract base64 content after the comma for data URLs
                base64_content = file_content.split(',', 1)[1]
                binary_content = base64.b64decode(base64_content)
                logging.info(f"Decoded data URL: {len(base64_content)} base64 chars -> {len(binary_content)} bytes")
            elif isinstance(file_content, str):
                # Assume it's already base64 encoded
                binary_content = base64.b64decode(file_content)
                logging.info(f"Decoded base64 string: {len(file_content)} chars -> {len(binary_content)} bytes")
            elif isinstance(file_content, bytes):
                # Already bytes
                binary_content = file_content
                logging.info(f"Using binary content directly: {len(binary_content)} bytes")
            else:
                # Handle unexpected data type
                logging.error(f"Unexpected file content type: {type(file_content)}")
                raise Exception(f"Unsupported file content type: {type(file_content)}")
            
            # Check PDF header
            if binary_content[:4] == b'%PDF':
                logging.info("✅ Valid PDF header detected")
            else:
                logging.warning(f"❌ Invalid PDF header: {binary_content[:20]}")
            
            logging.info(f"Processing PDF with {len(binary_content)} bytes")
            
            # Try multiple PDF processing approaches with enhanced error handling
            pdf_processed = False
            
            # Method 1: PyPDF2 text extraction
            try:
                import PyPDF2
                import io
                
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(binary_content))
                text_content = ""
                
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
                
                if text_content.strip():
                    logging.info(f"Successfully extracted text from PDF: {len(text_content)} characters")
                    full_prompt = prompt + f"\n\nDocument content:\n{text_content}"
                    logging.info(f"📝 AI Prompt (first 1500 chars): {full_prompt[:1500]}")
                    response = model.generate_content(full_prompt)
                    pdf_processed = True
                    
            except Exception as e:
                logging.error(f"PyPDF2 text extraction error: {e}")
            
            # Method 2: pdf2image conversion if text extraction failed
            if not pdf_processed:
                try:
                    from pdf2image import convert_from_bytes
                    from PIL import Image
                    import io
                    
                    # Try with different DPI settings for better compatibility
                    for dpi in [200, 150, 100]:
                        try:
                            images = convert_from_bytes(binary_content, dpi=dpi, first_page=1, last_page=3)
                            if images:
                                logging.info(f"Successfully converted PDF to {len(images)} page images at {dpi} DPI")
                                
                                # Process first page with Gemini Vision
                                first_page = images[0]
                                response = model.generate_content([prompt, first_page])
                                logging.info("Successfully processed PDF page as image with Gemini Vision")
                                pdf_processed = True
                                break
                        except Exception as dpi_error:
                            logging.error(f"PDF conversion failed at {dpi} DPI: {dpi_error}")
                            continue
                            
                except Exception as img_error:
                    logging.error(f"pdf2image processing error: {img_error}")
            

            
            # Final fallback if all PDF processing methods failed
            if not pdf_processed:
                logging.warning("All PDF processing methods failed - using intelligent fallback")
                fallback_prompt = f"""
                {prompt}
                
                CRITICAL: This PDF document named '{file_name}' could not be processed due to PDF formatting/corruption issues.
                
                IMPORTANT INSTRUCTIONS:
                1. DO NOT extract any data - the document content is inaccessible
                2. Set ALL extracted values to null
                3. Set ALL validation statuses to "invalid" 
                4. Set ALL confidence scores to 0
                5. Use "PDF processing failed - document format issues" as the AI reasoning for each field
                6. Mark the overall status as requiring manual review
                
                This ensures users understand the document needs to be re-uploaded in a different format or fixed.
                """
                response = model.generate_content(fallback_prompt)
        
        if not response or not response.text:
            raise Exception("No response from AI model")
        
        response_text = response.text.strip()
        
        if not response_text:
            raise Exception("Empty response from AI model")
        
        # Clean up response text - remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
        
        # Debug: Log the AI response
        logging.info(f"🤖 AI Response (first 1000 chars): {response_text[:1000]}")
        
        # Parse JSON response
        try:
            result_data = json.loads(response_text)
            logging.info(f"✅ Successfully parsed JSON response with keys: {list(result_data.keys()) if isinstance(result_data, dict) else 'Not a dict'}")
        except json.JSONDecodeError as e:
            logging.error(f"❌ JSON decode error: {e}")
            logging.error(f"Full response text: {response_text}")
            raise Exception("Failed to parse AI response as JSON")
        
        # Create field validations using batch AI validation
        field_validations = []
        extracted_data = result_data if isinstance(result_data, dict) else {}
        
        # Collect all fields for batch validation
        fields_to_validate = []
        field_metadata = {}  # Store field metadata for later use
        
        # Collect schema fields
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                try:
                    if not isinstance(field, dict):
                        logging.error(f"Field is not a dict: {type(field)} - {field}")
                        continue
                        
                    field_id = str(field.get("id", "unknown"))
                    field_name = field.get("fieldName", "")
                    field_type = field.get("fieldType", "TEXT")
                    extracted_value = extracted_data.get(field_name)
                    
                    fields_to_validate.append({
                        'field_name': field_name,
                        'extracted_value': extracted_value
                    })
                    
                    field_metadata[field_name] = {
                        'field_id': field_id,
                        'field_type': field_type,
                        'auto_verification_threshold': field.get("autoVerificationConfidence", 80),
                        'extracted_value': extracted_value
                    }
                except Exception as e:
                    logging.error(f"Error processing schema field: {e}")
                    continue
        
        # Collect collection fields
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                try:
                    if not isinstance(collection, dict):
                        logging.error(f"Collection is not a dict: {type(collection)} - {collection}")
                        continue
                        
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    collection_data = extracted_data.get(collection_name, [])
                except Exception as e:
                    logging.error(f"Error processing collection: {e}")
                    continue
                
                if isinstance(collection_data, list):
                    logging.info(f"📋 Processing collection {collection_name}: {len(collection_data)} items found")
                    for record_index, record in enumerate(collection_data):
                        if not isinstance(record, dict):
                            logging.warning(f"Record {record_index} in collection {collection_name} is not a dict")
                            continue
                        
                        properties_data = collection.get("properties", [])
                        
                        # Handle case where properties might be a dict instead of list
                        if isinstance(properties_data, dict):
                            if all(str(k).isdigit() for k in properties_data.keys()):
                                properties_data = [properties_data[str(i)] for i in sorted(int(k) for k in properties_data.keys())]
                            else:
                                logging.error(f"Cannot convert properties dict with keys: {list(properties_data.keys())}")
                                continue
                        
                        for prop in properties_data:
                            try:
                                if not isinstance(prop, dict):
                                    logging.error(f"Property is not a dict: {type(prop)} - {prop}")
                                    continue
                                    
                                prop_id = str(prop.get("id", "unknown"))
                                prop_name = prop.get("propertyName", "")
                                prop_type = prop.get("propertyType", "TEXT")
                            except Exception as e:
                                logging.error(f"Error processing property: {e}")
                                continue
                            
                            # Find extracted value (case-insensitive)
                            extracted_value = None
                            if prop_name in record:
                                extracted_value = record[prop_name]
                            elif prop_name.lower() in record:
                                extracted_value = record[prop_name.lower()]
                            else:
                                # Try other variations
                                for key, value in record.items():
                                    if key.lower() == prop_name.lower():
                                        extracted_value = value
                                        break
                            
                            field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                            
                            # Add to batch validation list
                            fields_to_validate.append({
                                'field_name': field_name_with_index,
                                'extracted_value': extracted_value
                            })
                            
                            # Store metadata for later processing
                            field_metadata[field_name_with_index] = {
                                'field_id': prop_id,
                                'field_type': prop_type,
                                'auto_verification_threshold': prop.get("autoVerificationConfidence", 80),
                                'extracted_value': extracted_value,
                                'collection_name': collection_name,
                                'record_index': record_index
                            }
        
        # PURE EXTRACTION: Do not create validation records during extraction phase
        # Validation records will be created later during batch validation with proper confidence scores
        logging.info(f"📋 PURE_EXTRACTION: Extraction complete for {len(field_metadata)} fields - NO validation processing during extraction")
        logging.info(f"📋 PURE_EXTRACTION: Validation records will be created later during batch validation phase")
        
        return ExtractionResult(
            extracted_data=extracted_data,
            confidence_score=0.95,
            processing_notes="AI extraction completed successfully",
            field_validations=[]  # Empty - validation records created later during batch validation
        )
        
    except Exception as e:
        logging.error(f"Extraction failed: {e}")
        raise Exception(f"Extraction failed for {file_name}: {str(e)}")

def run_post_extraction_batch_validation(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run batch AI validation AFTER data extraction and saving is complete.
    This updates the confidence scores and reasoning for all extracted fields.
    
    Args:
        session_data: Complete session data including session_id, project_schema, extraction_rules, etc.
    
    Returns:
        Results dict with updated validation information
    """
    session_id = session_data.get("session_id")
    project_schema = session_data.get("project_schema", {})
    extraction_rules = session_data.get("extraction_rules", [])
    knowledge_documents = session_data.get("knowledge_documents", [])
    
    logging.info(f"🚀 POST_EXTRACTION_BATCH_VALIDATION: Starting batch validation for session {session_id}")
    
    try:
        # Read actual field validations from the session data (this would be from database in real implementation)
        all_validations = session_data.get("existing_validations", [])
        
        # Collect fields that have extracted values for batch validation
        fields_to_validate = []
        validation_lookup = {}
        
        for validation in all_validations:
            field_name = validation.get("field_name", "")
            extracted_value = validation.get("extracted_value")
            
            # Only validate fields that have actual extracted values
            if extracted_value is not None and extracted_value != "" and extracted_value != "null":
                fields_to_validate.append({
                    'field_name': field_name,
                    'extracted_value': extracted_value
                })
                validation_lookup[field_name] = validation
        
        if len(fields_to_validate) > 0:
            logging.info(f"🚀 POST_EXTRACTION_BATCH_VALIDATION: Validating {len(fields_to_validate)} fields with real values")
            
            # Run the batch validation with real extracted values
            validation_results = ai_validate_batch(fields_to_validate, extraction_rules, knowledge_documents)
            
            logging.info(f"🚀 POST_EXTRACTION_BATCH_VALIDATION: Received {len(validation_results)} validation results")
            
            # Update validation records with new confidence scores and reasoning
            updated_validations = []
            for validation in all_validations:
                field_name = validation.get("field_name", "")
                
                if field_name in validation_results:
                    # Update with batch validation results
                    confidence, applied_rules, reasoning = validation_results[field_name]
                    
                    # Create updated validation with new AI results
                    updated_validation = validation.copy()
                    updated_validation["confidence_score"] = confidence
                    updated_validation["ai_reasoning"] = reasoning
                    updated_validation["original_confidence_score"] = confidence
                    updated_validation["original_ai_reasoning"] = reasoning
                    
                    # PRESERVE MANUAL INPUT STATUS - Only update validation status if not manually entered
                    current_status = validation.get("validation_status", "")
                    if current_status == "manual":
                        # Preserve manual status - don't override with AI confidence-based status
                        updated_validation["validation_status"] = "manual"
                        logging.info(f"PRESERVING manual status for field: {field_name}")
                    else:
                        # Update validation status based on new confidence for AI-extracted fields
                        auto_threshold = validation.get("auto_verification_threshold", 80)
                        if confidence >= auto_threshold:
                            updated_validation["validation_status"] = "verified"
                        else:
                            updated_validation["validation_status"] = "unverified"
                    
                    updated_validations.append(updated_validation)
                    logging.info(f"✅ Updated {field_name}: {confidence}% confidence")
                else:
                    # Keep original validation unchanged
                    updated_validations.append(validation)
            
            return {
                "success": True,
                "session_id": session_id,
                "updated_validations": updated_validations,
                "fields_processed": len(validation_results),
                "total_validations": len(all_validations)
            }
            
        else:
            logging.info(f"🚀 POST_EXTRACTION_BATCH_VALIDATION: No fields with values found to validate")
            return {
                "success": True,
                "session_id": session_id,
                "updated_validations": all_validations,
                "fields_processed": 0,
                "total_validations": len(all_validations)
            }
        
    except Exception as e:
        logging.error(f"🚀 POST_EXTRACTION_BATCH_VALIDATION: Error during batch validation: {e}")
        return {
            "success": False,
            "session_id": session_id,
            "error": str(e),
            "fields_processed": 0
        }

def create_comprehensive_validation_records(aggregated_data, project_schema, existing_validations, extraction_rules, knowledge_documents, session_id):
    """
    Create validation records for ALL schema fields after aggregation is complete.
    This implements the three-step process: 1) Extract, 2) Save data, 3) Create validations for ALL fields.
    """
    comprehensive_validations = []
    existing_field_names = {v.get("field_name", "") for v in existing_validations}
    
    # Keep all existing validations that were created during individual processing
    comprehensive_validations.extend(existing_validations)
    
    logging.info(f"🔧 STEP 3: Creating comprehensive validation records for ALL schema fields")
    logging.info(f"📊 Starting with {len(existing_validations)} existing validations")
    logging.info(f"🔍 Existing field names: {sorted(list(existing_field_names))}")
    
    # Debug the aggregated data structure
    logging.info(f"🔍 AGGREGATED DATA DEBUG:")
    for key, value in aggregated_data.items():
        if isinstance(value, list):
            logging.info(f"  {key}: {len(value)} items (first 2: {value[:2] if len(value) > 1 else value})")
        else:
            logging.info(f"  {key}: {type(value)} = {value}")
    
    # Debug the project schema structure  
    logging.info(f"🔍 PROJECT SCHEMA DEBUG:")
    logging.info(f"  Schema fields: {len(project_schema.get('schema_fields', []))}")
    logging.info(f"  Collections: {len(project_schema.get('collections', []))}")
    if project_schema.get('collections'):
        for i, collection in enumerate(project_schema['collections']):
            logging.info(f"  Collection {i}: {collection.get('collectionName', 'Unknown')} with properties type: {type(collection.get('properties', []))}")
    
    # Process schema fields (non-collection fields)
    if project_schema.get("schema_fields"):
        for field in project_schema["schema_fields"]:
            if not isinstance(field, dict):
                continue
                
            field_id = str(field.get("id", "unknown"))
            field_name = field.get("fieldName", "")
            field_type = field.get("fieldType", "TEXT")
            
            # Skip if validation already exists
            if field_name in existing_field_names:
                logging.info(f"✅ Schema field validation exists: {field_name}")
                continue
                
            # Create validation record for schema field
            extracted_value = aggregated_data.get(field_name)
            
            # CREATE INITIAL BLANK VALIDATION RECORDS - Show "No validation data" initially
            if extracted_value is not None and extracted_value != "":
                # Create blank validation record - batch validation will populate real data later
                confidence = 0  # No confidence score initially (0 to avoid null issues)
                reasoning = "No validation data"  # Clear initial state
                status = "unverified"  # Always start unverified
                extracted_value = extracted_value  # Keep extracted value
                logging.info(f"📝 Creating BLANK schema field validation: {field_name} = '{extracted_value}' - batch validation will populate later")
            else:
                confidence = 0
                status = "invalid"
                reasoning = "No validation data - no value found"
                extracted_value = None
                logging.info(f"📝 Creating BLANK schema field validation: {field_name} = null - batch validation will populate later")
            
            validation = FieldValidationResult(
                field_id=field_id,
                field_name=field_name,
                field_type=field_type,
                extracted_value=extracted_value,
                original_extracted_value=extracted_value,
                original_confidence_score=confidence,
                original_ai_reasoning=reasoning,
                validation_status=status,
                ai_reasoning=reasoning,
                confidence_score=confidence,
                document_source="Aggregated Data",
                document_sections=["Multi-document aggregation"]
            )
            comprehensive_validations.append(validation)
    
    # Process collection fields (collection properties for each item)
    if project_schema.get("collections"):
        for collection in project_schema["collections"]:
            if not isinstance(collection, dict):
                continue
                
            collection_name = collection.get('collectionName', collection.get('objectName', ''))
            collection_data = aggregated_data.get(collection_name, [])
            
            # Ensure collection_data is a list
            if not isinstance(collection_data, list):
                collection_data = []
            
            # Process all items in the collection (AI determined the collection contents)
            if isinstance(collection_data, list) and collection_data:
                logging.info(f"🤖 Processing AI-determined collection {collection_name}: {len(collection_data)} items")
                
                # Create validation records for each AI-extracted item in this collection
                for record_index in range(len(collection_data)):
                    record = collection_data[record_index] if record_index < len(collection_data) else {}
                
                properties_data = collection.get("properties", [])
                logging.info(f"COMPREHENSIVE VALIDATION - COLLECTION {collection_name} PROPERTIES DEBUG:")
                logging.info(f"  Type: {type(properties_data)}")
                logging.info(f"  Content: {properties_data}")
                
                # Handle case where properties might be a dict instead of list
                if isinstance(properties_data, dict):
                    logging.warning(f"Properties is a dict, not a list: {properties_data}")
                    # Try to convert to list if it has numeric keys
                    if all(str(k).isdigit() for k in properties_data.keys()):
                        properties_list = [properties_data[str(i)] for i in sorted(int(k) for k in properties_data.keys())]
                        logging.info(f"Converted dict to list with {len(properties_list)} properties")
                        properties_data = properties_list
                    else:
                        logging.error(f"Cannot convert properties dict with keys: {list(properties_data.keys())}")
                        continue
                
                for prop in properties_data:
                    if not isinstance(prop, dict):
                        continue
                        
                    prop_id = str(prop.get("id", "unknown"))
                    prop_name = prop.get("propertyName", "")
                    prop_type = prop.get("propertyType", "TEXT")
                    field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                    
                    # Skip if validation already exists for this exact field name with index
                    if field_name_with_index in existing_field_names:
                        logging.info(f"⏭️ Skipping existing validation: {field_name_with_index}")
                        continue
                    
                    logging.info(f"🔨 Creating NEW validation: {field_name_with_index}")
                    
                    # Find extracted value using the same logic as individual processing
                    extracted_value = None
                    if isinstance(record, dict):
                        if prop_name in record:
                            extracted_value = record[prop_name]
                        elif prop_name.lower() in record:
                            extracted_value = record[prop_name.lower()]
                        elif len(prop_name) > 1:
                            camel_case_name = prop_name[0].lower() + prop_name[1:]
                            if camel_case_name in record:
                                extracted_value = record[camel_case_name]
                        
                        if extracted_value is None:
                            for key, value in record.items():
                                if key.lower() == prop_name.lower():
                                    extracted_value = value
                                    break
                    
                    # CREATE INITIAL BLANK VALIDATION RECORDS - Show "No validation data" initially
                    if extracted_value is not None and extracted_value != "" and extracted_value != "null":
                        # Create blank validation record - batch validation will populate real data later
                        confidence = 0  # No confidence score initially
                        reasoning = "No validation data"  # Clear initial state
                        status = "unverified"  # Always start unverified
                        logging.info(f"📝 Creating BLANK collection validation: {field_name_with_index} = '{extracted_value}' - batch validation will populate later")
                    else:
                        confidence = 0
                        status = "invalid"
                        reasoning = "No validation data - no value found"
                        extracted_value = None
                        logging.info(f"📝 Creating BLANK collection validation: {field_name_with_index} = null - batch validation will populate later")
                    
                    validation = FieldValidationResult(
                        field_id=prop_id,
                        field_name=field_name_with_index,
                        field_type=prop_type,
                        extracted_value=extracted_value,
                        original_extracted_value=extracted_value,
                        original_confidence_score=confidence,
                        original_ai_reasoning=reasoning,
                        validation_status=status,
                        ai_reasoning=reasoning,
                        confidence_score=confidence,
                        document_source="Aggregated Data",
                        document_sections=["Multi-document aggregation"],
                        collection_name=collection_name,
                        record_index=record_index
                    )
                    comprehensive_validations.append(validation)
    
    logging.info(f"🎯 COMPREHENSIVE VALIDATION CREATION COMPLETE:")
    logging.info(f"   - Started with: {len(existing_validations)} existing validations")
    logging.info(f"   - Created total: {len(comprehensive_validations)} comprehensive validations")
    logging.info(f"   - Added: {len(comprehensive_validations) - len(existing_validations)} new validation records")
    
    return comprehensive_validations

def process_extraction_session(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process an entire extraction session with multiple documents"""
    
    print("=== STARTING AI EXTRACTION SESSION ===", file=sys.stderr)
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    
    results = {
        "session_id": session_data.get("session_id"),
        "processed_documents": [],
        "summary": {
            "total_documents": 0,
            "successful_extractions": 0,
            "average_confidence": 0.0
        }
    }
    
    files = session_data.get("files", [])
    project_schema = session_data.get("project_schema", {})
    extraction_rules = session_data.get("extraction_rules", [])
    knowledge_documents = session_data.get("knowledge_documents", [])
    
    logging.info(f"Processing {len(files)} files")
    
    successful_count = 0
    total_confidence = 0.0
    
    for file_info in files:
        try:
            file_name = file_info.get("name", "unknown")
            file_content = file_info.get("content", "")
            mime_type = file_info.get("mimeType", "application/octet-stream")
            
            logging.info(f"Processing file: {file_name}")
            logging.info(f"Original content type: {type(file_content)}")
            if isinstance(file_content, str):
                logging.info(f"Content starts with: {file_content[:50]}...")
                logging.info(f"Content length: {len(file_content)}")
            
            # DO NOT ENCODE STRING CONTENT TO UTF-8 - this corrupts data URLs!
            
            extraction_result = extract_data_from_document(
                file_content=file_content,
                file_name=file_name,
                mime_type=mime_type,
                project_schema=project_schema,
                extraction_rules=extraction_rules,
                knowledge_documents=knowledge_documents
            )
            
            document_result = {
                "file_name": file_name,
                "extraction_result": {
                    "extracted_data": extraction_result.extracted_data,
                    "confidence_score": extraction_result.confidence_score,
                    "processing_notes": extraction_result.processing_notes,
                    "field_validations": [
                        {
                            "field_id": fv.field_id,
                            "field_name": fv.field_name,
                            "field_type": fv.field_type,
                            "extracted_value": fv.extracted_value,
                            "validation_status": fv.validation_status,
                            "ai_reasoning": fv.ai_reasoning,
                            "confidence_score": fv.confidence_score,
                            "document_source": fv.document_source,
                            "document_sections": fv.document_sections,
                            "collection_name": fv.collection_name,
                            "record_index": fv.record_index
                        }
                        for fv in extraction_result.field_validations
                    ]
                },
                "status": "completed"
            }
            
            results["processed_documents"].append(document_result)
            
            if extraction_result.confidence_score > 0.5:
                successful_count += 1
                total_confidence += extraction_result.confidence_score
            
        except Exception as e:
            logging.error(f"Error processing file {file_info.get('name', 'unknown')}: {e}")
            results["processed_documents"].append({
                "file_name": file_info.get("name", "unknown"),
                "extraction_result": {
                    "extracted_data": {},
                    "confidence_score": 0.0,
                    "processing_notes": f"Processing error: {str(e)}",
                    "field_validations": []
                },
                "status": "error"
            })
    
    # Aggregate collections across all documents for multi-document extraction
    aggregated_data = {}
    all_field_validations = []
    
    # Get collections from project schema to know which fields are collections
    collections = project_schema.get("collections", [])
    collection_names = [collection.get("collectionName") for collection in collections if collection.get("collectionName")]
    
    # Validate we have documents to process
    completed_docs = [d for d in results["processed_documents"] if d.get("status") == "completed"]
    if not completed_docs:
        logging.warning("No completed documents found for aggregation")
        results["aggregated_extraction"] = {
            "extracted_data": {},
            "field_validations": [],
            "total_items": 0,
            "aggregation_summary": {
                "total_documents_processed": 0,
                "collections_aggregated": 0,
                "total_collection_items": 0,
                "total_field_validations": 0
            }
        }
        return results
    
    logging.info(f"Found {len(collection_names)} collections to aggregate: {collection_names}")
    logging.info(f"Processing {len(completed_docs)} completed documents")
    
    # Let AI determine all field values - no programmatic calculations
    # Take the last extraction for schema fields (AI's most comprehensive analysis)
    aggregated_data = {}
    for doc in reversed(results["processed_documents"]):  # Start from last document (most complete AI analysis)
        if doc.get("status") == "completed":
            extracted_data = doc["extraction_result"]["extracted_data"]
            for field_name, field_value in extracted_data.items():
                if field_name not in collection_names and field_value is not None:
                    # Only use this value if we don't already have one (preserving AI's latest decision)
                    if field_name not in aggregated_data:
                        aggregated_data[field_name] = field_value
                        logging.info(f"AI-determined value for {field_name}: {field_value}")
    
    logging.info(f"🤖 PURE_AI_EXTRACTION: Using AI-determined values for all schema fields")
    
    # Then, aggregate all collection data across documents with proper reindexing
    # This logic handles any N number of documents and M number of collections
    for collection_name in collection_names:
        aggregated_collection = []
        aggregated_validations = []
        global_index = 0  # Track global index across all documents
        
        logging.info(f"Starting aggregation for collection: {collection_name}")
        
        for doc_idx, doc in enumerate(results["processed_documents"]):
            if doc.get("status") != "completed":
                logging.info(f"Skipping document {doc.get('file_name', 'unknown')} - status: {doc.get('status')}")
                continue
                
            extracted_data = doc["extraction_result"]["extracted_data"]
            collection_data = extracted_data.get(collection_name, [])
            field_validations = doc["extraction_result"]["field_validations"]
            
            # Handle both list and empty/null collection data
            if not isinstance(collection_data, list):
                collection_data = []
            
            doc_items_count = len(collection_data)
            if doc_items_count > 0:
                logging.info(f"Document {doc_idx + 1}/{len(results['processed_documents'])}: '{doc['file_name']}' has {doc_items_count} {collection_name} items")
                
                # Add all collection items from this document
                aggregated_collection.extend(collection_data)
                
                # Reindex and aggregate field validations for each item in this document
                for local_item_index in range(doc_items_count):
                    # Find all validations for this specific item in this document
                    item_validations = [
                        v for v in field_validations 
                        if (v.get("collection_name") == collection_name and 
                            v.get("record_index") == local_item_index)
                    ]
                    
                    logging.info(f"  Item {local_item_index} -> global index {global_index}: found {len(item_validations)} validations")
                    
                    # Reindex each validation to the global aggregated index
                    for validation in item_validations:
                        new_validation = validation.copy()
                        new_validation["record_index"] = global_index
                        
                        # Update field name with new global index
                        old_field_name = validation.get("field_name", "")
                        if f"[{local_item_index}]" in old_field_name:
                            new_field_name = old_field_name.replace(f"[{local_item_index}]", f"[{global_index}]")
                            new_validation["field_name"] = new_field_name
                            logging.info(f"    🔄 Reindexed validation: {old_field_name} -> {new_field_name} (global_index: {global_index})")
                        
                        aggregated_validations.append(new_validation)
                    
                    global_index += 1  # Increment global index for next item
            else:
                logging.info(f"Document {doc_idx + 1}/{len(results['processed_documents'])}: '{doc['file_name']}' has no {collection_name} items")
        
        # Add aggregated collection to results if we found any data
        if aggregated_collection:
            aggregated_data[collection_name] = aggregated_collection
            
            # Note: Validation creation will be handled by the standard backend processing
            # The aggregated_validations already contains the reindexed validations from individual documents
            # Additional validation logic should be handled in the backend to avoid Python crashes
            
            all_field_validations.extend(aggregated_validations)
            logging.info(f"✅ Aggregated {collection_name}: {len(aggregated_collection)} total items from {len(results['processed_documents'])} documents with {len(aggregated_validations)} total validations")
        else:
            logging.info(f"❌ No {collection_name} data found across any documents")
    
    # Aggregate non-collection field validations
    for doc in results["processed_documents"]:
        if doc.get("status") == "completed":
            field_validations = doc["extraction_result"]["field_validations"]
            for validation in field_validations:
                # Only add non-collection validations (collections were handled above)
                if not validation.get("collection_name") or validation.get("collection_name") not in collection_names:
                    all_field_validations.append(validation)
    
    # PURE EXTRACTION: Skip all validation processing during extraction phase
    # Validation records will be created later during separate batch validation process  
    session_id = session_data.get("session_id")
    comprehensive_validations = []  # Empty - no validation records during extraction
    
    logging.info(f"📋 PURE_EXTRACTION_COMPLETE: Session {session_id} ready for separate batch validation process")
    
    # Add aggregated data to results with comprehensive summary
    total_aggregated_items = sum(len(v) if isinstance(v, list) else 1 for v in aggregated_data.values())
    
    results["aggregated_extraction"] = {
        "extracted_data": aggregated_data,
        "field_validations": [],  # Empty - no validation records during pure extraction phase
        "total_items": total_aggregated_items,
        "aggregation_summary": {
            "total_documents_processed": len([d for d in results["processed_documents"] if d.get("status") == "completed"]),
            "collections_aggregated": len([k for k, v in aggregated_data.items() if isinstance(v, list)]),
            "total_collection_items": sum(len(v) for v in aggregated_data.values() if isinstance(v, list)),
            "total_field_validations": 0  # No validation records during pure extraction
        }
    }
    
    logging.info(f"✅ Multi-document aggregation complete:")
    logging.info(f"   - {len(aggregated_data)} total fields aggregated")
    logging.info(f"   - {total_aggregated_items} total items")
    logging.info(f"   - 0 field validations (pure extraction phase)")
    logging.info(f"   - Processed {len(results['processed_documents'])} documents")

    # Calculate summary
    results["summary"]["total_documents"] = len(files)
    results["summary"]["successful_extractions"] = successful_count
    results["summary"]["average_confidence"] = (
        total_confidence / successful_count if successful_count > 0 else 0.0
    )
    
    return results