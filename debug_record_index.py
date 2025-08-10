#!/usr/bin/env python3

# Debug script to isolate the record_index variable scope issue
import json

def test_generate_field_validation_example():
    # Simulate the problematic code path
    json_lines = []
    json_lines.append('{"field_validations": [')
    
    # Mock data that matches the real scenario
    project_schema = {
        "schema_fields": [],
        "collections": [
            {
                "collectionName": "Column Name Mapping",
                "properties": [
                    {"id": "prop1", "propertyName": "Column Heading", "propertyType": "TEXT"},
                    {"id": "prop2", "propertyName": "Worksheet Name", "propertyType": "TEXT"}
                ]
            }
        ]
    }
    
    highest_collection_indices = {"Column Name Mapping": 110}
    
    # Simulate the actual problematic code
    for collection in project_schema.get("collections", []):
        collection_name = collection.get('collectionName', collection.get('objectName', ''))
        properties = collection.get("properties", [])
        
        # Same logic as in the original
        schema_field_count = len(project_schema.get("schema_fields", []))
        remaining_space = 100 - schema_field_count
        total_collections = len(project_schema.get("collections", []))
        
        if total_collections > 0:
            properties_per_collection = sum(len(c.get('properties', [])) for c in project_schema.get("collections", []))
            if properties_per_collection > 0:
                max_examples_per_collection = max(1, remaining_space // (properties_per_collection))
                example_count = min(2, max_examples_per_collection)
            else:
                example_count = 1
        else:
            example_count = 2
        
        # This is where the issue occurs
        start_index = highest_collection_indices.get(collection_name, -1) + 1
        
        # Only process if there are properties - THIS FIX SHOULD PREVENT THE ERROR
        if properties:
            for record_index in range(start_index, start_index + example_count):
                for prop_index, prop in enumerate(properties):
                    prop_id = prop['id']
                    prop_name = prop['propertyName']
                    prop_type = prop['propertyType']
                    
                    example_value = 'Test Value'
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
                    json_lines.append(f'    "ai_reasoning": "Found {collection_name} item {record_index + 1} with {prop_name} value in document",')
                    json_lines.append(f'    "record_index": {record_index}')
                    
                    # The problematic is_last check
                    is_last = (collection == project_schema["collections"][-1] and 
                             record_index == (start_index + example_count - 1) and 
                             prop_index == len(properties) - 1)
                    json_lines.append('  }' + ('' if is_last else ','))
                    
                    print(f"Processed record_index: {record_index}")
    
    json_lines.append(']}')
    return '\n'.join(json_lines)

if __name__ == "__main__":
    try:
        result = test_generate_field_validation_example()
        print("SUCCESS: Function completed without errors")
        line_count = len(result.split('\n'))
        print(f"Generated {line_count} lines")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()