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
ASANA MASTER SUBSCRIPTION AGREEMENT

1.6 Subcontractors: Asana may use subcontractors for Professional Services, and may disclose Confidential Information to them, provided they are obligated to maintain confidentiality.

2.5 Security; Protection of Customer Data: Asana implements and maintains reasonable administrative, organizational, and technical safeguards for the protection, confidentiality, and integrity of Customer Data, as described in their Data Security Standards and Data Processing Addendum (DPA).

2.6 Customer is responsible for notifying Asana of unauthorized use or access. Asana maintains security standards and the DPA applies to personal data.

2.7 Customer's Use of Third Party Services: Customer may integrate third-party services with the Service, and these third-party providers may access Customer Data. Asana disclaims responsibility for any use, disclosure, modification, or deletion of Customer Data by such third parties.

3.2.1(b) Service Warranties (Functionality): Asana warrants that it will not materially decrease the functionality of the Service. If a breach occurs and is not corrected, the customer may terminate the Order Form and receive a refund of prepaid, unused fees.

3.2.3 Malicious Code: Asana warrants that the Service is free from, and Asana will not introduce, software viruses, worms, logic bombs, Trojan horses, or other harmful code.

5.2 Termination for Cause: Either party may terminate the agreement with 30 days' written notice for material breach if not cured, or immediately for breach of acceptable use terms.

5.3 Effect of Termination: Upon termination or expiration, all customer rights and subscriptions cease. Customer remains obligated to pay accrued fees.

5.4 Treatment of Customer Data Following Expiration or Termination: Following termination, Asana may deactivate accounts. Customer Data is available for export for 30 days. After 30 days, Asana may delete data.

6 Confidentiality (Protection & Sensitive Data): The clause defines confidential information, outlines protection obligations for the receiving party, and prohibits the use of the Service to send or store sensitive personal information.

8 Indemnification (IP Infringement): Each party agrees to defend and indemnify the other against third-party claims that the Service or Customer Data infringes a patent or copyright.

9 Liability: Each party's aggregate liability is capped at the total amount paid by Customer in the preceding 12 months, excluding special, incidental, exemplary, or indirect damages, lost profits, etc.

10 Export Control and Economic Sanctions Compliance: Each party represents that it is not on any U.S. government prohibited or restricted parties list and agrees not to access or use the Service in a manner that would violate U.S. or international embargoes, economic sanctions, or export controls laws.

11.6 Access to Non-Production Versions of the Service: Non-production versions of the Service are provided 'as is' without warranties, are not for production use, are not supported, and are not subject to availability or security obligations.
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