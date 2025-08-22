import json
import sys
import subprocess

# Test data
test_data = {
    "step": "extract_text_only",
    "documents": [{
        "file_name": "test.xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "file_content": "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBAoAAAAIAA=="  # Truncated for test
    }]
}

# Run the extractor
process = subprocess.Popen(['python3', 'document_extractor.py'], 
                          stdin=subprocess.PIPE, 
                          stdout=subprocess.PIPE, 
                          stderr=subprocess.PIPE)

stdout, stderr = process.communicate(input=json.dumps(test_data).encode())

print("STDOUT:", stdout.decode())
if stderr:
    print("STDERR:", stderr.decode())
