#!/usr/bin/env python3

import sys
import json
import logging
from ai_extraction_simplified import detect_truncation

def test_real_scenario():
    """Test the exact scenario from the recent session: 300 validations with max index 149"""
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Simulate the exact project schema from the real session
    project_schema = {
        "schema_fields": [
            {
                "id": "377f12df-a43e-4726-8dbd-83d529b8ac5d",
                "fieldName": "Schema Field",
                "dataType": "TEXT"
            }
        ],
        "collections": [
            {
                "id": "c9f51565-a1e2-474e-a2dc-901d22920072",
                "collectionName": "Data Fields",
                "objectName": "Data Fields",
                "properties": [
                    {
                        "id": "d35ab7bb-48e2-41ab-be2a-f666ea365dcb",
                        "propertyName": "Field Name",
                        "dataType": "TEXT"
                    },
                    {
                        "id": "0fb1c324-68ea-491e-a7fd-f9587e6d504c", 
                        "propertyName": "Field Type",
                        "dataType": "TEXT"
                    }
                ]
            }
        ]
    }
    
    # Simulate 300 validations from real session: 1 schema + 299 collection properties
    field_validations = []
    
    # Add 1 schema field validation
    field_validations.append({
        "field_id": "377f12df-a43e-4726-8dbd-83d529b8ac5d",
        "validation_type": "schema_field",
        "data_type": "TEXT",
        "field_name": "Schema Field",
        "extracted_value": "Some value"
    })
    
    # Add 298 collection validations (149 items × 2 properties each)
    # This matches the real session output
    for i in range(149):
        # Field Name property
        field_validations.append({
            "field_id": "d35ab7bb-48e2-41ab-be2a-f666ea365dcb",
            "validation_type": "collection_property",
            "data_type": "TEXT",
            "field_name": f"Data Fields.Field Name[{i}]",
            "collection_name": "Data Fields",
            "record_index": i,
            "extracted_value": f"Some field name {i}"
        })
        
        # Field Type property  
        field_validations.append({
            "field_id": "0fb1c324-68ea-491e-a7fd-f9587e6d504c",
            "validation_type": "collection_property", 
            "data_type": "TEXT",
            "field_name": f"Data Fields.Field Type[{i}]",
            "collection_name": "Data Fields",
            "record_index": i,
            "extracted_value": "TEXT"
        })
    
    # Create simulated AI response
    response_data = {
        "field_validations": field_validations
    }
    response_text = json.dumps(response_data, indent=2)
    
    print(f"=== TESTING REAL SCENARIO ===")
    print(f"Simulating session with:")
    print(f"- Total validations: {len(field_validations)}")
    print(f"- Max record index: 148 (0-148 = 149 items)")
    print(f"- Collection properties: 2 per item")
    print(f"- Expected total: 371 (1 schema + 185*2 collection)")
    print()
    
    # Calculate expected field count using the same logic as the main extraction
    expected_field_count = 0
    if project_schema:
        schema_fields_count = len(project_schema.get('schema_fields', []))
        expected_field_count += schema_fields_count
        print(f"DEBUG: Found {schema_fields_count} schema fields")
        
        for collection in project_schema.get('collections', []):
            collection_name = collection.get('collectionName', collection.get('objectName', ''))
            properties_count = len(collection.get('properties', []))
            print(f"DEBUG: Collection '{collection_name}' has {properties_count} properties")
            
            if properties_count > 0:
                # Look for the highest record index in current validations to estimate total items
                collection_validations = [v for v in field_validations 
                                        if v.get('collection_name') == collection_name or
                                           v.get('field_name', '').startswith(f"{collection_name}.")]
                
                print(f"DEBUG: Found {len(collection_validations)} validations for collection '{collection_name}'")
                
                if collection_validations:
                    max_index = max((v.get('record_index', 0) for v in collection_validations), default=0)
                    estimated_items = max_index + 50  # Add buffer for missing items (same as main logic)
                    print(f"DEBUG: Max index {max_index}, estimating {estimated_items} total items")
                else:
                    estimated_items = 200  # Conservative estimate for large datasets
                    print(f"DEBUG: No collection validations found, using default estimate: {estimated_items}")
                
                collection_expected = properties_count * estimated_items
                expected_field_count += collection_expected
                print(f"DEBUG: Collection contributes {collection_expected} validations ({properties_count} × {estimated_items})")
        
        print(f"DEBUG: Total expected validations: {expected_field_count}")
    
    # Test truncation detection with calculated expected count
    is_truncated = detect_truncation(response_text, expected_field_count, project_schema)
    
    print(f"Truncation detected: {is_truncated}")
    
    if is_truncated:
        print("✅ SUCCESS: Real scenario truncation detected correctly")
    else:
        print("❌ FAILED: Real scenario should have triggered truncation")
    
    return is_truncated

if __name__ == "__main__":
    test_real_scenario()