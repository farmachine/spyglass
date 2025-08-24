#!/usr/bin/env python3
"""
Debug and fix the Get Worksheet from Column function
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
    
    # Updated function with better debugging and column matching
    new_function_code = '''import json
import re

def get_worksheet_from_column(column, document):
    """
    Find which worksheet a column belongs to.
    Handles various column name formats and provides detailed debugging.
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
        
        # Normalize column name for matching (remove quotes, trim)
        column_name_normalized = column_name.strip().strip('"').strip("'")
        
        # Parse document to find all sheets and their columns
        lines = document_content.strip().split('\\n')
        sheet_columns = {}  # Maps sheet name to list of columns
        current_sheet = None
        
        for i, line in enumerate(lines):
            # Look for sheet markers
            if line.startswith('=== Sheet:') and line.endswith('==='):
                current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                # Next line should have headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    # Split by tabs to get columns
                    headers = [h.strip().strip('"').strip("'") for h in headers_line.split('\\t')]
                    # Remove empty headers
                    headers = [h for h in headers if h]
                    if headers:
                        sheet_columns[current_sheet] = headers
        
        # Try to find the column in any sheet
        found_sheet = None
        
        # First try exact match
        for sheet, columns in sheet_columns.items():
            if column_name_normalized in columns:
                found_sheet = sheet
                break
        
        # If not found, try case-insensitive match
        if not found_sheet:
            column_lower = column_name_normalized.lower()
            for sheet, columns in sheet_columns.items():
                for col in columns:
                    if col.lower() == column_lower:
                        found_sheet = sheet
                        break
                if found_sheet:
                    break
        
        # If still not found, try partial match
        if not found_sheet:
            for sheet, columns in sheet_columns.items():
                for col in columns:
                    # Check if column name contains or is contained in the sheet column
                    if column_name_normalized in col or col in column_name_normalized:
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
            # Provide detailed debug info about what was searched
            all_columns = []
            for sheet, cols in sheet_columns.items():
                all_columns.extend([f"{sheet}: {col}" for col in cols[:3]])  # Show first 3 columns per sheet
            
            debug_info = f"Column '{column_name}' not found. Sheets searched: {list(sheet_columns.keys())}. Sample columns: {', '.join(all_columns[:10])}"
            
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
    print("✅ Updated 'Get Worksheet from Column' function with better debugging")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()