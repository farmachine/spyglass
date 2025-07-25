#!/usr/bin/env python3

import json
import logging
import os
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Gemini client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def generate_schema_from_query(user_query: str, project_id: str) -> dict:
    """
    Generate project schema structure from user's natural language query
    
    Args:
        user_query: User's description of what data they want to collect
        project_id: The project ID to associate with generated schema
        
    Returns:
        Dictionary containing generated schema structure
    """
    
    system_prompt = """You are an AI assistant that helps users create data extraction schemas based on their natural language descriptions.

Your task is to generate a complete project schema structure in JSON format that includes:
1. Main object name (what type of document/data they're extracting)
2. Schema fields (single-value fields that apply globally)
3. Collections (lists of similar items with properties)

IMPORTANT GUIDELINES:
- Always include realistic auto-verification confidence levels (usually 80-95%)
- Create meaningful AI guidance for each field that helps with extraction
- Generate relevant extraction rules when patterns are obvious (e.g., "Inc" companies, capitalization rules)
- Suggest appropriate knowledge documents that would help with validation
- Use appropriate field types: TEXT, NUMBER, DATE, BOOLEAN
- Make collection and property names descriptive and user-friendly
- Include realistic descriptions that explain what each field should contain

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:

{
  "main_object_name": "Contract",
  "schema_fields": [
    {
      "field_name": "Number of Parties",
      "field_type": "NUMBER", 
      "description": "The total number of parties involved across all contracts",
      "auto_verification_confidence": 85,
      "ai_guidance": "Count all unique companies, organizations, and legal entities mentioned as parties",
      "extraction_rules": "Look for party sections, signature blocks, and entity definitions throughout the document",
      "knowledge_documents": "Contract Review Playbook"
    }
  ],
  "collections": [
    {
      "collection_name": "Parties",
      "description": "The parties involved in the contract",
      "properties": [
        {
          "property_name": "Name",
          "field_type": "TEXT",
          "description": "Name of the party",
          "auto_verification_confidence": 90,
          "ai_guidance": "Extract the legal name of each party from the contract header or signature section",
          "extraction_rules": "Parties with names containing 'Inc' should be flagged with lower confidence for manual review",
          "knowledge_documents": "Contract Review Playbook"
        }
      ]
    }
  ]
}

Now process this user query and generate an appropriate schema structure:"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(role="user", parts=[types.Part(text=f"{system_prompt}\n\nUser Query: {user_query}")])
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=8000,
                temperature=0.3,
            ),
        )

        if not response.text:
            raise Exception("Empty response from Gemini API")

        # Extract JSON from response (handle potential markdown formatting)
        response_text = response.text.strip()
        
        # Remove markdown code block formatting if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
            
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        response_text = response_text.strip()
        
        # Parse JSON response
        schema_data = json.loads(response_text)
        
        logger.info(f"Generated schema for project {project_id}: {len(schema_data.get('schema_fields', []))} fields, {len(schema_data.get('collections', []))} collections")
        
        return {
            "success": True,
            "schema": schema_data
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        logger.error(f"Response text: {response_text}")
        return {
            "success": False,
            "error": f"Failed to parse AI response as JSON: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Schema generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python ai_schema_generator.py '<user_query>' '<project_id>'")
        sys.exit(1)
    
    user_query = sys.argv[1]
    project_id = sys.argv[2]
    
    result = generate_schema_from_query(user_query, project_id)
    print(json.dumps(result, indent=2))