#!/usr/bin/env python3
"""
WORKING AI EXTRACTION - MULTIMODAL APPROACH
Uses direct Gemini API with binary file content (like the working version)
"""

import sys
import json
import logging
import os
import base64
from typing import Dict, List, Any, Optional

from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)

def extract_data_from_documents(files_data: List[Dict[str, Any]], project_schema: Dict[str, Any], extraction_rules: List[Dict[str, Any]] = None, knowledge_documents: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Extract structured data from documents using Gemini AI (multimodal approach)
    This is the working method that processes binary PDF content directly
    """
    try:
        from google import genai
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        # Build extraction prompt based on schema
        schema_fields = project_schema.get("schema_fields", [])
        collections = project_schema.get("collections", [])
        
        # Build comprehensive extraction prompt
        extraction_prompt = f"""Document Data Extraction Task

EXTRACTION REQUIREMENTS:
- Extract only authentic content that appears in the document
- Return null for fields where no real data is found
- Ensure high accuracy and appropriate confidence levels

Schema Fields to extract:
"""
        
        for field in schema_fields:
            extraction_prompt += f"- {field['fieldName']} ({field['fieldType']}): {field.get('description', 'No description')}\n"
        
        extraction_prompt += "\nCollections (extract all relevant items):\n"
        for collection in collections:
            extraction_prompt += f"- {collection['collectionName']} (collection):\n"
            for prop in collection.get('properties', []):
                extraction_prompt += f"  - {prop['propertyName']} ({prop['propertyType']}): {prop.get('description', 'No description')}\n"
        
        extraction_prompt += f"""

EXTRACTION GUIDELINES:
1. Read the document thoroughly to identify relevant information
2. Extract data that precisely matches the requested schema fields
3. Use actual values found in the document (company names, dates, addresses, numbers)
4. Return null for fields where no corresponding data exists
5. Maintain high accuracy and assign appropriate confidence scores

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
        
        # Process each document with multimodal API
        all_extracted_data = {}
        
        for file_data in files_data:
            file_name = file_data.get('name', '')
            file_content = file_data.get('content', '')
            
            logging.info(f"🚀 Processing {file_name} with multimodal AI")
            
            try:
                # Handle data URL format
                if file_content.startswith('data:'):
                    header, encoded = file_content.split(',', 1)
                    file_bytes = base64.b64decode(encoded)
                    
                    # Determine MIME type
                    if 'pdf' in header.lower():
                        mime_type = 'application/pdf'
                    else:
                        mime_type = 'application/pdf'  # Default
                    
                    # Use multimodal processing with binary content
                    content_parts = [
                        types.Part.from_bytes(
                            data=file_bytes,
                            mime_type=mime_type
                        ),
                        extraction_prompt
                    ]
                    
                    logging.info(f"🚀 Making multimodal API call for {file_name}")
                    response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=content_parts,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            max_output_tokens=2048,
                        )
                    )
                    
                    if response.text:
                        logging.info(f"🚀 Raw AI Response: {response.text[:500]}...")
                        try:
                            document_data = json.loads(response.text)
                            logging.info(f"🤖 Extracted data keys: {list(document_data.keys())}")
                            
                            # Merge extracted data
                            for key, value in document_data.items():
                                if key in all_extracted_data:
                                    # Merge collections
                                    if isinstance(value, list) and isinstance(all_extracted_data[key], list):
                                        all_extracted_data[key].extend(value)
                                    else:
                                        # Keep first non-null value for fields
                                        if all_extracted_data[key] is None and value is not None:
                                            all_extracted_data[key] = value
                                else:
                                    all_extracted_data[key] = value
                            
                        except json.JSONDecodeError as json_error:
                            logging.error(f"❌ JSON parsing failed for {file_name}: {json_error}")
                    else:
                        logging.error(f"❌ Empty response for {file_name}")
                        
            except Exception as e:
                logging.error(f"❌ Failed to process {file_name}: {e}")
        
        logging.info(f"🤖 Final extracted data: {all_extracted_data}")
        return all_extracted_data
        
    except Exception as e:
        logging.error(f"❌ AI extraction failed: {e}")
        import traceback
        logging.error(f"❌ Full traceback: {traceback.format_exc()}")
        return {}

def apply_validation_rules(extracted_data: Dict[str, Any], extraction_rules: List[Dict[str, Any]], knowledge_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
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
                        ai_reasoning = f"Confidence adjusted to {confidence_score}% based on extraction rule"
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

def create_validation_records(processed_data: Dict[str, Any], extracted_data: Dict[str, Any], project_schema: Dict[str, Any], session_id: str) -> List[Dict[str, Any]]:
    """
    Create validation records from processed data
    """
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
        # Get collection data from the raw extracted_data, not processed_data
        collection_data = extracted_data.get(collection_name, [])
        logging.info(f"🔍 Processing collection '{collection_name}' with {len(collection_data) if isinstance(collection_data, list) else 'non-list'} items")
        logging.info(f"🔍 Collection data type: {type(collection_data)}, content: {collection_data}")
        
        # Ensure collection_data is a list
        if not isinstance(collection_data, list):
            collection_data = []
        
        properties = collection.get("properties", [])
        
        # Create instances for each extracted item
        for record_index, item_data in enumerate(collection_data):
            for property_def in properties:
                property_name = property_def.get("propertyName", "")
                property_value = item_data.get(property_name) if isinstance(item_data, dict) else None
                
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
                    "extractedValue": property_value,
                    "originalExtractedValue": property_value,
                    "confidenceScore": 95 if property_value is not None else 20,
                    "originalConfidenceScore": 95 if property_value is not None else 20,
                    "validationStatus": 'verified' if property_value is not None else 'unverified',
                    "aiReasoning": 'Extracted during AI processing' if property_value else 'Missing data',
                    "originalAiReasoning": 'Extracted during AI processing' if property_value else 'Missing data',
                    "manuallyVerified": False,
                    "record_type": "collection_property",
                    "collection_name": collection_name
                }
                
                validation_records.append(property_record)
                logging.info(f"✅ Collection property: {collection_name}.{property_name}[{record_index}] = {property_value}")
    
    return validation_records

def main():
    """
    Main execution function implementing the working extraction flow
    """
    try:
        # Read session data from stdin
        session_data = json.loads(sys.stdin.read())
        
        logging.info("🚀 WORKING_EXTRACTION: Starting multimodal extraction")
        
        # Extract using working multimodal method
        files_data = session_data.get("files", [])
        project_schema = session_data.get("project_schema", {})
        extraction_rules = session_data.get("extraction_rules", [])
        knowledge_documents = session_data.get("knowledge_documents", [])
        session_id = session_data.get("session_id", "")
        
        logging.info(f"📄 Processing {len(files_data)} documents")
        logging.info(f"🔧 Applying {len(extraction_rules)} rules and {len(knowledge_documents)} knowledge docs")
        
        # Step 1: Extract data using multimodal AI
        extracted_data = extract_data_from_documents(files_data, project_schema, extraction_rules, knowledge_documents)
        
        # Step 2: Apply validation rules
        processed_data = apply_validation_rules(extracted_data, extraction_rules, knowledge_documents)
        
        # Step 3: Create validation records
        validation_records = create_validation_records(processed_data, extracted_data, project_schema, session_id)
        
        # Return results
        result = {
            "success": True,
            "total_records": len(validation_records),
            "schema_fields_updated": len([r for r in validation_records if r.get("record_type") == "schema_field"]),
            "collection_properties_updated": len([r for r in validation_records if r.get("record_type") == "collection_property"]),
            "validation_records": validation_records,
            "message": f"✅ WORKING EXTRACTION COMPLETE - {len(validation_records)} validation records created"
        }
        
        print(json.dumps(result))
        logging.info(f"🚀 WORKING_EXTRACTION: Created {len(validation_records)} validation records")
        
    except Exception as e:
        logging.error(f"❌ Main extraction failed: {e}")
        import traceback
        logging.error(f"❌ Full traceback: {traceback.format_exc()}")
        
        result = {
            "success": False,
            "error": str(e),
            "total_records": 0,
            "schema_fields_updated": 0,
            "collection_properties_updated": 0,
            "validation_records": [],
            "message": f"❌ EXTRACTION FAILED: {str(e)}"
        }
        
        print(json.dumps(result))

if __name__ == "__main__":
    main()