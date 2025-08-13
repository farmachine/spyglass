import os
import psycopg2
import json
import pandas as pd
from io import StringIO

def excel_column_extraction(document_ids, session_id, target_fields_data):
    """Extract column data from Excel documents using target field data"""
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
        
        extraction_results = []
        
        for row in results:
            doc_id, file_name, mime_type, extracted_content = row
            
            # Process Excel content
            if mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                # Parse the extracted content to get column names
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
                            if field_data.get('name') == 'Column Heading':
                                # Extract each column heading
                                for index, column_name in enumerate(column_headers):
                                    if column_name.strip():  # Skip empty columns
                                        extraction_results.append({
                                            "validation_type": "collection_property",
                                            "data_type": field_data.get('property_type', 'TEXT'),
                                            "field_name": f"Column Name Mapping.ColumnHeading[{index}]",
                                            "collection_name": "Column Name Mapping",
                                            "extracted_value": column_name.strip(),
                                            "confidence_score": 1.0,
                                            "validation_status": "unverified",
                                            "ai_reasoning": "Extracted directly from excel using column extraction wizard",
                                            "record_index": index
                                        })
                            
                            elif field_data.get('name') == 'Worksheet':
                                # Extract worksheet name
                                extraction_results.append({
                                    "validation_type": "collection_property",
                                    "data_type": field_data.get('property_type', 'TEXT'),
                                    "field_name": f"Column Name Mapping.Worksheet[0]",
                                    "collection_name": "Column Name Mapping",
                                    "extracted_value": current_sheet,
                                    "confidence_score": 1.0,
                                    "validation_status": "unverified",
                                    "ai_reasoning": "Extracted directly from excel using column extraction wizard",
                                    "record_index": 0
                                })
                        break  # Only process first row
        
        cursor.close()
        conn.close()
        
        return extraction_results
        
    except Exception as e:
        return {"error": f"Excel extraction failed: {str(e)}"}