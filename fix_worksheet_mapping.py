import json

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
        lines = document_content.strip().split('\n')
        all_columns_map = {}  # Maps column name to sheet name
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
                    headers = re.split(r'\t+', headers_line)
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
        # Map simplified names to actual Excel column headers
        column_mappings = {
            'title': ['Title', 'Member Title', 'Name Title'],
            'id': ['Member\'s Reference No', 'Old Member\'s Reference No', 'ID', 'Reference No'],
            'surname': ['Surname', 'Last Name', 'Family Name', 'Member Surname'],
            'first name': ['First Name', 'Given Name', 'Forename', 'Member First Name'],
            'sex': ['Sex Code', 'Gender', 'Sex', 'Gender Code'],
            'date of birth': ['Date of Birth', 'DOB', 'Birth Date'],
            'date joined fund': ['Date Joined Fund', 'Join Date', 'Entry Date', 'Date Became Pensioner'],
            'date left service': ['Date Left Service', 'Exit Date', 'Date Of Exit From Active Service'],
            'reason for exit': ['Reason For Exit', 'Exit Reason', 'Code For Exit From Pensioner Status'],
            'date pension commences': ['Date Pension Commences', 'Pension Start Date', 'Date Became Pensioner']
        }
        
        # Check if the column name matches any mapping
        column_key = column_name.lower().strip()
        for key, possible_names in column_mappings.items():
            if column_key == key or column_key in [n.lower() for n in possible_names]:
                # Look for any of the possible names in the actual columns
                for possible_name in possible_names:
                    if possible_name in all_columns_map:
                        sheet = all_columns_map[possible_name]
                        return {
                            "extractedValue": sheet,
                            "validationStatus": "valid",
                            "aiReasoning": f"Mapped '{column_name}' to column '{possible_name}' in worksheet '{sheet}'",
                            "confidenceScore": 90,
                            "documentSource": f"Sheet: {sheet}"
                        }
                    # Try case-insensitive
                    for col, sheet in all_columns_map.items():
                        if col.lower() == possible_name.lower():
                            return {
                                "extractedValue": sheet,
                                "validationStatus": "valid",
                                "aiReasoning": f"Mapped '{column_name}' to column '{col}' in worksheet '{sheet}'",
                                "confidenceScore": 85,
                                "documentSource": f"Sheet: {sheet}"
                            }
        
        # If still not found, return a helpful error with available columns
        available_columns = list(all_columns_map.keys())[:5]
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
        }

# Test the function
if __name__ == "__main__":
    test_doc = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Date of Birth	Sex Code
123	456	01/01/1970	M
=== Sheet: Active_Members ===
Title	Surname	First Name	Date Joined Fund
Mr	Smith	John	01/01/2000
"""
    
    # Test with various formats
    test_cases = [
        {"extractedValue": "Date of Birth"},  # Should find in New_Pensioners
        {"extractedValue": "Title"},  # Should find in Active_Members
        {"extractedValue": "ID"},  # Should map to Member's Reference No
        "Sex",  # Should map to Sex Code
    ]
    
    for test_column in test_cases:
        result = get_worksheet_from_column(test_column, test_doc)
        print(f"\nInput: {test_column}")
        print(f"Result: {json.dumps(result, indent=2)}")