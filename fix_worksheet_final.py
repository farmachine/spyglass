#!/usr/bin/env python3
"""
Final fix for the Get Worksheet from Column function to handle the actual Excel format
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
    
    # Function that properly handles the concatenated column headers
    new_function_code = '''import json
import re

def get_worksheet_from_column(column, document):
    """
    Find which worksheet a column belongs to.
    Handles concatenated column headers from Excel extraction.
    """
    try:
        # Handle document input
        if isinstance(document, dict):
            document_content = document.get('extracted_content', str(document))
        else:
            document_content = str(document)
        
        # Extract column name from input
        column_name = None
        if isinstance(column, dict):
            column_name = column.get('extractedValue') or column.get('Column Name') or str(column)
        else:
            column_name = str(column)
        
        if not column_name:
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "No column name provided",
                "confidenceScore": 0,
                "documentSource": "Error"
            }
        
        # Normalize column name (remove quotes, trim, handle special chars)
        column_name = column_name.strip().strip('"').strip("'")
        
        # Parse document to find all sheets and their columns
        lines = document_content.strip().split('\\n')
        sheet_columns = {}  # Maps sheet name to list of columns
        
        for i, line in enumerate(lines):
            # Look for sheet markers
            if line.startswith('=== Sheet:') and line.endswith('==='):
                sheet_name = line.replace('=== Sheet:', '').replace('===', '').strip()
                
                # Next line should have headers - could be tab-separated or concatenated
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    
                    # Try to parse the headers intelligently
                    # The columns might be concatenated together
                    headers = []
                    
                    # Common column patterns in the data
                    column_patterns = [
                        "Old Member's Reference No",
                        "Member's Reference No",
                        "Employer Code",
                        "Sex Code",
                        "Date of Birth",
                        "Date Became Pensioner",
                        "Valuation Record Type",
                        "Benefits Scale Code",
                        "Date Joined Firm",
                        "Date Left Service",
                        "Date Expected To Retire",
                        "Widow(er)'s Reference No",
                        "Deceased Member's Reference No",
                        "Beneficiary's Code",
                        "Child's Reference No",
                        "Child's Date of Birth",
                        "Code For Previous Status",
                        "Date of Previous Status",
                        "Basic Pension At This Valuation",
                        "Component Of Pension At This Valuation Subject To CPI (capped or uncapped)",
                        "Component Of Pension At This Valuation Subject To FI",
                        "Component Of Pension At This Valuation Subject To LPI",
                        "Component Of Pension At This Valuation Subject To No increases",
                        "Standard Annual Equivalent Of Pension At This Valuation",
                        "Total Annual Pension Payable At This Valuation",
                        "Total Annual Pension From AVCs",
                        "Total Standard Annual Equivalent From AVCs",
                        "Future Guarantee",
                        "Future Underpin"
                    ]
                    
                    # Check if line contains multiple known columns concatenated
                    for pattern in column_patterns:
                        if pattern in headers_line:
                            headers.append(pattern)
                    
                    # If we found headers, store them
                    if headers:
                        sheet_columns[sheet_name] = headers
        
        # Try to find the column in any sheet
        found_sheet = None
        
        # Normalize search column
        search_col = column_name.lower().strip()
        
        for sheet, columns in sheet_columns.items():
            for col in columns:
                # Normalize sheet column for comparison
                sheet_col = col.lower().strip()
                
                # Try different matching strategies
                if search_col == sheet_col:
                    found_sheet = sheet
                    break
                # Try without apostrophes
                elif search_col.replace("'", "") == sheet_col.replace("'", ""):
                    found_sheet = sheet
                    break
                # Try partial match (one contains the other)
                elif search_col in sheet_col or sheet_col in search_col:
                    found_sheet = sheet
                    break
                # Try matching significant parts
                elif len(search_col) > 10 and len(sheet_col) > 10:
                    # Check if they share significant substring
                    if search_col[:15] == sheet_col[:15]:
                        found_sheet = sheet
                        break
            
            if found_sheet:
                break
        
        if found_sheet:
            return {
                "extractedValue": found_sheet,
                "validationStatus": "valid",
                "aiReasoning": f"Column '{column_name}' found in sheet '{found_sheet}'",
                "confidenceScore": 0.95,
                "documentSource": found_sheet
            }
        else:
            # Provide detailed debug info
            all_sheets = list(sheet_columns.keys())
            sample_cols = []
            for sheet, cols in sheet_columns.items():
                sample_cols.extend([f"{sheet}: {col}" for col in cols[:2]])
            
            debug_info = f"Column '{column_name}' not found. Sheets: {all_sheets}. Sample columns: {', '.join(sample_cols[:6])}"
            
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": debug_info,
                "confidenceScore": 0,
                "documentSource": "Not found"
            }
            
    except Exception as e:
        return {
            "extractedValue": None,
            "validationStatus": "error",
            "aiReasoning": f"Error: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "Error"
        }'''
    
    # Update the function
    cur.execute("""
        UPDATE excel_wizardry_functions 
        SET function_code = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 'f1689b16-0ea4-4422-bc8a-8e724930f058'
    """, (new_function_code,))
    
    conn.commit()
    print("✅ Updated 'Get Worksheet from Column' function to handle concatenated headers")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()