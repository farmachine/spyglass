#!/usr/bin/env python3
"""
Fix session d82a1d78-a486-45b3-b5c5-4984bd8a4e73 by properly setting up the extracted text
and triggering AI extraction
"""
import json
import sys
import requests
import importlib.util

def fix_session():
    session_id = "d82a1d78-a486-45b3-b5c5-4984bd8a4e73"
    
    try:
        # Get session data
        response = requests.get(f'http://localhost:5000/api/sessions/{session_id}')
        if response.status_code != 200:
            print(f"Failed to get session: {response.status_code}")
            return False
            
        session = response.json()
        print(f"Session status: {session.get('status')}")
        
        # Extract the text from extractedData
        extracted_data = json.loads(session['extractedData'])
        combined_text = '\n\n'.join([doc['text_content'] for doc in extracted_data['extracted_texts']])
        
        print(f"Extracted text length: {len(combined_text)} characters")
        print(f"Preview: {combined_text[:200]}...")
        
        # Prepare data for AI extraction
        extraction_data = {
            "session_id": session_id,
            "documents": [{
                "file_name": doc["file_name"],
                "file_content": doc["text_content"],
                "mime_type": "text/plain"  # Since it's already extracted text
            } for doc in extracted_data["extracted_texts"]]
        }
        
        # Load AI extraction module
        spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction_simplified.py")
        ai_extraction = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ai_extraction)
        
        print("Running AI extraction...")
        
        # Get project data for schema context - we'll need to mock this since API is protected
        # For now, let's try the direct step1 extraction function
        documents = extraction_data["documents"]
        
        # Run the step1 extraction directly with minimal schema
        project_schema = {
            "schema_fields": [],
            "collections": []
        }
        
        result = ai_extraction.step1_extract_from_documents(
            documents=documents,
            project_schema=project_schema,
            session_name="Insurance Document"
        )
        
        print("AI Extraction Result:")
        print(f"Success: {result.success}")
        print(f"Error: {result.error_message}")
        if result.extracted_data:
            print("Extracted data available")
        else:
            print("No extracted data")
        
        return True
        
    except Exception as e:
        print(f"Error fixing session: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_session()
    sys.exit(0 if success else 1)