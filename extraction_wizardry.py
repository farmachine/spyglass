import json
import sys
import os
import psycopg2
import subprocess
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
        
        # Analyze document formats with Gemini
        gemini_response = analyze_document_format_with_gemini(documents, target_fields_data)
        
        # Print document properties
        print(json.dumps(documents, indent=2))
        
        # Print target field descriptions from database
        print(json.dumps(target_fields_data, indent=2))
        
        # Print Gemini response
        print(gemini_response)
        
        # Check if AI recommends Excel Column Extraction and execute it
        if "Excel Column Extraction" in gemini_response:
            print("\n=== EXECUTING EXCEL COLUMN EXTRACTION ===")
            execute_excel_column_extraction(session_id, documents)
        
    else:
        print(json.dumps({"error": "Invalid data format. Expected object with document_ids and session_id"}))

def execute_excel_column_extraction(session_id, documents):
    """Execute Excel column extraction and save to field_validations database"""
    try:
        # Import the simple column extractor
        from simple_column_extractor import extract_columns_from_excel_text
        
        # Get database connection
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("ERROR: DATABASE_URL not found")
            return
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Process each document
        record_index = 0
        for doc in documents:
            if doc.get('type') == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                # Get full content from database
                query = """
                SELECT extracted_content FROM session_documents 
                WHERE id = %s AND session_id = %s
                """
                cursor.execute(query, (doc['id'], session_id))
                result = cursor.fetchone()
                
                if result and result[0]:
                    content = result[0]
                    file_name = doc['name']
                    
                    # Extract columns using simple_column_extractor logic
                    columns = extract_columns_from_excel_text(content, file_name)
                    
                    # Save each column to field_validations
                    for column_data in columns:
                        # Insert field validation for column name only
                        insert_query = """
                        INSERT INTO field_validations 
                        (field_id, field_name, extracted_value, ai_reasoning, confidence, 
                         validation_type, collection_name, record_index, validation_status, session_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        
                        values = (
                            f"worksheet_name_{record_index}",  # field_id
                            f"Column Name Mapping.Worksheet Name[{record_index}]",  # field_name
                            column_data["column_name"],  # extracted_value
                            f"Sheet name for column '{column_data['column_name']}'",  # ai_reasoning
                            1.0,  # confidence
                            "collection_property",  # validation_type
                            "Column Name Mapping",  # collection_name
                            record_index,  # record_index
                            "verified",  # validation_status
                            session_id  # session_id
                        )
                        
                        cursor.execute(insert_query, values)
                        record_index += 1
        
        # Commit changes
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Successfully extracted and saved {record_index} columns to field_validations")
        
    except Exception as e:
        print(f"ERROR in Excel column extraction: {str(e)}")

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