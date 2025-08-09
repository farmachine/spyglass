#!/usr/bin/env python3
"""
Test AI extraction with the actual session data to confirm the output format
"""
import json
import requests
import subprocess

def test_session_extraction():
    """Test AI extraction using actual session data"""
    
    # Get session data
    session_id = "46db61ff-2673-40c2-b566-44581db216ab"
    session_response = requests.get(f"http://localhost:5000/api/sessions/{session_id}")
    
    if session_response.status_code != 200:
        print(f"Failed to get session: {session_response.status_code}")
        return False
    
    session_data = session_response.json()
    extracted_data_json = json.loads(session_data['extractedData'])
    
    # Get the first document
    documents = extracted_data_json.get('extracted_texts', [])
    if not documents:
        print("No documents found in session")
        return False
    
    first_doc = documents[0]
    
    # Get project schema
    project_response = requests.get(f"http://localhost:5000/api/projects/{session_data['projectId']}")
    if project_response.status_code != 200:
        print(f"Failed to get project: {project_response.status_code}")
        return False
    
    project_data = project_response.json()
    
    # Get schema fields
    schema_response = requests.get(f"http://localhost:5000/api/projects/{session_data['projectId']}/schema-fields")
    schema_fields = schema_response.json() if schema_response.status_code == 200 else []
    
    # Get collections
    collections_response = requests.get(f"http://localhost:5000/api/projects/{session_data['projectId']}/collections")
    collections_data = collections_response.json() if collections_response.status_code == 200 else []
    
    # Build collections with properties
    collections = []
    for coll in collections_data:
        props_response = requests.get(f"http://localhost:5000/api/collections/{coll['id']}/properties")
        properties = props_response.json() if props_response.status_code == 200 else []
        
        collections.append({
            'collectionName': coll['collectionName'],
            'properties': properties
        })
    
    # Prepare extraction input
    extraction_input = {
        "operation": "extract",
        "documents": [{
            "file_name": first_doc['file_name'],
            "file_content": first_doc['text_content'][:10000],  # Use first 10KB
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }],
        "project_schema": {
            "schema_fields": schema_fields,
            "collections": collections
        },
        "extraction_rules": [],
        "knowledge_documents": [],
        "session_name": session_data['sessionName']
    }
    
    print(f"Testing extraction with:")
    print(f"- Document: {first_doc['file_name']}")
    print(f"- Content length: {len(first_doc['text_content'])} chars (using first 10K)")
    print(f"- Schema fields: {len(schema_fields)}")
    print(f"- Collections: {len(collections)}")
    if collections:
        print(f"- Collection 0: {collections[0]['collectionName']} with {len(collections[0]['properties'])} properties")
    
    # Run AI extraction
    try:
        input_json = json.dumps(extraction_input)
        
        process = subprocess.Popen(
            ['python3', 'ai_extraction_simplified.py'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=input_json)
        
        if process.returncode == 0:
            try:
                result = json.loads(stdout)
                field_validations = result.get('field_validations', [])
                
                print(f"\n✅ Extraction successful!")
                print(f"📊 Generated {len(field_validations)} field validations")
                
                # Check format
                if field_validations:
                    first_validation = field_validations[0]
                    required_keys = ['field_id', 'validation_type', 'data_type', 'field_name', 'extracted_value']
                    missing_keys = [key for key in required_keys if key not in first_validation]
                    
                    if missing_keys:
                        print(f"❌ Missing keys in validation: {missing_keys}")
                        print(f"First validation: {first_validation}")
                        return False
                    else:
                        print(f"✅ Correct field validation format")
                        
                        # Show samples
                        print(f"\n📋 Sample validations:")
                        for i, validation in enumerate(field_validations[:3]):
                            field_name = validation.get('field_name', 'Unknown')
                            extracted_value = validation.get('extracted_value', 'No value')
                            print(f"  {i+1}. {field_name} = '{extracted_value}'")
                        
                        if len(field_validations) > 3:
                            print(f"  ... and {len(field_validations) - 3} more")
                        
                        return True
                else:
                    print("❌ No field validations returned")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse AI response: {e}")
                print(f"Raw output (first 500 chars): {stdout[:500]}")
                return False
        else:
            print(f"❌ AI extraction failed with return code {process.returncode}")
            print(f"Error: {stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to run extraction: {e}")
        return False

if __name__ == "__main__":
    print("🔄 Testing AI extraction with actual session data...")
    success = test_session_extraction()
    
    if success:
        print("\n🎉 AI extraction output format is correct!")
        print("The system can properly extract field validations from your Excel data.")
    else:
        print("\n🔧 AI extraction needs format correction.")