#!/usr/bin/env python3
"""
Test the Gemini API status to help diagnose the "500 An internal error has occurred" issue
"""
import os
import sys

def test_gemini_api():
    """Test basic Gemini API connectivity and functionality"""
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("❌ GEMINI_API_KEY not found in environment")
            return False
        
        print(f"✅ GEMINI_API_KEY found (length: {len(api_key)})")
        
        # Import Google AI modules
        try:
            import google.generativeai as genai
            print("✅ Google Generative AI library imported successfully")
        except ImportError as e:
            print(f"❌ Failed to import Google Generative AI library: {e}")
            return False
        
        # Configure API
        try:
            genai.configure(api_key=api_key)
            print("✅ API configured successfully")
        except Exception as e:
            print(f"❌ Failed to configure API: {e}")
            return False
        
        # Test basic model access
        try:
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            print("✅ Model initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize model: {e}")
            return False
        
        # Test simple generation
        try:
            print("🧪 Testing simple text generation...")
            response = model.generate_content("Hello, please respond with: API Test Success")
            if response and response.text:
                print(f"✅ Simple generation successful: {response.text.strip()}")
            else:
                print("❌ No response from simple generation")
                return False
        except Exception as e:
            print(f"❌ Simple generation failed: {e}")
            return False
        
        # Test JSON generation (what our extraction process does)
        try:
            print("🧪 Testing JSON generation...")
            json_prompt = '''Please respond with valid JSON in this exact format:
{
  "field_validations": [
    {
      "field_id": "test123",
      "field_name": "Test Field",
      "field_type": "TEXT",
      "extracted_value": "Test Value",
      "confidence": 0.95,
      "ai_reasoning": "This is a test"
    }
  ]
}'''
            response = model.generate_content(json_prompt)
            if response and response.text:
                import json
                # Try to parse the response as JSON
                json.loads(response.text.strip().replace('```json', '').replace('```', ''))
                print("✅ JSON generation successful and parseable")
            else:
                print("❌ No response from JSON generation")
                return False
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON generation returned unparseable response: {e}")
            print(f"Response: {response.text[:200]}...")
        except Exception as e:
            print(f"❌ JSON generation failed: {e}")
            return False
        
        print("\n🎉 All Gemini API tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Unexpected error during API testing: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_gemini_api()
    sys.exit(0 if success else 1)