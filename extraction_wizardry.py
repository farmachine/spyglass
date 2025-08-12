import json
import sys

def run_wizardry(selected_data=None):
    if selected_data:
        documents = selected_data.get('documents', [])
        target_fields = selected_data.get('target_fields', [])
        additional_instructions = selected_data.get('additional_instructions', '')
        extraction_rules = selected_data.get('extraction_rules', [])
        
        result = {
            "message": "that's wizardry!",
            "processed_documents": len(documents),
            "processed_fields": len(target_fields),
            "has_instructions": bool(additional_instructions.strip()),
            "extraction_rules_count": len(extraction_rules),
            "document_names": [doc.get('fileName', 'Unknown') for doc in documents],
            "field_names": [field.get('fieldName', 'Unknown') for field in target_fields]
        }
        
        return result
    else:
        return {"message": "that's wizardry!", "note": "No data provided"}

if __name__ == "__main__":
    # Read JSON data from stdin if available
    selected_data = None
    if not sys.stdin.isatty():  # Check if there's input from stdin
        try:
            input_data = sys.stdin.read()
            if input_data.strip():
                selected_data = json.loads(input_data)
        except json.JSONDecodeError:
            pass
    
    result = run_wizardry(selected_data)
    print(json.dumps(result))