#!/usr/bin/env python3
"""
Test the document storage functionality by creating a test Excel file and running extract-text-only
"""
import json
import pandas as pd
import io
import base64
import requests

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

def test_extract_text():
    """Test the extract-text endpoint with a new Excel file"""
    
    # Create test Excel
    excel_data_url = create_test_excel()
    
    # Prepare the same format as the frontend sends
    test_data = {
        "files": [
            {
                "name": "test_employees.xlsx",
                "content": excel_data_url,
                "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        ]
    }
    
    print("Testing document storage with extract-text endpoint...")
    print(f"File size: {len(excel_data_url)} bytes")
    
    # Call the extract-text endpoint
    try:
        response = requests.post(
            "http://localhost:5000/api/sessions/d76539a6-d7c0-4eb3-9b07-02ff4830747a/extract-text",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
        
        if response.status_code == 200:
            print("✅ Extract text completed successfully")
            
            # Check if document was saved
            docs_response = requests.get(
                "http://localhost:5000/api/sessions/d76539a6-d7c0-4eb3-9b07-02ff4830747a/documents"
            )
            
            if docs_response.status_code == 200:
                documents = docs_response.json()
                print(f"📄 Found {len(documents)} documents in session")
                
                for doc in documents:
                    print(f"  - {doc['fileName']} (size: {doc['fileSize']}, extracted: {len(doc['extractedContent'])} chars)")
                    
            else:
                print(f"❌ Failed to fetch documents: {docs_response.status_code}")
        else:
            print(f"❌ Extract text failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing extract-text: {e}")

if __name__ == "__main__":
    test_extract_text()