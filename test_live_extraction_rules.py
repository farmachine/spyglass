#!/usr/bin/env python3
"""
Test script to debug why extraction rules aren't working during live processing
"""

import sys
import json
import subprocess
sys.path.append('.')

from ai_extraction import calculate_knowledge_based_confidence

def test_live_extraction_rules():
    """Test the extraction rules function with the exact data from recent extraction"""
    
    # Get extraction rules from the project
    project_id = "6b7df858-0ece-4c32-8d38-c2ced2c58e33"
    rules_result = subprocess.run(f'curl -s "http://localhost:5000/api/projects/{project_id}/rules"', shell=True, capture_output=True, text=True)
    extraction_rules = json.loads(rules_result.stdout)
    
    print(f"🔍 Found {len(extraction_rules)} extraction rules:")
    for rule in extraction_rules:
        print(f"  - {rule['ruleName']}: {rule['targetField']} -> {rule['ruleContent']}")
    
    # Get knowledge documents
    knowledge_result = subprocess.run(f'curl -s "http://localhost:5000/api/projects/{project_id}/knowledge"', shell=True, capture_output=True, text=True)
    knowledge_documents = json.loads(knowledge_result.stdout)
    
    print(f"📚 Found {len(knowledge_documents)} knowledge documents")
    
    # Test with the exact field name and value from the screenshot
    test_cases = [
        ("Parties.Name[9]", "FSC CT, Inc."),  # Exact field name format from extraction
        ("Parties.Name", "FSC CT, Inc."),     # Without index
        ("Name", "FSC CT, Inc."),             # Simple field name
    ]
    
    print("\n🧪 Testing extraction rules with different field name formats:")
    print("-" * 70)
    
    for field_name, extracted_value in test_cases:
        print(f"\nTesting: {field_name} = '{extracted_value}'")
        
        confidence, applied_rules = calculate_knowledge_based_confidence(
            field_name, extracted_value, 95, extraction_rules, knowledge_documents
        )
        
        print(f"  Result: {confidence}% confidence")
        if applied_rules:
            print(f"  Applied rules:")
            for rule in applied_rules:
                print(f"    - {rule['name']}: {rule['action']}")
        else:
            print(f"  ❌ No rules applied!")
    
    # Test the extraction rule matching logic in detail
    print(f"\n🔧 DETAILED FIELD MATCHING DEBUG:")
    print("-" * 70)
    
    inc_rule = None
    for rule in extraction_rules:
        if "inc" in rule['ruleName'].lower():
            inc_rule = rule
            break
    
    if inc_rule:
        print(f"Inc. Rule: {inc_rule['ruleName']}")
        print(f"Target Field: '{inc_rule['targetField']}'")
        print(f"Rule Content: '{inc_rule['ruleContent']}'")
        print(f"Is Active: {inc_rule['isActive']}")
        
        # Test field matching logic
        target_field = inc_rule['targetField']
        test_field = "Parties.Name[9]"
        
        target_fields = [f.strip() for f in target_field.split(',')]
        print(f"\nTarget fields after split: {target_fields}")
        
        for target in target_fields:
            target = target.strip()
            normalized_target = target.replace(' --> ', '.').replace('-->', '.')
            print(f"Original target: '{target}' -> Normalized: '{normalized_target}'")
            
            # Test matching conditions
            exact_match = test_field == normalized_target
            starts_with_bracket = test_field.startswith(normalized_target + '[')
            starts_with_dot = test_field.startswith(normalized_target + '.')
            contains_target = normalized_target in test_field
            
            print(f"  Testing '{test_field}' against '{normalized_target}':")
            print(f"    - Exact match: {exact_match}")
            print(f"    - Starts with bracket: {starts_with_bracket}")
            print(f"    - Starts with dot: {starts_with_dot}")
            print(f"    - Contains target: {contains_target}")
            
            field_matches = exact_match or starts_with_bracket or starts_with_dot or contains_target
            print(f"    - OVERALL MATCH: {field_matches}")

if __name__ == "__main__":
    test_live_extraction_rules()