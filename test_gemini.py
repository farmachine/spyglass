#!/usr/bin/env python3

import os
import logging
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)

def test_gemini_api():
    """Test basic Gemini API connectivity"""
    
    # Remove GOOGLE_API_KEY if it exists to avoid conflicts
    if "GOOGLE_API_KEY" in os.environ:
        del os.environ["GOOGLE_API_KEY"]
        print("Removed GOOGLE_API_KEY from environment")
    
    # Get GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found")
        return False
    
    print(f"Using GEMINI_API_KEY: {api_key[:10]}...")
    
    try:
        client = genai.Client(api_key=api_key)
        print("Client created successfully")
        
        # Simple test call
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents="Say 'Hello World' as JSON: {\"message\": \"Hello World\"}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        
        print(f"Response type: {type(response)}")
        print(f"Response text: '{response.text}'")
        print(f"Response length: {len(response.text) if response.text else 0}")
        
        if response.text:
            import json
            try:
                parsed = json.loads(response.text)
                print(f"Parsed JSON: {parsed}")
                return True
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                return False
        else:
            print("No response text received")
            return False
            
    except Exception as e:
        print(f"API call failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_gemini_api()
    print(f"Test result: {'SUCCESS' if success else 'FAILED'}")