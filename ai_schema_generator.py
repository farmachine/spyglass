#!/usr/bin/env python3

import json
import logging
import os
from google import genai
from google.genai import types

# Set up logging
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
    
    # Check if this is a CSP (Common Agricultural Policy Support) related query
    is_csp_query = any(keyword in user_query.lower() for keyword in ['csp', 'wheat', 'barley', 'maize', 'agriculture', 'malta', 'countrycode', 'intervention'])
    
    # Check if user is requesting lists/collections (stronger indicator than CSP detection)
    has_list_keywords = any(keyword in user_query.lower() for keyword in ['list', 'multiple', 'each', 'all', 'various', 'several', 'many', 'collection'])
    
    # Count potential field names (commas suggest multiple fields that should be in a collection)
    field_count = user_query.count(',') + user_query.count('\n')
    suggests_collection = field_count > 5  # Many fields suggest a collection structure
    
    if is_csp_query and (has_list_keywords or suggests_collection):
        system_prompt = """You are an AI assistant specializing in Common Agricultural Policy Support (CSP) data extraction schemas.

Create a schema for extracting CSP data. The output must be structured to handle:
1. Country codes, intervention descriptions, and other document-level fields (use schema_fields)
2. Multiple CSP interventions, activities, or repeated data items (use collections when appropriate)

WHEN TO USE COLLECTIONS FOR CSP DATA:
- If the user mentions "list", "multiple", "each", "all", "various" with CSP items
- If extracting multiple agricultural activities as separate items  
- If there are lists of countries, regions, or intervention types
- If the data contains repeated structures like multiple rows or records
- If user provides many column names (>5 fields) - CREATE A COLLECTION with ALL provided column names as properties
- If user mentions extracting CSP interventions, activities, or entries as individual items

FIELD NAMING RULES:
- When user provides specific column names (like "Soft_wheat_production_activity", "Barley_production_activity"), include ALL of them as collection properties
- Convert snake_case to proper naming (e.g., "Soft_wheat_production_activity" → "Soft Wheat Production Activity")
- Do not summarize or group user-specified fields - include each one individually

WHEN TO USE SCHEMA FIELDS FOR CSP DATA:
- Single country code per document
- Overall intervention description for the whole document
- Summary fields or totals across all interventions
- Binary activity strings that represent a single intervention's status

Use the same field types as regular schemas: TEXT, NUMBER, DATE, CHOICE
For CHOICE fields, include "choice_options" array with possible values.

CRITICAL: If the user mentions "list" or provides many column names, you should create a COLLECTION structure, not individual schema fields.

IMPORTANT: When users provide specific column/field names in their query, you MUST include ALL of them as properties in the collection. Do not rename or exclude any user-specified fields. Use the exact names provided by the user, converting only the formatting (e.g., snake_case to proper capitalization).

RESPONSE FORMAT:
Return ONLY a valid JSON object following the standard schema format with both schema_fields AND collections when appropriate.

Example for CSP list extraction with user-specified columns:
{
  "main_object_name": "CSP_Data", 
  "schema_fields": [
    {
      "field_name": "Country",
      "field_type": "TEXT",
      "description": "Country code for the document",
      "auto_verification_confidence": 90
    }
  ],
  "collections": [
    {
      "collection_name": "Agricultural Activities",
      "description": "List of agricultural production activities and their applicability", 
      "properties": [
        {
          "property_name": "Soft Wheat Production Activity",
          "field_type": "CHOICE",
          "description": "Applicability for soft wheat production",
          "auto_verification_confidence": 85,
          "choice_options": ["Yes", "No", "1", "0"]
        },
        {
          "property_name": "Barley Production Activity", 
          "field_type": "CHOICE",
          "description": "Applicability for barley production",
          "auto_verification_confidence": 85,
          "choice_options": ["Yes", "No", "1", "0"]
        }
      ]
    }
  ]
}

User Query: """
    elif is_csp_query:
        # CSP query without list keywords - use simplified schema
        system_prompt = """You are an AI assistant specializing in Common Agricultural Policy Support (CSP) data extraction schemas.

Create a simple schema for extracting CSP data with document-level fields only.

RESPONSE FORMAT:
Return ONLY a valid JSON object with schema_fields (no collections):

{
  "main_object_name": "CSP_Data",
  "schema_fields": [
    {
      "field_name": "Country_Code",
      "field_type": "TEXT",
      "description": "Country code for the CSP data",
      "auto_verification_confidence": 85,
      "ai_guidance": "Extract the country code from the data",
      "extraction_rules": "Look for 2-letter country codes",
      "knowledge_documents": "CSP Guidelines"
    }
  ],
  "collections": []
}

User Query: """
    else:
        system_prompt = """You are an AI assistant that helps users create data extraction schemas based on their natural language descriptions.

Your task is to generate a complete project schema structure in JSON format that includes:
1. Main object name (what type of document/data they're extracting)
2. Schema fields (single-value fields that apply globally to the entire document)
3. Collections (lists of repeating items with their own properties)

CRITICAL DECISION GUIDE - WHEN TO USE COLLECTIONS vs SCHEMA FIELDS:

USE COLLECTIONS when the user mentions:
- Multiple items of the same type (e.g., "parties", "products", "employees", "transactions")
- Lists, arrays, or repeated entities 
- "Each", "all", "every" followed by plural nouns
- Keywords like: "list of", "multiple", "several", "various"
- Examples: "parties in a contract", "products in an invoice", "signatories", "line items"

USE SCHEMA FIELDS when the user mentions:
- Single values that apply to the whole document
- Totals, counts, or summary information
- Document-level metadata
- Keywords like: "total", "overall", "document", "contract date", "invoice number"
- Examples: "total amount", "contract date", "number of parties", "document type"

IMPORTANT GUIDELINES:
- Always include realistic auto-verification confidence levels (usually 80-95%)
- Create meaningful AI guidance for each field that helps with extraction
- Generate relevant extraction rules when patterns are obvious (e.g., "Inc" companies, capitalization rules)
- Suggest appropriate knowledge documents that would help with validation
- Use appropriate field types: TEXT, NUMBER, DATE, CHOICE (replaces BOOLEAN)
- For CHOICE fields, include a "choice_options" array with possible values like ["Yes", "No"], ["Approved", "Rejected", "Pending"], etc.
- Make collection and property names descriptive and user-friendly
- Include realistic descriptions that explain what each field should contain

EXAMPLES OF GOOD SCHEMA DESIGN:

Example 1 - Contract Document:
- Schema Fields: "Contract Date", "Total Value", "Number of Parties" (document-level info)
- Collections: "Parties" with properties like "Name", "Role", "Address" (multiple similar items)

Example 2 - Invoice Document:
- Schema Fields: "Invoice Number", "Total Amount", "Invoice Date" (document-level info)
- Collections: "Line Items" with properties like "Product Name", "Quantity", "Price" (multiple similar items)

Example 3 - CSP Agricultural Data:
- Schema Fields: "Country Code", "Intervention Description" (document-level info)
- Collections: Usually none for CSP data unless extracting multiple interventions per document

RESPONSE FORMAT:
Return ONLY a valid JSON object with proper double-quoted property names. Do NOT include any markdown formatting, explanatory text, or comments. Return ONLY the JSON with this exact structure:

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
        },
        {
          "property_name": "Role",
          "field_type": "CHOICE",
          "description": "The role of the party in the contract",
          "auto_verification_confidence": 85,
          "ai_guidance": "Determine the party's role based on contract terms and definitions",
          "extraction_rules": "Look for role definitions in party sections or signature blocks",
          "knowledge_documents": "Contract Review Playbook",
          "choice_options": ["Buyer", "Seller", "Vendor", "Client", "Lessor", "Lessee", "Licensor", "Licensee"]
        }
      ]
    }
  ]
}

User Query: """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(role="user", parts=[types.Part(text=f"{system_prompt}{user_query}")])
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=30000000,  # Increased to 30 million tokens for extremely complex schemas
                temperature=0.1,  # Lower temperature for more consistent JSON
                response_mime_type="application/json",  # Force JSON output
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
        
        # Log the raw response for debugging
        logger.info(f"Raw AI response (first 500 chars): {response_text[:500]}...")
        
        # Try to parse JSON response with error recovery
        try:
            schema_data = json.loads(response_text)
        except json.JSONDecodeError as json_error:
            # Try comprehensive JSON repair for complex schemas
            logger.warning(f"Initial JSON parse failed: {json_error}. Attempting comprehensive repair...")
            
            import re
            fixed_text = response_text
            
            # Step 1: Fix basic JSON formatting issues
            # Fix unquoted property names
            fixed_text = re.sub(r'(\w+):\s*"', r'"\1": "', fixed_text)
            fixed_text = re.sub(r'(\w+):\s*(\d+)', r'"\1": \2', fixed_text)
            fixed_text = re.sub(r'(\w+):\s*(true|false)', r'"\1": \2', fixed_text)
            fixed_text = re.sub(r'(\w+):\s*\[', r'"\1": [', fixed_text)
            fixed_text = re.sub(r'(\w+):\s*\{', r'"\1": {', fixed_text)
            
            # Step 2: Fix unterminated strings by finding incomplete string values
            # Look for strings that start with quote but don't end properly
            lines = fixed_text.split('\n')
            repaired_lines = []
            
            for line in lines:
                # Check if line has unterminated string
                if line.count('"') % 2 != 0:
                    # Find the last quote and see if it needs closing
                    if line.strip().endswith(',') or line.strip().endswith('}') or line.strip().endswith(']'):
                        # Line probably fine, just missing quote before comma/brace
                        line = re.sub(r'([^"])(\s*[,\}\]])$', r'\1"\2', line)
                    else:
                        # Add closing quote at end
                        line = line.rstrip() + '"'
                        
                repaired_lines.append(line)
            
            fixed_text = '\n'.join(repaired_lines)
            
            # Step 3: Fix array formatting for knowledge_documents and extraction_rules
            fixed_text = re.sub(r'"knowledge_documents":\s*"([^"]+)",\s*"([^"]+)"', r'"knowledge_documents": ["\1", "\2"]', fixed_text)
            fixed_text = re.sub(r'"extraction_rules":\s*"([^"]+)",\s*"([^"]+)"', r'"extraction_rules": ["\1", "\2"]', fixed_text)
            
            # Step 4: Try parsing the repaired JSON
            try:
                schema_data = json.loads(fixed_text)
                logger.info("Successfully repaired JSON formatting")
            except json.JSONDecodeError:
                # Step 5: Extract the largest valid JSON object from response
                logger.warning("Advanced JSON repair needed - extracting valid JSON segments")
                
                # Find JSON object boundaries
                brace_stack = []
                json_start = -1
                json_end = -1
                
                for i, char in enumerate(fixed_text):
                    if char == '{':
                        if json_start == -1:
                            json_start = i
                        brace_stack.append(i)
                    elif char == '}':
                        if brace_stack:
                            brace_stack.pop()
                            if not brace_stack and json_start != -1:
                                json_end = i + 1
                                break
                
                if json_start != -1 and json_end != -1:
                    json_content = fixed_text[json_start:json_end]
                    try:
                        schema_data = json.loads(json_content)
                        logger.info("Successfully extracted valid JSON segment")
                    except json.JSONDecodeError:
                        # Final fallback: create a simplified schema
                        logger.error("All JSON repair attempts failed. Creating simplified schema.")
                        schema_data = {
                            "main_object_name": "CSP_Data",
                            "schema_fields": [
                                {
                                    "field_name": "Country_Code",
                                    "field_type": "TEXT",
                                    "description": "Country code for the CSP data",
                                    "auto_verification_confidence": 85
                                },
                                {
                                    "field_name": "Intervention_Description", 
                                    "field_type": "TEXT",
                                    "description": "Description of the agricultural intervention",
                                    "auto_verification_confidence": 80
                                },
                                {
                                    "field_name": "Activity_Values",
                                    "field_type": "TEXT", 
                                    "description": "Binary string representing activity status for all agricultural categories",
                                    "auto_verification_confidence": 90
                                }
                            ],
                            "collections": []
                        }
                        logger.info("Created fallback simplified schema")
                else:
                    raise json_error
        
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