import psycopg2
import os
import json

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("Error: DATABASE_URL not found")
    exit(1)

# Updated function code that returns unique column names with sheet information
updated_function_code = '''import json
import re

def get_column_names(*args, **kwargs):
    """Extract unique column names from Excel file content with sheet tracking."""
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
        
        # Convert to string if needed
        if not isinstance(excel_file_content, str):
            excel_file_content = str(excel_file_content)
        
        # Extract column headers from the Excel content
        lines = excel_file_content.strip().split('\\n')
        column_locations = {}  # Track unique columns with their sheet locations
        
        current_sheet = "Unknown"
        for i, line in enumerate(lines):
            # Look for sheet markers
            if line.startswith('=== Sheet:') and line.endswith('==='):
                current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                
                # Look for headers in the next few lines
                for j in range(i+1, min(i+10, len(lines))):
                    check_line = lines[j]
                    
                    # Skip empty lines and separators
                    if not check_line or check_line.strip() == '---':
                        continue
                    
                    # Look for header row patterns (pipe-separated)
                    if '|' in check_line:
                        headers = [h.strip() for h in check_line.split('|')]
                        headers = [h for h in headers if h]  # Remove empty strings
                        
                        # If we found multiple headers, this is likely a header row
                        if len(headers) >= 2:
                            for position, header in enumerate(headers, 1):
                                header = header.strip()
                                # Skip numeric-only headers
                                if header and not header.replace('.', '').replace('-', '').isdigit():
                                    # Track unique columns with their first occurrence sheet
                                    if header not in column_locations:
                                        column_locations[header] = {
                                            "sheet": current_sheet,
                                            "position": position,
                                            "occurrences": [current_sheet]
                                        }
                                    else:
                                        # Track additional occurrences
                                        if current_sheet not in column_locations[header]["occurrences"]:
                                            column_locations[header]["occurrences"].append(current_sheet)
                            break
            
            # Also look for tab-separated headers
            elif '\\t' in line:
                headers = line.split('\\t')
                if len(headers) >= 3:
                    for position, header in enumerate(headers, 1):
                        header = header.strip()
                        # Skip numeric-only headers
                        if header and not header.replace('.', '').replace('-', '').isdigit():
                            if header not in column_locations:
                                column_locations[header] = {
                                    "sheet": current_sheet,
                                    "position": position,
                                    "occurrences": [current_sheet]
                                }
        
        # Format results - one entry per unique column
        results = []
        for column_name, info in column_locations.items():
            sheet_info = info["sheet"]
            if len(info["occurrences"]) > 1:
                sheet_info = f"{info['sheet']} (+{len(info['occurrences'])-1} more sheets)"
            
            results.append({
                "extractedValue": column_name,
                "validationStatus": "valid",
                "aiReasoning": f"Column found in {sheet_info}",
                "confidenceScore": 100,
                "documentSource": sheet_info
            })
        
        # If still no results, return error
        if not results:
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "No column headers found in the Excel content",
                "confidenceScore": 0,
                "documentSource": "ERROR"
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

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Update the function
    cur.execute("""
        UPDATE excel_wizardry_functions 
        SET function_code = %s,
            updated_at = NOW()
        WHERE name = 'Get Column Names'
        RETURNING id, name
    """, (updated_function_code,))
    
    result = cur.fetchone()
    if result:
        print(f"✅ Successfully updated function: {result[1]} (ID: {result[0]})")
        print("📊 Function now returns UNIQUE column names (185 expected)")
        print("📍 Sheet locations tracked for each column")
    else:
        print("❌ Function 'Get Column Names' not found")
    
    conn.commit()
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error updating function: {e}")