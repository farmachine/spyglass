import json

# Simulate the function returning a list of field validation objects
result = [
    {
        "extractedValue": "New_Pensioners",
        "validationStatus": "valid",
        "aiReasoning": "Located column 'Column1' in worksheet 'New_Pensioners'",
        "confidenceScore": 100,
        "documentSource": "Sheet: New_Pensioners"
    },
    {
        "extractedValue": "Active_deferreds",
        "validationStatus": "valid",
        "aiReasoning": "Located column 'Column2' in worksheet 'Active_deferreds'",
        "confidenceScore": 100,
        "documentSource": "Sheet: Active_deferreds"
    }
]

# This is what the current code does - check if it's a list of field validation objects
if isinstance(result, list):
    if all(isinstance(item, dict) and 'extractedValue' in item and 'validationStatus' in item for item in result):
        print("Result is field validation format")
        print(json.dumps(result))
    else:
        print("Result is list but not field validation format")
