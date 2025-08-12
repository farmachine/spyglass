import json
import sys
import os
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS

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

def get_target_fields_from_db(target_fields):
    """Query database to get field descriptions from field IDs"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        field_descriptions = []
        
        print(f"DEBUG: Processing {len(target_fields)} target fields")
        
        for field in target_fields:
            field_id = field.get('id', '')
            print(f"DEBUG: Processing field ID: {field_id}")
            
            # Check if it's a collection property (contains '.')
            if '.' in field_id:
                # Collection property: get from collection_properties table
                property_id = field_id.split('.')[1]
                print(f"DEBUG: Looking for collection property with ID: {property_id}")
                query = """
                SELECT property_name, description 
                FROM collection_properties 
                WHERE id = %s
                """
                cursor.execute(query, (property_id,))
                result = cursor.fetchone()
                print(f"DEBUG: Collection query result: {result}")
                if result:
                    property_name, description = result
                    field_descriptions.append({
                        "field_id": field_id,
                        "name": property_name,
                        "description": description or "",
                        "type": "collection_property"
                    })
            else:
                # Schema field: get from project_schema_fields table
                print(f"DEBUG: Looking for schema field with ID: {field_id}")
                query = """
                SELECT field_name, description 
                FROM project_schema_fields 
                WHERE id = %s
                """
                cursor.execute(query, (field_id,))
                result = cursor.fetchone()
                print(f"DEBUG: Schema query result: {result}")
                if result:
                    field_name, description = result
                    field_descriptions.append({
                        "field_id": field_id,
                        "name": field_name,
                        "description": description or "",
                        "type": "schema_field"
                    })
        
        cursor.close()
        conn.close()
        
        print(f"DEBUG: Final field_descriptions: {field_descriptions}")
        return field_descriptions
        
    except Exception as e:
        print(f"DEBUG: Database error: {str(e)}")
        return {"error": f"Target fields query failed: {str(e)}"}

def analyze_document_format_with_gemini(documents, target_fields_data=None):
    """Send document properties to Gemini and return raw response"""
    try:
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
        
        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        # Return raw response text
        return response.text or "ERROR: Empty response from Gemini"
            
    except Exception as e:
        return f"ERROR: Gemini analysis failed: {str(e)}"

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
        
        # Get target field descriptions from database
        target_fields_data = get_target_fields_from_db(target_fields) if target_fields else []
        
        # Debug: Print raw target fields and processed data
        print(f"DEBUG: Raw target_fields: {json.dumps(target_fields, indent=2)}")
        print(f"DEBUG: Processed target_fields_data: {json.dumps(target_fields_data, indent=2)}")
        
        # Analyze document formats with Gemini
        gemini_response = analyze_document_format_with_gemini(documents, target_fields_data)
        
        # Print document properties
        print(json.dumps(documents, indent=2))
        
        # Print target field descriptions from database
        print(json.dumps(target_fields_data, indent=2))
        
        # Print Gemini response
        print(gemini_response)
        
    else:
        print(json.dumps({"error": "Invalid data format. Expected object with document_ids and session_id"}))

def run_wizardry(data=None):
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