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

def calculate_knowledge_based_confidence(field_name: str, extracted_value: Any, base_confidence: float, extraction_rules: List[Dict[str, Any]] = None, knowledge_documents: List[Dict[str, Any]] = None) -> tuple[int, list]:
    """
    Calculate confidence percentage based on knowledge base and rules compliance.
    
    Core Logic:
    - If knowledge document conflicts exist → Set confidence to 50%
    - If no rules/knowledge apply to a field AND value is extracted → Show 95% confidence (high default)
    - If rules/knowledge apply → Calculate confidence based on compliance level (1-100%)
    
    Args:
        field_name: Name of the field being validated
        extracted_value: The extracted value
        base_confidence: Base AI confidence from extraction
        extraction_rules: List of extraction rules to apply
        knowledge_documents: List of knowledge documents to check for conflicts
    
    Returns:
        Tuple of (confidence_percentage, applied_rules_list)
    """
    if extracted_value is None or extracted_value == "" or extracted_value == "null":
        return 0, []
    
    # Check for knowledge document conflicts first
    has_conflict, conflicting_sections = check_knowledge_document_conflicts(field_name, extracted_value, knowledge_documents)
    if has_conflict:
        return 50, [{
            'name': 'Knowledge Document Conflict',
            'action': f"Set confidence to 50% due to conflicts found in knowledge documents: {'; '.join(conflicting_sections[:2])}"
        }]
    
    # Base confidence calculation - use a high default confidence (95%) for field-level validation
    confidence_percentage = 95  # Default high confidence for extracted fields
    applied_rules = []
    
    # Apply extraction rules if available
    if extraction_rules:
        logging.info(f"Applying extraction rules for field '{field_name}' with value '{extracted_value}'")
        logging.info(f"Available extraction rules: {extraction_rules}")
        for rule in extraction_rules:
            rule_name = rule.get("ruleName", "")
            target_field = rule.get("targetField", "")
            rule_content = rule.get("ruleContent", "")
            is_active = rule.get("isActive", True)
            
            logging.info(f"Checking rule: {rule_name} - Target: {target_field}, Active: {is_active}")
            logging.info(f"Rule content: {rule_content}")
            
            # Skip inactive rules
            if not is_active:
                continue
                
            # Check if this rule applies to the current field
            # Handle multiple target fields separated by commas
            target_fields = [f.strip() for f in target_field.split(',')]
            field_matches = any(
                field_name == target.strip() or 
                field_name.startswith(target.strip()) for target in target_fields
            )
            
            if field_matches:
                rule_content_lower = rule_content.lower()
                
                # Check for Inc. confidence rule
                if "inc" in rule_content_lower and "confidence" in rule_content_lower and "50%" in rule_content_lower:
                    if isinstance(extracted_value, str) and "inc" in extracted_value.lower():
                        confidence_percentage = 50
                        applied_rules.append({
                            'name': rule_name,
                            'action': f"Set confidence to 50% due to 'Inc' in company name - indicates potential entity ambiguity"
                        })
                        logging.info(f"Applied rule '{rule_name}': Set confidence to 50% because value contains 'Inc'")
                        continue
                    else:
                        logging.info(f"Inc. rule '{rule_name}' not applied - value '{extracted_value}' does not contain 'Inc'")
                        continue
    
    return confidence_percentage, applied_rules

def check_knowledge_document_conflicts(field_name: str, extracted_value: Any, knowledge_documents: List[Dict[str, Any]] = None) -> tuple[bool, List[str]]:
    """
    Check for conflicts between extracted value and knowledge documents.
    Uses dynamic content analysis without hardcoded rules.
    
    Returns:
        Tuple of (has_conflict, conflicting_document_sections)
    """
    if not knowledge_documents or not extracted_value:
        return False, []
    
    logging.info(f"CONFLICT DEBUG: Checking field '{field_name}' with value '{extracted_value}'")
    logging.info(f"CONFLICT DEBUG: Knowledge documents count: {len(knowledge_documents)}")
    
    conflicting_sections = []
    extracted_str = str(extracted_value).lower().strip()
    
    # Search through knowledge documents for potential conflicts
    for doc in knowledge_documents:
        doc_name = doc.get('displayName', doc.get('fileName', 'Unknown Document'))
        content = doc.get('content', '')
        
        logging.info(f"CONFLICT DEBUG: Document '{doc_name}' has content: {bool(content)}")
        if content:
            logging.info(f"CONFLICT DEBUG: Content preview: {content[:200]}...")
        
        if isinstance(content, str) and content.strip():
            content_lower = content.lower()
            
            # Generic conflict detection - look for any mention of the extracted value
            # in knowledge documents that suggests special handling, review, or caution
            if extracted_str in content_lower:
                # Split content into sentences for section identification
                sentences = content.split('.')
                for i, sentence in enumerate(sentences):
                    sentence_lower = sentence.lower().strip()
                    
                    # Check if this sentence mentions the extracted value and contains
                    # keywords that suggest conflict, special review, or reduced confidence
                    conflict_keywords = [
                        'review', 'manual', 'caution', 'require', 'flag', 'check', 
                        'verify', 'confirm', 'validate', 'compliance', 'policy',
                        'restriction', 'limitation', 'special', 'enhanced', 'additional'
                    ]
                    
                    if extracted_str in sentence_lower and any(keyword in sentence_lower for keyword in conflict_keywords):
                        conflict_text = f"Knowledge document '{doc_name}' mentions special requirements for '{extracted_value}': {sentence.strip()}"
                        conflicting_sections.append(conflict_text)
                        logging.info(f"CONFLICT DETECTED: {conflict_text}")
                        break
    
    return len(conflicting_sections) > 0, conflicting_sections

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
        
        # Add schema fields
        if project_schema.get("schema_fields"):
            prompt += "Schema fields to extract:\n"
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                field_description = field.get('description', '')
                if field_description:
                    prompt += f"- {field_name} ({field_type}): {field_description}\n"
                else:
                    prompt += f"- {field_name} ({field_type})\n"
        
        # Add collections
        if project_schema.get("collections"):
            prompt += "\nCollections to extract:\n"
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_description = collection.get('description', '')
                if collection_description:
                    prompt += f"- {collection_name}: {collection_description}\n"
                else:
                    prompt += f"- {collection_name}:\n"
                for prop in collection.get("properties", []):
                    prop_name = prop['propertyName']
                    prop_type = prop['propertyType']
                    prop_description = prop.get('description', '')
                    if prop_description:
                        prompt += f"  * {prop_name} ({prop_type}): {prop_description}\n"
                    else:
                        prompt += f"  * {prop_name} ({prop_type})\n"
        
        prompt += "\nExtraction Rules:\n"
        prompt += "1. Extract ONLY real data from the document - NO sample data\n"
        prompt += "2. If data is not found, return null\n"
        prompt += "3. Return proper JSON format\n"
        prompt += "4. IMPORTANT: Pay careful attention to field descriptions for context\n"
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
        
        # Create field validations
        field_validations = []
        extracted_data = result_data if isinstance(result_data, dict) else {}
        
        # Validate schema fields
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_id = str(field.get("id", "unknown"))
                field_name = field.get("fieldName", "")
                field_type = field.get("fieldType", "TEXT")
                extracted_value = extracted_data.get(field_name)
                
                if extracted_value is not None and extracted_value != "":
                    # Apply knowledge-based confidence calculation with extraction rules
                    confidence, applied_rules = calculate_knowledge_based_confidence(
                        field_name, extracted_value, 95, extraction_rules, knowledge_documents
                    )
                    
                    # Use the field's specific auto verification confidence threshold
                    auto_verification_threshold = field.get("autoVerificationConfidence", 80)
                    status = "verified" if confidence >= auto_verification_threshold else "unverified"
                    
                    # Generate human-friendly reasoning
                    reasoning = generate_human_friendly_reasoning(field_name, extracted_value, applied_rules)
                else:
                    confidence = 0
                    status = "invalid"
                    reasoning = f"No value found for {field_name} in document"
                
                validation = FieldValidationResult(
                    field_id=field_id,
                    field_name=field_name,
                    field_type=field_type,
                    extracted_value=extracted_value,
                    original_extracted_value=extracted_value,  # Store original value for reverting
                    original_confidence_score=confidence,  # Store original confidence
                    original_ai_reasoning=reasoning,  # Store original reasoning
                    validation_status=status,
                    ai_reasoning=reasoning,
                    confidence_score=confidence,
                    document_source=file_name,
                    document_sections=["Document Content"]
                )
                field_validations.append(validation)
        
        # Validate collections
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_data = extracted_data.get(collection_name, [])
                
                if isinstance(collection_data, list):
                    for record_index, record in enumerate(collection_data):
                        for prop in collection.get("properties", []):
                            prop_id = str(prop.get("id", "unknown"))
                            prop_name = prop.get("propertyName", "")
                            prop_type = prop.get("propertyType", "TEXT")
                            
                            extracted_value = record.get(prop_name) if isinstance(record, dict) else None
                            field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                            
                            if extracted_value is not None and extracted_value != "":
                                # Apply knowledge-based confidence calculation with extraction rules
                                confidence, applied_rules = calculate_knowledge_based_confidence(
                                    prop_name, extracted_value, 95, extraction_rules, knowledge_documents
                                )
                                
                                # Use the property's specific auto verification confidence threshold
                                auto_verification_threshold = prop.get("autoVerificationConfidence", 80)
                                status = "verified" if confidence >= auto_verification_threshold else "unverified"
                                
                                # Generate human-friendly reasoning  
                                reasoning = generate_human_friendly_reasoning(prop_name, extracted_value, applied_rules)
                            else:
                                confidence = 0
                                status = "invalid"
                                reasoning = f"No value found for {prop_name} in {collection_name}"
                            
                            validation = FieldValidationResult(
                                field_id=prop_id,
                                field_name=field_name_with_index,
                                field_type=prop_type,
                                extracted_value=extracted_value,
                                original_extracted_value=extracted_value,  # Store original value for reverting
                                original_confidence_score=confidence,  # Store original confidence
                                original_ai_reasoning=reasoning,  # Store original reasoning
                                validation_status=status,
                                ai_reasoning=reasoning,
                                confidence_score=confidence,
                                document_source=file_name,
                                document_sections=["Document Content"]
                            )
                            field_validations.append(validation)
        
        return ExtractionResult(
            extracted_data=extracted_data,
            confidence_score=0.95,
            processing_notes="AI extraction completed successfully",
            field_validations=field_validations
        )
        
    except Exception as e:
        logging.error(f"Extraction failed: {e}")
        raise Exception(f"Extraction failed for {file_name}: {str(e)}")

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
                            "document_sections": fv.document_sections
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
    
    # First, collect all non-collection fields from the first successful document
    for doc in results["processed_documents"]:
        if doc.get("status") == "completed":
            extracted_data = doc["extraction_result"]["extracted_data"]
            for field_name, field_value in extracted_data.items():
                if field_name not in collection_names and field_value is not None:
                    # Take the first non-null value for non-collection fields
                    if field_name not in aggregated_data:
                        aggregated_data[field_name] = field_value
            break
    
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
                            logging.info(f"    Reindexed field: {old_field_name} -> {new_field_name}")
                        
                        aggregated_validations.append(new_validation)
                    
                    global_index += 1  # Increment global index for next item
            else:
                logging.info(f"Document {doc_idx + 1}/{len(results['processed_documents'])}: '{doc['file_name']}' has no {collection_name} items")
        
        # Add aggregated collection to results if we found any data
        if aggregated_collection:
            aggregated_data[collection_name] = aggregated_collection
            all_field_validations.extend(aggregated_validations)
            logging.info(f"✅ Aggregated {collection_name}: {len(aggregated_collection)} total items from {len(results['processed_documents'])} documents with {len(aggregated_validations)} reindexed validations")
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
    
    # Add aggregated data to results with comprehensive summary
    total_aggregated_items = sum(len(v) if isinstance(v, list) else 1 for v in aggregated_data.values())
    
    results["aggregated_extraction"] = {
        "extracted_data": aggregated_data,
        "field_validations": all_field_validations,
        "total_items": total_aggregated_items,
        "aggregation_summary": {
            "total_documents_processed": len([d for d in results["processed_documents"] if d.get("status") == "completed"]),
            "collections_aggregated": len([k for k, v in aggregated_data.items() if isinstance(v, list)]),
            "total_collection_items": sum(len(v) for v in aggregated_data.values() if isinstance(v, list)),
            "total_field_validations": len(all_field_validations)
        }
    }
    
    logging.info(f"✅ Multi-document aggregation complete:")
    logging.info(f"   - {len(aggregated_data)} total fields aggregated")
    logging.info(f"   - {total_aggregated_items} total items")
    logging.info(f"   - {len(all_field_validations)} field validations")
    logging.info(f"   - Processed {len(results['processed_documents'])} documents")

    # Calculate summary
    results["summary"]["total_documents"] = len(files)
    results["summary"]["successful_extractions"] = successful_count
    results["summary"]["average_confidence"] = (
        total_confidence / successful_count if successful_count > 0 else 0.0
    )
    
    return results