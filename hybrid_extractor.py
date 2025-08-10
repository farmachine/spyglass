#!/usr/bin/env python3
"""
Hybrid Extractor - Combines simple direct extraction with complex AI reasoning
"""

import json
import sys
import pandas as pd
import logging
from pathlib import Path

def extract_excel_columns_simple(session_data, target_fields, collection_record_counts):
    """Simple direct extraction for basic tasks like column mapping"""
    
    results = []
    
    # Get the starting index for new records
    start_index = collection_record_counts.get("Column Name Mapping", 0)
    record_index = start_index
    
    print(f"SIMPLE EXTRACTION: Starting from index {start_index}")
    
    # Process each extracted text (Excel file)
    for extracted_text in session_data.get('extractedTexts', []):
        content = extracted_text.get('content', '')
        file_name = extracted_text.get('fileName', 'Unknown')
        
        if 'Excel file content' in content and '.xlsx' in file_name:
            # Parse Excel content directly from the text representation
            lines = content.split('\n')
            current_sheet = None
            
            for line in lines:
                if line.startswith('=== SHEET:'):
                    # Extract sheet name
                    current_sheet = line.split('=== SHEET: ')[1].split(' ===')[0].strip()
                    continue
                    
                elif current_sheet and line.strip() and not line.startswith('==='):
                    # This is likely a header row with column names
                    # Split by multiple spaces or tabs to get columns
                    columns = [col.strip() for col in line.split() if col.strip()]
                    
                    # Process each column
                    for column_name in columns:
                        if len(column_name) > 2:  # Filter out single letters/numbers
                            # Create Column Heading field
                            results.append({
                                "field_id": f"column_heading_{record_index}",
                                "field_name": f"Column Name Mapping.Column Heading[{record_index}]",
                                "extracted_value": column_name,
                                "ai_reasoning": f"Extracted column '{column_name}' from sheet '{current_sheet}' using direct parsing",
                                "confidence": 1.0,
                                "validation_type": "collection_property",
                                "collection_name": "Column Name Mapping",
                                "record_index": record_index,
                                "validation_status": "verified"
                            })
                            
                            # Create Worksheet Name field
                            results.append({
                                "field_id": f"worksheet_name_{record_index}",
                                "field_name": f"Column Name Mapping.Worksheet Name[{record_index}]",
                                "extracted_value": current_sheet,
                                "ai_reasoning": f"Worksheet name for column '{column_name}'",
                                "confidence": 1.0,
                                "validation_type": "collection_property", 
                                "collection_name": "Column Name Mapping",
                                "record_index": record_index,
                                "validation_status": "verified"
                            })
                            
                            record_index += 1
                    
                    # Only process first data row per sheet for column extraction
                    current_sheet = None
    
    print(f"SIMPLE EXTRACTION: Generated {len(results)} field validations, ending at index {record_index-1}")
    
    return {
        "success": True,
        "message": f"Simple extraction completed: {len(results)} validations created",
        "field_validations": results
    }

if __name__ == "__main__":
    # Test with sample data
    test_session = {
        "extractedTexts": [{
            "fileName": "test.xlsx",
            "content": """Excel file content from test.xlsx:
=== SHEET: New_Pensioners ===
 Member ID  Full Name  Date Of Birth  Pension Amount  Status Code 
=== SHEET: Deferreds ===
 Reference No  Name  DOB  Deferred Amount  Category 
"""
        }]
    }
    
    result = extract_excel_columns_simple(test_session, ["Column Name Mapping"], {"Column Name Mapping": 0})
    print(json.dumps(result, indent=2))