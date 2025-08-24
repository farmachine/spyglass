import psycopg2
import os

# Updated function code that handles the correct input format
updated_function = """import re

def extract_function(Column_Name, Excel_File):
    '''
    Find which worksheet each column name appears in.
    Column_Name: A dict with 'identifierId' and 'name' fields
    Excel_File: Text string with Excel format using '=== Sheet: Name ===' delimiters
    '''
    try:
        # Extract the column name from the input
        column_name = None
        
        # Handle the new format: {'identifierId': '...', 'name': '...'}
        if isinstance(Column_Name, dict):
            column_name = Column_Name.get('name') or Column_Name.get('extractedValue') or str(Column_Name)
        else:
            column_name = str(Column_Name)
        
        if not column_name:
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "No column name provided",
                "confidenceScore": 0,
                "documentSource": "Error"
            }
        
        # Parse Excel text using sheet delimiters
        sheets_data = re.split(r'===\\s*Sheet:\\s*(.*?)\\s*===', Excel_File)
        
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
                        # Get headers from first line
                        headers = lines[0].split('\\t')
                        sheets_info.append({
                            'name': sheet_name,
                            'headers': headers
                        })
        
        # Search for the column in each sheet
        found_sheets = []
        for sheet in sheets_info:
            # Clean headers for comparison
            clean_headers = [h.strip() for h in sheet['headers']]
            
            # Check if column exists in this sheet
            if column_name in clean_headers:
                found_sheets.append(sheet['name'])
        
        if found_sheets:
            # Return the first sheet where column was found
            return {
                "extractedValue": found_sheets[0],
                "validationStatus": "valid",
                "aiReasoning": f"Column '{column_name}' found in sheet: {found_sheets[0]}",
                "confidenceScore": 1.0,
                "documentSource": f"Sheet: {found_sheets[0]}"
            }
        else:
            # Column not found in any sheet
            available_sheets = [s['name'] for s in sheets_info]
            sample_columns = []
            for sheet in sheets_info[:2]:  # Show columns from first 2 sheets
                sample_columns.extend(sheet['headers'][:5])
            
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"Column '{column_name}' not found. Available sheets: {available_sheets}. Sample columns: {sample_columns}",
                "confidenceScore": 0,
                "documentSource": "Not found"
            }
            
    except Exception as e:
        return {
            "extractedValue": None,
            "validationStatus": "error",
            "aiReasoning": f"Error processing: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "Error"
        }
"""

# Connect to database
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

# Update the function
cur.execute("""
    UPDATE excel_wizardry_functions 
    SET function_code = %s,
        updated_at = NOW()
    WHERE id = 'f1689b16-0ea4-4422-bc8a-8e724930f058'
""", (updated_function,))

conn.commit()
print(f"Updated function successfully")

cur.close()
conn.close()