#!/usr/bin/env python3

"""
GEMINI AI EXTRACTION SCRIPT
Single-step process: Receive prompt → Send to Gemini → Return result
"""

import json
import sys
import os
from google import genai
from google.genai import types

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        prompt = data.get('prompt', '')
        project_id = data.get('projectId', '')
        session_id = data.get('sessionId', '')
        
        print(f"DEBUG: Starting Gemini extraction for session {session_id}", file=sys.stderr)
        print(f"DEBUG: Prompt length: {len(prompt)} characters", file=sys.stderr)
        
        # Check if documents are in the prompt
        if "DOCUMENTS TO PROCESS" in prompt:
            doc_section = prompt.split("DOCUMENTS TO PROCESS")[1].split("--- END OF DOCUMENTS ---")[0] if "--- END OF DOCUMENTS ---" in prompt else "Not found"
            print(f"DEBUG: Document section found, length: {len(doc_section)}", file=sys.stderr)
            print(f"DEBUG: First 300 chars of document section: {doc_section[:300]}", file=sys.stderr)
        else:
            print("DEBUG: No 'DOCUMENTS TO PROCESS' section found in prompt", file=sys.stderr)
        
        # Initialize Gemini client
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Send prompt to Gemini
        print("DEBUG: Sending request to Gemini API...", file=sys.stderr)
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.1,
                response_mime_type="text/plain"
            )
        )
        
        if response and response.text:
            result_text = response.text.strip()
            print(f"DEBUG: Received response from Gemini ({len(result_text)} characters)", file=sys.stderr)
            
            # Return success response
            result = {
                "success": True,
                "extractedData": result_text,
                "sessionId": session_id,
                "projectId": project_id
            }
        else:
            result = {
                "success": False,
                "error": "No response received from Gemini API",
                "sessionId": session_id,
                "projectId": project_id
            }
        
        # Output JSON result to stdout
        print(json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        error_result = {
            "success": False,
            "error": str(e),
            "sessionId": data.get('sessionId', '') if 'data' in locals() else '',
            "projectId": data.get('projectId', '') if 'data' in locals() else ''
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()