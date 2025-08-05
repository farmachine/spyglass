#!/usr/bin/env python3
"""
Test script to verify the truncation repair function works correctly
"""
import json
import logging
from ai_extraction_simplified import repair_truncated_json

logging.basicConfig(level=logging.INFO)

# Simulate a truncated response like what we saw in the logs
truncated_response = '''
{
  "field_validations": [
    {
      "field_id": "988737fa-0df4-43aa-8457-640df86914cc",
      "validation_type": "schema_field",
      "data_type": "TEXT",
      "field_name": "Description",
      "extracted_value": "This data represents a comprehensive snapshot of a defined benefit pension scheme's membership",
      "confidence_score": 1.0,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from the header row of the spreadsheet data"
    },
    {
      "field_id": "0fb1c324-68ea-491e-a7fd-f9587e6d504c",
      "validation_type": "collection_property", 
      "data_type": "TEXT",
      "field_name": "Data Fields.Field Type[0]",
      "collection_name": "Data Fields",
      "extracted_value": "Text",
      "confidence_score": 1.0,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from the header row of the 'Pensioners' sheet"
    },
    {
      "field_id": "d35ab7bb-48e2-41ab-be2a-f666ea365dcb",
      "validation_type": "collection_property",
      "data_type": "TEXT", 
      "field_name": "Data Fields.Field Name[1]",
      "collection_name": "Data Fields",
      "extracted_value": "Status",
      "confidence_score": 1.0,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from the header row of the 'Pensioners' sheet. The field name 'Status' and the text data in the column indicate a Text data type."
'''

print("Testing truncation repair...")
print(f"Original response length: {len(truncated_response)}")

# Test the repair function
repaired = repair_truncated_json(truncated_response)

if repaired:
    print("Repair successful!")
    print(f"Repaired response length: {len(repaired)}")
    
    try:
        parsed = json.loads(repaired)
        print(f"Successfully parsed repaired JSON!")
        print(f"Field validations found: {len(parsed.get('field_validations', []))}")
        
        for i, validation in enumerate(parsed.get('field_validations', [])[:3]):
            field_name = validation.get('field_name', 'Unknown')
            value = validation.get('extracted_value', 'None')
            print(f"  {i+1}. {field_name}: {str(value)[:50]}...")
            
    except json.JSONDecodeError as e:
        print(f"Failed to parse repaired JSON: {e}")
else:
    print("Repair failed")