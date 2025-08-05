#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_extraction_simplified import detect_truncation
import json

# Test the enhanced truncation detection with simulated data from your session
def test_session_truncation():
    """
    Test truncation detection with data similar to session 18f9d838-d33f-4017-a75c-f8d010b43ba5
    """
    
    # Simulate the project schema (185 items, 2 properties each expected)
    project_schema = {
        "schema_fields": [
            {"fieldName": "Main Field", "fieldType": "TEXT", "id": "main-field-id"}
        ],
        "collections": [
            {
                "collectionName": "Data Fields",
                "properties": [
                    {"fieldName": "Field Name", "fieldType": "TEXT", "id": "field-name-id"},
                    {"fieldName": "Field Type", "fieldType": "TEXT", "id": "field-type-id"}
                ]
            }
        ]
    }
    
    # Simulate response with 300 validations (missing 71) 
    # Should have: 1 schema + (185 items × 2 properties) = 371 total
    # Actually got: 1 schema + (149 items × 2 properties) = 300 total (36 fewer items than expected)  
    
    field_validations = []
    
    # Add 1 schema field validation
    field_validations.append({
        "field_id": "main-field-id",
        "validation_type": "schema_field", 
        "data_type": "TEXT",
        "field_name": "Main Field",
        "extracted_value": "Some value"
    })
    
    # Add 298 collection validations (149 items × 2 properties each) 
    # This simulates the current truncation - missing 36 complete items (from item 149 to 184)
    for i in range(149):
        # Field Name property
        field_validations.append({
            "field_id": "field-name-id",
            "validation_type": "collection_property",
            "data_type": "TEXT", 
            "field_name": "Field Name",
            "collection_name": "Data Fields",
            "item_index": i,
            "extracted_value": f"Field {i+1}"
        })
        
        # Field Type property  
        field_validations.append({
            "field_id": "field-type-id", 
            "validation_type": "collection_property",
            "data_type": "TEXT",
            "field_name": "Field Type", 
            "collection_name": "Data Fields",
            "item_index": i,
            "extracted_value": "TEXT"
        })
        
        # Missing: Items 149-184 (36 complete items missing due to truncation)
    
    # Create simulated AI response
    response_data = {
        "field_validations": field_validations
    }
    
    response_text = json.dumps(response_data, indent=2)
    expected_field_count = 1 + (2 * 185)  # Schema + collection properties
    
    print(f"Testing truncation detection:")
    print(f"- Total validations in response: {len(field_validations)}")
    print(f"- Expected validations: {expected_field_count}") 
    print(f"- Collection items found: 149")
    print(f"- Collection items expected: 185")
    print(f"- Properties per item: 2")
    print()
    
    # Test the enhanced detection
    is_truncated = detect_truncation(response_text, expected_field_count, project_schema)
    
    print(f"Truncation detected: {is_truncated}")
    
    if is_truncated:
        print("✅ SUCCESS: Enhanced detection correctly identified the missing collection items (149-184)")
    else:
        print("❌ FAILED: Detection missed the truncation")
    
    return is_truncated

if __name__ == "__main__":
    test_session_truncation()