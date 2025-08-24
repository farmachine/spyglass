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
        model='gemini-1.5-pro',
        contents="Say 'API is working' if you can read this."
    )
    print(f"Success! Gemini 1.5 Pro Response: {response.text}")
except Exception as e:
    print(f"Error with gemini-1.5-pro: {e}")
