#!/usr/bin/env python3

import os
import json
import logging
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)

def test_document_extraction():
    """Test document extraction with a simple text document"""
    
    # Remove GOOGLE_API_KEY if it exists to avoid conflicts
    if "GOOGLE_API_KEY" in os.environ:
        del os.environ["GOOGLE_API_KEY"]
    
    # Get GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found")
        return False
    
    client = genai.Client(api_key=api_key)
    
    # Create a simple test document
    test_document = """
    CONTRACT AGREEMENT
    
    Company Name: HubSpot Inc.
    Contract Date: July 15, 2024
    Effective Date: August 1, 2024
    Contract Type: Software License Agreement
    
    Party 1: HubSpot Inc.
    Address: 25 First Street, Cambridge, MA 02141
    Country: United States
    
    Party 2: Client Corporation
    Address: 123 Business Street, New York, NY 10001
    Country: United States
    
    This agreement governs the use of HubSpot software services.
    """
    
    # Simple schema to extract
    prompt = """Extract the following data from this contract document:

- Company Name: The main company providing the service
- Effective Date: The date when the contract becomes effective (YYYY-MM-DD format)
- Parties: Array of party objects with Name, Address, and Country

Return only valid JSON in this format:
{
  "extracted_data": {
    "Company Name": "actual company name",
    "Effective Date": "YYYY-MM-DD",
    "Parties": [
      {"Name": "party name", "Address": "address", "Country": "country"}
    ]
  },
  "confidence_score": 0.95,
  "processing_notes": "Brief notes"
}

Document content:
""" + test_document
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=1024
            )
        )
        
        print(f"Response text: {response.text}")
        
        if response.text:
            try:
                result = json.loads(response.text)
                print(f"Parsed result: {json.dumps(result, indent=2)}")
                
                # Check if the extracted data contains actual content from the document
                extracted = result.get("extracted_data", {})
                company_name = extracted.get("Company Name", "")
                effective_date = extracted.get("Effective Date", "")
                
                print(f"\nExtracted Company Name: '{company_name}'")
                print(f"Extracted Effective Date: '{effective_date}'")
                
                # Check if it extracted real data
                if "HubSpot" in company_name and "2024-08-01" in effective_date:
                    print("SUCCESS: AI extracted real data from the document")
                    return True
                else:
                    print("FAILURE: AI returned sample/generic data instead of real extraction")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                return False
        else:
            print("No response text received")
            return False
            
    except Exception as e:
        print(f"API call failed: {e}")
        return False

if __name__ == "__main__":
    success = test_document_extraction()
    print(f"\nTest result: {'SUCCESS' if success else 'FAILED'}")