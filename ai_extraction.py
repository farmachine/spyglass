import json
import logging
import os
import base64
from typing import Dict, List, Any, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

# Initialize Gemini client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class ExtractionResult(BaseModel):
    extracted_data: Dict[str, Any]
    confidence_score: float
    processing_notes: str

def extract_data_from_document(
    file_content: bytes,
    file_name: str,
    mime_type: str,
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None
) -> ExtractionResult:
    """
    Extract structured data from a document using Gemini AI
    
    Args:
        file_content: The binary content of the file
        file_name: Name of the file being processed
        mime_type: MIME type of the file
        project_schema: The project's data schema definition
        extraction_rules: Optional extraction rules to guide the AI
    
    Returns:
        ExtractionResult containing extracted data and metadata
    """
    try:
        # Build the extraction prompt
        prompt = build_extraction_prompt(project_schema, extraction_rules, file_name)
        
        # Create the content parts for Gemini
        content_parts = [
            types.Part.from_bytes(
                data=file_content,
                mime_type=mime_type
            ),
            prompt
        ]
        
        # Make the API call to Gemini
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=content_parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Lower temperature for more consistent extraction
                max_output_tokens=4096
            )
        )
        
        if not response.text:
            raise Exception("No response from Gemini API")
            
        # Parse the JSON response
        result_data = json.loads(response.text)
        
        return ExtractionResult(
            extracted_data=result_data.get("extracted_data", {}),
            confidence_score=result_data.get("confidence_score", 0.0),
            processing_notes=result_data.get("processing_notes", "")
        )
        
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse JSON response: {e}")
        return ExtractionResult(
            extracted_data={},
            confidence_score=0.0,
            processing_notes=f"JSON parsing error: {str(e)}"
        )
    except Exception as e:
        logging.error(f"Error during document extraction: {e}")
        return ExtractionResult(
            extracted_data={},
            confidence_score=0.0,
            processing_notes=f"Extraction error: {str(e)}"
        )

def build_extraction_prompt(
    project_schema: Dict[str, Any], 
    extraction_rules: List[Dict[str, Any]] = None,
    file_name: str = ""
) -> str:
    """Build a comprehensive prompt for data extraction"""
    
    prompt = f"""
You are an expert document data extraction AI. Your task is to analyze the provided document ({file_name}) and extract structured data according to the specified schema.

EXTRACTION SCHEMA:
"""
    
    # Add project schema fields
    if project_schema.get("schema_fields"):
        prompt += "\nGlobal Fields (apply to the entire document):\n"
        for field in project_schema["schema_fields"]:
            prompt += f"- {field['fieldName']} ({field['fieldType']}): {field['description']}\n"
    
    # Add object collections
    if project_schema.get("collections"):
        prompt += "\nObject Collections (repeating structures):\n"
        for collection in project_schema["collections"]:
            prompt += f"\n{collection['collectionName']}: {collection['description']}\n"
            prompt += "Properties:\n"
            for prop in collection.get("properties", []):
                prompt += f"  - {prop['propertyName']} ({prop['propertyType']}): {prop['description']}\n"
    
    # Add extraction rules if provided
    if extraction_rules:
        prompt += "\nEXTRACTION RULES:\n"
        for rule in extraction_rules:
            if rule.get("isActive", True):
                prompt += f"- {rule['ruleName']}: {rule['ruleContent']}\n"
                if rule.get("targetField"):
                    prompt += f"  (Applies to: {rule['targetField']})\n"
    
    prompt += """
INSTRUCTIONS:
1. Carefully analyze the document content
2. Extract data according to the schema above
3. For object collections, identify all instances in the document
4. Follow all extraction rules precisely
5. If a field cannot be found or determined, use null
6. Provide a confidence score (0.0 to 1.0) based on data clarity and completeness
7. Add processing notes about any challenges or assumptions made

RESPONSE FORMAT (JSON):
{
  "extracted_data": {
    // Global fields as key-value pairs
    "field_name": "extracted_value",
    
    // Object collections as arrays
    "collection_name": [
      {
        "property_name": "value",
        // ... other properties
      }
      // ... more instances
    ]
  },
  "confidence_score": 0.95,
  "processing_notes": "Document was clear and well-structured. All required fields found."
}

Analyze the document now and provide the extracted data in the exact JSON format specified above.
"""
    
    return prompt

def process_extraction_session(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process an entire extraction session with multiple documents
    
    Args:
        session_data: Dictionary containing session info, files, and schema
    
    Returns:
        Dictionary with processing results
    """
    results = {
        "session_id": session_data.get("session_id"),
        "processed_documents": [],
        "summary": {
            "total_documents": 0,
            "successful_extractions": 0,
            "average_confidence": 0.0
        }
    }
    
    files = session_data.get("files", [])
    project_schema = session_data.get("project_schema", {})
    extraction_rules = session_data.get("extraction_rules", [])
    
    total_confidence = 0.0
    successful_count = 0
    
    for file_info in files:
        try:
            # Read file content (in a real implementation, this would read from uploaded files)
            # For now, we'll simulate with the file info
            
            file_content = file_info.get("content", b"")
            file_name = file_info.get("name", "unknown")
            mime_type = file_info.get("mime_type", "application/pdf")
            
            if not file_content:
                # Simulate content for demo purposes
                file_content = f"Sample document content for {file_name}".encode()
                mime_type = "text/plain"
            
            # Extract data from the document
            extraction_result = extract_data_from_document(
                file_content=file_content,
                file_name=file_name,
                mime_type=mime_type,
                project_schema=project_schema,
                extraction_rules=extraction_rules
            )
            
            # Record the result
            document_result = {
                "file_name": file_name,
                "extraction_result": extraction_result.dict(),
                "status": "completed" if extraction_result.confidence_score > 0.5 else "review_needed"
            }
            
            results["processed_documents"].append(document_result)
            
            if extraction_result.confidence_score > 0.5:
                successful_count += 1
                total_confidence += extraction_result.confidence_score
            
        except Exception as e:
            logging.error(f"Error processing file {file_info.get('name', 'unknown')}: {e}")
            results["processed_documents"].append({
                "file_name": file_info.get("name", "unknown"),
                "extraction_result": {
                    "extracted_data": {},
                    "confidence_score": 0.0,
                    "processing_notes": f"Processing error: {str(e)}"
                },
                "status": "error"
            })
    
    # Calculate summary
    results["summary"]["total_documents"] = len(files)
    results["summary"]["successful_extractions"] = successful_count
    results["summary"]["average_confidence"] = (
        total_confidence / successful_count if successful_count > 0 else 0.0
    )
    
    return results

if __name__ == "__main__":
    # Test the extraction functionality
    sample_schema = {
        "schema_fields": [
            {
                "fieldName": "Document Type",
                "fieldType": "TEXT",
                "description": "Type of document (invoice, contract, report, etc.)"
            }
        ],
        "collections": [
            {
                "collectionName": "Company",
                "description": "Company information found in the document",
                "properties": [
                    {
                        "propertyName": "Name",
                        "propertyType": "TEXT",
                        "description": "Company name"
                    },
                    {
                        "propertyName": "Address",
                        "propertyType": "TEXT", 
                        "description": "Company address"
                    }
                ]
            }
        ]
    }
    
    sample_rules = [
        {
            "ruleName": "Company Name Format",
            "ruleContent": "Extract company names in title case format",
            "targetField": "Company --> Name",
            "isActive": True
        }
    ]
    
    # Test extraction
    test_content = "ABC Corporation\n123 Main Street, New York, NY\nInvoice #12345"
    
    result = extract_data_from_document(
        file_content=test_content.encode(),
        file_name="test_invoice.txt",
        mime_type="text/plain",
        project_schema=sample_schema,
        extraction_rules=sample_rules
    )
    
    print("Extraction Result:")
    print(json.dumps(result.dict(), indent=2))