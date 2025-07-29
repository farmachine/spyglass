#!/usr/bin/env python3
"""
Fresh extraction runner that bypasses module caching issues
"""
import sys
import json
import importlib.util

def run_extraction():
    """Run extraction with fresh module import"""
    try:
        # Force fresh import by loading module from file path
        spec = importlib.util.spec_from_file_location("ai_extraction", "./ai_extraction.py")
        ai_extraction = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ai_extraction)
        
        # Read input data
        data = json.loads(sys.stdin.read())
        
        # Call the extraction function
        result = ai_extraction.process_extraction_session(data)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    run_extraction()