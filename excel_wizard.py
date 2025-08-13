import os
import psycopg2
import json
import pandas as pd
from io import StringIO
from google import genai
from all_prompts import EXCEL_FUNCTION_GENERATOR

def generate_excel_extraction_function(target_fields_data):
    """Generate a custom Excel extraction function using Gemini based on field descriptions"""
    try:
        # Initialize Gemini client
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        
        # Format target fields for the prompt
        target_fields_json = json.dumps(target_fields_data, indent=2)
        
        # Generate the extraction function using Gemini
        prompt = EXCEL_FUNCTION_GENERATOR.format(target_fields=target_fields_json)
        
        print("\n" + "=" * 80)
        print("GENERATING EXCEL EXTRACTION FUNCTION")
        print("=" * 80)
        print("Target fields:", len(target_fields_data))
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        generated_function = response.text
        print("Generated function length:", len(generated_function) if generated_function else 0)
        print("=" * 80)
        
        return generated_function
        
    except Exception as e:
        print(f"Error generating Excel function: {e}")
        return None

def excel_column_extraction(document_ids, session_id, target_fields_data):
    """Extract column data from Excel documents using AI-generated function"""
    try:
        # Generate custom extraction function using Gemini
        generated_function = generate_excel_extraction_function(target_fields_data)
        if not generated_function:
            return {"error": "Failed to generate extraction function"}
        
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
        
        all_extraction_results = []
        
        for row in results:
            doc_id, file_name, mime_type, extracted_content = row
            
            # Process Excel content using generated function
            if mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                try:
                    # Execute the generated function
                    print("\n" + "=" * 80)
                    print("EXECUTING GENERATED FUNCTION")
                    print("=" * 80)
                    print(f"Processing document: {file_name}")
                    
                    # Create a safe execution environment
                    exec_globals = {
                        'json': json,
                        'pandas': pd,
                        'StringIO': StringIO
                    }
                    
                    # Execute the generated function code
                    exec(generated_function, exec_globals)
                    
                    # Call the generated extract_excel_data function
                    extraction_function = exec_globals.get('extract_excel_data')
                    if extraction_function:
                        document_results = extraction_function(extracted_content, target_fields_data)
                        if isinstance(document_results, list):
                            all_extraction_results.extend(document_results)
                            print(f"Extracted {len(document_results)} records from {file_name}")
                        else:
                            print(f"Function returned non-list result: {type(document_results)}")
                    else:
                        print("Generated function 'extract_excel_data' not found")
                        
                    print("=" * 80)
                    
                except Exception as func_error:
                    print(f"Error executing generated function: {func_error}")
                    # Fallback to simple extraction if generated function fails
                    print("Falling back to simple column extraction")
                    fallback_results = simple_column_extraction(extracted_content, target_fields_data)
                    all_extraction_results.extend(fallback_results)
        
        cursor.close()
        conn.close()
        
        return all_extraction_results
        
    except Exception as e:
        print(f"Error in excel_column_extraction: {e}")
        return {"error": str(e)}

def simple_column_extraction(extracted_content, target_fields_data):
    """Fallback simple column extraction when generated function fails"""
    extraction_results = []
    record_index = 0
    
    # Parse the extracted content to get column names from all sheets
    lines = extracted_content.split('\n')
    current_sheet = None
    
    for line in lines:
        if line.startswith('=== Sheet: '):
            current_sheet = line.replace('=== Sheet: ', '').replace(' ===', '')
        elif line.strip() and current_sheet and not line.startswith('==='):
            # This should be the first row with column headers
            column_headers = line.split('\t')
            
            # Create extraction results for each target field
            for field_data in target_fields_data:
                field_name = field_data.get('name', '')
                if field_name:  # Only process fields with names
                    # Extract each column heading
                    for column_name in column_headers:
                        if column_name.strip():  # Skip empty columns
                            collection_name = field_data.get('collection_name', 'Unknown Collection')
                            extraction_results.append({
                                "validation_type": "collection_property",
                                "data_type": field_data.get('property_type', 'TEXT'),
                                "field_name": f"{collection_name}.{field_name}[{record_index}]",
                                "collection_name": collection_name,
                                "extracted_value": column_name.strip(),
                                "confidence_score": 0.8,
                                "validation_status": "unverified",
                                "ai_reasoning": "Fallback extraction - direct column mapping",
                                "record_index": record_index
                            })
                            record_index += 1
            
            # Move to next line to continue processing other sheets
            current_sheet = None
    
    return extraction_results