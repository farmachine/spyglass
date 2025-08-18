import json
import requests
import os

# Function to update the sample data for the Get Worksheet from Column function
function_id = "303ca205-a7af-40dd-87d0-44deca9e6703"

# Sample data for Column Name parameter
column_sample_data = {
    "name": "Column Names",
    "rows": [
        {"Column Name": "Employer Code"},
        {"Column Name": "Date Pensionable Service Commenced"},
        {"Column Name": "Code For Previous Status"},
        {"Column Name": "Annual Pre-6.4.1988 GMP Component At Date Of This Valuation"},
        {"Column Name": "Widow(er)'s Annual Post-5.4.1988 GMP Component At Date Of This Valuation"}
    ],
    "columns": ["Column Name"],
    "identifierColumn": "Column Name"
}

# Prepare the update payload
update_data = {
    "inputParameters": [
        {
            "name": "Column Name",
            "type": "data",
            "description": "The name of the column in the excel file.",
            "sampleData": column_sample_data
        },
        {
            "name": "Excel File", 
            "type": "document",
            "description": "Excel file containing the columns and the worksheets.",
            "sampleFile": "Ersatz eighth (1).xlsx"
        }
    ]
}

print("Sample data configuration:")
print(json.dumps(update_data, indent=2))
