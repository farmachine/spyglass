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
        
        # Handle both old format (prompt) and new format (files + schema_markdown)
        if 'prompt' in data:
            prompt = data.get('prompt', '')
            project_id = data.get('projectId', '')
            session_id = data.get('sessionId', '')
        else:
            # New format from server
            session_id = data.get('session_id', '')
            files = data.get('files', [])
            schema_markdown = data.get('schema_markdown', '')
            
            # Build prompt from files and schema
            documents_text = ""
            for i, file_data in enumerate(files):
                documents_text += f"\n=== DOCUMENT {i+1}: {file_data['file_name']} ===\n"
                documents_text += file_data['file_content']
                documents_text += "\n=== END OF DOCUMENT ===\n"
            
            prompt = f"{schema_markdown}\n\n## DOCUMENTS TO PROCESS\n{documents_text}\n--- END OF DOCUMENTS ---\n\nPlease extract the data according to the schema above and return the JSON response in the exact format specified."
            project_id = ''
        
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
                max_output_tokens=10000000,
                temperature=0.1,
                response_mime_type="text/plain"
            )
        )
        
        if response and response.text:
            result_text = response.text.strip()
            print(f"DEBUG: Received response from Gemini ({len(result_text)} characters)", file=sys.stderr)
            print(f"DEBUG: Response starts with: {result_text[:200]}", file=sys.stderr)
            print(f"DEBUG: Response ends with: {result_text[-200:]}", file=sys.stderr)
            
            # Check if response appears to be truncated
            if result_text.endswith('…') or '[TRUNCATED]' in result_text:
                print("WARNING: Response appears to be truncated!", file=sys.stderr)
            
            # Try to parse JSON from Gemini response
            try:
                # Look for JSON content in the response
                if '{' in result_text and '}' in result_text:
                    # Extract JSON from markdown code blocks if present
                    if '```json' in result_text:
                        json_start = result_text.find('```json') + 7
                        json_end = result_text.find('```', json_start)
                        json_text = result_text[json_start:json_end].strip()
                    elif '```' in result_text:
                        json_start = result_text.find('```') + 3
                        json_end = result_text.find('```', json_start)
                        json_text = result_text[json_start:json_end].strip()
                    else:
                        # Try to find JSON boundaries
                        first_brace = result_text.find('{')
                        last_brace = result_text.rfind('}')
                        json_text = result_text[first_brace:last_brace+1]
                    
                    print(f"DEBUG: Attempting to parse JSON: {json_text[:300]}...", file=sys.stderr)
                    parsed_json = json.loads(json_text)
                    
                    # Return parsed JSON structure 
                    result = {
                        "success": True,
                        "field_validations": parsed_json.get("field_validations", []),
                        "sessionId": session_id
                    }
                else:
                    print("DEBUG: No JSON structure found in response, returning as text", file=sys.stderr)
                    # Fallback: return as raw text
                    result = {
                        "success": True,
                        "extractedData": result_text,
                        "sessionId": session_id
                    }
            except json.JSONDecodeError as e:
                print(f"DEBUG: JSON parse error: {e}", file=sys.stderr)
                # Fallback: return as raw text
                result = {
                    "success": True,
                    "extractedData": result_text,
                    "sessionId": session_id
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