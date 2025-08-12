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

def analyze_document_format_with_gemini(documents):
    """Send document properties to Gemini and return raw response"""
    try:
        # Get API key from environment
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return "ERROR: GEMINI_API_KEY not found"
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Use centralized prompt from all_prompts.py
        prompt = DOCUMENT_FORMAT_ANALYSIS.format(documents=json.dumps(documents, indent=2))
        
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
        
        if not document_ids or not session_id:
            print(json.dumps({"error": "Missing document_ids or session_id"}))
            return
        
        # Get document properties from database
        documents = get_document_properties_from_db(document_ids, session_id)
        
        if isinstance(documents, dict) and "error" in documents:
            print(json.dumps(documents))
            return
        
        # Analyze document formats with Gemini
        gemini_response = analyze_document_format_with_gemini(documents)
        
        # Print document properties
        print(json.dumps(documents, indent=2))
        
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