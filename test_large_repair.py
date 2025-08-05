#!/usr/bin/env python3
"""
Test script to verify the truncation repair function works with large responses
"""
import json
import logging
from ai_extraction_simplified import repair_truncated_json

logging.basicConfig(level=logging.INFO)

# Create a large truncated response with many field validations
def create_validation(index):
    return f'''    {{
      "field_id": "0fb1c324-68ea-491e-a7fd-f9587e6d504c",
      "validation_type": "collection_property",
      "data_type": "TEXT", 
      "field_name": "Data Fields.Field Type[{index}]",
      "collection_name": "Data Fields",
      "extracted_value": "Text",
      "confidence_score": 1.0,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from the header row of sheet"
    }}'''

# Build a large response with 50 field validations that gets truncated
large_response = '{\n  "field_validations": [\n'

for i in range(50):
    validation = create_validation(i)
    large_response += validation
    if i < 49:  # Add comma except for last item
        large_response += ','
    large_response += '\n'

# Simulate truncation by cutting off in the middle of the last validation
large_response = large_response[:-200]  # Remove end to simulate truncation

print("Testing large truncation repair...")
print(f"Original response length: {len(large_response)}")
print(f"Response ends with: ...{large_response[-100:]}")

# Test the repair function
repaired = repair_truncated_json(large_response)

if repaired:
    print("Repair successful!")
    print(f"Repaired response length: {len(repaired)}")
    
    try:
        parsed = json.loads(repaired)
        print(f"Successfully parsed repaired JSON!")
        print(f"Field validations found: {len(parsed.get('field_validations', []))}")
        
        # Show first and last few validations
        validations = parsed.get('field_validations', [])
        print(f"First validation: {validations[0].get('field_name', 'Unknown') if validations else 'None'}")
        if len(validations) > 1:
            print(f"Last validation: {validations[-1].get('field_name', 'Unknown')}")
            
    except json.JSONDecodeError as e:
        print(f"Failed to parse repaired JSON: {e}")
else:
    print("Repair failed")