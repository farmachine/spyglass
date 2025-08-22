import json
import sys

# Simulated function code
def get_worksheet_from_column(columns, document):
    results = []
    
    # Extract column names from field validation format
    column_names = []
    if isinstance(columns, list) and len(columns) > 0:
        first_item = columns[0]
        if isinstance(first_item, dict) and 'extractedValue' in first_item:
            column_names = [item['extractedValue'] for item in columns if item.get('extractedValue')]
    
    # Return test results
    for i, col_name in enumerate(column_names[:3]):  # Just 3 for testing
        results.append({
            "extractedValue": f"Sheet_{i}",
            "validationStatus": "valid",
            "aiReasoning": f"Located column '{col_name}' in worksheet",
            "confidenceScore": 100,
            "documentSource": f"Sheet: Sheet_{i}"
        })
    
    return results  # Returns a list, not JSON string

# Test execution - simulate what the execution script does
try:
    # Simulate inputs
    inputs = {
        "0.em9e3ppfap": [
            {"extractedValue": "Column1", "validationStatus": "valid"},
            {"extractedValue": "Column2", "validationStatus": "valid"},
            {"extractedValue": "Column3", "validationStatus": "valid"}
        ],
        "0.e2e4q7okb0q": "test document"
    }
    
    parameters = [
        {"name": "Columns", "id": "0.em9e3ppfap"},
        {"name": "Document", "id": "0.e2e4q7okb0q"}
    ]
    
    function_name = "get_worksheet_from_column"
    func_to_call = get_worksheet_from_column
    
    # Single execution mode
    args = []
    for param in parameters:
        param_name = param['name']
        param_id = param.get('id', param_name)
        
        # Try to find input by parameter ID first, then by name
        if param_id in inputs:
            args.append(inputs[param_id])
        elif param_name in inputs:
            args.append(inputs[param_name])
    
    # Execute function once
    result = func_to_call(*args)
    
    print(f"DEBUG: Result type: {type(result)}", file=sys.stderr)
    print(f"DEBUG: Result length: {len(result) if isinstance(result, list) else 'N/A'}", file=sys.stderr)
    
    # Check if result is already in the correct format
    if isinstance(result, list):
        # Check if it's already a list of field validation objects
        if all(isinstance(item, dict) and 'extractedValue' in item and 'validationStatus' in item for item in result):
            # Result is already in field validation format - just JSON encode it
            print(json.dumps(result))
        else:
            # List but not field validation format - convert each item
            output = []
            for idx, item in enumerate(result):
                output.append({
                    "extractedValue": item,
                    "validationStatus": "valid",
                    "aiReasoning": f"Extracted item {idx+1} from {function_name}",
                    "confidenceScore": 95,
                    "documentSource": f"CODE_FUNCTION_ITEM_{idx+1}"
                })
            print(json.dumps(output))
    else:
        # Non-list result
        output = [{
            "extractedValue": result,
            "validationStatus": "valid",
            "aiReasoning": f"Function {function_name} executed successfully",
            "confidenceScore": 95,
            "documentSource": "CODE_FUNCTION"
        }]
        print(json.dumps(output))

except Exception as e:
    error_output = {
        "extractedValue": None,
        "validationStatus": "invalid",
        "aiReasoning": f"Function execution error: {str(e)}",
        "confidenceScore": 0,
        "documentSource": "CODE_ERROR"
    }
    print(json.dumps([error_output]))
