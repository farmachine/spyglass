#!/usr/bin/env python3
"""
Extraction Wizardry - AI-powered document data extraction for the wizard modal.

This module handles the extraction logic when users click "Run Extraction" in the wizard modal.
It processes selected documents, fields, and extraction rules to perform targeted AI extraction.
"""

import json
import sys
from typing import Dict, List, Any, Optional


def run_extraction(
    selected_documents: List[Dict[str, Any]],
    selected_fields: List[Dict[str, Any]], 
    extraction_rules: Dict[str, List[Dict[str, Any]]],
    additional_instructions: str = ""
) -> Dict[str, Any]:
    """
    Run AI extraction on selected documents for specified target fields.
    
    Args:
        selected_documents: List of document objects with id, name, type, contentPreview
        selected_fields: List of target field objects with schema details
        extraction_rules: Dict containing 'targeted' and 'global' extraction rules
        additional_instructions: User-provided additional instructions for extraction
        
    Returns:
        Dict containing extraction results and metadata
    """
    
    # Start building the response
    response = {
        "status": "success",
        "message": "The documents you selected are:",
        "documents": selected_documents,
        "field_count": len(selected_fields),
        "rule_count": extraction_rules.get('total', 0),
        "additional_instructions": additional_instructions or "(none provided)"
    }
    
    # Log the response to console for debugging
    print("EXTRACTION WIZARDRY RESULTS:")
    print("=" * 50)
    print("The documents you selected are:")
    print()
    print(json.dumps(selected_documents, indent=2))
    print()
    print(f"Target Fields: {len(selected_fields)}")
    print(f"Extraction Rules: {extraction_rules.get('total', 0)} total ({len(extraction_rules.get('targeted', []))} targeted, {len(extraction_rules.get('global', []))} global)")
    print(f"Additional Instructions: {additional_instructions or '(none provided)'}")
    
    return response


def main():
    """
    Main entry point when called from command line or API.
    Expects JSON input via stdin or uses sample data for testing.
    """
    
    try:
        # Try to read from stdin (when called from the API)
        if not sys.stdin.isatty():  # stdin has data
            input_data = sys.stdin.read().strip()
            if input_data:
                data = json.loads(input_data)
                selected_documents = data.get('selectedDocuments', [])
                selected_fields = data.get('selectedFields', [])
                extraction_rules = data.get('extractionRules', {"targeted": [], "global": [], "total": 0})
                additional_instructions = data.get('additionalInstructions', "")
            else:
                raise ValueError("No input data provided")
        else:
            # Use sample data for testing when run directly
            selected_documents = [
                {
                    "id": "2ce9e0ec-8fe5-4d52-a0d1-9c07bc701a6b",
                    "name": "Pension Scheme Codes Reference Guide.pdf",
                    "type": "application/pdf",
                    "contentPreview": "Pension Scheme Codes Reference Guide 1. Valuation Record Type Codes: AD, C, D, W • AD - Active Deferred (member who has left employment but retained pension rights) • C - Current/Active (currently con..."
                },
                {
                    "id": "5b3e84b1-0943-4daa-9273-f4b4f0c4ef00",
                    "name": "INSURANCE PROPOSAL.docx",
                    "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "contentPreview": "INSURANCE PROPOSAL\nProposal Number: INS-2025-7845\nDate: July 30, 2025\nValid Until: August 29, 2025\n\nPROPOSED INSURED\nCompany Name: TechForward Solutions LLC\nIndustry: Software Development & IT Consult..."
                },
                {
                    "id": "4e90ac8d-27cf-4179-a8a2-c42df310a650",
                    "name": "Ersatz eighth (1).xlsx",
                    "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "contentPreview": "=== Sheet: New_Pensioners ===\nOld Member's Reference No\tMember's Reference No\tEmployer Code\tSex Code\tDate of Birth\tDate Became Pensioner\tCode For Previous Status\tType Of Retirement\tDate Of Exit From A..."
                }
            ]
            selected_fields = []
            extraction_rules = {"targeted": [], "global": [], "total": 0}
            additional_instructions = ""
    
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Error parsing input: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Run the extraction
    result = run_extraction(
        selected_documents=selected_documents,
        selected_fields=selected_fields,
        extraction_rules=extraction_rules,
        additional_instructions=additional_instructions
    )
    
    # Return JSON result
    print("\nJSON RESPONSE:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()