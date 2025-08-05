#!/usr/bin/env python3
"""
Test the truncation repair functionality to ensure it's working correctly
"""
import json
import sys
import os
import importlib.util

def test_repair_function():
    """Test the repair_truncated_json function with various truncated responses"""
    
    # Load the AI extraction module
    spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction_simplified.py")
    ai_extraction = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ai_extraction)
    
    print("🧪 Testing truncation repair functionality...")
    
    # Test Case 1: Truncated response with one complete and one incomplete object
    test_case_1 = '''{"field_validations": [
    {
      "field_id": "123",
      "field_name": "Policy Number",
      "field_type": "TEXT",
      "extracted_value": "POL12345",
      "confidence": 0.95,
      "ai_reasoning": "Found in header"
    },
    {
      "field_id": "456",
      "field_name": "Effective Date",
      "field_type": "DATE", 
      "extracted_value": "2023-01-01",
      "confidence": 0.85,
      "ai_reasoning": "Extracted from'''
    
    print("\n📋 Test Case 1: Truncated response with incomplete last object")
    result_1 = ai_extraction.repair_truncated_json(test_case_1)
    if result_1:
        try:
            parsed = json.loads(result_1)
            print(f"✅ Successfully repaired - got {len(parsed['field_validations'])} objects")
            print(f"   Last complete object: {parsed['field_validations'][-1]['field_name']}")
        except:
            print("❌ Repair failed - invalid JSON")
    else:
        print("❌ Repair returned None")
    
    # Test Case 2: Response with multiple complete objects but missing closing brace
    test_case_2 = '''{"field_validations": [
    {
      "field_id": "111",
      "field_name": "Insurer Name", 
      "field_type": "TEXT",
      "extracted_value": "Allianz",
      "confidence": 0.98,
      "ai_reasoning": "Company name found"
    },
    {
      "field_id": "222",
      "field_name": "Policy Amount",
      "field_type": "CURRENCY",
      "extracted_value": "$50,000",
      "confidence": 0.92,
      "ai_reasoning": "Amount clearly stated"
    },
    {
      "field_id": "333",
      "field_name": "Expiration",
      "field_type": "DATE",
      "extracted_value": "2024-12-31",
      "confidence": 0.88,
      "ai_reasoning": "Date found in coverage section"
    }
  ]'''
    
    print("\n📋 Test Case 2: Missing closing brace")
    result_2 = ai_extraction.repair_truncated_json(test_case_2)
    if result_2:
        try:
            parsed = json.loads(result_2)
            print(f"✅ Successfully repaired - got {len(parsed['field_validations'])} objects")
        except:
            print("❌ Repair failed - invalid JSON")
    else:
        print("❌ Repair returned None")
        
    # Test Case 3: Completely broken response
    test_case_3 = '''This is not JSON at all, just plain text response from the AI'''
    
    print("\n📋 Test Case 3: Non-JSON response")
    result_3 = ai_extraction.repair_truncated_json(test_case_3)
    if result_3:
        print("❌ Should have returned None for non-JSON")
    else:
        print("✅ Correctly returned None for non-JSON")
        
    # Test Case 4: Response with field_validations key but malformed structure
    test_case_4 = '''{"field_validations": [
    {
      "field_id": "444",
      "field_name": "Test Field",
      "field_type": "TEXT"
      missing comma and closing'''
      
    print("\n📋 Test Case 4: Malformed structure")
    result_4 = ai_extraction.repair_truncated_json(test_case_4)
    if result_4:
        print("❌ Should not have successfully repaired malformed structure")
    else:
        print("✅ Correctly identified malformed structure")
        
    print("\n🏁 Truncation repair tests completed!")
    
    return True

if __name__ == "__main__":
    success = test_repair_function()
    sys.exit(0 if success else 1)