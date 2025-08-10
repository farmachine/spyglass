#!/usr/bin/env python3

import json
import sys

# Minimal test to isolate the record_index issue
def test_basic_extraction():
    """Test the AI extraction with minimal input to isolate the error"""
    
    # Create the exact input that's causing the error
    raw_input = {
        "documents": [{
            "file_name": "test.xlsx", 
            "file_content": "Simple test content"
        }],
        "project_schema": {
            "schema_fields": [],
            "collections": [{
                "collectionName": "Column Name Mapping",
                "properties": [
                    {"id": "prop1", "propertyName": "Column Heading", "propertyType": "TEXT"},
                    {"id": "prop2", "propertyName": "Worksheet Name", "propertyType": "TEXT"}
                ]
            }]
        },
        "extraction_rules": [],
        "knowledge_documents": [],
        "session_name": "test_session",
        "validated_data_context": {},
        "collection_record_counts": {"Column Name Mapping": 111},
        "extraction_notes": "",
        "is_subsequent_upload": True
    }
    
    # Try to directly execute the problematic part
    try:
        # Print input to verify structure
        print("Input structure looks correct")
        
        # Test the record counting logic that seemed to work
        collection_record_counts = raw_input.get('collection_record_counts', {})
        highest_collection_indices = {}
        
        for collection_name, count in collection_record_counts.items():
            if count > 0:
                highest_collection_indices[collection_name] = count - 1
                print(f"Collection {collection_name}: {count} records (highest index: {count - 1})")
        
        # Test the example generation logic
        project_schema = raw_input["project_schema"]
        
        json_lines = []
        json_lines.append('{"field_validations": [')
        
        if project_schema.get("collections"):
            all_collection_items = []
            
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                properties = collection.get("properties", [])
                
                if not properties:
                    continue
                    
                start_index = highest_collection_indices.get(collection_name, -1) + 1
                example_count = 2
                
                for record_index in range(start_index, start_index + example_count):
                    for prop in properties:
                        item_data = {
                            'collection_name': collection_name,
                            'record_index': record_index,
                            'prop_name': prop['propertyName']
                        }
                        all_collection_items.append(item_data)
                        print(f"Generated item: {item_data}")
            
            print(f"Successfully generated {len(all_collection_items)} collection items")
            return True
            
    except Exception as e:
        print(f"ERROR FOUND: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_basic_extraction()
    if success:
        print("SUCCESS: No record_index scope errors detected")
        sys.exit(0)
    else:
        print("FAILED: record_index scope error reproduced")
        sys.exit(1)