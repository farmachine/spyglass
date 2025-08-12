import json
import sys
import os
import psycopg2

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
        SELECT id, "fileName", "mimeType", "extractedContent" 
        FROM session_documents 
        WHERE id = ANY(%s) AND "sessionId" = %s
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

def run_wizardry(data=None):
    if data and isinstance(data, dict):
        document_ids = data.get('document_ids', [])
        session_id = data.get('session_id')
        
        if not document_ids or not session_id:
            print(json.dumps({"error": "Missing document_ids or session_id"}))
            return
        
        # Get document properties from database
        documents = get_document_properties_from_db(document_ids, session_id)
        print(json.dumps(documents, indent=2))
        
    else:
        print(json.dumps({"error": "Invalid data format. Expected object with document_ids and session_id"}))

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