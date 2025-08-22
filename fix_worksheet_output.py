import json

def get_worksheet_from_column(columns, document):
    try:
        results = []
        
        # Handle document input - could be string or extracted content
        if isinstance(document, dict):
            document_content = document.get('extracted_content', str(document))
        else:
            document_content = str(document)
        
        # Parse columns from various input formats
        column_names = []
        
        # Check if columns is a list of field validation objects (from previous step)
        if isinstance(columns, list) and len(columns) > 0:
            first_item = columns[0]
            if isinstance(first_item, dict) and 'extractedValue' in first_item:
                # This is field validation format from previous step
                column_names = [item['extractedValue'] for item in columns if item.get('extractedValue')]
            elif isinstance(first_item, str):
                # Simple list of column names
                column_names = columns
            else:
                # Unknown list format
                column_names = [str(item) for item in columns]
        elif isinstance(columns, dict):
            # Handle structured table input
            if 'rows' in columns:
                for row in columns['rows']:
                    if 'Column Name' in row:
                        column_names.append(row['Column Name'])
        else:
            # Try to parse as JSON string
            try:
                parsed = json.loads(columns)
                if isinstance(parsed, list):
                    if len(parsed) > 0 and isinstance(parsed[0], dict) and 'extractedValue' in parsed[0]:
                        column_names = [item['extractedValue'] for item in parsed if item.get('extractedValue')]
                    else:
                        column_names = parsed
                elif isinstance(parsed, dict) and 'rows' in parsed:
                    for row in parsed['rows']:
                        if 'Column Name' in row:
                            column_names.append(row['Column Name'])
            except:
                # Assume it's a single column name
                column_names = [str(columns)]
        
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
        
        # Find which worksheet each column belongs to
        for col_name in column_names:
            found = False
            for sheet_name, sheet_cols in worksheet_columns.items():
                if col_name in sheet_cols:
                    results.append({
                        "extractedValue": sheet_name,
                        "validationStatus": "valid",
                        "aiReasoning": f"Located column '{col_name}' in worksheet '{sheet_name}'",
                        "confidenceScore": 100,
                        "documentSource": f"Sheet: {sheet_name}"
                    })
                    found = True
                    break
            
            if not found:
                results.append({
                    "extractedValue": None,
                    "validationStatus": "invalid",
                    "aiReasoning": f"Column '{col_name}' not found in any worksheet",
                    "confidenceScore": 0,
                    "documentSource": "Not found"
                })
        
        # Return the results array directly, not as JSON string
        return results
        
    except Exception as e:
        return [{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Error processing request: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "Error"
        }]

# Test with sample data
if __name__ == "__main__":
    # Test with field validation format
    test_columns = [
        {"extractedValue": "Old Member's Reference No", "validationStatus": "valid"},
        {"extractedValue": "Date of Birth", "validationStatus": "valid"}
    ]
    
    test_doc = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Date of Birth
123	456	01/01/1970
"""
    
    result = get_worksheet_from_column(test_columns, test_doc)
    print(json.dumps(result, indent=2))