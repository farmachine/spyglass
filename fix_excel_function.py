#!/usr/bin/env python3
"""
Script to update Excel wizardry function to handle cases where only headers are available
and create sample data entries for each column header found
"""

import os
import psycopg2

def update_excel_wizardry_function(function_id, function_code, description=None):
    """Update an existing Excel wizardry function"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        if description:
            query = """
            UPDATE excel_wizardry_functions 
            SET function_code = %s, description = %s, updated_at = NOW()
            WHERE id = %s
            """
            cursor.execute(query, (function_code, description, function_id))
        else:
            query = """
            UPDATE excel_wizardry_functions 
            SET function_code = %s, updated_at = NOW()
            WHERE id = %s
            """
            cursor.execute(query, (function_code, function_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"message": "Excel wizardry function updated successfully"}
        
    except Exception as e:
        return {"error": f"Failed to update Excel wizardry function: {str(e)}"}

# Updated function that handles header-only content and creates entries for each column
improved_function_code = '''def extract_excel_data(extracted_content, target_fields_data):
    results = []
    record_index = 0
    
    print(f"DEBUG - Starting extraction with content length: {len(extracted_content)}")
    print(f"DEBUG - Target fields: {len(target_fields_data)}")
    print(f"DEBUG - Content preview: {extracted_content[:200]}")
    
    # More flexible sheet splitting
    if "=== Sheet:" in extracted_content:
        sheets = extracted_content.split("=== Sheet:")
    else:
        sheets = [extracted_content]
    
    print(f"DEBUG - Found {len(sheets)} sheet sections")
    
    for sheet_idx, sheet_part in enumerate(sheets):
        if not sheet_part.strip():
            continue
            
        lines = sheet_part.strip().split("\\n")
        print(f"DEBUG - Sheet {sheet_idx}: {len(lines)} lines")
        
        if not lines:
            continue
            
        # Get sheet name 
        sheet_name = f"Sheet_{sheet_idx}"
        if lines and "===" in lines[0]:
            sheet_name = lines[0].replace("===", "").strip()
            lines = lines[1:]  # Remove sheet name line
        
        print(f"DEBUG - Processing sheet: {sheet_name}")
        
        # Find header row
        header_row = None
        data_rows = []
        
        for line_idx, line in enumerate(lines):
            if not line.strip():
                continue
                
            # Look for tab-separated values first
            if "\\t" in line:
                parts = line.strip().split("\\t")
                if len(parts) > 1:
                    if header_row is None:
                        header_row = parts
                        print(f"DEBUG - Found header: {header_row}")
                    else:
                        data_rows.append(parts)
            # Try comma-separated as fallback
            elif "," in line and len(line.split(",")) > 1:
                parts = [p.strip() for p in line.strip().split(",")]
                if header_row is None:
                    header_row = parts
                    print(f"DEBUG - Found CSV header: {header_row}")
                else:
                    data_rows.append(parts)
        
        if not header_row:
            print(f"DEBUG - No header found in sheet {sheet_name}")
            continue
            
        print(f"DEBUG - Found {len(data_rows)} data rows in {sheet_name}")
        
        # If no data rows but we have headers, create entries for each column header
        # This addresses the user's request to extract column headings
        if len(data_rows) == 0 and header_row:
            print(f"DEBUG - No data rows found, creating entries for column headers")
            
            for col_idx, header in enumerate(header_row):
                if header and header.strip():
                    header_clean = header.strip()
                    
                    # Try to match with target fields for better classification
                    field_match = None
                    collection_name = "ExcelData"
                    
                    for field in target_fields_data:
                        field_name = field.get("property_name", "").lower()
                        if field_name:
                            collection_name = field.get("collection_name", "ExcelData")
                            # Match column heading field specifically
                            if "column" in field_name and "heading" in field_name:
                                field_match = field
                                break
                    
                    # Create result entry for the column header
                    if field_match:
                        data_type = field_match.get("property_type", "TEXT")
                        field_name_full = f"{collection_name}.{field_match.get('property_name', 'Column_Heading')}[{record_index}]"
                        confidence = 0.95
                        reasoning = f"Extracted column header '{header_clean}' from sheet '{sheet_name}'"
                    else:
                        data_type = "TEXT"
                        field_name_full = f"{collection_name}.Column_Heading[{record_index}]"
                        confidence = 0.90
                        reasoning = f"Extracted column header '{header_clean}' from sheet '{sheet_name}'"
                    
                    result = {
                        "validation_type": "collection_property",
                        "data_type": data_type,
                        "field_name": field_name_full,
                        "collection_name": collection_name,
                        "extracted_value": header_clean,
                        "confidence_score": confidence,
                        "validation_status": "unverified",
                        "ai_reasoning": reasoning,
                        "record_index": record_index
                    }
                    
                    results.append(result)
                    print(f"DEBUG - Added header result: {field_name_full} = {header_clean}")
                    record_index += 1
        else:
            # Process data rows normally
            for row_idx, row_data in enumerate(data_rows):
                print(f"DEBUG - Processing row {row_idx}: {len(row_data)} columns")
                
                for col_idx, header in enumerate(header_row):
                    if col_idx < len(row_data) and row_data[col_idx].strip():
                        value = str(row_data[col_idx]).strip()
                        
                        # Try to match with target fields
                        field_match = None
                        collection_name = "ExcelData"
                        
                        for field in target_fields_data:
                            field_name = field.get("property_name", "").lower()
                            if field_name:
                                collection_name = field.get("collection_name", "ExcelData")
                                if (field_name in header.lower() or 
                                    header.lower() in field_name or
                                    field_name.replace("_", " ") in header.lower() or
                                    header.lower().replace(" ", "_") in field_name):
                                    field_match = field
                                    break
                        
                        # Create result entry
                        if field_match:
                            data_type = field_match.get("property_type", "TEXT")
                            field_name_full = f"{collection_name}.{field_match.get('property_name', header)}[{record_index}]"
                            confidence = 0.90
                            reasoning = f"Matched '{header}' from {sheet_name} to {field_match.get('property_name')}"
                        else:
                            data_type = "TEXT"
                            clean_header = header.replace(" ", "_").replace("-", "_").lower()
                            field_name_full = f"{collection_name}.{clean_header}[{record_index}]"
                            confidence = 0.75
                            reasoning = f"Extracted '{header}' from {sheet_name} (auto-mapped)"
                        
                        result = {
                            "validation_type": "collection_property",
                            "data_type": data_type,
                            "field_name": field_name_full,
                            "collection_name": collection_name,
                            "extracted_value": value,
                            "confidence_score": confidence,
                            "validation_status": "unverified",
                            "ai_reasoning": reasoning,
                            "record_index": record_index
                        }
                        
                        results.append(result)
                        print(f"DEBUG - Added data result: {field_name_full} = {value}")
                
                record_index += 1
    
    print(f"DEBUG - Total results: {len(results)}")
    return results'''

if __name__ == "__main__":
    function_id = "5cb27213-baeb-4c83-8acd-8033f04978b9"
    
    update_result = update_excel_wizardry_function(
        function_id, 
        improved_function_code,
        "Enhanced function that extracts column headers when no data rows are present, plus all data when available"
    )
    
    if 'error' in update_result:
        print(f"Error updating function: {update_result['error']}")
    else:
        print(f"Successfully updated function {function_id} to handle header-only content")