#!/usr/bin/env python3

"""
Simple text extraction test script
"""

import json
import sys
import os

def test_text_extraction():
    try:
        # Read input from stdin
        input_data = sys.stdin.read().strip()
        print(f"DEBUG: Received input length: {len(input_data)}", file=sys.stderr)
        print(f"DEBUG: Received input: {input_data[:200]}...", file=sys.stderr)
        
        if not input_data:
            raise Exception("No input data received")
        
        data = json.loads(input_data)
        files = data.get('files', [])
        
        print(f"DEBUG: Processing {len(files)} files", file=sys.stderr)
        
        extracted_texts = []
        for file_info in files:
            file_name = file_info.get('file_name', 'unknown')
            file_content = file_info.get('file_content', '')
            mime_type = file_info.get('mime_type', '')
            
            print(f"DEBUG: Processing file {file_name} (type: {mime_type})", file=sys.stderr)
            
            # For now, just return a simple extracted text
            extracted_text = {
                "file_name": file_name,
                "text_content": f"Sample extracted text from {file_name}",
                "extraction_method": "test"
            }
            extracted_texts.append(extracted_text)
        
        result = {
            "success": True,
            "extracted_texts": extracted_texts
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    test_text_extraction()