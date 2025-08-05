#!/usr/bin/env python3
"""
Test the AI continuation system with realistic scenarios
"""
import json
import logging
from ai_continuation_system import (
    analyze_truncation_point,
    generate_continuation_prompt,
    merge_extraction_results
)

def test_continuation_system():
    """Test the full continuation workflow"""
    
    print("🧪 Testing AI Continuation System...")
    
    # Test Case 1: Analyze truncation point from real truncated response
    print("\n📋 Test Case 1: Analyzing truncation point")
    
    # Sample truncated response (like what we might get from Gemini)
    truncated_response = '''{"field_validations": [
    {
      "field_id": "123-456-789",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Data Fields.Field Name[0]",
      "collection_name": "Data Fields",
      "extracted_value": "New_Pensioners.Member Reference No",
      "confidence_score": 1,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted column header from sheet",
      "record_index": 0
    },
    {
      "field_id": "987-654-321",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Data Fields.Field Type[0]",
      "collection_name": "Data Fields",
      "extracted_value": "Number",
      "confidence_score": 1,
      "validation_status": "unverified",
      "ai_reasoning": "Inferred field type based on column name",
      "record_index": 0
    },
    {
      "field_id": "123-456-789",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Data Fields.Field Name[1]",
      "collection_name": "Data Fields",
      "extracted_value": "New_Pensioners.Date of Birth",
      "confidence_score": 1,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from column header'''
    
    # Repair the truncated response to get valid JSON
    repaired_data = {
        "field_validations": [
            {
                "field_id": "123-456-789",
                "validation_type": "collection_property",
                "data_type": "TEXT",
                "field_name": "Data Fields.Field Name[0]",
                "collection_name": "Data Fields",
                "extracted_value": "New_Pensioners.Member Reference No",
                "confidence_score": 1,
                "validation_status": "unverified",
                "ai_reasoning": "Extracted column header from sheet",
                "record_index": 0
            },
            {
                "field_id": "987-654-321",
                "validation_type": "collection_property",
                "data_type": "TEXT",
                "field_name": "Data Fields.Field Type[0]",
                "collection_name": "Data Fields",
                "extracted_value": "Number",
                "confidence_score": 1,
                "validation_status": "unverified",
                "ai_reasoning": "Inferred field type based on column name",
                "record_index": 0
            }
        ]
    }
    
    # Test truncation analysis
    continuation_info = analyze_truncation_point(truncated_response, repaired_data)
    
    if continuation_info:
        print("✅ Truncation analysis successful")
        print(f"   Last processed index: {continuation_info['last_processed_index']}")
        print(f"   Last validation type: {continuation_info['last_validation_type']}")
        print(f"   Total recovered: {continuation_info['total_recovered']}")
        print(f"   Last record index: {continuation_info.get('last_record_index', 'N/A')}")
    else:
        print("❌ Truncation analysis failed")
        return False
    
    # Test Case 2: Generate continuation prompt
    print("\n📋 Test Case 2: Generating continuation prompt")
    
    original_prompt = """Extract data from document and provide field_validations in JSON format.
    
SCHEMA FIELDS:
- Field Name (ID: 123-456-789, TEXT): Name of the data field
- Field Type (ID: 987-654-321, TEXT): Type of the data field

COLLECTIONS:
- Data Fields: Collection of field definitions

DOCUMENT TEXT:
[Large Excel file with pension data...]
"""
    
    continuation_prompt = generate_continuation_prompt(
        original_prompt,
        continuation_info,
        "[Document text...]"
    )
    
    if continuation_prompt and "CONTINUATION REQUEST" in continuation_prompt:
        print("✅ Continuation prompt generated successfully")
        print(f"   Prompt length: {len(continuation_prompt)} characters")
        print(f"   Contains resume instructions: {'RESUME' in continuation_prompt}")
        print(f"   Contains index info: {str(continuation_info['last_processed_index']) in continuation_prompt}")
    else:
        print("❌ Continuation prompt generation failed")
        return False
    
    # Test Case 3: Merge extraction results
    print("\n📋 Test Case 3: Merging extraction results")
    
    # Simulate continuation extraction results
    continuation_data = {
        "field_validations": [
            {
                "field_id": "987-654-321",
                "validation_type": "collection_property",
                "data_type": "TEXT",
                "field_name": "Data Fields.Field Type[1]",
                "collection_name": "Data Fields",
                "extracted_value": "Date",
                "confidence_score": 1,
                "validation_status": "unverified",
                "ai_reasoning": "Inferred field type for date column",
                "record_index": 1
            },
            {
                "field_id": "123-456-789",
                "validation_type": "collection_property",
                "data_type": "TEXT",
                "field_name": "Data Fields.Field Name[2]",
                "collection_name": "Data Fields",
                "extracted_value": "New_Pensioners.Pension Amount",
                "confidence_score": 1,
                "validation_status": "unverified",
                "ai_reasoning": "Extracted from column header",
                "record_index": 2
            }
        ]
    }
    
    merged_results = merge_extraction_results(repaired_data, continuation_data)
    
    if (merged_results and 
        merged_results.get('field_validations') and 
        len(merged_results['field_validations']) == 4):
        print("✅ Results merging successful")
        print(f"   Original count: {merged_results['extraction_metadata']['original_count']}")
        print(f"   Continuation count: {merged_results['extraction_metadata']['continuation_count']}")
        print(f"   Total count: {merged_results['extraction_metadata']['total_count']}")
        print(f"   Truncation repaired: {merged_results['extraction_metadata']['truncation_repaired']}")
    else:
        print("❌ Results merging failed")
        return False
    
    print("\n🎉 All continuation system tests passed!")
    return True

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    success = test_continuation_system()
    exit(0 if success else 1)