#!/usr/bin/env python3
"""
Retry the specific failing session a6bbb469-7fad-4bc9-a1bd-0b4760da0d16 
with the enhanced ultra-aggressive sanitization system.
"""
import subprocess
import json
import logging

logging.basicConfig(level=logging.INFO)

def retry_session_with_ultra_sanitization():
    """
    Retry the specific session that's been failing with content safety blocks.
    """
    session_id = "a6bbb469-7fad-4bc9-a1bd-0b4760da0d16"
    
    print(f"🔄 RETRYING SESSION WITH ULTRA-AGGRESSIVE SANITIZATION")
    print(f"=" * 60)
    print(f"Session ID: {session_id}")
    print(f"Issue: Content safety blocks on Spanish insurance document")
    print(f"Solution: 4-tier sanitization with ultra-aggressive final attempt")
    
    # Prepare the retry command with the session ID
    retry_cmd = [
        "python3", "ai_extraction_simplified.py",
        "--retry-session", session_id
    ]
    
    print(f"\n🚀 Executing retry with enhanced sanitization...")
    
    try:
        # Run the retry command
        result = subprocess.run(
            retry_cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print("✅ SUCCESS: Session retry completed successfully!")
            print(f"   stdout: {result.stdout}")
            
            # Try to parse the result
            try:
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if line.startswith('{') and 'success' in line:
                        response = json.loads(line)
                        if response.get('success'):
                            print(f"✅ AI Extraction succeeded!")
                            if 'field_validations' in response.get('extracted_data', {}):
                                validations = response['extracted_data']['field_validations']
                                print(f"   Extracted {len(validations)} field validations")
                        else:
                            print(f"❌ AI Extraction failed: {response.get('error', 'Unknown error')}")
                        break
            except json.JSONDecodeError:
                print("   Output is not JSON, but command succeeded")
                
        else:
            print(f"❌ FAILED: Session retry failed with exit code {result.returncode}")
            print(f"   stderr: {result.stderr}")
            print(f"   stdout: {result.stdout}")
            
    except subprocess.TimeoutExpired:
        print("⏰ TIMEOUT: Session retry took too long (>5 minutes)")
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    retry_session_with_ultra_sanitization()