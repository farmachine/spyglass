import json
import sys

# The actual function code from the database
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
        
        # Check for common indicators of no content
        if excel_file_content in ['user_document', '["user_document"]', "['user_document']"]:
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"No column headers found. Content preview: {excel_file_content[:50]}...",
                "confidenceScore": 0,
                "documentSource": "N/A"
            }])
        
        # Find columns
        lines = excel_file_content.strip().split('\n')
        results = []
        sheet_columns = {}
        current_sheet = None
        
        for i, line in enumerate(lines):
            # Check for sheet markers
            if line.startswith('=== Sheet:') or line.startswith('Sheet:'):
                sheet_name = line.replace('=== Sheet:', '').replace('Sheet:', '').strip()
                sheet_name = sheet_name.replace('===', '').strip()
                current_sheet = sheet_name
                
                # Next line should have headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    columns = []
                    
                    # Try tab-separated first
                    if '\t' in headers_line:
                        columns = [col.strip() for col in headers_line.split('\t') if col.strip()]
                    elif '|' in headers_line:
                        columns = [col.strip() for col in headers_line.split('|') if col.strip()]
                    else:
                        # Try splitting by multiple spaces
                        import re
                        columns = [col.strip() for col in re.split(r'\s{2,}', headers_line) if col.strip()]
                    
                    if columns:
                        sheet_columns[current_sheet] = columns
        
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
        
        if not results:
            return json.dumps([{
                "extractedValue": None,
                "validationStatus": "invalid",
                "aiReasoning": f"No column headers found. Content preview: {excel_file_content[:50]}...",
                "confidenceScore": 0,
                "documentSource": "N/A"
            }])
        
        return json.dumps(results)
        
    except Exception as e:
        return json.dumps([{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Extraction failed: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "Error"
        }])

# Test with actual document content
test_content = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Employer Code	Sex Code	Date of Birth	Date Became Pensioner	Code For Previous Status	Type Of Retirement	Date Of Exit From Active Service	Annual Pre-6.4.1988 GMP Component At Date Of Exit From Active Service	Annual Post-5.4.1988 GMP Component At Date Of Exit From Active Service	Annual Pre-6.4.1988 GMP Component At Date Of This Valuation	Annual Post-5.4.1988 GMP Component At Date Of This Valuation	Component Of Pension At This Valuation Subject To CPI (capped At 2.5%)	Component Of Pension At This Valuation Subject To CPI (capped At 5%)	Component Of Pension At This Valuation Subject To Increases In Excess Of GMP	Component Of Pension At This Valuation Subject To LPI	Component Of Pension At This Valuation In Payment At Fixed Rate	Date Pensionable Service Commenced
AD134226	MNM		M	1964-06-10 00:00:00	1984-01-03 00:00:00	2018-09-30 00:00:00	RTA_06092016	2016-09-06 00:00:00	0	0	1212.89	3105.17	0	0	0	0	90000	1974-01-01 00:00:00"""

# Test with the function
result = get_column_names(test_content)
parsed = json.loads(result)
print(f"Found {len(parsed)} columns")
if parsed:
    print(f"First column: {parsed[0]}")
    print(f"Last column: {parsed[-1]}")
