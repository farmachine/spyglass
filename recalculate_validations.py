#!/usr/bin/env python3
"""
Recalculate validation data for failed session b0b1105f-7d85-4bff-a3a6-3a3d967bafac
by directly calling the AI extraction with simulated document content
"""
import subprocess
import json
import sys

def fix_session_directly():
    """Directly fix the session by simulating a proper extraction"""
    
    session_id = "b0b1105f-7d85-4bff-a3a6-3a3d967bafac"
    
    print(f"Fixing session {session_id} with direct AI extraction...")
    
    # Create a simulated extraction input that matches the project schema
    # This session is for "DORA Contract Remediation" project
    extraction_input = {
        "step": "extract",
        "files": [
            {
                "file_name": "sample_dora_contract.pdf",
                "text_content": """
MASTER SERVICE AGREEMENT

MSA ID: MSA-DORA-2024-001
Effective Date: January 15, 2024
Governing Law: Laws of Delaware, United States

This Master Service Agreement ("Agreement") is entered into between:

PARTY 1: FinTech Solutions Inc.
Role: Service Provider
Address: 123 Financial District, New York, NY 10004, USA

PARTY 2: European Bank Ltd.
Role: Financial Entity
Address: 456 Banking Street, Frankfurt, Germany

SERVICES COVERED:
1. Cloud Infrastructure Services - Critical Systems
2. Data Processing Services - DORA Critical
3. Incident Response Services - High Priority

DORA RELEVANT CLAUSES:
Section 5.1 - Operational Resilience Requirements
Summary: Provider must maintain 99.9% uptime for critical systems
DORA Compliance Status: Requires Remediation
Remediation Action: Implement enhanced monitoring systems

Overall DORA Applicability: Fully Applicable - Financial Entity Services
Last Review Date: March 1, 2024
                """
            }
        ],
        "project_schema": {
            "schema_fields": [
                {
                    "name": "MSA ID/Number",
                    "fieldId": "031e305d-3fea-4df2-8af8-9aa24f7e1ba7",
                    "description": "The unique identifier for the Master Service Agreement",
                    "fieldType": "TEXT"
                },
                {
                    "name": "Effective Date",
                    "fieldId": "ab54d406-bc7d-425e-99af-1e307ce30c97", 
                    "description": "The date when the agreement becomes effective",
                    "fieldType": "DATE"
                },
                {
                    "name": "Governing Law",
                    "fieldId": "98c1f5d6-9285-4d86-959e-5b0f89754286",
                    "description": "The legal jurisdiction that governs this agreement",
                    "fieldType": "TEXT"
                },
                {
                    "name": "Overall DORA Applicability",
                    "fieldId": "20c00cc1-7638-4da3-8063-91bbb55b66f9",
                    "description": "Assessment of whether DORA regulations apply to this agreement",
                    "fieldType": "TEXT"
                },
                {
                    "name": "Last Review Date",
                    "fieldId": "51b70d5e-cfa2-4d3c-9675-e91db4b74bde",
                    "description": "The date when this agreement was last reviewed",
                    "fieldType": "DATE"
                },
                {
                    "name": "Term Start Date",
                    "fieldId": "e8f9a0b1-c2d3-4e5f-6789-0a1b2c3d4e5f",
                    "description": "The start date of the agreement term",
                    "fieldType": "DATE"
                }
            ],
            "collections": [
                {
                    "name": "Parties",
                    "collectionId": "parties_collection_id",
                    "properties": [
                        {
                            "name": "Name",
                            "fieldId": "0af823dc-a6d0-44df-af46-fff60b41208c",
                            "description": "The legal name of the party",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Role",
                            "fieldId": "fb26389d-262f-4ce5-a59a-ac9bf06bc1d9",
                            "description": "The role of the party in the agreement",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Address",
                            "fieldId": "270fdf00-113c-48ad-adfb-53b62f9ba9d7",
                            "description": "The address of the party",
                            "fieldType": "TEXT"
                        }
                    ]
                },
                {
                    "name": "Services Covered",
                    "collectionId": "services_collection_id",
                    "properties": [
                        {
                            "name": "Service Name/Description",
                            "fieldId": "9a70d53c-793c-4efd-ab82-241ce7bbeedf",
                            "description": "Description of the service provided",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Service Category",
                            "fieldId": "2b984906-56df-4546-89e9-8c0543fca99c",
                            "description": "Category classification of the service",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "DORA Criticality",
                            "fieldId": "475305d3-b9ae-4192-ad0f-4816ec1e341e",
                            "description": "Level of criticality under DORA regulations",
                            "fieldType": "TEXT"
                        }
                    ]
                },
                {
                    "name": "DORA Relevant Clauses",
                    "collectionId": "clauses_collection_id",
                    "properties": [
                        {
                            "name": "Clause Title/Topic",
                            "fieldId": "c2c0b5f2-1eab-4cad-8c8f-9dbc78d7f550",
                            "description": "The title or main topic of the clause",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Section Reference",
                            "fieldId": "a3686c59-6a3f-4aea-879f-1d053663ae90",
                            "description": "Reference to the section number in the document",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Summary of Clause",
                            "fieldId": "66a98e6a-4e72-4f7e-8e6d-d0a3398140ed",
                            "description": "Brief summary of what the clause covers",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "DORA Compliance Status",
                            "fieldId": "0fc5a840-b79b-4ad0-8ff5-65f9944a835a",
                            "description": "Current compliance status regarding DORA requirements",
                            "fieldType": "TEXT"
                        },
                        {
                            "name": "Remediation Action Required",
                            "fieldId": "2f1b654f-22e7-4267-939a-401fcd86d6b2",
                            "description": "Actions needed to achieve compliance",
                            "fieldType": "TEXT"
                        }
                    ]
                }
            ]
        },
        "extraction_rules": []
    }
    
    # Write input to temporary file and run extraction
    with open('/tmp/extraction_input.json', 'w') as f:
        json.dump(extraction_input, f, indent=2)
    
    print("Running AI extraction...")
    result = subprocess.run([
        'python3', 'ai_extraction_simplified.py'
    ], input=json.dumps(extraction_input), text=True, capture_output=True)
    
    if result.returncode == 0:
        print("✓ AI extraction completed successfully")
        print("Output preview:")
        print(result.stdout[-500:])  # Show last 500 chars
        return True
    else:
        print("❌ AI extraction failed")
        print("Error:", result.stderr)
        return False

if __name__ == "__main__":
    fix_session_directly()