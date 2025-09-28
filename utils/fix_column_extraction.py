#!/usr/bin/env python3

import psycopg2
import os

# Connect to database
database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("❌ DATABASE_URL not found")
    exit(1)

conn = psycopg2.connect(database_url)
cur = conn.cursor()

# Updated function code to include ALL columns from ALL sheets without filtering
function_code = '''import json

def get_column_names(*args, **kwargs):
    """Extract ALL column names from ALL sheets in Excel file content."""
    try:
        # Accept content from any source
        excel_file_content = None
        
        # Try args first
        if args:
            excel_file_content = args[0]
        # Then try kwargs with any key
        elif kwargs:
            excel_file_content = list(kwargs.values())[0]
        
        if not excel_file_content:
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "No content provided",
                "confidenceScore": 0,
                "documentSource": "N/A"
            }])
        
        # Handle dict inputs
        if isinstance(excel_file_content, dict):
            for key in ['content', 'text', 'file_content', 'text_content', 'extracted_content']:
                if key in excel_file_content:
                    excel_file_content = excel_file_content[key]
                    break
            else:
                if excel_file_content:
                    excel_file_content = list(excel_file_content.values())[0] if excel_file_content else ""
        
        # Convert to string if needed
        if not isinstance(excel_file_content, str):
            excel_file_content = str(excel_file_content)
        
        results = []
        
        # Look for sheet markers and extract ALL columns from ALL sheets
        lines = excel_file_content.split('\\n')
        current_sheet = None
        
        for i, line in enumerate(lines):
            # Check for sheet markers
            if '=== Sheet:' in line or 'Sheet:' in line:
                # Extract sheet name
                if '===' in line:
                    current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                else:
                    current_sheet = line.replace('Sheet:', '').strip()
                
                # Next line should contain headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1].strip()
                    if headers_line:
                        # Split by tabs and preserve ALL columns including empty ones
                        if '\\t' in headers_line:
                            # Split by tabs and keep ALL columns (including empty)
                            all_columns = headers_line.split('\\t')
                            for col_index, col_name in enumerate(all_columns):
                                # Add ALL columns, even empty ones (as blank entries)
                                clean_col_name = col_name.strip() if col_name else f"Column_{col_index + 1}"
                                results.append({
                                    "extractedValue": clean_col_name,
                                    "validationStatus": "valid",
                                    "aiReasoning": f"Column {col_index + 1} from sheet '{current_sheet}'",
                                    "confidenceScore": 100,
                                    "documentSource": f"Sheet: {current_sheet}, Position {col_index + 1}"
                                })
                        else:
                            # Try splitting by multiple spaces
                            import re
                            all_columns = re.split(r'\\s{2,}', headers_line)
                            for col_index, col_name in enumerate(all_columns):
                                clean_col_name = col_name.strip() if col_name else f"Column_{col_index + 1}"
                                results.append({
                                    "extractedValue": clean_col_name,
                                    "validationStatus": "valid", 
                                    "aiReasoning": f"Column {col_index + 1} from sheet '{current_sheet}'",
                                    "confidenceScore": 100,
                                    "documentSource": f"Sheet: {current_sheet}, Position {col_index + 1}"
                                })
            
            # Also check for common header patterns at the start
            elif i == 0 and not current_sheet and '\\t' in line:
                all_columns = line.split('\\t')
                for col_index, col_name in enumerate(all_columns):
                    clean_col_name = col_name.strip() if col_name else f"Column_{col_index + 1}"
                    results.append({
                        "extractedValue": clean_col_name,
                        "validationStatus": "valid",
                        "aiReasoning": f"Column {col_index + 1} from main sheet",
                        "confidenceScore": 100,
                        "documentSource": f"Main Sheet, Position {col_index + 1}"
                    })
        
        # If no columns found anywhere, try to find any tab-separated headers
        if not results:
            for line in lines[:10]:  # Check first 10 lines
                if '\\t' in line:
                    all_columns = line.split('\\t')
                    # Add ALL columns regardless of content
                    for col_index, col_name in enumerate(all_columns):
                        clean_col_name = col_name.strip() if col_name else f"Column_{col_index + 1}"
                        results.append({
                            "extractedValue": clean_col_name,
                            "validationStatus": "valid",
                            "aiReasoning": f"Auto-detected column {col_index + 1}",
                            "confidenceScore": 90,
                            "documentSource": f"Auto-detected, Position {col_index + 1}"
                        })
                    break
        
        # If no columns found, provide detailed error
        if not results:
            content_preview = excel_file_content[:500] if len(excel_file_content) > 500 else excel_file_content
            debug_info = f"Content preview: {content_preview[:200]}..."
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"No column headers found. {debug_info}",
                "confidenceScore": 0,
                "documentSource": "N/A"
            }])
        
        print(f"🎯 EXTRACTED {len(results)} TOTAL COLUMNS FROM ALL SHEETS", file=sys.stderr)
        return json.dumps(results, indent=2)
        
    except Exception as e:
        import sys
        print(f"❌ ERROR: {str(e)}", file=sys.stderr)
        return json.dumps([{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Error: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "ERROR"
        }])'''

# Update the function
cur.execute("""
    UPDATE excel_wizardry_functions 
    SET function_code = %s,
        updated_at = NOW()
    WHERE id = '72204391-0d72-4493-889e-67807d6c96a8'
""", (function_code,))

conn.commit()
print("✅ Updated Get Column Names function to include ALL columns from ALL sheets")

cur.close()
conn.close()