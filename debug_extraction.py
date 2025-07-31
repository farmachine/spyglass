#!/usr/bin/env python3
"""
Quick test to see what the AI extraction script is actually outputting
"""
import json
import subprocess
import sys

# Test data matching what the server would send
test_data = {
    "operation": "extract",
    "documents": [
        {
            "file_name": "test.pdf",
            "file_content": "This is a Master Service Agreement. The governing law is the State of California, United States. The parties are Asana, Inc. and BRYTER GmbH. Effective Date: January 1, 2022.",
            "mime_type": "application/pdf"
        }
    ],
    "project_schema": {
        "schema_fields": [
            {
                "id": "test-field-1",
                "fieldName": "Governing Law",
                "fieldType": "TEXT",
                "description": "The jurisdiction whose laws will govern the interpretation and enforcement of the MSA."
            }
        ],
        "collections": []
    },
    "extraction_rules": [],
    "session_name": "test"
}

print("=== TESTING AI EXTRACTION SCRIPT ===")
print(f"Input data: {json.dumps(test_data, indent=2)[:500]}...")

try:
    # Run the Python script
    process = subprocess.Popen(
        ['python3', 'ai_extraction_simplified.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(input=json.dumps(test_data))
    
    print(f"Exit code: {process.returncode}")
    print(f"STDOUT: {stdout[:1000]}...")
    print(f"STDERR: {stderr}")
    
    if stdout:
        try:
            result = json.loads(stdout)
            print(f"Parsed result: {json.dumps(result, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            
except Exception as e:
    print(f"Error running script: {e}")