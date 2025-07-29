#!/usr/bin/env python3
"""
Fix failed extraction session by re-running the AI extraction process
"""
import requests
import json
import sys

def fix_session(session_id):
    """Fix a failed session by triggering re-extraction"""
    
    print(f"Fixing session: {session_id}")
    
    # Get session details
    session_response = requests.get(f"http://localhost:5000/api/sessions/{session_id}")
    if session_response.status_code != 200:
        print(f"Error getting session: {session_response.status_code}")
        return False
    
    session_data = session_response.json()
    project_id = session_data['projectId']
    
    print(f"Session project: {project_id}")
    print(f"Session status: {session_data['status']}")
    
    # Trigger re-extraction
    extract_payload = {"mode": "standard"}
    extract_response = requests.post(
        f"http://localhost:5000/api/orchestration/{session_id}/extract",
        json=extract_payload,
        headers={"Content-Type": "application/json"}
    )
    
    if extract_response.status_code == 200:
        print("Re-extraction triggered successfully")
        return True
    else:
        print(f"Failed to trigger re-extraction: {extract_response.status_code}")
        print(f"Response: {extract_response.text}")
        return False

if __name__ == "__main__":
    session_id = "b0b1105f-7d85-4bff-a3a6-3a3d967bafac"
    fix_session(session_id)