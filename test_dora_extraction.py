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

Article 3. Data Security and Operational Resilience
3.1 ICT Risk Management: Provider shall implement comprehensive information and communication technology (ICT) risk management framework in accordance with digital operational resilience requirements.

3.2 Third-party Risk Assessment: All outsourcing arrangements must undergo operational resilience assessment prior to implementation.

Article 7. Compliance Requirements  
7.1 Regulatory Compliance: Provider must maintain compliance with applicable financial services regulations including DORA requirements for operational resilience.

7.2 Incident Reporting: Provider shall establish incident reporting procedures for ICT-related operational disruptions within 24 hours.

Article 12. Service Level Requirements
12.1 Business Continuity: Provider must maintain 99.9% service availability with defined recovery time objectives.

Parties:
- Financial Institution ABC Corp (123 Main St, New York, NY)
- Technology Provider XYZ Ltd (456 Tech Blvd, London, UK)

Services Covered:
- Core banking platform hosting (Critical)
- Payment processing services (High)
- Customer data analytics (Medium)
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