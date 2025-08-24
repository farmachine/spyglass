import os
import sys
from google import genai

api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("No GEMINI_API_KEY found")
    sys.exit(1)

client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents="Say 'API is working' if you can read this."
    )
    print(f"Success! Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
