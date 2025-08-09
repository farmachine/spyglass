#!/usr/bin/env python3
"""
Run enhanced AI extraction to push from 154 to 185+ column mappings
"""
import json
import requests
import subprocess

def run_enhanced_extraction():
    """Run enhanced extraction to capture more column mappings"""
    
    # Get the session data from the existing session
    session_id = "46db61ff-2673-40c2-b566-44581db216ab"
    
    # Get authentication token
    login_response = requests.post("http://localhost:5000/api/auth/login", 
                                 json={"email": "admin@test.com", "password": "password"})
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return False
    
    token = login_response.json().get('token')
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Get the session to extract more comprehensive data
    session_response = requests.get(f"http://localhost:5000/api/sessions/{session_id}")
    if session_response.status_code != 200:
        print(f"❌ Failed to get session: {session_response.status_code}")
        return False
    
    session_data = session_response.json()
    extracted_data = json.loads(session_data['extractedData'])
    
    print("🚀 Running enhanced AI extraction...")
    print(f"📊 Current status: 154/185 column mappings (83%)")
    print(f"🎯 Target: Extract 31+ additional columns to reach 185+")
    
    # Run targeted AI extraction focusing on Column Name Mapping
    extraction_payload = {
        "targetPropertyIds": ["767bc354-2646-479b-b63d-5a1578c9ff8a", "bb243624-8e70-4489-b243-ec2ae8fad363"]
    }
    
    print("⚙️ Triggering AI extraction with enhanced capacity...")
    extraction_response = requests.post(
        f"http://localhost:5000/api/sessions/{session_id}/ai-extraction",
        headers=headers,
        json=extraction_payload
    )
    
    if extraction_response.status_code == 200:
        result = extraction_response.json()
        print(f"✅ AI extraction completed: {result.get('message', 'Success')}")
        
        # Check the new validation count
        import time
        time.sleep(2)  # Give database time to update
        
        # Query the updated count
        count_response = requests.get(f"http://localhost:5000/api/sessions/{session_id}/validations")
        if count_response.status_code == 200:
            validations = count_response.json()
            column_mappings = [v for v in validations if v.get('collection_name') == 'Column Name Mapping']
            
            # Count unique records
            unique_records = set(v.get('record_index', 0) for v in column_mappings)
            new_count = len(unique_records)
            
            print(f"📊 Updated count: {new_count} column mappings")
            print(f"📈 Progress: {new_count}/185 ({new_count/185*100:.1f}%)")
            
            if new_count >= 185:
                print(f"🎉 SUCCESS! Target reached with {new_count} column mappings!")
                return True
            else:
                improvement = new_count - 154
                print(f"📈 Improvement: +{improvement} new mappings")
                print(f"🎯 Still need {185 - new_count} more to reach target")
                return False
        else:
            print(f"❌ Failed to get updated validations: {count_response.status_code}")
            return False
    else:
        print(f"❌ AI extraction failed: {extraction_response.status_code}")
        try:
            error_details = extraction_response.json()
            print(f"Error details: {error_details}")
        except:
            print(f"Raw error: {extraction_response.text}")
        return False

if __name__ == "__main__":
    success = run_enhanced_extraction()
    
    if success:
        print("\n🎉 Successfully reached 185+ column mappings!")
        print("Your system now has maximum capacity for Excel column processing.")
    else:
        print("\n🔧 Working on reaching the 185+ target...")
        print("The enhanced capacity settings are ready for larger Excel files.")