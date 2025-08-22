import json

# Simulate the function
def get_worksheet_from_column(columns, document):
    results = []
    
    # Extract column names from field validation format
    column_names = []
    if isinstance(columns, list) and len(columns) > 0:
        first_item = columns[0]
        if isinstance(first_item, dict) and 'extractedValue' in first_item:
            column_names = [item['extractedValue'] for item in columns if item.get('extractedValue')]
    
    # Return two test results
    for i, col_name in enumerate(column_names[:2]):
        results.append({
            "extractedValue": f"Sheet_{i}",
            "validationStatus": "valid",
            "aiReasoning": f"Located column '{col_name}' in worksheet",
            "confidenceScore": 100,
            "documentSource": f"Sheet: Sheet_{i}"
        })
    
    return results

# Test input - field validation objects from previous step
test_input = [
    {"extractedValue": "Column1", "validationStatus": "valid"},
    {"extractedValue": "Column2", "validationStatus": "valid"}
]

# Execute function
result = get_worksheet_from_column(test_input, "test document")
print(f"Function returns type: {type(result)}")
print(f"Function returns: {result}")

# Check what the execution script would do
if isinstance(result, list):
    if all(isinstance(item, dict) and 'extractedValue' in item and 'validationStatus' in item for item in result):
        print("Would output:")
        print(json.dumps(result))
