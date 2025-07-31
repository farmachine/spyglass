#!/usr/bin/env python3

"""
MINIMAL AI EXTRACTION SYSTEM
Single-step process: Extract essential fields only to prevent truncation
"""

import json
import logging
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@dataclass
class ExtractionResult:
    success: bool
    field_validations: List[Dict[str, Any]] = None
    error_message: str = ""
    prompt: str = ""
    ai_response: str = ""

def extract_data_minimal(documents, project_schema, extraction_rules=None, knowledge_documents=None, operation="automated"):
    """
    MINIMAL extraction approach - only extract first 10 fields to prevent truncation
    """
    try:
        from google import genai
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return ExtractionResult(success=False, error_message="GEMINI_API_KEY not found")
        
        client = genai.Client(api_key=api_key)
        
        logging.info(f"MINIMAL EXTRACTION: Processing {len(documents)} documents")
        
        # Extract document content
        extracted_content_text = ""
        processed_docs = 0
        
        for doc in documents:
            file_name = doc.get('file_name', 'Unknown')
            file_content = doc.get('file_content', '')
            mime_type = doc.get('mime_type', '')
            
            try:
                if 'pdf' in mime_type:
                    # Use Gemini for PDF extraction
                    content_response = client.models.generate_content(
                        model="gemini-2.0-flash-exp",
                        contents=[
                            genai.types.Part.from_bytes(
                                data=file_content,
                                mime_type=mime_type,
                            ),
                            "Extract all text content from this document."
                        ]
                    )
                    
                    if content_response and content_response.text:
                        document_content = content_response.text.strip()
                        logging.info(f"Extracted {len(document_content)} characters from PDF {file_name}")
                    else:
                        document_content = "[PDF extraction failed]"
                else:
                    document_content = f"[Unsupported format: {mime_type}]"
                
                extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n{document_content}"
                processed_docs += 1
                
            except Exception as e:
                logging.error(f"Failed to process {file_name}: {e}")
                extracted_content_text += f"\n\n=== DOCUMENT: {file_name} ===\n[Error: {e}]"
        
        # Build MINIMAL extraction prompt - only first few fields
        essential_fields = []
        
        # Add only first 3 schema fields
        if project_schema.get("schema_fields"):
            essential_fields.extend(project_schema["schema_fields"][:3])
        
        # Add only first collection with first 3 properties
        essential_collections = []
        if project_schema.get("collections"):
            first_collection = project_schema["collections"][0]
            limited_collection = {
                **first_collection,
                "properties": first_collection.get("properties", [])[:3]
            }
            essential_collections.append(limited_collection)
        
        # Build minimal prompt
        prompt = f"""Extract data from {len(documents)} documents. Return JSON with this exact structure:

{{
  "field_validations": ["""
        
        # Add essential schema fields
        field_examples = []
        for field in essential_fields:
            field_examples.append(f'''    {{
      "field_id": "{field['id']}",
      "field_type": "schema_field",
      "field_name": "{field['fieldName']}",
      "extracted_value": "VALUE",
      "confidence_score": 0.95,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted"
    }}''')
        
        # Add essential collection properties  
        for collection in essential_collections:
            collection_name = collection.get('collectionName', '')
            for prop in collection.get("properties", []):
                field_examples.append(f'''    {{
      "field_id": "{prop['id']}",
      "field_type": "collection_property", 
      "field_name": "{collection_name}.{prop['propertyName']}[0]",
      "extracted_value": "VALUE",
      "confidence_score": 0.95,
      "validation_status": "unverified",
      "ai_reasoning": "Extracted",
      "record_index": 0
    }}''')
        
        prompt += ",\n".join(field_examples)
        prompt += f"""
  ]
}}

DOCUMENTS:
{extracted_content_text}

Extract real values from documents. Keep ai_reasoning under 5 words."""
        
        # Make AI call with very low token limit
        logging.info(f"Making minimal extraction call with {len(essential_fields)} schema fields and {len(essential_collections)} collections")
        
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=10000,  # Very low limit - 10K tokens only
                response_mime_type="application/json"
            )
        )
        
        if not response or not response.text:
            return ExtractionResult(success=False, error_message="No AI response")
        
        response_text = response.text.strip()
        logging.info(f"AI response length: {len(response_text)}")
        
        # Remove markdown blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON
        try:
            extracted_data = json.loads(response_text)
            field_validations = extracted_data.get("field_validations", [])
            
            logging.info(f"SUCCESS: Extracted {len(field_validations)} validations")
            
            return ExtractionResult(
                success=True,
                field_validations=field_validations,
                prompt=prompt,
                ai_response=response_text
            )
            
        except json.JSONDecodeError as e:
            logging.error(f"JSON parsing failed: {e}")
            logging.error(f"Response text: {response_text[:1000]}")
            
            return ExtractionResult(
                success=False,
                error_message=f"JSON parsing failed: {e}",
                prompt=prompt,
                ai_response=response_text
            )
    
    except Exception as e:
        logging.error(f"MINIMAL EXTRACTION FAILED: {e}")
        return ExtractionResult(success=False, error_message=str(e))

if __name__ == "__main__":
    # CLI interface
    if len(sys.argv) != 2:
        print("Usage: python ai_extraction_minimal.py <json_input>")
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        
        documents = input_data.get('documents', [])
        project_schema = input_data.get('project_schema', {})
        extraction_rules = input_data.get('extraction_rules', [])
        knowledge_documents = input_data.get('knowledge_documents', [])
        operation = input_data.get('operation', 'automated')
        
        result = extract_data_minimal(documents, project_schema, extraction_rules, knowledge_documents, operation)
        
        output = {
            "success": result.success,
            "field_validations": result.field_validations or [],
            "error_message": result.error_message,
            "prompt": result.prompt,
            "ai_response": result.ai_response
        }
        
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "success": False,
            "field_validations": [],
            "error_message": str(e),
            "prompt": "",
            "ai_response": ""
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)