import os
from google import genai

api_key = os.environ.get('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

models_to_test = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash-exp',
]

for model in models_to_test:
    try:
        response = client.models.generate_content(
            model=model,
            contents="Say 'working'"
        )
        print(f"✓ {model}: WORKING - {response.text[:50]}")
    except Exception as e:
        if "429" in str(e):
            print(f"✗ {model}: Quota exceeded")
        else:
            print(f"✗ {model}: {str(e)[:100]}")
