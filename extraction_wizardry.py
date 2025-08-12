import json
import sys

def run_wizardry(documents=None):
    if documents:
        # Print the document properties as requested
        print(json.dumps(documents, indent=2))
    else:
        print("No documents provided")

if __name__ == "__main__":
    # Read JSON data from stdin if available
    documents = None
    if not sys.stdin.isatty():  # Check if there's input from stdin
        try:
            input_data = sys.stdin.read()
            if input_data.strip():
                documents = json.loads(input_data)
        except json.JSONDecodeError:
            pass
    
    run_wizardry(documents)