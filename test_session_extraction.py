#!/usr/bin/env python3

import os
import sys
import json
import logging
from ai_extraction_simplified import step1_extract_from_documents

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

def test_session_extraction():
    """Test extraction on the problematic session 765e0111-a31e-41e2-9c38-7dfe3e8ffccd"""
    
    # Sample document content from the session (truncated)
    document_content = """Here's a transcription of the provided PDF document.  Note that the tables' formatting may not be perfectly reproduced due to variations in the original document's structure:

**CAP Strategic Plan for Malta 2023-2027**

**Version 3.1**

**5 Direct payments, sectoral and rural development interventions specified in the strategy**

| Fund | Form of Intervention | Type of Intervention | Intervention Code (MS) - Name | Carry-over | Common Gen. Output Indicator | Env. ES | LEADER | Renewal rebate system |
|---|---|---|---|---|---|---|---|---|
| EAGF | Decoupled Direct Payments | BISS(21) | DP BISS - Direct Payments (Basic Income Support for Sustainability) | 0.4 | 0.4 |  |  |  |
| EAGF | Decoupled Direct Payments | BISS(21) | DP BISS SF - Direct Payments (Basic Income Support for Sustainability for Small Farmers) | 0.5 | 0.5 |  |  |  |
| EAGF | Decoupled Direct Payments | BISS | DP CIS-YF - Direct Payments (Complementary income support for young farmers) | 0.6 | 0.6 |  |  |  |
| EAGF | Decoupled Direct Payments | ECO | DP ECO-Biodeg Mulch - Direct Payments (Eco-scheme: Biodegradable mulch) | 0.7 | 0.7 |  |  |  |
| EAGF | Decoupled Direct Payments | ECO | DP ECO-BDW - Eco-scheme: Bovine Dairy Welfare Scheme | 0.8 | 0.8 |  |  |  |
| EAGF | Decoupled Direct Payments | ECO | DP ECO-Biodiversity - Direct Payments (Eco-scheme) Land parcels dedicated for biodiversity | 0.9 | 0.9 |  |  |  |"""
    
    # Test documents array
    test_documents = [{
        "file_name": "CAPSP-MT-2023_2027_V3.1_red_red 22.09.09.pdf",
        "file_content": document_content,
        "mime_type": "application/pdf"
    }]
    
    # Sample schema for CSP interventions (with all required IDs)
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
    
    print("Testing session 765e0111-a31e-41e2-9c38-7dfe3e8ffccd extraction with enhanced prompts...")
    print("Document contains DP codes: DP BISS, DP BISS SF, DP CIS-YF, DP ECO-Biodeg Mulch, DP ECO-BDW, DP ECO-Biodiversity")
    
    # Run extraction
    try:
        result = step1_extract_from_documents(
            documents=test_documents,
            project_schema=sample_schema,
            extraction_rules=[]
        )
        
        if result.success and result.extracted_data:
            # Extract field_validations from the result
            field_validations = result.extracted_data.get('field_validations', [])
            
            # Count CSP intervention items
            csp_items = []
            for validation in field_validations:
                if (validation.get('field_type') == 'collection_property' and 
                    validation.get('field_name', '').startswith('CSP Interventions.Code Intervention[')):
                    csp_items.append({
                        'record_index': validation.get('record_index'),
                        'code': validation.get('extracted_value'),
                        'confidence': validation.get('confidence_score')
                    })
            
            print(f"\n✅ SUCCESS: AI extracted {len(csp_items)} CSP intervention items:")
            for item in sorted(csp_items, key=lambda x: x['record_index']):
                print(f"  - Record {item['record_index']}: {item['code']} ({item['confidence']*100:.0f}% confidence)")
            
            if len(csp_items) >= 4:  # Should extract at least 4-6 different DP codes
                print(f"\n✅ TEST PASSED: Found multiple DP codes as expected")
                return True
            else:
                print(f"\n❌ TEST FAILED: Expected multiple CSP codes, but only got {len(csp_items)} items")
                print("This indicates the AI might still be missing some intervention codes")
                return False
                
        else:
            print(f"\n❌ EXTRACTION FAILED: {result.error_message}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    test_session_extraction()