import json
import re

def get_column_names(*args, **kwargs):
    """Extract actual column names from Excel file content."""
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
        
        # Extract actual column headers from the Excel content
        lines = excel_file_content.strip().split('\n')
        all_columns = []
        seen_columns = set()
        
        for i, line in enumerate(lines):
            # Look for sheet markers
            if line.startswith('=== Sheet:') and line.endswith('==='):
                sheet_name = line.replace('=== Sheet:', '').replace('===', '').strip()
                
                # The next line should contain the column headers
                if i + 1 < len(lines):
                    headers_line = lines[i + 1]
                    
                    # Split by tabs (Excel TSV format)
                    headers = re.split(r'\t', headers_line)
                    
                    # Clean and filter headers
                    for header in headers:
                        header = header.strip()
                        # Skip empty headers and avoid duplicates
                        if header and header not in seen_columns:
                            seen_columns.add(header)
                            all_columns.append({
                                "column": header,
                                "sheet": sheet_name,
                                "position": len(all_columns) + 1
                            })
        
        # If no columns found through sheet markers, try to find tab-separated headers
        if not all_columns:
            for line in lines[:20]:  # Check first 20 lines
                if '\t' in line:
                    headers = re.split(r'\t', line)
                    # If we have at least 3 columns, assume it's a header row
                    if len(headers) >= 3:
                        for header in headers:
                            header = header.strip()
                            if header and header not in seen_columns and not header.replace('.', '').replace('-', '').isdigit():
                                seen_columns.add(header)
                                all_columns.append({
                                    "column": header,
                                    "sheet": "Unknown",
                                    "position": len(all_columns) + 1
                                })
                        if all_columns:
                            break
        
        # Format results
        results = []
        for col_info in all_columns:
            results.append({
                "extractedValue": col_info["column"],
                "validationStatus": "valid",
                "aiReasoning": f"Column from {col_info['sheet']} sheet at position {col_info['position']}",
                "confidenceScore": 100,
                "documentSource": f"{col_info['sheet']} - Column {col_info['position']}"
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
        }])

# Test the function
if __name__ == "__main__":
    test_content = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Date of Birth	Sex Code	Date Became Pensioner
123	456	01/01/1970	M	01/01/2022
=== Sheet: Active_Members ===
Employee ID	Name	Department	Salary	Join Date
789	John Smith	IT	50000	01/01/2020
"""
    
    result = get_column_names(test_content)
    parsed = json.loads(result)
    
    print(f"Found {len(parsed)} columns:")
    for item in parsed[:10]:  # Show first 10
        print(f"  - {item['extractedValue']} ({item['documentSource']})")