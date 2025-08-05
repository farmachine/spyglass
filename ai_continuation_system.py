#!/usr/bin/env python3
"""
AI Continuation System for Large Document Processing

This system handles continuation of AI extraction when responses are truncated,
allowing the AI to resume from where it left off rather than restarting.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Tuple
from ai_extraction_simplified import step1_extract_from_documents, repair_truncated_json

def analyze_truncation_point(original_response: str, repaired_data: Dict) -> Optional[Dict]:
    """
    Analyze where truncation occurred to determine continuation point.
    
    Args:
        original_response: The original truncated response from AI
        repaired_data: The successfully repaired data structure
        
    Returns:
        Dict with continuation info or None if no continuation needed
    """
    try:
        field_validations = repaired_data.get('field_validations', [])
        if not field_validations:
            logging.warning("No field validations found in repaired data")
            return None
            
        # Find the last complete validation object
        last_validation = field_validations[-1]
        
        # Determine what type of extraction this was
        validation_type = last_validation.get('validation_type', 'unknown')
        
        continuation_info = {
            'last_processed_index': len(field_validations) - 1,
            'last_field_id': last_validation.get('field_id'),
            'last_validation_type': validation_type,
            'total_recovered': len(field_validations),
            'truncation_detected': True
        }
        
        # For collection properties, track the record index
        if validation_type == 'collection_property':
            continuation_info['last_record_index'] = last_validation.get('record_index', 0)
            
        # Analyze the truncation pattern to understand what was being processed
        lines = original_response.split('\n')
        truncation_context = []
        
        # Look for incomplete objects at the end
        for i, line in enumerate(lines[-10:], start=len(lines)-10):
            if any(keyword in line for keyword in ['"field_id"', '"validation_type"', '"extracted_value"']):
                truncation_context.append(f"Line {i}: {line.strip()}")
                
        continuation_info['truncation_context'] = truncation_context
        
        logging.info(f"📍 Truncation analysis: Last processed at index {continuation_info['last_processed_index']}")
        logging.info(f"🔄 Continuation needed from: {continuation_info['last_validation_type']}")
        
        return continuation_info
        
    except Exception as e:
        logging.error(f"❌ Error analyzing truncation point: {e}")
        return None

def generate_continuation_prompt(
    original_prompt: str,
    continuation_info: Dict,
    extracted_text: str
) -> str:
    """
    Generate a continuation prompt that instructs AI to resume from truncation point.
    
    Args:
        original_prompt: The original extraction prompt
        continuation_info: Information about where to continue from
        extracted_text: The document text being processed
        
    Returns:
        Modified prompt for continuation
    """
    last_index = continuation_info.get('last_processed_index', 0)
    last_validation_type = continuation_info.get('last_validation_type', 'unknown')
    
    # Create continuation instruction
    continuation_instruction = f"""
CONTINUATION REQUEST - RESUME FROM TRUNCATION POINT

Previous extraction was truncated. You successfully processed {continuation_info['total_recovered']} field validations.

RESUME INSTRUCTIONS:
- Start from where the previous response was cut off
- The last successfully processed validation was at index {last_index}
- Last validation type: {last_validation_type}
- DO NOT repeat any previously processed validations
- Continue with the NEXT unprocessed field/object
- Maintain the same JSON structure format
"""
    
    if last_validation_type == 'collection_property':
        last_record_index = continuation_info.get('last_record_index', 0)
        continuation_instruction += f"""
- Last processed record index: {last_record_index}
- Continue with record index {last_record_index + 1}
"""
    
    # Add context about what was being processed
    if continuation_info.get('truncation_context'):
        continuation_instruction += f"""
TRUNCATION CONTEXT:
{chr(10).join(continuation_info['truncation_context'])}
"""
    
    # Modify the original prompt to include continuation instructions
    modified_prompt = continuation_instruction + "\n\n" + original_prompt
    
    # Add emphasis on continuation
    modified_prompt += """

CRITICAL: This is a CONTINUATION request. Start exactly where the previous response was truncated.
Do not restart from the beginning. Resume processing from the next unprocessed item.
"""
    
    return modified_prompt

def perform_continuation_extraction(
    session_id: str,
    project_id: str,
    extracted_text: str,
    schema_fields: List[Dict],
    collections: List[Dict],
    knowledge_base: List[Dict],
    extraction_rules: List[Dict],
    previous_response: str,
    repaired_data: Dict
) -> Optional[Dict]:
    """
    Perform continuation extraction starting from truncation point.
    
    Args:
        session_id: Session identifier
        project_id: Project identifier  
        extracted_text: Document text
        schema_fields: Schema field definitions
        collections: Collection definitions
        knowledge_base: Knowledge base entries
        extraction_rules: Extraction rules
        previous_response: The truncated response
        repaired_data: Successfully repaired partial data
        
    Returns:
        Continuation extraction result or None if failed
    """
    try:
        # Analyze where truncation occurred
        continuation_info = analyze_truncation_point(previous_response, repaired_data)
        
        if not continuation_info:
            logging.error("❌ Could not analyze truncation point for continuation")
            return None
            
        logging.info(f"🔄 Starting continuation extraction for session {session_id}")
        
        # Generate original prompt (simplified version)
        original_prompt = f"""
Extract data from the following document text and validate against the provided schema fields and collections.

SCHEMA FIELDS: {json.dumps(schema_fields, indent=2)}
COLLECTIONS: {json.dumps(collections, indent=2)}
KNOWLEDGE BASE: {json.dumps(knowledge_base, indent=2)}
EXTRACTION RULES: {json.dumps(extraction_rules, indent=2)}

DOCUMENT TEXT:
{extracted_text}

Provide field_validations in JSON format.
"""
        
        # Generate continuation prompt
        continuation_prompt = generate_continuation_prompt(
            original_prompt,
            continuation_info,
            extracted_text
        )
        
        logging.info("🚀 Sending continuation request to AI...")
        
        # Prepare project schema in the expected format
        project_schema = {
            'schema_fields': schema_fields,
            'collections': collections
        }
        
        # Create documents structure for continuation
        documents = [{
            'file_content': extracted_text,
            'file_name': f'continuation_session_{session_id}.txt',
            'mime_type': 'text/plain'
        }]
        
        # Get already processed field IDs to explicitly skip them
        processed_field_ids = set()
        existing_validations = repaired_data.get('field_validations', [])
        for validation in existing_validations:
            field_id = validation.get('field_id', '')
            if field_id:
                processed_field_ids.add(field_id)
        
        logging.info(f"🔄 Processed field IDs to skip: {len(processed_field_ids)} items")
        logging.info(f"🔄 First few processed IDs: {list(processed_field_ids)[:5]}")
        
        # Create list of fields/properties that still need processing
        remaining_items = []
        
        # Add schema fields that haven't been processed
        for field in schema_fields:
            field_id = field.get('id', '')
            if field_id and field_id not in processed_field_ids:
                remaining_items.append({
                    'type': 'schema_field',
                    'id': field_id,
                    'name': field.get('fieldName', ''),
                    'data_type': field.get('fieldType', 'TEXT')
                })
        
        # Add collection properties that haven't been processed  
        for collection in collections:
            collection_id = collection.get('id', '')
            collection_name = collection.get('collectionName', '')
            properties = collection.get('properties', [])
            
            for prop in properties:
                prop_id = prop.get('id', '')
                if prop_id and prop_id not in processed_field_ids:
                    remaining_items.append({
                        'type': 'collection_property',
                        'id': prop_id,
                        'name': prop.get('propertyName', ''),
                        'data_type': prop.get('propertyType', 'TEXT'),
                        'collection_id': collection_id,
                        'collection_name': collection_name
                    })
        
        if not remaining_items:
            logging.info("✅ All items have been processed - no continuation needed")
            return {
                'continuation_data': {'field_validations': []},
                'continuation_info': continuation_info,
                'success': True
            }
        
        logging.info(f"🔄 Found {len(remaining_items)} items still needing extraction")
        
        # Create detailed continuation prompt with explicit skip instructions
        skip_list = '\n'.join([f"- {field_id}" for field_id in sorted(processed_field_ids)])
        remaining_list = '\n'.join([f"- {item['id']} ({item['type']}): {item['name']}" for item in remaining_items[:10]])
        
        enhanced_continuation_prompt = f"""
CONTINUATION EXTRACTION - CRITICAL INSTRUCTIONS

You are continuing a truncated AI extraction that processed {len(processed_field_ids)} validations.

ALREADY PROCESSED - DO NOT EXTRACT THESE FIELD IDs AGAIN:
{skip_list}

REMAINING ITEMS TO EXTRACT ({len(remaining_items)} total):
{remaining_list}
{f"... and {len(remaining_items) - 10} more items" if len(remaining_items) > 10 else ""}

STRICT RULES:
1. ONLY extract validations for the REMAINING ITEMS listed above
2. DO NOT re-extract any field_id from the ALREADY PROCESSED list
3. Extract ALL remaining items, not just a subset
4. Use the exact same JSON format as the original extraction
5. Start response with {{"field_validations": [...]}}

DOCUMENT CONTENT:
{extracted_text}

Extract field validations for the remaining unprocessed items only.
"""
        
        # Perform continuation extraction with enhanced prompt
        from ai_extraction_simplified import make_gemini_request
        
        continuation_response = make_gemini_request(enhanced_continuation_prompt)
        
        if not continuation_response or not continuation_response.get('success'):
            logging.error("❌ Continuation request failed")
            return None
        
        continuation_text = continuation_response.get('response', '')
        if not continuation_text:
            logging.error("❌ Empty continuation response")
            return None
        
        # Parse continuation response
        try:
            import json
            
            if continuation_text.strip().startswith('{'):
                continuation_data = json.loads(continuation_text)
            else:
                # Try to extract as array
                import re
                match = re.search(r'"field_validations":\s*\[(.*)\]', continuation_text, re.DOTALL)
                if match:
                    validations_text = '[' + match.group(1) + ']'
                    validations_array = json.loads(validations_text)
                    continuation_data = {"field_validations": validations_array}
                else:
                    if continuation_text.strip().startswith('['):
                        validations_array = json.loads(continuation_text)
                        continuation_data = {"field_validations": validations_array}
                    else:
                        raise json.JSONDecodeError("Could not parse continuation response", continuation_text, 0)
                        
            continuation_validations = continuation_data.get('field_validations', [])
            
            # Filter out any duplicates (safety check)
            filtered_validations = []
            for validation in continuation_validations:
                field_id = validation.get('field_id', '')
                if field_id and field_id not in processed_field_ids:
                    filtered_validations.append(validation)
                else:
                    logging.warning(f"⚠️ Filtered duplicate field_id: {field_id}")
            
            continuation_data['field_validations'] = filtered_validations
            
            logging.info(f"✅ Continuation extraction successful: {len(filtered_validations)} new validations")
            return {
                'continuation_data': continuation_data,
                'continuation_info': continuation_info,
                'success': True,
                'remaining_items_requested': len(remaining_items),
                'validations_extracted': len(filtered_validations),
                'duplicates_filtered': len(continuation_validations) - len(filtered_validations)
            }
            
        except json.JSONDecodeError as e:
            logging.error(f"❌ Failed to parse continuation JSON: {e}")
            logging.error(f"❌ Response preview: {continuation_text[:500]}")
            return None
            
    except Exception as e:
        logging.error(f"❌ Error in continuation extraction: {e}")
        import traceback
        traceback.print_exc()
        return None

def merge_extraction_results(
    original_data: Dict,
    continuation_data: Dict
) -> Dict:
    """
    Merge original repaired data with continuation data.
    
    Args:
        original_data: The original repaired data
        continuation_data: New data from continuation extraction
        
    Returns:
        Merged complete dataset
    """
    try:
        # Get field validations from both datasets
        original_validations = original_data.get('field_validations', [])
        continuation_validations = continuation_data.get('field_validations', [])
        
        # Merge the validations
        merged_validations = original_validations + continuation_validations
        
        # Create merged result
        merged_result = {
            'field_validations': merged_validations,
            'extraction_metadata': {
                'original_count': len(original_validations),
                'continuation_count': len(continuation_validations),
                'total_count': len(merged_validations),
                'truncation_repaired': True,
                'continuation_used': True
            }
        }
        
        logging.info(f"🔗 Merged extraction results: {len(original_validations)} + {len(continuation_validations)} = {len(merged_validations)} total validations")
        
        return merged_result
        
    except Exception as e:
        logging.error(f"❌ Error merging extraction results: {e}")
        return original_data

if __name__ == "__main__":
    # Test the continuation system
    print("🧪 AI Continuation System - Ready for testing")
    print("This module provides continuation capabilities for truncated AI extractions")