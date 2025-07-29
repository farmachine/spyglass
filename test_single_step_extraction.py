#!/usr/bin/env python3
"""
Test script for single-step extraction system
Tests party counting accuracy and extraction rule application
"""

import json
import sys
from ai_extraction_single_step import extract_and_create_validations

def test_single_step_extraction():
    """Test single-step extraction with focus on party counting"""
    
    # Mock document content simulating the real 8-document session
    mock_documents = [
        {
            "file_name": "document1.pdf",
            "file_content": """
            CONTRACT DOCUMENT 1
            
            This Non-Disclosure Agreement is between:
            - ABC Corporation, Inc. (Delaware)
            - XYZ Company (California) 
            - 3M Company (Minnesota)
            - Tech Solutions Ltd. (New York)
            """,
            "mime_type": "text/plain"
        },
        {
            "file_name": "document2.pdf", 
            "file_content": """
            CONTRACT DOCUMENT 2
            
            Parties to this agreement:
            - Microsoft Corporation (Washington)
            - Apple Inc. (California)
            - Google LLC (California)
            - Amazon.com, Inc. (Washington)
            - Meta Platforms, Inc. (Delaware)
            """,
            "mime_type": "text/plain"
        },
        {
            "file_name": "document3.pdf",
            "file_content": """
            CONTRACT DOCUMENT 3
            
            Agreement between:
            - IBM Corporation (New York)
            - Oracle Corporation (Texas)  
            - Salesforce.com, Inc. (California)
            - Adobe Inc. (California)
            """,
            "mime_type": "text/plain"
        }
    ]
    
    # Project schema matching the real project structure
    project_schema = {
        "schema_fields": [
            {
                "fieldName": "Number of Parties",
                "fieldType": "NUMBER",
                "description": "Count the total number of unique companies/organizations/parties across ALL documents. Include every company mentioned as a party to any agreement. This should be a comprehensive count of all business entities involved."
            },
            {
                "fieldName": "Number of NDAs", 
                "fieldType": "NUMBER",
                "description": "Count the total number of Non-Disclosure Agreements across ALL documents. Count each separate NDA document or agreement."
            }
        ],
        "collections": [
            {
                "collectionName": "Parties",
                "description": "Extract ALL unique companies/organizations that are parties to any agreement across ALL documents. Be comprehensive and thorough.",
                "properties": [
                    {
                        "propertyName": "Name",
                        "propertyType": "TEXT", 
                        "description": "Full legal name of the company or organization"
                    },
                    {
                        "propertyName": "Address",
                        "propertyType": "TEXT",
                        "description": "Business address or location of the organization"
                    },
                    {
                        "propertyName": "Country",
                        "propertyType": "TEXT",
                        "description": "Country where the organization is located or incorporated"
                    }
                ]
            }
        ]
    }
    
    # Extraction rules including the Inc. rule
    extraction_rules = [
        {
            "id": "rule1",
            "ruleName": "Company Inc. Names",
            "ruleContent": "If company name ends with 'Inc.' set confidence to 27%",
            "targetField": ["Parties --> Name"],
            "isActive": True
        }
    ]
    
    # Knowledge documents for conflict detection
    knowledge_documents = [
        {
            "displayName": "Contract Review Guidelines",
            "content": "All U.S. jurisdiction contracts require legal review for compliance verification.",
            "fileName": "guidelines.pdf"
        }
    ]
    
    print("Starting single-step extraction test...")
    print(f"Processing {len(mock_documents)} documents")
    print(f"Schema fields: {len(project_schema['schema_fields'])}")
    print(f"Collections: {len(project_schema['collections'])}")
    print(f"Extraction rules: {len(extraction_rules)}")
    
    # Call single-step extraction
    result = extract_and_create_validations(
        documents=mock_documents,
        project_schema=project_schema,
        extraction_rules=extraction_rules,
        knowledge_documents=knowledge_documents,
        session_id="test-session-123"
    )
    
    if not result.success:
        print(f"FAILED: {result.error_message}")
        return False
    
    print(f"\nSUCCESS: {result.documents_processed} documents processed")
    print(f"Field validations created: {len(result.field_validations)}")
    
    # Analyze results
    party_count_validation = None
    nda_count_validation = None
    party_name_validations = []
    
    for validation in result.field_validations:
        field_name = validation.get('field_name', '')
        extracted_value = validation.get('extracted_value')
        confidence = validation.get('validation_confidence')
        
        print(f"\nField: {field_name}")
        print(f"Value: {extracted_value}")  
        print(f"Confidence: {confidence}%")
        print(f"Status: {validation.get('validation_status')}")
        print(f"Reasoning: {validation.get('ai_reasoning', '')[:100]}...")
        
        if field_name == "Number of Parties":
            party_count_validation = validation
        elif field_name == "Number of NDAs":
            nda_count_validation = validation
        elif "Parties.Name[" in field_name:
            party_name_validations.append(validation)
    
    # Validate party counting
    expected_parties = 13  # 4 + 5 + 4 from the mock documents
    if party_count_validation:
        actual_count = party_count_validation.get('extracted_value')
        print(f"\n=== PARTY COUNTING TEST ===")
        print(f"Expected parties: {expected_parties}")
        print(f"AI counted parties: {actual_count}")
        print(f"Confidence: {party_count_validation.get('validation_confidence')}%")
        
        if str(actual_count) == str(expected_parties):
            print("✅ PARTY COUNTING: CORRECT")
        else:
            print("❌ PARTY COUNTING: INCORRECT")
    
    # Validate extraction rule application
    inc_company_validations = [v for v in party_name_validations 
                              if v.get('extracted_value', '').endswith('Inc.')]
    
    print(f"\n=== EXTRACTION RULE TEST ===")
    print(f"Inc. companies found: {len(inc_company_validations)}")
    
    rule_applied_correctly = True
    for validation in inc_company_validations:
        confidence = validation.get('validation_confidence')
        company_name = validation.get('extracted_value')
        print(f"Company: {company_name}, Confidence: {confidence}%")
        
        if confidence != 27:
            print(f"❌ RULE ERROR: {company_name} should have 27% confidence, got {confidence}%")
            rule_applied_correctly = False
    
    if rule_applied_correctly and inc_company_validations:
        print("✅ EXTRACTION RULES: CORRECTLY APPLIED")
    elif inc_company_validations:
        print("❌ EXTRACTION RULES: INCORRECTLY APPLIED")
    else:
        print("⚠️ EXTRACTION RULES: NO INC. COMPANIES TO TEST")
    
    # Validate field validation structure
    print(f"\n=== VALIDATION STRUCTURE TEST ===")
    required_fields = ['field_name', 'field_type', 'validation_status', 'validation_confidence', 'ai_reasoning']
    
    structure_valid = True
    for validation in result.field_validations[:3]:  # Check first 3
        for field in required_fields:
            if field not in validation:
                print(f"❌ MISSING FIELD: {field} in validation {validation.get('field_name')}")
                structure_valid = False
    
    if structure_valid:
        print("✅ VALIDATION STRUCTURE: CORRECT")
    else:
        print("❌ VALIDATION STRUCTURE: INCORRECT")
    
    return result.success

if __name__ == "__main__":
    success = test_single_step_extraction()
    if success:
        print("\n🎉 SINGLE-STEP EXTRACTION TEST: PASSED")
        sys.exit(0)
    else:
        print("\n💥 SINGLE-STEP EXTRACTION TEST: FAILED")
        sys.exit(1)