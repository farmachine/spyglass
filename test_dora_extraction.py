#!/usr/bin/env python3
import json
import subprocess

# Create test data that includes DORA-relevant clauses
test_data = {
    "operation": "extract",
    "documents": [
        {
            "file_name": "test_msa.pdf",
            "file_content": """
MASTER SERVICE AGREEMENT

This is a standard software licensing agreement between two technology companies.

Article 1. Software License Terms
1.1 License Grant: Licensor grants licensee a non-exclusive right to use the software.

Article 2. Payment Terms  
2.1 Fees: Licensee shall pay annual license fees as specified in Exhibit A.

Article 3. Support Services
3.1 Technical Support: Licensor will provide email support during business hours.

Parties:
- Software Company ABC Corp (123 Main St, New York, NY)  
- Technology User XYZ Ltd (456 Tech Blvd, London, UK)

Services Covered:
- Software licensing (Standard)
- Email support services (Basic)
- Documentation access (Standard)
            """,
            "mime_type": "application/pdf"
        }
    ],
    "project_schema": {
        "schema_fields": [],
        "collections": [
            {
                "collectionName": "DORA Relevant Clauses",
                "description": "Specific clauses or sections within the MSA that are pertinent to DORA compliance and remediation.",
                "properties": [
                    {
                        "id": "clause-title-1",
                        "propertyName": "Clause Title/Topic",
                        "propertyType": "TEXT",
                        "description": "The title or main topic of the specific clause"
                    },
                    {
                        "id": "section-ref-1", 
                        "propertyName": "Section Reference",
                        "propertyType": "TEXT",
                        "description": "The section number or reference identifier"
                    },
                    {
                        "id": "clause-summary-1",
                        "propertyName": "Summary of Clause", 
                        "propertyType": "TEXT",
                        "description": "A brief summary of what the clause covers"
                    },
                    {
                        "id": "dora-status-1",
                        "propertyName": "DORA Compliance Status",
                        "propertyType": "CHOICE",
                        "choiceOptions": ["Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable"],
                        "description": "Assessment of the clause's compliance with DORA requirements"
                    }
                ]
            }
        ]
    },
    "extraction_rules": [],
    "session_name": "test_dora"
}

print("=== TESTING DORA CLAUSE EXTRACTION ===")
print(f"Document content preview: {test_data['documents'][0]['file_content'][:200]}...")

try:
    # Run the Python script
    process = subprocess.Popen(
        ['python3', 'ai_extraction_simplified.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(input=json.dumps(test_data))
    
    print(f"Exit code: {process.returncode}")
    print(f"STDERR: {stderr}")
    
    if stdout:
        try:
            result = json.loads(stdout)
            print(f"SUCCESS: {result.get('success', False)}")
            
            if result.get('field_validations'):
                print(f"Extracted {len(result['field_validations'])} validations:")
                for validation in result['field_validations']:
                    print(f"  - {validation.get('field_name', 'Unknown')}: {validation.get('extracted_value', 'Not set')}")
            else:
                print("No field validations found")
                
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw stdout: {stdout}")
            
except Exception as e:
    print(f"Error running script: {e}")