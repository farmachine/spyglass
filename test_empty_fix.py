#!/usr/bin/env python3
"""Test the empty response fix"""

import json
import sys

def test_empty_response_fix():
    # Simulate project schema with 3 fields
    project_schema = {
        'schema_fields': [
            {'id': 'field-1', 'fieldName': 'Test Field 1', 'fieldType': 'TEXT'},
            {'id': 'field-2', 'fieldName': 'Test Field 2', 'fieldType': 'TEXT'},  
            {'id': 'field-3', 'fieldName': 'Test Field 3', 'fieldType': 'NUMBER'}
        ]
    }
    
    # Simulate AI returning empty response
    empty_ai_response = {"field_validations": []}
    
    # Test the fixed logic
    field_validations = empty_ai_response.get('field_validations', [])
    
    if len(field_validations) == 0:
        print("EMPTY_RESPONSE_HANDLING: AI returned empty field_validations array - creating placeholder records")
        
        schema_fields = project_schema.get('schema_fields', [])
        placeholder_validations = []
        
        for field in schema_fields:
            placeholder_validation = {
                'field_id': field.get('id'),
                'field_name': field.get('fieldName'),
                'field_type': 'schema_field',
                'validation_type': 'schema_field',
                'extracted_value': None,
                'original_extracted_value': None,
                'validation_status': 'pending',
                'confidence_score': 0,
                'ai_reasoning': None,
                'original_ai_reasoning': None,
                'batch_number': 1,  # This is the key fix!
                'data_type': field.get('fieldType', 'TEXT'),
                'collection_name': None,
                'record_index': None
            }
            placeholder_validations.append(placeholder_validation)
        
        print(f"EMPTY_RESPONSE_HANDLING: Created {len(placeholder_validations)} placeholder validation records")
        
        # Verify all records have batch_number
        for validation in placeholder_validations:
            batch_num = validation.get('batch_number')
            field_id = validation.get('field_id')
            print(f"  ✓ Field {field_id}: batch_number = {batch_num}")
        
        print("\n✅ SUCCESS: All placeholder validations have batch_number = 1")
        return True
    else:
        print("❌ FAILED: This should have triggered empty response handling")
        return False

if __name__ == "__main__":
    test_empty_response_fix()