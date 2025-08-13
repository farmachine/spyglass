import json
import sys
import os
import re
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS
from simple_column_extractor import simple_extraction_main

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
            
            # Create content preview (very short preview for console, full content stored separately)
            content_preview = ""
            if extracted_content:
                # Show only first few lines with sheet names for console output
                lines = extracted_content.split('\n')[:3]
                content_preview = '\n'.join(lines) + "..." if len(extracted_content) > 100 else extracted_content
            
            documents.append({
                "id": doc_id,
                "name": file_name,
                "type": mime_type or "unknown",
                "contentPreview": content_preview,
                "fullContent": extracted_content  # Store full content for processing
            })
        
        cursor.close()
        conn.close()
        
        return documents
        
    except Exception as e:
        return {"error": f"Database query failed: {str(e)}"}


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

def extract_excel_columns(documents, target_fields):
    """Extract all column headers from Excel documents using simple_column_extractor.py"""
    try:
        # Format documents data for simple_column_extractor
        session_data = {
            'extractedTexts': []
        }
        
        for document in documents:
            # Use full content for processing
            full_content = document.get('fullContent', '')
            if full_content:
                # Add the "Excel file content:" prefix that simple_column_extractor expects
                formatted_content = "Excel file content:\n" + full_content
                session_data['extractedTexts'].append({
                    'content': formatted_content,
                    'fileName': document.get('name', 'Unknown')
                })
        
        # Debug: Check session data format before calling extractor
        print(f"\n=== DEBUG: SESSION DATA FORMAT ===")
        print(f"Session data keys: {list(session_data.keys())}")
        if 'extractedTexts' in session_data:
            print(f"Number of extracted texts: {len(session_data['extractedTexts'])}")
            for i, text_data in enumerate(session_data['extractedTexts']):
                content = text_data.get('content', '')
                print(f"Text {i}: {text_data.get('fileName', 'Unknown')} - Content length: {len(content)}")
                print(f"Content preview: {content[:100]}...")
        print("=== END DEBUG ===\n")
        
        # Call simple_column_extractor module with start_index 0 and target fields
        extraction_result = simple_extraction_main(session_data, start_index=0, target_fields=target_fields)
        
        # Log the raw JSON response from simple_column_extractor
        print(f"\n=== RAW JSON RESPONSE FROM SIMPLE_COLUMN_EXTRACTOR ===")
        print(json.dumps(extraction_result, indent=2))
        print("=== END RAW JSON RESPONSE ===\n")
        
        # Return the field validations from simple_column_extractor
        return extraction_result.get('field_validations', [])
        
    except Exception as e:
        return {"error": f"Excel column extraction failed: {str(e)}"}

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
        
        # Console log all collection properties for debugging
        print(f"\n=== ALL COLLECTION PROPERTIES ===")
        collection_properties = [field for field in target_fields_data if field.get('type') == 'collection_property']
        print(f"Total collection properties: {len(collection_properties)}")
        for i, prop in enumerate(collection_properties):
            print(f"Property {i+1}:")
            print(f"  Field ID: {prop.get('field_id', '')}")
            print(f"  Name: {prop.get('name', '')}")
            print(f"  Description: {prop.get('description', '')}")
            print(f"  Type: {prop.get('property_type', '')}")
            print(f"  Collection ID: {prop.get('collection_id', '')}")
            print(f"  Is Identifier: {prop.get('is_identifier', False)}")
            print(f"  Order Index: {prop.get('order_index', 0)}")
        print("=== END ALL COLLECTION PROPERTIES ===\n")
        
        # Analyze document formats with Gemini
        gemini_response = analyze_document_format_with_gemini(documents, target_fields_data)
        
        # Print Gemini response
        print(gemini_response)
        
        # Check if Gemini recommends Excel Column Extraction
        if "Excel Column Extraction" in gemini_response:
            extraction_results = extract_excel_columns(documents, target_fields)
            print("\n=== EXCEL COLUMN EXTRACTION RESULTS ===")
            print(json.dumps(extraction_results, indent=2))
            print("=== END EXCEL COLUMN EXTRACTION RESULTS ===\n")
        
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