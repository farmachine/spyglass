import psycopg2
import os

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

# Updated function code with correct parameter names
function_code = """import re

def extract_function(column, document):
    '''
    Find which worksheet each column name appears in.
    column: A dict with 'identifierId' and 'name' fields or the column value from ID
    document: Text string with Excel format using '=== Sheet: Name ===' delimiters
    '''
    try:
        # Extract the column name from the input
        column_name = None
        
        # Handle the new format: {'identifierId': '...', 'name': '...'}
        if isinstance(column, dict):
            # Try various field names that might contain the column name
            column_name = column.get('name') or column.get('extractedValue') or column.get('ID') or str(column)
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
        
        # Parse Excel text using sheet delimiters
        sheets_data = re.split(r'===\\s*Sheet:\\s*(.*?)\\s*===', document)
        
        if len(sheets_data) < 2:
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"No sheet delimiters found in Excel data",
                "confidenceScore": 0,
                "documentSource": "Not found"
            }
        
        # Build mapping of columns to sheets
        sheets_info = []
        for i in range(1, len(sheets_data), 2):
            if i < len(sheets_data):
                sheet_name = sheets_data[i].strip()
                if i + 1 < len(sheets_data):
                    sheet_content = sheets_data[i + 1]
                    lines = sheet_content.strip().split('\\n')
                    if lines:
                        # First line contains column headers
                        headers = lines[0].split('\\t')
                        sheets_info.append({
                            "sheet": sheet_name,
                            "columns": headers
                        })
        
        # Search for the column in all sheets
        found_sheet = None
        for sheet_info in sheets_info:
            # Clean column names for comparison
            clean_headers = [h.strip() for h in sheet_info["columns"]]
            if column_name in clean_headers:
                found_sheet = sheet_info["sheet"]
                break
        
        if found_sheet:
            return {
                "extractedValue": found_sheet,
                "validationStatus": "verified",
                "aiReasoning": f"Column '{column_name}' found in sheet '{found_sheet}'",
                "confidenceScore": 100,
                "documentSource": f"Sheet: {found_sheet}"
            }
        else:
            # Return empty for columns not found
            return {
                "extractedValue": "",
                "validationStatus": "pending",
                "aiReasoning": f"Column '{column_name}' not found in any sheet",
                "confidenceScore": 0,
                "documentSource": "Not found"
            }
    
    except Exception as e:
        return {
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Function execution error: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "ERROR"
        }"""

# Connect to database
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Update the function
cur.execute("""
    UPDATE excel_wizardry_functions 
    SET function_code = %s
    WHERE id = 'f1689b16-0ea4-4422-bc8a-8e724930f058'
""", (function_code,))

conn.commit()
print("✅ Successfully updated Get Worksheet from Column function with correct parameter names")

cur.close()
conn.close()