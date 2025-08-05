#!/usr/bin/env python3
"""
Fix Excel session by running extraction with proper project schema
"""
import json
import requests
import importlib.util

def fix_excel_extraction():
    session_id = "edb3c841-48fb-4907-987f-b459c5ceb6e0"
    
    try:
        # Get session data
        session_response = requests.get(f'http://localhost:5000/api/sessions/{session_id}')
        session = session_response.json()
        
        project_id = session['projectId']
        print(f"Project ID: {project_id}")
        
        # Get project schema
        project_response = requests.get(f'http://localhost:5000/api/projects/{project_id}')
        if project_response.status_code != 200:
            print(f"Failed to get project: {project_response.status_code}")
            return False
            
        project = project_response.json()
        print(f"Project: {project.get('name')}")
        
        # Build schema for extraction
        schema_fields = project.get('schemaFields', [])
        collections = project.get('collections', [])
        
        print(f"Schema fields: {len(schema_fields)}")
        print(f"Collections: {len(collections)}")
        
        if not schema_fields and not collections:
            print("No schema fields or collections found - cannot extract data")
            return False
        
        # Prepare project schema
        project_schema = {
            "schema_fields": schema_fields,
            "collections": collections
        }
        
        # Get extracted text data
        extracted_data = json.loads(session['extractedData'])
        doc = extracted_data['extracted_texts'][0]
        
        print(f"Document: {doc['file_name']}")
        print(f"Content length: {len(doc['text_content'])} characters")
        
        # Prepare extraction data
        documents = [{
            "file_name": doc["file_name"],
            "file_content": doc["text_content"],
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }]
        
        # Load AI extraction module
        spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction_simplified.py")
        ai_extraction = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ai_extraction)
        
        print("Running AI extraction with proper schema...")
        
        # Run extraction with the actual project schema
        result = ai_extraction.step1_extract_from_documents(
            documents=documents,
            project_schema=project_schema,
            session_name=project.get('name', 'Excel Analysis')
        )
        
        print(f"AI extraction success: {result.success}")
        if not result.success:
            print(f"Error: {result.error_message}")
            return False
        
        # Check if we got actual field validations
        if hasattr(result, 'extracted_data') and result.extracted_data:
            field_validations = result.extracted_data.get('field_validations', [])
            print(f"Extracted {len(field_validations)} field validations")
            
            # Show sample validations
            for i, validation in enumerate(field_validations[:5]):
                field_name = validation.get('fieldName', 'Unknown')
                status = validation.get('validationStatus', 'Unknown')
                value = validation.get('extractedValue', '')
                print(f"  {field_name}: {status} = '{str(value)[:50]}'")
                
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_excel_extraction()
    if success:
        print("\nNow try accessing the session again to see if data is visible")
    else:
        print("\nExtraction failed - please check the logs above")