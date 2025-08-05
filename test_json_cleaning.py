#!/usr/bin/env python3
"""
Test the enhanced JSON cleaning function to ensure it properly removes markdown formatting.
"""
import json
from ai_extraction_simplified import clean_gemini_response

# Test cases with various markdown formatting scenarios
test_cases = [
    {
        "name": "Clean JSON (no formatting)",
        "input": '{"field_validations": [{"field_id": "test", "extracted_value": "value"}]}',
        "expected_valid": True
    },
    {
        "name": "JSON with ```json wrapper",
        "input": '```json\n{"field_validations": [{"field_id": "test", "extracted_value": "value"}]}\n```',
        "expected_valid": True
    },
    {
        "name": "JSON with ``` wrapper only",
        "input": '```\n{"field_validations": [{"field_id": "test", "extracted_value": "value"}]}\n```',
        "expected_valid": True
    },
    {
        "name": "JSON with introductory text",
        "input": 'Here is the JSON response:\n{"field_validations": [{"field_id": "test", "extracted_value": "value"}]}',
        "expected_valid": True
    },
    {
        "name": "JSON with markdown and intro text",
        "input": 'Here is the extracted data in JSON format:\n```json\n{"field_validations": [{"field_id": "test", "extracted_value": "value"}]}\n```',
        "expected_valid": True
    },
    {
        "name": "Complex JSON with multiple field validations",
        "input": '''```json
{
  "field_validations": [
    {
      "field_id": "field-001",
      "validation_type": "schema_field",
      "data_type": "TEXT",
      "field_name": "Document Title",
      "extracted_value": "Contract Agreement",
      "confidence_score": 0.95,
      "validation_status": "unverified",
      "ai_reasoning": "Found in document header"
    },
    {
      "field_id": "field-002",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Parties.Name[0]",
      "collection_name": "Parties",
      "extracted_value": "ABC Corporation",
      "confidence_score": 1.0,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted from party information section",
      "record_index": 0
    }
  ]
}
```''',
        "expected_valid": True
    }
]

print("🧹 TESTING JSON CLEANING FUNCTION")
print("=" * 40)

total_tests = len(test_cases)
passed_tests = 0

for i, test_case in enumerate(test_cases, 1):
    print(f"\n📋 Test {i}/{total_tests}: {test_case['name']}")
    
    # Apply cleaning function
    cleaned = clean_gemini_response(test_case['input'])
    
    print(f"   Input length: {len(test_case['input'])} characters")
    print(f"   Cleaned length: {len(cleaned)} characters")
    
    # Check if the cleaned output is valid JSON
    try:
        parsed = json.loads(cleaned)
        is_valid_json = True
        field_validations = parsed.get('field_validations', [])
        validation_count = len(field_validations)
        print(f"   ✅ Valid JSON with {validation_count} field validations")
        
        # Show first few characters of cleaned output
        print(f"   Cleaned output starts with: {cleaned[:100]}...")
        
        if test_case['expected_valid']:
            passed_tests += 1
            print(f"   🎯 PASS: Successfully cleaned markdown formatting")
        else:
            print(f"   ❌ UNEXPECTED: Expected invalid but got valid JSON")
            
    except json.JSONDecodeError as e:
        is_valid_json = False
        print(f"   ❌ Invalid JSON: {e}")
        
        if not test_case['expected_valid']:
            passed_tests += 1
            print(f"   🎯 PASS: Expected invalid JSON")
        else:
            print(f"   ❌ FAIL: Expected valid JSON but got parse error")
            print(f"   Raw cleaned output: {cleaned[:200]}...")

print(f"\n📊 SUMMARY")
print(f"=" * 20)
print(f"Tests passed: {passed_tests}/{total_tests}")
print(f"Success rate: {passed_tests/total_tests*100:.1f}%")

if passed_tests == total_tests:
    print(f"🎉 All tests passed! JSON cleaning function works correctly.")
    print(f"✅ Gemini responses will now be clean JSON without markdown formatting.")
else:
    print(f"⚠️  Some tests failed. The JSON cleaning function needs further refinement.")

print(f"\n💡 The clean_gemini_response function:")
print(f"   • Removes ```json and ``` markdown wrappers")
print(f"   • Strips introductory text before JSON")
print(f"   • Finds and extracts the actual JSON content")
print(f"   • Ensures output starts with {{ and contains field_validations")