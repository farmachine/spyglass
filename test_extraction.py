import json
import sys

# Test data similar to what the server sends
test_data = {
    "step": "extract_text_only",
    "documents": [{
        "file_name": "test.txt",
        "file_content": "data:text/plain;base64,VGVzdCBjb250ZW50IGZvciBleHRyYWN0aW9u",  # "Test content for extraction"
        "mime_type": "text/plain"
    }]
}

# Run the document_extractor
import subprocess
result = subprocess.run(['python3', 'document_extractor.py'], 
                       input=json.dumps(test_data), 
                       capture_output=True, 
                       text=True)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)

# Parse and show structure
try:
    output = json.loads(result.stdout)
    print("\nParsed output structure:")
    if isinstance(output, list):
        print(f"  - Array with {len(output)} elements")
        if output:
            print(f"  - First element keys: {list(output[0].keys())}")
    elif isinstance(output, dict):
        print(f"  - Object with keys: {list(output.keys())}")
except:
    print("Could not parse as JSON")
