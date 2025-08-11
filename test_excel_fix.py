#!/usr/bin/env python3
"""
Test script to demonstrate the Excel processing fix
"""
import json
import pandas as pd
import io
import base64

def create_test_excel():
    """Create a simple test Excel file"""
    data = {
        'Employee_ID': ['EMP001', 'EMP002', 'EMP003'],
        'Name': ['John Smith', 'Jane Doe', 'Bob Johnson'],
        'Department': ['IT', 'HR', 'Finance'],
        'Salary': [75000, 65000, 80000]
    }
    
    df = pd.DataFrame(data)
    
    # Create Excel in memory
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Employees', index=False)
    
    excel_buffer.seek(0)
    excel_data = excel_buffer.getvalue()
    
    # Convert to base64 data URL
    base64_data = base64.b64encode(excel_data).decode()
    data_url = f"data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{base64_data}"
    
    return data_url

def test_extract_text_only():
    """Test the extract-text-only function with a new Excel file"""
    
    # Create test Excel
    excel_data_url = create_test_excel()
    
    # Prepare the same format as the frontend sends
    test_data = {
        "step": "extract_text_only",
        "documents": [
            {
                "file_name": "test_employees.xlsx",
                "file_content": excel_data_url,
                "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        ]
    }
    
    print("Test data prepared:")
    print(f"Step: {test_data['step']}")
    print(f"File name: {test_data['documents'][0]['file_name']}")
    print(f"MIME type: {test_data['documents'][0]['mime_type']}")
    print(f"Data URL length: {len(test_data['documents'][0]['file_content'])}")
    
    return json.dumps(test_data)

if __name__ == "__main__":
    test_json = test_extract_text_only()
    print("\nGenerated test JSON for ai_extraction_simplified.py:")
    print(test_json[:200] + "...")