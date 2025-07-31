#!/usr/bin/env python3
"""
Test script to verify multiple CSP intervention extraction
"""
import json
import subprocess
import sys

def test_multiple_csp_extraction():
    """Test that AI extracts multiple CSP intervention codes as separate collection items"""
    
    # Sample document content with multiple DP codes (like the real document)
    sample_documents = [{
        "file_name": "test_csp_document.pdf",
        "file_content": """
        5.1 Direct payments interventions
        
        | Fund | Intervention Code | Name |
        |------|------------------|------|
        | EAGF | DP BISS | Direct Payments (Basic Income Support for Sustainability) |
        | EAGF | DP BISS SF | Direct Payments (Basic Income Support for Sustainability for Small Farmers) |
        | EAGF | DP CIS-YF | Direct Payments (Complementary income support for young farmers) |
        | EAGF | DP ECO-Biodeg Mulch | Direct Payments (Eco-scheme: Biodegradable mulch) |
        | EAGF | DP ECO-BDW | Eco-scheme: Bovine Dairy Welfare Scheme |
        | EAGF | DP ECO-Biodiversity | Direct Payments (Eco-scheme) Land parcels dedicated for biodiversity |
        """,
        "mime_type": "application/pdf"
    }]
    
    # Sample schema for CSP interventions (with required IDs)
    sample_schema = {
        "schema_fields": [
            {
                "id": "test-field-1",
                "fieldName": "Document Title",
                "fieldType": "TEXT",
                "description": "Title of the document"
            }
        ],
        "collections": [
            {
                "id": "test-collection-1",
                "collectionName": "CSP Interventions",
                "description": "List of Common Agricultural Policy Support (CSP) interventions and their associated activities/applicability. These exist in section 5.1 and begin with DP",
                "properties": [
                    {
                        "id": "test-prop-1",
                        "propertyName": "Code Intervention",
                        "propertyType": "TEXT",
                        "description": "The DP code for the CSP intervention (e.g., DP BISS, DP ECO-Biodiversity)"
                    },
                    {
                        "id": "test-prop-2",
                        "propertyName": "Description",
                        "propertyType": "TEXT", 
                        "description": "Full name/description of the intervention"
                    }
                ]
            }
        ]
    }
    
    # Sample extraction rules
    sample_rules = [
        {
            "ruleName": "Section 5",
            "ruleContent": "Only look in Section 5.1",
            "targetField": []
        }
    ]
    
    # Call the AI extraction function
    try:
        from ai_extraction_simplified import step1_extract_from_documents
        
        print("Testing multiple CSP intervention extraction...")
        print(f"Document contains 6 DP codes: DP BISS, DP BISS SF, DP CIS-YF, DP ECO-Biodeg Mulch, DP ECO-BDW, DP ECO-Biodiversity")
        
        result = step1_extract_from_documents(
            documents=sample_documents,
            project_schema=sample_schema,
            extraction_rules=sample_rules,
            session_name="CSP Test"
        )
        
        if result.success:
            field_validations = result.extracted_data.get("field_validations", [])
            
            # Count CSP intervention collection items
            csp_items = {}
            for validation in field_validations:
                if (validation.get("field_type") == "collection_property" and 
                    validation.get("collection_name") == "CSP Interventions"):
                    record_index = validation.get("record_index", 0)
                    if record_index not in csp_items:
                        csp_items[record_index] = {}
                    
                    field_name = validation.get("field_name", "")
                    if "Code Intervention" in field_name:
                        csp_items[record_index]["code"] = validation.get("extracted_value")
                    elif "Description" in field_name:
                        csp_items[record_index]["description"] = validation.get("extracted_value")
            
            print(f"\n✅ SUCCESS: AI extracted {len(csp_items)} CSP intervention items:")
            for idx, item in csp_items.items():
                code = item.get("code", "Unknown")
                desc = item.get("description", "Unknown")
                print(f"  Item {idx}: {code} - {desc}")
            
            # Check if we got multiple items (expected: 6)
            if len(csp_items) >= 4:  # At least 4 of the 6 codes should be found
                print(f"\n🎉 TEST PASSED: AI correctly extracted multiple CSP intervention codes as separate collection items!")
                return True
            else:
                print(f"\n❌ TEST FAILED: Expected multiple CSP codes, but only got {len(csp_items)} items")
                print("This indicates the AI is still combining multiple codes into single items")
                return False
        else:
            print(f"❌ Extraction failed: {result.error_message}")
            return False
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False

if __name__ == "__main__":
    success = test_multiple_csp_extraction()
    sys.exit(0 if success else 1)