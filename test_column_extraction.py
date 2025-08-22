import json

# Test the actual function from the database
function_code = """
def get_column_names(*args, **kwargs):
    \"\"\"Extract all column names from Excel file content.\"\"\"
    try:
        # Accept content from any source - args, kwargs, or direct
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
        
        # Handle dict inputs - extract the actual content
        if isinstance(excel_file_content, dict):
            # Try common keys
            for key in ['content', 'text', 'file_content', 'text_content']:
                if key in excel_file_content:
                    excel_file_content = excel_file_content[key]
                    break
            else:
                # If no known key, get first value
                if excel_file_content:
                    excel_file_content = list(excel_file_content.values())[0] if excel_file_content else ""
        
        # Convert to string if needed
        content = str(excel_file_content)
        
        # Parse the Excel content
        lines = content.strip().split('\\n')
        results = []
        
        # Find all sheet headers and extract column names
        current_sheet = None
        sheet_columns = {}
        
        for i, line in enumerate(lines):
            if line.startswith('=== Sheet:') and line.endswith('==='):
                # Extract sheet name
                current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                # Next line should contain column headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1].strip()
                    if headers_line:
                        # Split by tabs to get column names
                        columns = [col.strip() for col in headers_line.split('\\t') if col.strip()]
                        sheet_columns[current_sheet] = columns
        
        # Convert to field validation format - one result per column
        for sheet_name, columns in sheet_columns.items():
            for col_index, col_name in enumerate(columns):
                results.append({
                    "extractedValue": col_name,
                    "validationStatus": "valid",
                    "aiReasoning": f"Column from sheet '{sheet_name}'",
                    "confidenceScore": 100,
                    "documentSource": f"Sheet: {sheet_name}, Column {col_index + 1}"
                })
        
        # If no columns found, return error
        if not results:
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "No column headers found in Excel file",
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
        }])
"""

# Execute the function definition
exec(function_code)

# Test with sample Excel content
test_content = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Employer Code	Sex Code	Date of Birth
P	70642	70642	1	1964-05-18 00:00:00
P	70655	70655	2	1966-01-12 00:00:00"""

# Test direct call
print("Testing direct call:")
result = get_column_names(test_content)
print(result)

# Test with dict wrapper
print("\nTesting with dict wrapper:")
inputs = {'document': test_content}
args = list(inputs.values())
result = get_column_names(*args)
print(result)