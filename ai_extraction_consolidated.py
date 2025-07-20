#!/usr/bin/env python3
"""
CONSOLIDATED AI EXTRACTION - UPDATED FLOW
1. Extract document content into one big text
2. Extract data points based on schema  
3. Save and re-read extracted data fields
4. Process extracted data fields through validation rules/knowledge
5. Update extracted data fields with validation results
"""

import sys
import json
import logging
import os
import base64
import tempfile
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)

def extract_document_content(files_data: List[Dict[str, Any]]) -> str:
    """
    Step 1: Extract document content into one big text
    Process all uploaded files and extract their text content
    """
    combined_text = ""
    
    for file_data in files_data:
        file_name = file_data.get('name', '')
        file_content = file_data.get('content', '')
        
        logging.info(f"📄 Processing document: {file_name}")
        logging.info(f"🔍 File content type: {type(file_content)}, length: {len(file_content)}")
        logging.info(f"🔍 Content preview: {file_content[:100]}...")
        
        try:
            # Handle data URL format (data:application/pdf;base64,...)
            if file_content.startswith('data:'):
                logging.info(f"🔍 Detected data URL format")
                # Extract base64 content from data URL
                header, encoded = file_content.split(',', 1)
                logging.info(f"🔍 Header: {header}, encoded length: {len(encoded)}")
                file_bytes = base64.b64decode(encoded)
                logging.info(f"🔍 Decoded {len(file_bytes)} bytes")
                
                # Save to temporary file for processing
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                    temp_file.write(file_bytes)
                    temp_path = temp_file.name
                    logging.info(f"🔍 Saved to temp file: {temp_path}")
                
                # Extract text from PDF
                try:
                    import PyPDF2
                    logging.info(f"🔍 Attempting PyPDF2 extraction for {file_name}")
                    with open(temp_path, 'rb') as pdf_file:
                        pdf_reader = PyPDF2.PdfReader(pdf_file)
                        logging.info(f"🔍 PDF has {len(pdf_reader.pages)} pages")
                        text_content = ""
                        for i, page in enumerate(pdf_reader.pages):
                            page_text = page.extract_text()
                            text_content += page_text + "\n"
                            logging.info(f"🔍 Page {i+1}: extracted {len(page_text)} characters")
                        
                        logging.info(f"🔍 Total text extracted: {len(text_content)} characters")
                        logging.info(f"🔍 Text preview: {text_content[:200]}...")
                        
                        if text_content.strip():
                            combined_text += f"\n=== Document: {file_name} ===\n{text_content}\n"
                            logging.info(f"✅ Extracted {len(text_content)} characters from {file_name}")
                        else:
                            logging.warning(f"⚠️ PyPDF2 returned empty text for {file_name}, trying OCR")
                            # Fallback to OCR with pdf2image if no text found
                            try:
                                from pdf2image import convert_from_path
                                import pytesseract
                                
                                logging.info(f"🔍 Converting {file_name} to images for OCR")
                                images = convert_from_path(temp_path, dpi=200)
                                logging.info(f"🔍 Generated {len(images)} images from PDF")
                                ocr_text = ""
                                for i, image in enumerate(images):
                                    page_ocr = pytesseract.image_to_string(image)
                                    ocr_text += page_ocr + "\n"
                                    logging.info(f"🔍 OCR page {i+1}: {len(page_ocr)} characters")
                                
                                logging.info(f"🔍 Total OCR text: {len(ocr_text)} characters")
                                if ocr_text.strip():
                                    combined_text += f"\n=== Document: {file_name} (OCR) ===\n{ocr_text}\n"
                                    logging.info(f"✅ OCR extracted {len(ocr_text)} characters from {file_name}")
                                else:
                                    logging.error(f"❌ Both PyPDF2 and OCR failed for {file_name}")
                                
                            except Exception as ocr_error:
                                logging.error(f"❌ OCR failed for {file_name}: {ocr_error}")
                                combined_text += f"\n=== Document: {file_name} ===\n[Content extraction failed]\n"
                
                except Exception as pdf_error:
                    logging.warning(f"⚠️ PDF extraction failed for {file_name}: {pdf_error}")
                    combined_text += f"\n=== Document: {file_name} ===\n[PDF processing failed]\n"
                
                # Clean up temp file
                os.unlink(temp_path)
            
            else:
                # Handle plain text content
                combined_text += f"\n=== Document: {file_name} ===\n{file_content}\n"
                logging.info(f"✅ Added text content for {file_name}")
                
        except Exception as e:
            logging.error(f"❌ Failed to process {file_name}: {e}")
            combined_text += f"\n=== Document: {file_name} ===\n[Processing failed: {e}]\n"
    
    logging.info(f"📝 Combined document content: {len(combined_text)} total characters")
    return combined_text

def extract_data_points(document_text: str, project_schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Step 2: Extract data points based on schema using AI
    Use Gemini API to extract structured data from document text
    """
    try:
        from google import genai
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        # Build extraction prompt based on schema (fix key mismatch)
        schema_fields = project_schema.get("schema_fields", [])
        collections = project_schema.get("collections", [])
        
        # Create field descriptions for AI
        field_descriptions = []
        for field in schema_fields:
            field_descriptions.append(f"- {field['fieldName']} ({field['fieldType']}): {field.get('description', 'No description')}")
        
        collection_descriptions = []
        for collection in collections:
            props = []
            for prop in collection.get('properties', []):
                props.append(f"  - {prop['propertyName']} ({prop['propertyType']}): {prop.get('description', 'No description')}")
            collection_descriptions.append(f"- {collection['collectionName']} (collection):\n" + "\n".join(props))
        
        # Build comprehensive extraction prompt (restored from working version)
        extraction_prompt = f"""Document Data Extraction Task

EXTRACTION REQUIREMENTS:
- Extract only authentic content that appears in the document
- Return null for fields where no real data is found
- Ensure high accuracy and appropriate confidence levels

Schema Fields to extract:
{chr(10).join(field_descriptions)}

Collections (extract up to 3 relevant items per collection):
{chr(10).join(collection_descriptions)}

DOCUMENT TEXT:
{document_text}

EXTRACTION GUIDELINES:
1. Read the document thoroughly to identify relevant information
2. Extract data that precisely matches the requested schema fields
3. Use actual values found in the document (company names, dates, addresses, numbers)
4. Return null for fields where no corresponding data exists
5. Maintain high accuracy and assign appropriate confidence scores

CONFIDENCE SCORING:
- 95-100%: Data clearly present and unambiguous
- 80-94%: Data present but requires interpretation
- 50-79%: Data partially present or unclear
- Below 50%: Uncertain or conflicting information

Return JSON response with this EXACT structure (use actual field names from schema):
{{"""
        
        # Build exact JSON template with actual field names
        if schema_fields:
            for field in schema_fields:
                field_name = field['fieldName']
                extraction_prompt += f'  "{field_name}": null,\n'
        
        if collections:
            for collection in collections:
                collection_name = collection.get('collectionName', '')
                extraction_prompt += f'  "{collection_name}": [\n'
                extraction_prompt += '    {\n'
                
                properties = collection.get("properties", [])
                for prop in properties:
                    prop_name = prop.get('propertyName', '')
                    if prop_name:
                        extraction_prompt += f'      "{prop_name}": null,\n'
                
                extraction_prompt += '    }\n'
                extraction_prompt += '  ],\n'
        
        extraction_prompt += """}}

For NDA/Contract Documents - Party Extraction Guidelines:
- Extract ALL party/company names from signature blocks, headers, and legal text
- Extract complete addresses including street, city, state, country
- Count total number of distinct parties/organizations mentioned
- For each party, extract: Name, Address, Country

Ensure all extracted values are genuine content from the document.
IMPORTANT: Only return the JSON object, no additional text.
"""
        
        # Add debugging for prompt
        logging.info(f"🚀 AI Extraction Prompt Length: {len(extraction_prompt)} characters")
        logging.info(f"🚀 Schema Fields: {[f['fieldName'] for f in schema_fields]}")
        logging.info(f"🚀 Collections: {[c.get('collectionName', 'Unknown') for c in collections]}")
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=extraction_prompt
        )
        
        logging.info(f"🚀 AI Response received, text length: {len(response.text) if response.text else 0}")
        
        if response.text:
            # Log the raw response for debugging
            logging.info(f"🚀 Raw AI Response: {response.text[:500]}...")
            
            try:
                extracted_data = json.loads(response.text)
                logging.info(f"🤖 AI extracted data keys: {list(extracted_data.keys())}")
                logging.info(f"🤖 Extracted data: {extracted_data}")
                return extracted_data
            except json.JSONDecodeError as json_error:
                logging.error(f"❌ JSON parsing failed: {json_error}")
                logging.error(f"❌ Raw response: {response.text}")
                return {}
        else:
            logging.error("❌ AI returned empty response")
            return {}
            
    except Exception as e:
        logging.error(f"❌ AI extraction failed: {e}")
        import traceback
        logging.error(f"❌ Full traceback: {traceback.format_exc()}")
        return {}

def apply_validation_rules(extracted_data: Dict[str, Any], extraction_rules: List[Dict[str, Any]], knowledge_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Step 4: Process extracted data fields through validation rules/knowledge
    Apply confidence adjustments and reasoning based on rules and knowledge documents
    """
    processed_data = {}
    
    for field_name, value in extracted_data.items():
        confidence_score = 95 if value is not None and str(value).strip() != "" else 20
        ai_reasoning = "Extracted during AI processing"
        validation_status = "verified" if confidence_score >= 80 else "unverified"
        
        # Apply extraction rules
        for rule in extraction_rules:
            target_fields = rule.get('targetFields', [])
            if field_name in target_fields or any(target in field_name for target in target_fields):
                rule_content = rule.get('content', '').lower()
                
                # Check if rule applies to this value
                if value and str(value).lower() in rule_content:
                    # Extract confidence percentage from rule content
                    import re
                    confidence_match = re.search(r'(\d+)%', rule_content)
                    if confidence_match:
                        rule_confidence = int(confidence_match.group(1))
                        confidence_score = min(confidence_score, rule_confidence)
                        ai_reasoning = f"Confidence adjusted to {confidence_score}% based on extraction rule: {rule.get('content', '')}"
                        logging.info(f"🔧 Rule applied to {field_name}: {confidence_score}% confidence")
        
        # Apply knowledge document conflicts
        for doc in knowledge_documents:
            doc_content = doc.get('content', '').lower()
            if value and doc_content and str(value).lower() in doc_content:
                # Check for conflict indicators
                conflict_keywords = ['review', 'compliance', 'jurisdiction', 'legal', 'requirement']
                if any(keyword in doc_content for keyword in conflict_keywords):
                    confidence_score = min(confidence_score, 50)
                    ai_reasoning = f"Requires review due to knowledge document policy conflict. Original confidence reduced to {confidence_score}%."
                    logging.info(f"⚠️ Knowledge conflict for {field_name}: {confidence_score}% confidence")
        
        processed_data[field_name] = {
            'value': value,
            'confidence_score': confidence_score,
            'ai_reasoning': ai_reasoning,
            'validation_status': validation_status
        }
    
    return processed_data

def create_validation_records(session_data: Dict[str, Any], processed_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Step 5: Update extracted data fields with validation results
    Create validation records by combining schema structure with processed extraction data
    """
    session_id = session_data.get("session_id")
    project_schema = session_data.get("project_schema", {})
    
    validation_records = []
    
    # Process Schema Fields
    schema_fields = project_schema.get("schema_fields", [])
    for field in schema_fields:
        field_name = field.get("fieldName", "")
        processed_field = processed_data.get(field_name, {})
        
        validation_record = {
            "id": field.get("id"),
            "projectId": field.get("projectId"),
            "fieldName": field_name,
            "fieldType": field.get("fieldType"),
            "description": field.get("description"),
            "autoVerificationConfidence": field.get("autoVerificationConfidence", 80),
            "orderIndex": field.get("orderIndex", 0),
            "sessionId": session_id,
            "extractedValue": processed_field.get('value'),
            "originalExtractedValue": processed_field.get('value'),
            "confidenceScore": processed_field.get('confidence_score', 20),
            "originalConfidenceScore": processed_field.get('confidence_score', 20),
            "validationStatus": processed_field.get('validation_status', 'unverified'),
            "aiReasoning": processed_field.get('ai_reasoning', 'Field requires manual input'),
            "originalAiReasoning": processed_field.get('ai_reasoning', 'Field requires manual input'),
            "manuallyVerified": False,
            "record_type": "schema_field"
        }
        
        validation_records.append(validation_record)
        logging.info(f"✅ Schema field: {field_name} = {processed_field.get('value')} ({processed_field.get('confidence_score', 20)}%)")
    
    # Process Collection Properties  
    collections = project_schema.get("collections", [])
    for collection in collections:
        collection_name = collection.get("collectionName", "")
        collection_data = processed_data.get(collection_name, [])
        
        # Ensure collection_data is a list
        if not isinstance(collection_data, list):
            collection_data = []
        
        properties = collection.get("properties", [])
        
        # Create instances for each extracted item
        for record_index, item_data in enumerate(collection_data):
            for property_def in properties:
                property_name = property_def.get("propertyName", "")
                property_value = item_data.get(property_name) if isinstance(item_data, dict) else None
                
                # Check if we have processed data for this specific property instance
                field_key = f"{collection_name}.{property_name}[{record_index}]"
                processed_property = processed_data.get(field_key, {
                    'value': property_value,
                    'confidence_score': 95 if property_value is not None else 20,
                    'ai_reasoning': 'Extracted during AI processing' if property_value else 'Missing data',
                    'validation_status': 'verified' if property_value is not None else 'unverified'
                })
                
                property_record = {
                    "id": property_def.get("id"),
                    "collectionId": collection.get("id"),
                    "propertyName": property_name,
                    "propertyType": property_def.get("propertyType"),
                    "description": property_def.get("description"),
                    "autoVerificationConfidence": property_def.get("autoVerificationConfidence", 80),
                    "orderIndex": property_def.get("orderIndex", 0),
                    "recordIndex": record_index,
                    "sessionId": session_id,
                    "extractedValue": processed_property.get('value'),
                    "originalExtractedValue": processed_property.get('value'),
                    "confidenceScore": processed_property.get('confidence_score', 20),
                    "originalConfidenceScore": processed_property.get('confidence_score', 20),
                    "validationStatus": processed_property.get('validation_status', 'unverified'),
                    "aiReasoning": processed_property.get('ai_reasoning', 'Extracted during AI processing'),
                    "originalAiReasoning": processed_property.get('ai_reasoning', 'Extracted during AI processing'),
                    "manuallyVerified": False,
                    "record_type": "collection_property",
                    "collection_name": collection_name
                }
                
                validation_records.append(property_record)
                logging.info(f"✅ Collection property: {collection_name}.{property_name}[{record_index}] = {processed_property.get('value')} ({processed_property.get('confidence_score', 20)}%)")
    
    return validation_records

def main():
    """
    Main execution function implementing the 5-step extraction flow
    """
    try:
        # Read session data from stdin
        session_data = json.loads(sys.stdin.read())
        
        logging.info("🚀 CONSOLIDATED_EXTRACTION: Starting 5-step extraction flow")
        
        # Step 1: Extract document content into one big text
        files_data = session_data.get("files", [])
        logging.info(f"📄 Step 1: Processing {len(files_data)} documents")
        document_text = extract_document_content(files_data)
        
        if not document_text.strip():
            logging.error("❌ CRITICAL: No document content extracted from any files!")
            logging.error("❌ PDF processing completely failed - no text content available for AI extraction")
            # Return empty data structure instead of demo data
            demo_data = {}
        else:
            # Step 2: Extract data points based on schema  
            project_schema = session_data.get("project_schema", {})
            logging.info(f"🤖 Step 2: AI extraction from {len(document_text)} characters")
            demo_data = extract_data_points(document_text, project_schema)
        
        # Step 3: Save and re-read extracted data fields (data is now in demo_data)
        logging.info(f"💾 Step 3: Processing {len(demo_data)} extracted fields")
        
        # Step 4: Process through validation rules/knowledge
        extraction_rules = session_data.get("extraction_rules", [])
        knowledge_documents = session_data.get("knowledge_documents", [])
        logging.info(f"🔧 Step 4: Applying {len(extraction_rules)} rules and {len(knowledge_documents)} knowledge docs")
        processed_data = apply_validation_rules(demo_data, extraction_rules, knowledge_documents)
        
        # Step 5: Update extracted data fields with validation results
        logging.info(f"📋 Step 5: Creating validation records")
        validation_records = create_validation_records(session_data, processed_data)
        
        # Output results
        results = {
            "validation_records": validation_records,
            "total_records": len(validation_records),
            "message": "Consolidated validation records created successfully"
        }
        
        print(json.dumps(results))
        logging.info(f"✅ CONSOLIDATED_EXTRACTION: Complete - {len(validation_records)} records created")
        
    except Exception as e:
        logging.error(f"❌ CONSOLIDATED_EXTRACTION: Fatal error: {e}")
        import traceback
        traceback.print_exc()
        
        # Return error response
        error_result = {
            "validation_records": [],
            "total_records": 0,
            "error": str(e),
            "message": "Extraction failed"
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()