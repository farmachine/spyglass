#!/usr/bin/env python3
"""
Fixed AI extraction system with robust JSON handling
"""
import json
import sys
import logging
import google.generativeai as genai
import os

logging.basicConfig(level=logging.INFO)

# Configure Gemini AI
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

def create_extraction_prompt(documents, project_schema, session_name):
    """Create a focused extraction prompt for Column Name Mapping"""
    
    # Extract document content
    document_content = ""
    for doc in documents:
        document_content += f"Document: {doc['file_name']}\n"
        document_content += doc['file_content'][:50000]  # Limit content size
        document_content += "\n\n"
    
    # Build collections info
    collections_info = ""
    for collection in project_schema.get('collections', []):
        collection_name = collection.get('collectionName', '')
        properties = collection.get('properties', [])
        
        collections_info += f"Collection: {collection_name}\n"
        for prop in properties:
            prop_name = prop.get('propertyName', '')
            prop_type = prop.get('propertyType', 'TEXT')
            collections_info += f"  - {prop_name} ({prop_type})\n"
        collections_info += "\n"
    
    prompt = f"""You are an expert data extraction specialist. Extract data from the following document and return ONLY a valid JSON object with the exact structure shown below.

DOCUMENT CONTENT:
{document_content}

EXTRACTION SCHEMA:
{collections_info}

INSTRUCTIONS:
- Extract ALL column headers from ALL worksheets in the Excel file
- For Column Name Mapping collection, create one record per column header
- Each record should have a Worksheet Name and Column Heading
- Extract up to 250 column mappings maximum
- Return ONLY valid JSON, no explanations

REQUIRED OUTPUT FORMAT (return ONLY this JSON structure):
{{
  "field_validations": [
    {{
      "field_id": "767bc354-2646-479b-b63d-5a1578c9ff8a",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Column Name Mapping.Worksheet Name[0]",
      "collection_name": "Column Name Mapping",
      "record_index": 0,
      "extracted_value": "New_Pensioners",
      "confidence_score": 0.95,
      "validation_status": "unverified",
      "ai_reasoning": "Found worksheet name in Excel file"
    }},
    {{
      "field_id": "bb243624-8e70-4489-b243-ec2ae8fad363",
      "validation_type": "collection_property",
      "data_type": "TEXT",
      "field_name": "Column Name Mapping.Column Heading[0]",
      "collection_name": "Column Name Mapping",
      "record_index": 0,
      "extracted_value": "Member Reference No",
      "confidence_score": 0.95,
      "validation_status": "unverified",
      "ai_reasoning": "Found column header in New_Pensioners worksheet"
    }}
  ]
}}

Extract ALL available columns across ALL worksheets. Return valid JSON only."""

    return prompt

def extract_with_gemini(prompt):
    """Run extraction using Gemini AI"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=8192,
            )
        )
        
        if not response.text:
            raise Exception("Empty response from Gemini")
            
        # Clean the response
        response_text = response.text.strip()
        
        # Remove code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
            
        response_text = response_text.strip()
        
        # Parse JSON
        try:
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError as e:
            logging.error(f"JSON decode error: {e}")
            logging.error(f"Response text: {response_text[:500]}...")
            
            # Try to repair common issues
            if '"field_validations"' in response_text:
                # Find the field_validations array
                start_idx = response_text.find('"field_validations"')
                if start_idx > 0:
                    # Extract from opening brace to end
                    json_start = response_text.find('{', max(0, start_idx - 50))
                    if json_start >= 0:
                        json_part = response_text[json_start:]
                        # Try to find a valid JSON ending
                        for end_pos in range(len(json_part) - 1, 0, -1):
                            if json_part[end_pos] == '}':
                                try:
                                    repaired = json_part[:end_pos + 1]
                                    return json.loads(repaired)
                                except:
                                    continue
            
            # If repair fails, return empty structure
            return {"field_validations": []}
            
    except Exception as e:
        logging.error(f"Gemini extraction failed: {e}")
        return {"field_validations": []}

def main():
    """Main extraction function"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            raise ValueError("No input data received")
        
        # Parse input JSON
        data = json.loads(input_data)
        
        documents = data.get('documents', [])
        project_schema = data.get('project_schema', {})
        session_name = data.get('session_name', 'extraction')
        
        logging.info(f"Processing {len(documents)} documents for session: {session_name}")
        
        if not documents:
            raise ValueError("No documents provided")
        
        # Create extraction prompt
        prompt = create_extraction_prompt(documents, project_schema, session_name)
        
        # Run extraction
        result = extract_with_gemini(prompt)
        
        # Validate result structure
        if not isinstance(result, dict) or 'field_validations' not in result:
            result = {"field_validations": []}
        
        field_validations = result.get('field_validations', [])
        logging.info(f"Extracted {len(field_validations)} field validations")
        
        # Output result
        print(json.dumps(result))
        return 0
        
    except Exception as e:
        logging.error(f"Extraction failed: {e}")
        print(json.dumps({"success": False, "error": str(e)}))
        return 1

if __name__ == "__main__":
    sys.exit(main())