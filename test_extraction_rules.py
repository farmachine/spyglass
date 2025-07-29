#!/usr/bin/env python3
"""
Test script to verify extraction rules are working correctly
"""

import sys
import os
sys.path.append('.')

from ai_extraction import calculate_knowledge_based_confidence

def test_extraction_rules():
    """Test extraction rules with sample data"""
    
    # Sample extraction rules from the database
    extraction_rules = [
        {
            "id": "76282c21-cd27-48c3-9f67-4d48fdbda06b",
            "projectId": "6b7df858-0ece-4c32-8d38-c2ced2c58e33",
            "ruleName": "In",
            "targetField": "Parties --> Name",
            "ruleContent": "If the company name contains 'Inc.', set confidence to 27%",
            "isActive": True
        },
        {
            "id": "659c935b-538f-4811-bc65-21bb41a0c7f0",
            "projectId": "6b7df858-0ece-4c32-8d38-c2ced2c58e33",
            "ruleName": "Capital Letters",
            "targetField": "Parties --> Country",
            "ruleContent": "Capitalize extracted info",
            "isActive": True
        }
    ]
    
    # Sample knowledge documents (empty since we want to test just rules)
    knowledge_documents = []
    
    print("=== Testing Extraction Rules ===")
    
    # Test 1: Company with Inc. should get 27% confidence
    field_name = "Parties.Name[1]"
    extracted_value = "Cogent, Inc."
    confidence, applied_rules = calculate_knowledge_based_confidence(
        field_name, extracted_value, 95, extraction_rules, knowledge_documents
    )
    
    print(f"\nTest 1 - Inc. Rule:")
    print(f"Field: {field_name}")
    print(f"Value: {extracted_value}")
    print(f"Expected confidence: 27%")
    print(f"Actual confidence: {confidence}%")
    print(f"Applied rules: {applied_rules}")
    print(f"Result: {'PASS' if confidence == 27 else 'FAIL'}")
    
    # Test 2: Company without Inc. should get default 95% confidence
    field_name = "Parties.Name[0]"
    extracted_value = "3M Company"
    confidence, applied_rules = calculate_knowledge_based_confidence(
        field_name, extracted_value, 95, extraction_rules, knowledge_documents
    )
    
    print(f"\nTest 2 - No Inc. Rule:")
    print(f"Field: {field_name}")
    print(f"Value: {extracted_value}")
    print(f"Expected confidence: 95%")
    print(f"Actual confidence: {confidence}%")
    print(f"Applied rules: {applied_rules}")
    print(f"Result: {'PASS' if confidence == 95 else 'FAIL'}")
    
    # Test 3: Country field should match capitalization rule
    field_name = "Parties.Country[1]"
    extracted_value = "Delaware"
    confidence, applied_rules = calculate_knowledge_based_confidence(
        field_name, extracted_value, 95, extraction_rules, knowledge_documents
    )
    
    print(f"\nTest 3 - Capital Letters Rule:")
    print(f"Field: {field_name}")
    print(f"Value: {extracted_value}")
    print(f"Expected: Capitalization rule applied")
    print(f"Actual confidence: {confidence}%")
    print(f"Applied rules: {applied_rules}")
    print(f"Result: {'PASS' if any('Capital' in rule.get('name', '') for rule in applied_rules) else 'FAIL'}")

if __name__ == "__main__":
    test_extraction_rules()