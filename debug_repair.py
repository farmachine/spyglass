#!/usr/bin/env python3
"""
Debug the repair function to understand why it's not working with the test data
"""
from ai_extraction_simplified import repair_truncated_json

# Create a simple truncated response to debug
test_response = '''
{
  "field_validations": [
    {
      "field_id": "field-001",
      "validation_type": "schema_field",
      "data_type": "TEXT",
      "field_name": "Test Field 1",
      "extracted_value": "Test Value 1",
      "confidence_score": 0.95
    },
    {
      "field_id": "field-002",
      "validation_type": "collection_property",
      "data_type": "TEXT", 
      "field_name": "Test Field 2",
      "extracted_value": "Test Value 2",
      "confidence_sco'''

print("Testing simple truncated response...")
print(f"Response length: {len(test_response)}")
print("Response content:")
print(test_response)
print("\n" + "="*50 + "\n")

result = repair_truncated_json(test_response)
if result:
    print("Repair successful!")
    print(f"Repaired length: {len(result)}")
    print("Repaired content:")
    print(result)
else:
    print("Repair failed!")