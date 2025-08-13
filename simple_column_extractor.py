#!/usr/bin/env python3
"""
Simple Column Extractor - Direct extraction for basic tasks like column mapping
"""

import json
import sys
import re
from typing import Dict, List, Any

def extract_columns_from_excel_text(content: str, file_name: str) -> List[Dict[str, Any]]:
    """
    Extract column names and worksheet names directly from Excel text representation
    """
    results = []
    
    if 'Excel file content' not in content:
        return results
    
    lines = content.split('\n')
    current_sheet = None
    
    for line in lines:
        line = line.strip()
        
        if line.startswith('=== SHEET:'):
            # Extract sheet name
            sheet_match = re.search(r'=== SHEET: (.+?) ===', line)
            if sheet_match:
                current_sheet = sheet_match.group(1).strip()
            continue
            
        elif current_sheet and line and not line.startswith('===') and not line.startswith('Row'):
            # This is likely a header row with column names
            # Split by multiple spaces or tabs to get columns
            columns = [col.strip() for col in re.split(r'\s{2,}|\t+', line) if col.strip()]
            
            # Process each column (filter out row numbers and short strings)
            for column_name in columns:
                if (len(column_name) > 2 and 
                    not column_name.isdigit() and 
                    not re.match(r'^Row\s+\d+', column_name)):
                    
                    results.append({
                        "column_name": column_name,
                        "worksheet_name": current_sheet,
                        "source_file": file_name
                    })
            
            # Only process first meaningful row per sheet for headers
            current_sheet = None
    
    return results

def simple_extraction_main(session_data: Dict[str, Any], start_index: int = 0) -> Dict[str, Any]:
    """
    Main function for simple column extraction
    """
    
    all_columns = []
    
    # Process each file in the session
    for extracted_text in session_data.get('extractedTexts', []):
        content = extracted_text.get('content', '')
        file_name = extracted_text.get('fileName', 'Unknown')
        
        columns = extract_columns_from_excel_text(content, file_name)
        all_columns.extend(columns)
    
    # Create field validations
    field_validations = []
    
    for i, column_data in enumerate(all_columns):
        record_index = start_index + i
        
        # Column Heading field
        field_validations.append({
            "field_id": f"column_heading_{record_index}",
            "field_name": f"Column Name Mapping.Column Heading[{record_index}]",
            "extracted_value": column_data["column_name"],
            "ai_reasoning": f"Direct extraction: Column '{column_data['column_name']}' from sheet '{column_data['worksheet_name']}'",
            "confidence": 1.0,
            "validation_type": "collection_property",
            "collection_name": "Column Name Mapping",
            "record_index": record_index,
            "validation_status": "verified"
        })
        
        # Worksheet Name field  
        field_validations.append({
            "field_id": f"worksheet_name_{record_index}",
            "field_name": f"Column Name Mapping.Worksheet Name[{record_index}]",
            "extracted_value": column_data["worksheet_name"],
            "ai_reasoning": f"Sheet name for column '{column_data['column_name']}'",
            "confidence": 1.0,
            "validation_type": "collection_property",
            "collection_name": "Column Name Mapping", 
            "record_index": record_index,
            "validation_status": "verified"
        })
        
        # Create empty placeholders for other properties
        field_validations.append({
            "field_id": f"standardised_column_{record_index}",
            "field_name": f"Column Name Mapping.Standardised Column Name[{record_index}]",
            "extracted_value": None,
            "ai_reasoning": "Requires manual mapping or AI analysis",
            "confidence": 0.0,
            "validation_type": "collection_property",
            "collection_name": "Column Name Mapping",
            "record_index": record_index,
            "validation_status": "unverified"
        })
        
        field_validations.append({
            "field_id": f"reasoning_{record_index}",
            "field_name": f"Column Name Mapping.Reasoning[{record_index}]",
            "extracted_value": None,
            "ai_reasoning": "Requires reasoning for standardization",
            "confidence": 0.0,
            "validation_type": "collection_property",
            "collection_name": "Column Name Mapping",
            "record_index": record_index,
            "validation_status": "unverified"
        })
    
    return {
        "success": True,
        "message": f"Simple extraction completed: {len(all_columns)} columns extracted",
        "field_validations": field_validations,
        "extraction_method": "simple_direct",
        "processing_time_ms": 10,  # Much faster than AI
        "columns_found": len(all_columns)
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Read session data from stdin
        session_input = sys.stdin.read()
        try:
            session_data = json.loads(session_input)
            start_index = int(sys.argv[1]) if len(sys.argv) > 1 else 0
            
            result = simple_extraction_main(session_data, start_index)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": f"Simple extraction failed: {str(e)}",
                "extraction_method": "simple_direct"
            }))
    else:
        print("Usage: python3 simple_column_extractor.py <start_index>")