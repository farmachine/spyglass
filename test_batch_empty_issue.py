#!/usr/bin/env python3
"""
Test script to reproduce the batch property issue with empty AI responses
"""

import json
import logging
from ai_extraction_simplified import step1_extract_from_documents

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_empty_response_batch_handling():
    """Test what happens when AI returns empty field_validations array"""
    
    print("Testing empty AI response batch handling...")
    
    # Mock minimal project schema
    project_schema = {
        'schema_fields': [
            {
                'id': 'test-field-1',
                'field_name': 'Test Field',
                'field_type': 'TEXT',
                'description': 'Test field for empty response'
            }
        ],
        'object_collections': []
    }
    
    # Mock document content that AI will likely return empty for
    documents = [
        {
            'content': 'This is random text that has nothing to do with the schema fields.',
            'filename': 'test.txt'
        }
    ]
    
    # Mock extraction - this should trigger the empty response path
    result = step1_extract_from_documents(
        documents=documents,
        project_schema=project_schema,
        extraction_rules=[],
        knowledge_documents=[],
        session_name="test_empty"
    )
    
    print(f"Extraction Success: {result.success}")
    print(f"Field Validations Count: {len(result.extracted_data.get('field_validations', []))}")
    
    # Check if batch_number is properly set
    field_validations = result.extracted_data.get('field_validations', [])
    if field_validations:
        print("Field validations found:")
        for validation in field_validations:
            batch_num = validation.get('batch_number', 'MISSING')
            print(f"  - Field: {validation.get('field_id')}, Batch: {batch_num}")
    else:
        print("No field validations found - this is the issue!")
        print(f"Raw AI Response: {result.ai_response[:200]}...")
    
    return result

if __name__ == "__main__":
    test_empty_response_batch_handling()