import json
import sys
import os
import re
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
    """Extract all column headers from Excel documents and return formatted JSON"""
    try:
        extraction_results = []
        
        # Get collection name from target fields (assuming they're from the same collection)
        collection_name = ""
        if target_fields and len(target_fields) > 0:
            # Look for collectionId in the target fields to get collection name
            collection_id = target_fields[0].get('collectionId', '')
            if collection_id:
                # We'd need to query the database for collection name, but for now use a placeholder
                collection_name = "Column Headers Collection"
        
        for document in documents:
            # Use full content for processing, contentPreview for display
            full_content = document.get('fullContent', '')
            
            # Parse Excel content to extract column headers from ALL sheets
            if 'Sheet:' in full_content:
                # Split by sheet sections
                sheet_sections = full_content.split('=== Sheet:')
                
                # Track global record index across all sheets
                global_record_index = 0
                
                for sheet_index, sheet_section in enumerate(sheet_sections):
                    if not sheet_section.strip():
                        continue
                    
                    lines = sheet_section.strip().split('\n')
                    if len(lines) < 2:
                        continue
                    
                    # Extract sheet name (remove trailing '===')
                    sheet_name_line = lines[0]
                    sheet_name = sheet_name_line.split('===')[0].strip()
                    
                    # Get the first data line (column headers) - should be line 1
                    header_line = lines[1] if len(lines) > 1 else ""
                    
                    # Split by multiple spaces/tabs to get individual column headers
                    # Use regex to split on multiple whitespace characters
                    columns = re.split(r'\s{2,}', header_line.strip())
                    
                    # Create extraction results for each column in this sheet
                    for col_index, column_header in enumerate(columns):
                        if column_header.strip():
                            # Find matching target field for column heading
                            column_field = None
                            worksheet_field = None
                            
                            for field in target_fields:
                                field_name = field.get('propertyName') or field.get('fieldName', '')
                                if 'column' in field_name.lower() and 'heading' in field_name.lower():
                                    column_field = field
                                elif 'worksheet' in field_name.lower():
                                    worksheet_field = field
                            
                            # Add column heading result
                            if column_field:
                                extraction_results.append({
                                    "field_id": column_field.get('id', ''),
                                    "validation_type": "collection_property",
                                    "data_type": "TEXT",
                                    "field_name": f"{column_field.get('propertyName', 'Column Heading')}[{global_record_index}]",
                                    "collection_name": collection_name,
                                    "extracted_value": column_header.strip(),
                                    "confidence_score": 1.0,
                                    "validation_status": "verified",
                                    "ai_reasoning": f"Extracted directly from sheet '{sheet_name}' using column extraction",
                                    "record_index": global_record_index
                                })
                            
                            # Add worksheet result for each column
                            if worksheet_field:
                                extraction_results.append({
                                    "field_id": worksheet_field.get('id', ''),
                                    "validation_type": "collection_property",
                                    "data_type": "TEXT",
                                    "field_name": f"{worksheet_field.get('propertyName', 'Worksheet')}[{global_record_index}]",
                                    "collection_name": collection_name,
                                    "extracted_value": sheet_name,
                                    "confidence_score": 1.0,
                                    "validation_status": "verified",
                                    "ai_reasoning": f"Extracted sheet name for column '{column_header.strip()}' using column extraction",
                                    "record_index": global_record_index
                                })
                            
                            # Increment global record index for each column across all sheets
                            global_record_index += 1
        
        return extraction_results
        
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
        
        # Analyze document formats with Gemini
        gemini_response = analyze_document_format_with_gemini(documents, target_fields_data)
        
        # Print document properties
        print(json.dumps(documents, indent=2))
        
        # Print target field descriptions from database
        print(json.dumps(target_fields_data, indent=2))
        
        # Print Gemini response
        print(gemini_response)
        
        # Check if Gemini recommends Excel Column Extraction
        if "Excel Column Extraction" in gemini_response:
            extraction_results = extract_excel_columns(documents, target_fields)
            print("\n=== EXCEL COLUMN EXTRACTION RESULTS ===")
            print(json.dumps(extraction_results, indent=2))
        
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