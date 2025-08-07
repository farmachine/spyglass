#!/usr/bin/env python3
"""
Repair script to fix session 78a0feab-d4ca-43e1-9e0f-8eb201ecd51c
that has correct AI response data but null validation records.
"""
import json
import requests

def repair_session():
    session_id = "78a0feab-d4ca-43e1-9e0f-8eb201ecd51c"
    
    print(f"Fetching session {session_id}...")
    
    # Get session data
    response = requests.get(f"http://localhost:5000/api/sessions/{session_id}")
    if response.status_code != 200:
        print(f"Failed to fetch session: {response.status_code}")
        return
    
    session_data = response.json()
    ai_response_str = session_data.get('aiResponse')
    
    if not ai_response_str:
        print("No AI response found")
        return
    
    # Parse AI response JSON string
    try:
        ai_response = json.loads(ai_response_str)
    except json.JSONDecodeError as e:
        print(f"Failed to parse AI response: {e}")
        return
    
    field_validations = ai_response.get('field_validations', [])
    print(f"Found {len(field_validations)} field validations in AI response")
    
    if not field_validations:
        print("No field validations found")
        return
    
    # Show first few validations
    for i, validation in enumerate(field_validations[:3]):
        print(f"Validation {i}: {validation.get('field_name')} = {validation.get('extracted_value')}")
    
    # Send to save-validations endpoint
    update_data = {
        'validations': field_validations
    }
    
    print(f"Sending {len(field_validations)} validations to save-validations endpoint...")
    
    response = requests.post(f"http://localhost:5000/api/sessions/{session_id}/save-validations", 
                           json=update_data)
    
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("SUCCESS: Session repaired!")
    else:
        print("FAILED: Could not repair session")

if __name__ == "__main__":
    repair_session()