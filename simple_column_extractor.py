#!/usr/bin/env python3
"""
Simple Column Extractor - Direct Excel Processing
Handles basic column extraction without AI overhead for simple tasks
"""

import pandas as pd
import json
import sys
import logging
from pathlib import Path

def extract_columns_simple(file_path, session_id):
    """Extract columns and worksheet names directly from Excel file"""
    
    try:
        # Read Excel file with all sheets
        excel_file = pd.ExcelFile(file_path)
        
        results = []
        record_index = 0
        
        # Process each worksheet
        for sheet_name in excel_file.sheet_names:
            print(f"Processing sheet: {sheet_name}")
            
            # Read the sheet to get column names
            df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=0)  # Only headers
            
            # Extract each column
            for column_name in df.columns:
                column_str = str(column_name).strip()
                if column_str and column_str != 'Unnamed':
                    
                    # Create validation record
                    validation = {
                        "session_id": session_id,
                        "field_name": f"Column Name Mapping.Column Heading[{record_index}]",
                        "extracted_value": column_str,
                        "record_index": record_index,
                        "collection_name": "Column Name Mapping",
                        "validation_type": "collection_property"
                    }
                    results.append(validation)
                    
                    # Add worksheet name
                    worksheet_validation = {
                        "session_id": session_id,
                        "field_name": f"Column Name Mapping.Worksheet Name[{record_index}]",
                        "extracted_value": sheet_name,
                        "record_index": record_index,
                        "collection_name": "Column Name Mapping",
                        "validation_type": "collection_property"
                    }
                    results.append(worksheet_validation)
                    
                    record_index += 1
        
        return {
            "success": True,
            "field_validations": results,
            "total_columns": record_index,
            "sheets_processed": len(excel_file.sheet_names)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "field_validations": []
        }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python simple_column_extractor.py <excel_file> <session_id>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    session_id = sys.argv[2]
    
    result = extract_columns_simple(file_path, session_id)
    print(json.dumps(result, indent=2))