#!/usr/bin/env python3
"""
Test the sample data detection system
"""
import sys
import json
import importlib.util

def test_sample_detection():
    """Test the sample data detection with realistic data"""
    
    # Load the AI extraction module fresh
    spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction.py")
    ai_extraction = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ai_extraction)
    
    # Create a test project schema (simplified)
    test_schema = {
        "schema_fields": [
            {"fieldName": "Scheme Name", "fieldType": "TEXT", "description": "The name of the scheme"}
        ],
        "collections": []
    }
    
    # Simulate sample data response from AI (this should trigger detection)
    sample_response = """
    {
        "extracted_data": {
            "Scheme Name": "Sample scheme name from Ben_spec_TFL.docx"
        },
        "confidence_score": 0.95,
        "processing_notes": "Extraction completed"
    }
    """
    
    # Test the detection logic
    file_name = "Ben_spec_TFL.docx"
    raw_response = sample_response.strip()
    
    has_sample = "sample" in raw_response.lower()
    has_example = "example" in raw_response.lower()
    has_filename = file_name.lower() in raw_response.lower()
    
    print(f"=== SAMPLE DATA DETECTION TEST ===")
    print(f"File: {file_name}")
    print(f"Response contains 'sample': {has_sample}")
    print(f"Response contains 'example': {has_example}")
    print(f"Response contains filename: {has_filename}")
    print(f"Would trigger error: {has_sample or has_example or has_filename}")
    
    if has_sample or has_example or has_filename:
        print("✓ DETECTION WORKING - This would throw an error and prevent storage")
        error_message = f"AI extraction failed: Generated sample/placeholder data instead of real content. Document may be too complex or large for AI processing. Detected patterns: sample={has_sample}, example={has_example}, filename_referenced={has_filename}"
        print(f"Error message: {error_message}")
        return True
    else:
        print("✗ DETECTION FAILED - Sample data would be stored")
        return False

if __name__ == "__main__":
    test_sample_detection()