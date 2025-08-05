#!/usr/bin/env python3
"""
Debug the Excel session edb3c841-48fb-4907-987f-b459c5ceb6e0
"""
import json
import requests
import importlib.util

def debug_excel_session():
    session_id = "edb3c841-48fb-4907-987f-b459c5ceb6e0"
    
    try:
        # Get session data
        response = requests.get(f'http://localhost:5000/api/sessions/{session_id}')
        session = response.json()
        
        print(f"Session status: {session.get('status')}")
        print(f"Extract status: {session.get('extractStatus')}")
        
        # Parse extracted data
        extracted_data = json.loads(session['extractedData'])
        doc = extracted_data['extracted_texts'][0]
        
        print(f"File: {doc['file_name']}")
        print(f"Content length: {len(doc['text_content'])} characters")
        
        # Check if content looks valid
        content = doc['text_content']
        lines = content.split('\n')[:20]  # First 20 lines
        print("First 20 lines of content:")
        for i, line in enumerate(lines):
            print(f"  {i+1}: {line[:100]}")
        
        # Try AI extraction
        print("\nAttempting AI extraction...")
        
        # Prepare extraction data
        extraction_data = {
            "session_id": session_id,
            "documents": [{
                "file_name": doc["file_name"],
                "file_content": doc["text_content"],
                "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }]
        }
        
        # Load AI extraction module
        spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction_simplified.py")
        ai_extraction = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ai_extraction)
        
        # Get project schema - we'll use empty for now
        project_schema = {
            "schema_fields": [],
            "collections": []
        }
        
        result = ai_extraction.step1_extract_from_documents(
            documents=extraction_data["documents"],
            project_schema=project_schema,
            session_name="Excel Analysis"
        )
        
        print(f"AI extraction success: {result.success}")
        if not result.success:
            print(f"Error: {result.error_message}")
        else:
            print("AI extraction completed successfully")
            
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    debug_excel_session()