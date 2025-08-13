import json
import sys
import os
import time
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS
from excel_wizard import excel_column_extraction
from ai_extraction_wizard import ai_document_extraction
from ai_conductor import ai_conductor

def get_document_properties_from_db(document_ids, session_id):
    """Query session_documents table to get document properties"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Query session_documents for the given document IDs
        query = """
        SELECT id, file_name, mime_type, extracted_content 
        FROM session_documents 
        WHERE id = ANY(%s::uuid[]) AND session_id = %s
        """
        
        cursor.execute(query, (document_ids, session_id))
        results = cursor.fetchall()
        
        # Format results as document properties
        documents = []
        for row in results:
            doc_id, file_name, mime_type, extracted_content = row
            
            # Create content preview (first 200 characters)
            content_preview = ""
            if extracted_content:
                content_preview = extracted_content[:200] + "..." if len(extracted_content) > 200 else extracted_content
            
            documents.append({
                "id": doc_id,
                "name": file_name,
                "type": mime_type or "unknown",
                "contentPreview": content_preview
            })
        
        cursor.close()
        conn.close()
        
        return documents
        
    except Exception as e:
        return {"error": f"Database query failed: {str(e)}"}


def analyze_document_format_with_gemini(documents, target_fields_data=None, max_retries=3):
    """Send document properties to Gemini and return raw response with retry logic"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return "ERROR: GEMINI_API_KEY not found"
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Use centralized prompt from all_prompts.py with both placeholders
    documents_content = json.dumps(documents, indent=2)
    target_fields_content = json.dumps(target_fields_data, indent=2) if target_fields_data and not isinstance(target_fields_data, dict) else "No target fields provided"
    
    prompt = DOCUMENT_FORMAT_ANALYSIS.format(
        documents=documents_content,
        target_fields=target_fields_content
    )
    
    # Log the prompt before sending to Gemini
    print("\n" + "=" * 80)
    print("GEMINI PROMPT")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    # Retry logic for Gemini API calls
    for attempt in range(max_retries):
        try:
            # Call Gemini API
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            
            # Return raw response text if successful
            return response.text or "ERROR: Empty response from Gemini"
            
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini API attempt {attempt + 1} failed: {error_msg}")
            
            # Check if it's a 503 (overloaded) error
            if "503" in error_msg or "overloaded" in error_msg.lower():
                if attempt < max_retries - 1:  # Not the last attempt
                    wait_time = (attempt + 1) * 2  # Exponential backoff: 2, 4, 6 seconds
                    print(f"Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
            
            # For non-503 errors or last attempt, return error immediately
            return f"ERROR: Gemini analysis failed: {error_msg}"
    
    # This should never be reached, but just in case
    return "ERROR: All Gemini API retry attempts failed"

def clean_json_and_extract_identifiers(extraction_result, target_fields_data):
    """Clean JSON results and create Identifier Results array"""
    try:
        # Parse the extraction result if it's a string
        if isinstance(extraction_result, str):
            cleaned_result = json.loads(extraction_result)
        else:
            cleaned_result = extraction_result
        
        # Clean the JSON by trimming whitespace from string values
        if isinstance(cleaned_result, list):
            for item in cleaned_result:
                if isinstance(item, dict):
                    for key, value in item.items():
                        if isinstance(value, str):
                            item[key] = value.strip()
        
        # Create Identifier Results array
        identifier_results = []
        
        # Find identifier fields from target_fields_data
        identifier_fields = []
        if target_fields_data:
            for field in target_fields_data:
                if field.get('is_identifier', False):
                    identifier_fields.append({
                        'field_id': field.get('field_id'),
                        'name': field.get('name'),
                        'property_name': field.get('name')
                    })
        
        # Extract all field_validation objects from the cleaned results for identifier results
        if isinstance(cleaned_result, list):
            for result_item in cleaned_result:
                if isinstance(result_item, dict):
                    # Return the complete field_validation object
                    identifier_results.append(result_item)
        
        return {
            'cleaned_results': cleaned_result,
            'identifier_results': identifier_results
        }
        
    except Exception as e:
        return {
            'error': f"Failed to clean JSON and extract identifiers: {str(e)}",
            'original_result': extraction_result
        }

def get_all_collection_properties(collection_ids):
    """Get all properties for the given collection IDs"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Query collection_properties for all properties in the collections
        query = """
        SELECT cp.id, cp.collection_id, cp.property_name, cp.property_type, cp.description, 
               cp.auto_verification_confidence, cp.choice_options, cp.is_identifier, 
               cp.order_index, oc.collection_name
        FROM collection_properties cp
        JOIN object_collections oc ON cp.collection_id = oc.id
        WHERE cp.collection_id = ANY(%s::uuid[])
        ORDER BY cp.collection_id, cp.order_index
        """
        
        cursor.execute(query, (collection_ids,))
        results = cursor.fetchall()
        
        # Format results
        all_properties = []
        for row in results:
            prop_id, collection_id, property_name, property_type, description, confidence, choice_options, is_identifier, order_index, collection_name = row
            all_properties.append({
                "id": str(prop_id),
                "collection_id": str(collection_id),
                "collection_name": collection_name,
                "property_name": property_name,
                "property_type": property_type,
                "description": description or "",
                "auto_verification_confidence": confidence,
                "choice_options": choice_options or [],
                "is_identifier": is_identifier,
                "order_index": order_index
            })
        
        cursor.close()
        conn.close()
        
        return all_properties
        
    except Exception as e:
        return {"error": f"Collection properties query failed: {str(e)}"}

def run_wizardry_with_gemini_analysis(data=None):
    """Main function that gets documents from DB and analyzes them with Gemini"""
    if data and isinstance(data, dict):
        document_ids = data.get('document_ids', [])
        session_id = data.get('session_id')
        target_fields = data.get('target_fields', [])
        
        if not document_ids or not session_id:
            print(json.dumps({"error": "Missing document_ids or session_id"}))
            return
        
        # Get document properties from database
        documents = get_document_properties_from_db(document_ids, session_id)
        
        if isinstance(documents, dict) and "error" in documents:
            print(json.dumps(documents))
            return
        
        # Extract complete field data from the target fields (no database query needed)
        target_fields_data = []
        if target_fields:
            for field in target_fields:
                field_data = {
                    "field_id": field.get('id', ''),
                    "name": field.get('propertyName') or field.get('fieldName', ''),
                    "description": field.get('description', ''),
                    "property_type": field.get('propertyType') or field.get('fieldType', ''),
                    "auto_verification_confidence": field.get('autoVerificationConfidence', 80),
                    "choice_options": field.get('choiceOptions', []),
                    "is_identifier": field.get('isIdentifier', False),
                    "order_index": field.get('orderIndex', 0),
                    "collection_id": field.get('collectionId', ''),
                    "type": "collection_property" if field.get('collectionId') else "schema_field"
                }
                target_fields_data.append(field_data)
        
        # Filter identifier targets early for use in both display and Gemini analysis
        identifier_targets = [field for field in target_fields_data if field.get('is_identifier', False)]
        
        # Print document properties
        print("\n" + "=" * 80)
        print("DOCUMENT CONTENT FOR THIS EXTRACTION")
        print("=" * 80)
        print(json.dumps(documents, indent=2))
        print("=" * 80)
        
        # Print target field descriptions from database
        print("\n" + "=" * 80)
        print("TARGET PROPERTIES FOR THIS EXTRACTION")
        print("=" * 80)
        print(json.dumps(target_fields_data, indent=2))
        print("=" * 80)
        
        # Display identifier targets
        print("\n" + "=" * 80)
        print("IDENTIFIER TARGET")
        print("=" * 80)
        print(json.dumps(identifier_targets, indent=2))
        print("=" * 80)
        
        # Use AI Conductor for orchestrated extraction
        print("\n" + "=" * 80)
        print("STARTING AI CONDUCTOR ORCHESTRATION")
        print("=" * 80)
        
        # Get document IDs from the documents data
        document_ids = [doc['id'] for doc in documents]
        
        # Run AI Conductor orchestration
        extraction_result = ai_conductor(document_ids, session_id, identifier_targets)
        
        # Process results from AI Conductor
        if isinstance(extraction_result, dict) and 'error' in extraction_result:
            print(f"AI Conductor failed: {extraction_result['error']}")
            return {"message": "Wizardry analysis completed", "error": extraction_result['error']}
        elif isinstance(extraction_result, list):
            # Clean JSON and extract identifiers
            processed_results = clean_json_and_extract_identifiers(extraction_result, identifier_targets)
            if 'error' not in processed_results:
                # Show record count instead of raw output
                record_count = len(processed_results['cleaned_results']) if isinstance(processed_results['cleaned_results'], list) else 0
                print(f"Found {record_count} records")
                
                # Show identifier results with proper header
                print("\n" + "=" * 80)
                print("IDENTIFIER RESULTS")
                print("=" * 80)
                print(json.dumps(processed_results['identifier_results'], indent=2))
                
                # Create and display IDENTIFIER REFERENCES array
                identifier_references = []
                for result in processed_results['identifier_results']:
                    if 'extracted_value' in result and 'field_name' in result:
                        # Split field_name on dot and take the part after the collection name
                        field_name_parts = result['field_name'].split('.')
                        field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                        identifier_references.append({field_name_only: result['extracted_value']})
                
                print("\n" + "=" * 80)
                print("IDENTIFIER REFERENCES")
                print("=" * 80)
                print(json.dumps(identifier_references, indent=2))
                print("=" * 80)
                
                return {"message": "Wizardry analysis completed", "results": processed_results}
            else:
                return {"message": "Wizardry analysis completed", "error": processed_results['error']}
        else:
            print(f"AI Conductor returned unexpected format: {type(extraction_result)}")
            return {"message": "Wizardry analysis completed", "error": "Unexpected result format from AI Conductor"}
        print("=" * 80)
        
    else:
        print(json.dumps({"error": "Invalid data format. Expected object with document_ids and session_id"}))

def run_wizardry(data=None):
    # FIRST: Display all collection properties at the very beginning
    if data and isinstance(data, dict):
        target_fields = data.get('target_fields', [])
        collection_ids = list(set([field.get('collectionId') for field in target_fields if field.get('collectionId')]))
        print(f"DEBUG: Found collection IDs: {collection_ids}")
        if collection_ids:
            all_collection_properties = get_all_collection_properties(collection_ids)
            print("\n" + "=" * 80)
            print("ALL PROPERTIES ASSOCIATED WITH THE EXTRACTION")
            print("=" * 80)
            print(json.dumps(all_collection_properties, indent=2))
            print("=" * 80)
        else:
            print("No collection IDs found in target fields")
    
    # Call the new function with Gemini analysis
    run_wizardry_with_gemini_analysis(data)

if __name__ == "__main__":
    # Read JSON data from stdin if available
    data = None
    if not sys.stdin.isatty():  # Check if there's input from stdin
        try:
            input_data = sys.stdin.read()
            if input_data.strip():
                data = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"JSON decode error: {str(e)}"}))
            sys.exit(1)
    
    run_wizardry(data)