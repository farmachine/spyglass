#!/usr/bin/env python3
"""
Debug AI extraction to find the specific error
"""
import os
import json
import sys
import traceback

def test_ai_extraction():
    """Test basic AI extraction functionality"""
    try:
        # Test 1: Check API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("ERROR: GEMINI_API_KEY not found")
            return False
        print("✓ API key available")
        
        # Test 2: Import modules
        try:
            from google import genai
            print("✓ Google genai imported")
        except Exception as e:
            print(f"ERROR importing google.genai: {e}")
            return False
            
        # Test 3: Initialize client
        try:
            client = genai.Client(api_key=api_key)
            print("✓ Genai client created")
        except Exception as e:
            print(f"ERROR creating client: {e}")
            return False
            
        # Test 4: Simple API call
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Hello, respond with just 'OK'"
            )
            print(f"✓ API call successful: {response.text}")
        except Exception as e:
            print(f"ERROR making API call: {e}")
            return False
            
        # Test 5: Import main extraction function
        try:
            from ai_extraction import process_extraction_session
            print("✓ process_extraction_session imported")
        except Exception as e:
            print(f"ERROR importing process_extraction_session: {e}")
            return False
            
        print("All tests passed!")
        return True
        
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    test_ai_extraction()