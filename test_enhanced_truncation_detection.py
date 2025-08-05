#!/usr/bin/env python3
"""
Test Enhanced 3-Tier Truncation Detection System
Validates that the system prioritizes AI response structure analysis over field counting
"""

import sys
import os
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_extraction_simplified import detect_truncation

def test_tier_1_json_structure_detection():
    """Test Tier 1: JSON Structure Analysis (PRIMARY)"""
    print("=== TESTING TIER 1: JSON STRUCTURE ANALYSIS ===")
    
    # Test 1.1: Response doesn't end with closing brace
    response_1 = '{"field_validations": [{"field_id": "test"'
    result = detect_truncation(response_1, None, None)
    assert result["is_truncated"] == True
    assert result["detection_method"] == "json_structure"
    assert "closing brace" in result["reason"]
    print("✅ Test 1.1 PASSED: Detects missing closing brace")
    
    # Test 1.2: Response with incomplete field pattern
    response_2 = '{"field_validations": [{"field_id": "test", "validation_type"'
    result = detect_truncation(response_2, None, None)
    assert result["is_truncated"] == True
    assert result["detection_method"] == "json_structure"
    print("✅ Test 1.2 PASSED: Detects incomplete field patterns")
    
    # Test 1.3: Valid complete JSON should NOT be flagged by Tier 1
    response_3 = '{"field_validations": [{"field_id": "test", "validation_type": "schema_field", "data_type": "TEXT", "field_name": "Test"}]}'
    result = detect_truncation(response_3, None, None)
    assert result["is_truncated"] == False
    print("✅ Test 1.3 PASSED: Valid JSON not flagged by Tier 1")

def test_tier_2_collection_completeness_analysis():
    """Test Tier 2: Collection Completeness Analysis (SECONDARY)"""
    print("\n=== TESTING TIER 2: COLLECTION COMPLETENESS ANALYSIS ===")
    
    # Simulate project schema with one collection
    project_schema = {
        "schema_fields": [{"fieldName": "Main Field", "fieldType": "TEXT", "id": "main-field"}],
        "collections": [
            {
                "collectionName": "Test Items", 
                "properties": [
                    {"propertyName": "Name", "propertyType": "TEXT", "id": "name-prop"},
                    {"propertyName": "Value", "propertyType": "TEXT", "id": "value-prop"}
                ]
            }
        ]
    }
    
    # Test 2.1: Complete collection items (should NOT be truncated)
    complete_response = {
        "field_validations": [
            # Schema field
            {"field_id": "main-field", "validation_type": "schema_field", "data_type": "TEXT", "field_name": "Main Field"},
            # Complete collection items (10 items, each with 2 properties)
        ]
    }
    
    # Add complete collection items
    for i in range(10):
        complete_response["field_validations"].extend([
            {"field_id": "name-prop", "validation_type": "collection_property", "collection_name": "Test Items", "item_index": i, "data_type": "TEXT", "field_name": "Name"},
            {"field_id": "value-prop", "validation_type": "collection_property", "collection_name": "Test Items", "item_index": i, "data_type": "TEXT", "field_name": "Value"}
        ])
    
    result = detect_truncation(json.dumps(complete_response), None, project_schema)
    assert result["is_truncated"] == False
    print("✅ Test 2.1 PASSED: Complete collection items not flagged as truncated")
    
    # Test 2.2: Incomplete collection items (should be detected as truncated)
    incomplete_response = {
        "field_validations": [
            # Schema field
            {"field_id": "main-field", "validation_type": "schema_field", "data_type": "TEXT", "field_name": "Main Field"},
            # Incomplete collection: 10 complete items + 1 incomplete item (only 1 of 2 properties)
        ]
    }
    
    # Add 10 complete items
    for i in range(10):
        incomplete_response["field_validations"].extend([
            {"field_id": "name-prop", "validation_type": "collection_property", "collection_name": "Test Items", "item_index": i, "data_type": "TEXT", "field_name": "Name"},
            {"field_id": "value-prop", "validation_type": "collection_property", "collection_name": "Test Items", "item_index": i, "data_type": "TEXT", "field_name": "Value"}
        ])
    
    # Add 1 incomplete item (missing second property - indicates truncation)
    incomplete_response["field_validations"].append(
        {"field_id": "name-prop", "validation_type": "collection_property", "collection_name": "Test Items", "item_index": 10, "data_type": "TEXT", "field_name": "Name"}
    )
    
    result = detect_truncation(json.dumps(incomplete_response), None, project_schema)
    assert result["is_truncated"] == True
    assert result["detection_method"] == "collection_completeness"
    assert ("incomplete final item" in result["reason"]) or ("completeness" in result["reason"])
    print("✅ Test 2.2 PASSED: Incomplete collection items detected as truncated")

def test_tier_3_field_count_comparison():
    """Test Tier 3: Field Count Comparison (TERTIARY)"""
    print("\n=== TESTING TIER 3: FIELD COUNT COMPARISON ===")
    
    # Test 3.1: Field count significantly below expected (should be truncated)
    low_count_response = '{"field_validations": [{"field_id": "test1", "validation_type": "schema_field", "data_type": "TEXT", "field_name": "Test1"}]}'
    result = detect_truncation(low_count_response, expected_field_count=100, project_schema=None)
    assert result["is_truncated"] == True
    assert result["detection_method"] == "field_count"
    print("✅ Test 3.1 PASSED: Low field count detected as truncated")
    
    # Test 3.2: Field count within acceptable range (should NOT be truncated)
    acceptable_response = '{"field_validations": []}'
    # Add 85 validations (85 out of 100 expected = 85% which is > 80% threshold)
    validations = []
    for i in range(85):
        validations.append({"field_id": f"test-{i}", "validation_type": "schema_field", "data_type": "TEXT", "field_name": f"Test {i}"})
    
    acceptable_response = json.dumps({"field_validations": validations})
    result = detect_truncation(acceptable_response, expected_field_count=100, project_schema=None)
    assert result["is_truncated"] == False
    print("✅ Test 3.2 PASSED: Acceptable field count not flagged as truncated")

def test_detection_method_priority():
    """Test that higher tier methods take priority over lower tier methods"""
    print("\n=== TESTING DETECTION METHOD PRIORITY ===")
    
    # Create a response that would trigger Tier 3 (field count) but should be caught by Tier 1 (JSON structure)
    incomplete_json = '{"field_validations": [{"field_id": "test"'  # Incomplete JSON
    
    result = detect_truncation(incomplete_json, expected_field_count=1000, project_schema=None)
    
    # Should be detected by Tier 1 (JSON structure), not Tier 3 (field count)
    assert result["is_truncated"] == True
    assert result["detection_method"] == "json_structure"
    print("✅ PRIORITY TEST PASSED: Tier 1 takes priority over Tier 3")

def test_batch_continuation_guidance():
    """Test that truncation detection provides guidance for batch continuation"""
    print("\n=== TESTING BATCH CONTINUATION GUIDANCE ===")
    
    project_schema = {
        "collections": [
            {
                "collectionName": "Large Dataset",
                "properties": [
                    {"propertyName": "Field1", "propertyType": "TEXT"},
                    {"propertyName": "Field2", "propertyType": "TEXT"}
                ]
            }
        ]
    }
    
    # Create incomplete collection response
    incomplete_items = {
        "field_validations": []
    }
    
    # Add 50 complete items + 1 incomplete item
    for i in range(50):
        incomplete_items["field_validations"].extend([
            {"field_id": "f1", "validation_type": "collection_property", "collection_name": "Large Dataset", "item_index": i, "data_type": "TEXT", "field_name": "Field1"},
            {"field_id": "f2", "validation_type": "collection_property", "collection_name": "Large Dataset", "item_index": i, "data_type": "TEXT", "field_name": "Field2"}
        ])
    
    # Add incomplete item (triggers truncation)
    incomplete_items["field_validations"].append(
        {"field_id": "f1", "validation_type": "collection_property", "collection_name": "Large Dataset", "item_index": 50, "data_type": "TEXT", "field_name": "Field1"}
    )
    
    result = detect_truncation(json.dumps(incomplete_items), None, project_schema)
    
    assert result["is_truncated"] == True
    assert result["missing_validations"] > 0
    assert result["batch_size"] > 0
    print("✅ BATCH GUIDANCE TEST PASSED: Provides continuation guidance")

def run_all_tests():
    """Run all truncation detection tests"""
    print("🧪 STARTING ENHANCED 3-TIER TRUNCATION DETECTION TESTS\n")
    
    try:
        test_tier_1_json_structure_detection()
        test_tier_2_collection_completeness_analysis()
        test_tier_3_field_count_comparison()
        test_detection_method_priority()
        test_batch_continuation_guidance()
        
        print("\n🎉 ALL TESTS PASSED! Enhanced 3-Tier Truncation Detection System is working correctly.")
        print("\nSYSTEM SUMMARY:")
        print("✅ Tier 1 (JSON Structure) - Highest Priority: Detects malformed/incomplete JSON")
        print("✅ Tier 2 (Collection Completeness) - Medium Priority: Analyzes collection item completeness")
        print("✅ Tier 3 (Field Count) - Fallback Priority: Compares actual vs expected field counts")
        print("✅ Method Prioritization: Higher tiers take precedence over lower tiers")
        print("✅ Batch Continuation: Provides guidance for missing validation retrieval")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n💥 TEST ERROR: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)