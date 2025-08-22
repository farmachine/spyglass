def extract_function(Excel_Document):
    """
    Extracts column names from processed Excel document content.
    The Excel_Document parameter contains pre-processed text content from Excel sheets.
    """
    import sys
    results = []
    
    # Debug logging
    print(f"DEBUG: Received Excel_Document type: {type(Excel_Document)}", file=sys.stderr)
    print(f"DEBUG: Excel_Document length: {len(Excel_Document) if Excel_Document else 0}", file=sys.stderr)
    if Excel_Document:
        print(f"DEBUG: First 200 chars: {Excel_Document[:200]}", file=sys.stderr)
    
    if not Excel_Document:
        return [{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": "No content provided",
            "confidenceScore": 0,
            "documentSource": "@Excel Document"
        }]
    
    try:
        # Split content by sheet sections
        sheet_sections = Excel_Document.split("=== Sheet:")
        
        for section in sheet_sections[1:]:  # Skip first empty section
            lines = section.strip().split('\n')
            if len(lines) < 2:
                continue
                
            # First line contains sheet name
            sheet_name = lines[0].split('===')[0].strip()
            
            # Second line contains column headers (tab-separated)
            if len(lines) > 1:
                header_line = lines[1]
                column_names = [col.strip() for col in header_line.split('\t') if col.strip()]
                
                for column_name in column_names:
                    if column_name and column_name != '':
                        results.append({
                            "extractedValue": column_name,  # Just the column name string
                            "validationStatus": "valid",
                            "aiReasoning": f"Successfully extracted column name '{column_name}' from sheet '{sheet_name}'",
                            "confidenceScore": 95,
                            "documentSource": "@Excel Document"
                        })
    
    except Exception as e:
        return [{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": f"Error processing Excel content: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "@Excel Document"
        }]
    
    if not results:
        return [{
            "extractedValue": None,
            "validationStatus": "invalid", 
            "aiReasoning": "No column names found in the Excel document",
            "confidenceScore": 0,
            "documentSource": "@Excel Document"
        }]
    
    return results