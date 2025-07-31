#!/usr/bin/env python3
import json
import subprocess

# Test with contract content that should extract clauses
test_data = {
    "operation": "extract",
    "documents": [
        {
            "file_name": "test_contract.pdf",
            "file_content": """
MASTER SERVICE AGREEMENT

This agreement governs the provision of technology services.

Article 3. Service Level Requirements
3.1 Availability: Provider must maintain 99.9% system availability with maximum 4 hours downtime per month.
3.2 Response Time: All critical incidents must be addressed within 2 hours of notification.

Article 5. Data Security and Compliance  
5.1 Security Standards: Provider shall implement industry-standard security controls including encryption, access controls, and monitoring.
5.2 Regulatory Compliance: Services must comply with applicable financial regulations and operational risk management requirements.

Article 8. Business Continuity
8.1 Disaster Recovery: Provider must maintain comprehensive disaster recovery procedures with 4-hour recovery time objective.
8.2 Incident Management: All operational disruptions must be reported within 24 hours with detailed remediation plans.

Parties:
- Financial Services Corp (New York)
- Tech Provider Ltd (California)

Services Covered:
- Core banking platform (Critical)
- Payment processing (High)
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
    "session_name": "test_contract"
}

print("=== TESTING CLAUSE DETECTION WITH RELEVANT CONTENT ===")
print("This contract contains operational resilience content that should generate clauses...")

try:
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
                    field_name = validation.get('field_name', 'Unknown')
                    value = validation.get('extracted_value', 'Not set')
                    print(f"  - {field_name}: {value}")
                    
                # Check for CHOICE field compliance
                choice_fields = [v for v in result['field_validations'] if 'DORA Compliance Status' in v.get('field_name', '')]
                if choice_fields:
                    print(f"\nChoice field values:")
                    for cf in choice_fields:
                        print(f"  - {cf['field_name']}: {cf['extracted_value']}")
            else:
                print("No field validations found - this indicates the clause detection may not be working")
                
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw stdout: {stdout}")
            
except Exception as e:
    print(f"Error running script: {e}")