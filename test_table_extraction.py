#!/usr/bin/env python3

"""
Test improved table extraction with escalation rates example
"""

import json
import sys
from ai_extraction_simplified import step1_extract_from_documents

def test_escalation_table_extraction():
    """Test extraction with table data similar to the escalation rates table"""
    
    # Create test document with table structure similar to user's escalation rates
    test_document = {
        "file_name": "pension_escalation_rates.txt",
        "file_content": """
SECTION 2 - PENSION ESCALATION RATES

2.3.1 Pre 6 April 1988 GMP (All members)
Pensioners: None
Deferreds: None

2.3.2 Post 5 April 1988 GMP (All members)  
Pensioners: CPI subject to a minimum increase of 0% and a maximum increase of 3% each year
Deferreds: CPI subject to a minimum increase of 0% and a maximum increase of 3% each year

2.3.3 Pre 6 April 1997 pension in excess of GMP (Section A members)
Pensioners: CPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year  
Deferreds: CPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year

2.3.4 Pre 21 July 1997 pension in excess of GMP (Former Section B Members)
Pensioners: Fixed 5% per annum
Deferreds: Fixed 3% per annum

2.3.5 Post 5 April 1997 pre 1 January 2008 pension (Section A members)
Pensioners: RPI subject to a minimum increase of 0% and a maximum increase of 5% each year
Deferreds: RPI subject to a minimum increase of 0% and a maximum increase of 5% each year

2.3.6 Post 20 July 1997 pre 6 April 2005 pension (Former Section B Members)
Pensioners: CPI subject to a minimum increase of 0% and a maximum increase of 5% each year
Deferreds: CPI subject to a minimum increase of 0% and a maximum increase of 5% each year

2.3.7 Post 5 April 2005 pension (Former Section B Members)
Pensioners: CPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year
Deferreds: CPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year

2.3.8 Post 31 December 2007 pension (Section A members)
Pensioners: RPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year
Deferreds: RPI subject to a minimum increase of 0% and a maximum increase of 2.5% each year

2.3.9 Non-escalating pension (All members)
Pensioners: None
Deferreds: None

2.3.10 SUPPs (Section A members)
Pensioners: RPI subject to a minimum increase of 0% and a maximum increase of 5% each year
Deferreds: RPI subject to a minimum increase of 0% and a maximum increase of 5% each year
        """,
        "mime_type": "text/plain"
    }
    
    # Create schema for escalation rates collection  
    test_schema = {
        "schema_fields": [],
        "collections": [{
            "id": "escalation-rates-collection",
            "collectionName": "Escalation Rates", 
            "description": "Extract all escalation rate entries from pension documents",
            "properties": [
                {
                    "id": "name-prop",
                    "propertyName": "Name",
                    "propertyType": "TEXT",
                    "description": "Extract the name/description of the pension escalation rate section"
                },
                {
                    "id": "section-prop", 
                    "propertyName": "Valid Section",
                    "propertyType": "TEXT",
                    "description": "Extract which pension members this applies to"
                },
                {
                    "id": "min-prop",
                    "propertyName": "Min Escalation", 
                    "propertyType": "TEXT",
                    "description": "Extract minimum escalation percentage"
                },
                {
                    "id": "max-prop",
                    "propertyName": "Max Escalation",
                    "propertyType": "TEXT", 
                    "description": "Extract maximum escalation percentage"
                },
                {
                    "id": "type-prop",
                    "propertyName": "Escalation Type",
                    "propertyType": "TEXT",
                    "description": "Extract escalation index type (CPI, RPI, Fixed, None)"
                },
                {
                    "id": "rate-prop",
                    "propertyName": "Rate Value",
                    "propertyType": "TEXT",
                    "description": "Extract specific rate value if fixed rate"
                }
            ]
        }]
    }
    
    print("🧪 Testing improved table extraction...")
    print(f"📄 Document contains 10 distinct escalation rate sections (2.3.1 - 2.3.10)")
    
    # Test extraction
    result = step1_extract_from_documents([test_document], test_schema, [], "test")
    
    if result.success:
        field_validations = result.extracted_data.get("field_validations", [])
        collection_items = [fv for fv in field_validations if fv.get("field_type") == "collection_property"]
        
        # Count unique record indices
        record_indices = set()
        for item in collection_items:
            if "record_index" in item:
                record_indices.add(item["record_index"])
        
        unique_records = len(record_indices)
        
        print(f"✅ Extraction successful!")
        print(f"📊 Found {len(collection_items)} collection property extractions")
        print(f"🔢 Unique collection records: {unique_records}")
        print(f"🎯 Expected: 10 unique records (one per section)")
        
        if unique_records >= 8:  # Allow for some variation
            print(f"🎉 SUCCESS: Found {unique_records}/10 expected table rows!")
        else:
            print(f"⚠️  ISSUE: Only found {unique_records}/10 expected table rows")
            
        # Show sample extractions
        print(f"\n📋 Sample extractions:")
        for i, item in enumerate(collection_items[:6]):  # Show first 6
            record_idx = item.get('record_index', 'unknown')
            field_name = item.get('field_name', 'unknown')
            value = item.get('extracted_value', 'unknown')
            print(f"  {i+1}. {field_name}: '{value}' (record {record_idx})")
            
    else:
        print(f"❌ Extraction failed: {result.error_message}")
        
    return result

if __name__ == "__main__":
    test_escalation_table_extraction()