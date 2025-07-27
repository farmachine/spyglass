#!/usr/bin/env python3
"""
Test actual extraction with minimal data to find the error
"""
import json
import sys
import traceback

def test_minimal_extraction():
    """Test with minimal extraction data"""
    try:
        from ai_extraction import process_extraction_session
        
        # Minimal test data structure
        test_data = {
            "session_id": "test-session",
            "files": [
                {
                    "name": "test.txt",
                    "content": "This is a test document. Company Name: Test Corp. The effective date is January 1, 2024. Location: New York.",
                    "mimeType": "text/plain"
                }
            ],
            "project_schema": {
                "schema_fields": [
                    {
                        "id": "test-field-1",
                        "name": "Company Name",
                        "type": "TEXT",
                        "description": "Name of the company"
                    }
                ],
                "collections": []
            },
            "extraction_rules": [],
            "knowledge_documents": []
        }
        
        print("Starting minimal extraction test...")
        result = process_extraction_session(test_data)
        print("Extraction completed successfully!")
        print(f"Result keys: {list(result.keys())}")
        
        if "error" in result:
            print(f"ERROR in result: {result['error']}")
            return False
        
        return True
        
    except Exception as e:
        print(f"ERROR during extraction: {e}")
        print(f"Full traceback:\n{traceback.format_exc()}")
        return False

if __name__ == "__main__":
    success = test_minimal_extraction()
    sys.exit(0 if success else 1)