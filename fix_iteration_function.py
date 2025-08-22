import json

def get_worksheet_from_column(column, document):
    """
    Process a single column to find which worksheet it belongs to.
    This function will be called once for each column in the iteration.
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
                # This is field validation format from previous step
                column_name = column['extractedValue']
            elif 'Column Name' in column:
                # This is row format from data parameter
                column_name = column['Column Name']
            else:
                # Try to get any value from the dict
                column_name = str(column)
        elif isinstance(column, str):
            # Direct string column name
            column_name = column
        else:
            # Unknown format, convert to string
            column_name = str(column)
        
        if not column_name:
            return {
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": "Could not extract column name from input",
                "confidenceScore": 0,
                "documentSource": "Error"
            }
        
        # Parse the Excel content to find worksheets and their columns
        lines = document_content.strip().split('\n')
        worksheet_columns = {}
        current_sheet = None
        
        for i, line in enumerate(lines):
            if line.startswith('=== Sheet:') and line.endswith('==='):
                # Extract sheet name
                current_sheet = line.replace('=== Sheet:', '').replace('===', '').strip()
                # Next line should contain column headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    # Split by tab or multiple spaces
                    import re
                    headers = re.split(r'\t+|\s{2,}', headers_line)
                    # Clean up headers
                    headers = [h.strip() for h in headers if h.strip()]
                    worksheet_columns[current_sheet] = headers
        
        # Find which worksheet this column belongs to
        for sheet_name, sheet_cols in worksheet_columns.items():
            if column_name in sheet_cols:
                return {
                    "extractedValue": sheet_name,
                    "validationStatus": "valid",
                    "aiReasoning": f"Located column '{column_name}' in worksheet '{sheet_name}'",
                    "confidenceScore": 100,
                    "documentSource": f"Sheet: {sheet_name}"
                }
        
        # Column not found in any worksheet
        return {
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Column '{column_name}' not found in any worksheet",
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
        }

# Test with sample data
if __name__ == "__main__":
    # Test with field validation format (what comes from previous step)
    test_column = {"extractedValue": "Date of Birth", "validationStatus": "valid"}
    
    test_doc = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Date of Birth
123	456	01/01/1970
"""
    
    result = get_worksheet_from_column(test_column, test_doc)
    print(json.dumps(result, indent=2))