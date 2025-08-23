#!/usr/bin/env python3
"""
Fix the Get Worksheet from Column function to properly parse Excel document format
"""

import sys
import json
import psycopg2
import os

def main():
    # Connect to database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        print("DATABASE_URL not found")
        sys.exit(1)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Updated function that properly handles the document format
    new_function_code = '''import json

def get_worksheet_from_column(column, document):
    """
    Process a single column to find which worksheet it belongs to.
    This function handles the actual Excel column headers properly.
    """
    try:
        # Handle document input - could be string or extracted content
        if isinstance(document, dict):
            document_content = document.get('extracted_content', str(document))
        else:
            document_content = str(document)
        
        # Get the column name from various input formats
        column_name = None
        
        # If column is a dict with extractedValue (field validation format)
        if isinstance(column, dict):
            if 'extractedValue' in column:
                column_name = column['extractedValue']
            elif 'Column Name' in column:
                column_name = column['Column Name']
            else:
                column_name = str(column)
        elif isinstance(column, str):
            column_name = column
        else:
            column_name = str(column)
        
        if not column_name:
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "Could not extract column name from input",
                "confidenceScore": 0,
                "documentSource": "Error"
            }
        
        # Build a comprehensive mapping of ALL columns across all sheets
        lines = document_content.strip().split('\\n')
        all_columns_map = {}  # Maps column name to sheet name
        current_sheet = None
        
        for i, line in enumerate(lines):
            if line.startswith('=== Sheet:') and line.endswith('==='):
                # Extract sheet name
                current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                # Next line should contain column headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    # Split by tab to get headers
                    headers = headers_line.split('\\t')
                    # Clean up headers
                    headers = [h.strip() for h in headers if h.strip()]
                    
                    # Store each column with its sheet
                    for header in headers:
                        if header:
                            all_columns_map[header] = current_sheet
        
        # Try exact match first
        if column_name in all_columns_map:
            sheet_name = all_columns_map[column_name]
            return {
                "extractedValue": sheet_name,
                "validationStatus": "valid",
                "aiReasoning": f"Located column '{column_name}' in worksheet '{sheet_name}'",
                "confidenceScore": 100,
                "documentSource": f"Sheet: {sheet_name}"
            }
        
        # Try case-insensitive match
        column_lower = column_name.lower()
        for col, sheet in all_columns_map.items():
            if col.lower() == column_lower:
                return {
                    "extractedValue": sheet,
                    "validationStatus": "valid",
                    "aiReasoning": f"Located column '{column_name}' (matched as '{col}') in worksheet '{sheet}'",
                    "confidenceScore": 95,
                    "documentSource": f"Sheet: {sheet}"
                }
        
        # Try partial match for common column names
        # Remove apostrophes and normalize for matching
        column_normalized = column_name.replace("'", "").replace("'", "").lower()
        for col, sheet in all_columns_map.items():
            col_normalized = col.replace("'", "").replace("'", "").lower()
            if col_normalized == column_normalized:
                return {
                    "extractedValue": sheet,
                    "validationStatus": "valid",
                    "aiReasoning": f"Located column '{column_name}' (normalized match with '{col}') in worksheet '{sheet}'",
                    "confidenceScore": 90,
                    "documentSource": f"Sheet: {sheet}"
                }
        
        # No match found - provide helpful debug info
        available_columns = list(all_columns_map.keys())[:10]  # Show first 10 columns
        return {
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Column '{column_name}' not found. Available columns include: {', '.join(available_columns)}...",
            "confidenceScore": 0,
            "documentSource": "Not found"
        }
        
    except Exception as e:
        return {
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Error processing request: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "Error"
        }'''
    
    # Update the function
    cur.execute("""
        UPDATE excel_wizardry_functions 
        SET function_code = %s,
            updated_at = NOW()
        WHERE name = 'Get Worksheet from Column'
        RETURNING id, name
    """, (new_function_code,))
    
    result = cur.fetchone()
    if result:
        conn.commit()
        print(f"Successfully updated function: {result[1]} (ID: {result[0]})")
        
        # Test with sample data
        print("\nTesting updated function...")
        test_column = {"extractedValue": "Old Member's Reference No"}
        test_doc = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Employer Code	Sex Code	Date of Birth
=== Sheet: Active deferreds ===
Valuation Record Type	Member's Reference No	Employer Code	Benefits Scale Code	Sex Code"""
        
        # Create test function
        exec(new_function_code, globals())
        result = get_worksheet_from_column(test_column, test_doc)
        print(f"Test result: {json.dumps(result, indent=2)}")
    else:
        print("Function not found")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()