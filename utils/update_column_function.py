import psycopg2
import os
import json

# Connect to database
DATABASE_URL = os.environ.get('DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Updated function code with better debugging
function_code = '''import json

def get_column_names(*args, **kwargs):
    """Extract all column names from Excel file content."""
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
        
        # Debug: Log content structure
        content_preview = excel_file_content[:500] if len(excel_file_content) > 500 else excel_file_content
        
        results = []
        sheet_columns = {}
        
        # Look for sheet markers and extract columns
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
                        # Split by tabs first, then by multiple spaces if no tabs
                        if '\\t' in headers_line:
                            columns = [col.strip() for col in headers_line.split('\\t') if col.strip()]
                        else:
                            # Try splitting by multiple spaces
                            import re
                            columns = [col.strip() for col in re.split(r'\\s{2,}', headers_line) if col.strip()]
                        
                        if columns:
                            sheet_columns[current_sheet] = columns
            
            # Also check for common header patterns at the start
            elif i == 0 and not current_sheet and '\\t' in line:
                columns = [col.strip() for col in line.split('\\t') if col.strip()]
                if columns:
                    sheet_columns['Main'] = columns
        
        # If no sheets found, try to find any tab-separated headers
        if not sheet_columns:
            for line in lines[:10]:  # Check first 10 lines
                if '\\t' in line:
                    columns = [col.strip() for col in line.split('\\t') if col.strip()]
                    # Check if these look like headers (not just numbers)
                    if columns and any(not col.replace('.', '').replace('-', '').isdigit() for col in columns):
                        sheet_columns['Sheet1'] = columns
                        break
        
        # Convert to field validation format
        for sheet_name, columns in sheet_columns.items():
            for col_index, col_name in enumerate(columns):
                if col_name:  # Only add non-empty column names
                    results.append({
                        "extractedValue": col_name,
                        "validationStatus": "valid",
                        "aiReasoning": f"Column from sheet '{sheet_name}'",
                        "confidenceScore": 100,
                        "documentSource": f"Sheet: {sheet_name}, Column {col_index + 1}"
                    })
        
        # If no columns found, provide detailed error
        if not results:
            debug_info = f"Content preview: {content_preview[:200]}..."
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"No column headers found. {debug_info}",
                "confidenceScore": 0,
                "documentSource": "N/A"
            }])
        
        return json.dumps(results, indent=2)
        
    except Exception as e:
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
print("✅ Updated Get Column Names function with better debugging")

cur.close()
conn.close()
