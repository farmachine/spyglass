#!/usr/bin/env python3
"""
Test script to validate AI extraction for session 46db61ff-2673-40c2-b566-44581db216ab
with the new large document handling improvements
"""
import json
import sys
import subprocess
import logging

logging.basicConfig(level=logging.INFO)

def test_session_extraction():
    """Test the AI extraction for the problematic session"""
    
    # Session data extracted from database
    session_data = {
        "step": "extract",
        "session_name": "Ersatz",
        "documents": [{
            "file_name": "Ersatz eighth (1).xlsx",
            "file_content": """Excel file content from Ersatz eighth (1).xlsx:

=== SHEET: New_Pensioners ===
 Old Member's Reference No  Member's Reference No Employer Code Sex Code Date of Birth Date Became Pensioner Code For Previous Status Type Of Retirement Date Of Exit From Active Service  Annual Pre-6.4.1988 GMP Component At Date Of Exit From Active Service  Annual Post-5.4.1988 GMP Component At Date Of Exit From Active Service
                     33297                 133297           MNM        F    1962-03-05            2022-03-05                        D                 PN                       1992-03-13                                                                 421.20                                                                  184.08
                     33381                 133381           MNM        F    1962-03-19            2022-03-19                        D                 PN                       1985-06-18                                                                 174.72                                                                    0.00

=== SHEET: Active_deferreds ===
Valuation Record Type Member's Reference No Employer Code Benefits Scale Code Sex Code Date Of Birth Date Pensionable Service Commenced Date Became Active Deferred Member Code For Previous Status Normal Retirement Date
 AD 134226 MNM M 1964-06-10 1984-01-03 2018-09-30 A 2024-06-07
 AD 134227 MNM M 1959-05-14 1986-04-01 2018-09-30 A 2019-05-11

... (additional data rows would continue) ...""",
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }],
        "project_schema": {
            "schema_fields": [
                {
                    "id": "af112497-0aed-4aa1-a293-bff8a92b768e",
                    "fieldName": "Pension Scheme",
                    "fieldType": "TEXT",
                    "description": "The name of the pension scheme"
                },
                {
                    "id": "e4fd1a72-0cf3-44b0-8f8b-0b365920b651", 
                    "fieldName": "Admin Contact",
                    "fieldType": "TEXT",
                    "description": "Administrative contact details"
                }
            ],
            "collections": []
        },
        "extraction_rules": [],
        "knowledge_documents": [],
        "validated_data_context": {
            "existing_validations": [
                {
                    "field_id": "af112497-0aed-4aa1-a293-bff8a92b768e",
                    "extracted_value": "Ersatz",
                    "validation_status": "verified"
                }
            ]
        },
        "is_subsequent_upload": True
    }
    
    # Test the extraction
    logging.info("Testing AI extraction with optimized large document handling...")
    try:
        # Call the improved AI extraction script
        process = subprocess.Popen(
            ['python3', 'ai_extraction_simplified.py'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=json.dumps(session_data))
        
        if process.returncode == 0:
            result = json.loads(stdout)
            logging.info("✅ AI extraction successful!")
            logging.info(f"Extracted {len(result.get('field_validations', []))} field validations")
            
            # Show sample results
            for validation in result.get('field_validations', [])[:3]:
                logging.info(f"  - {validation.get('field_name')}: {validation.get('extracted_value')} (confidence: {validation.get('confidence_score')})")
            
            return True
        else:
            logging.error(f"❌ AI extraction failed with return code {process.returncode}")
            logging.error(f"Error output: {stderr}")
            return False
            
    except Exception as e:
        logging.error(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    success = test_session_extraction()
    sys.exit(0 if success else 1)