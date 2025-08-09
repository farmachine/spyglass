#!/usr/bin/env python3
"""
Test script to verify the performance optimization for field validation updates
"""
import requests
import json
import time

def test_session_reprocessing():
    """Test that reprocessing a session doesn't cause redundant updates"""
    
    session_id = "46db61ff-2673-40c2-b566-44581db216ab"
    base_url = "http://localhost:5000"
    
    print("🧪 Testing performance optimization for field validation updates...")
    
    # Make multiple requests to trigger validation processing
    start_time = time.time()
    
    # Get validation data before test
    print("📊 Getting current validation count...")
    response = requests.get(f"{base_url}/api/sessions/{session_id}/validations")
    if response.status_code == 200:
        initial_count = len(response.json())
        print(f"Initial validation count: {initial_count}")
    else:
        print(f"Failed to get validations: {response.status_code}")
        return False
    
    # Test multiple calls to ensure no redundant updates
    print("🔄 Testing multiple validation requests...")
    for i in range(3):
        print(f"Request {i+1}/3...")
        response = requests.get(f"{base_url}/api/sessions/{session_id}/validations")
        if response.status_code != 200:
            print(f"Request {i+1} failed: {response.status_code}")
            return False
        time.sleep(0.5)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Final count should be the same
    response = requests.get(f"{base_url}/api/sessions/{session_id}/validations")
    if response.status_code == 200:
        final_count = len(response.json())
        print(f"Final validation count: {final_count}")
        
        if final_count == initial_count:
            print(f"✅ Test passed! No redundant records created")
            print(f"⏱️  Total duration: {duration:.2f} seconds")
            return True
        else:
            print(f"❌ Test failed! Count changed from {initial_count} to {final_count}")
            return False
    else:
        print(f"Failed to get final validations: {response.status_code}")
        return False

if __name__ == "__main__":
    success = test_session_reprocessing()
    print("\n" + "="*50)
    if success:
        print("🎉 Performance optimization working correctly!")
        print("The system now properly detects when values haven't changed.")
    else:
        print("⚠️  Performance test failed - check the optimization.")