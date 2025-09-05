#!/usr/bin/env python3
"""
Column Name Mapping Extractor
Creates identifier references by mapping Excel column headers to standardized names
"""

import os
import sys
import json
import psycopg2
from google import genai

def extract_column_mappings(session_id, document_id, collection_id):
    """Extract column mappings to create identifier references"""
    
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Get the Excel document content
        cursor.execute("""
            SELECT extracted_content, file_name 
            FROM session_documents 
            WHERE session_id = %s AND id = %s
        """, (session_id, document_id))
        
        result = cursor.fetchone()
        if not result:
            return {"error": "Document not found"}
        
        extracted_content, file_name = result
        
        # Parse the Excel content to extract column headers from all sheets
        sheets_data = {}
        if "=== Sheet:" in extracted_content:
            sheet_sections = extracted_content.split("=== Sheet:")
            
            for section in sheet_sections[1:]:  # Skip empty first part
                lines = section.strip().split('\n')
                if not lines:
                    continue
                    
                sheet_name = lines[0].replace("===", "").strip()
                if len(lines) > 1:
                    headers = lines[1].split('\t')
                    # Clean and filter headers
                    clean_headers = [h.strip() for h in headers if h.strip()]
                    sheets_data[sheet_name] = clean_headers
        
        # Initialize Gemini for standardization
        api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {"error": "No API key found"}
        
        client = genai.Client(api_key=api_key)
        
        # Create column mappings for all sheets
        all_mappings = []
        mapping_id = 1
        
        for sheet_name, headers in sheets_data.items():
            for header in headers:
                if not header or len(header.strip()) < 2:
                    continue
                
                # Generate standardized name and reasoning using Gemini
                prompt = f"""
You are analyzing pension scheme data column headers. For the column header "{header}" from worksheet "{sheet_name}":

1. Create a standardized column name (short, clear, standardized format)
2. Provide reasoning for the mapping

Column Header: "{header}"
Worksheet: "{sheet_name}"

Respond with JSON in this exact format:
{{
  "standardised_name": "Standard_Column_Name",
  "reasoning": "Brief explanation of what this column represents and why this standardization was chosen"
}}
"""
                
                try:
                    response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt
                    )
                    
                    result_text = response.text.strip()
                    
                    # Clean the response
                    if result_text.startswith('```json'):
                        result_text = result_text.replace('```json', '').replace('```', '').strip()
                    elif result_text.startswith('```'):
                        result_text = result_text.replace('```', '').strip()
                    
                    # Parse JSON response
                    mapping_data = json.loads(result_text)
                    
                    # Create the mapping entry
                    mapping_entry = {
                        "column_heading": header,
                        "worksheet": sheet_name,
                        "standardised_column_name": mapping_data.get("standardised_name", f"Column_{mapping_id}"),
                        "reasoning": mapping_data.get("reasoning", f"Mapped from column '{header}' in sheet '{sheet_name}'")
                    }
                    
                    all_mappings.append(mapping_entry)
                    mapping_id += 1
                    
                    # Limit to prevent too many mappings
                    if len(all_mappings) >= 50:
                        break
                    
                except Exception as e:
                    # Fallback mapping
                    mapping_entry = {
                        "column_heading": header,
                        "worksheet": sheet_name,
                        "standardised_column_name": header.replace(' ', '_').replace('(', '').replace(')', ''),
                        "reasoning": f"Direct mapping from Excel column '{header}' in worksheet '{sheet_name}'"
                    }
                    all_mappings.append(mapping_entry)
                    mapping_id += 1
        
        # Now save the mappings as field validations
        if all_mappings:
            # Get collection properties
            cursor.execute("""
                SELECT id, property_name, is_identifier
                FROM collection_properties 
                WHERE collection_id = %s
                ORDER BY order_index
            """, (collection_id,))
            
            properties = cursor.fetchall()
            
            # Map properties by name
            prop_map = {}
            for prop_id, prop_name, is_identifier in properties:
                prop_map[prop_name.lower().replace(' ', '_')] = {
                    'id': prop_id, 
                    'name': prop_name,
                    'is_identifier': is_identifier
                }
            
            # Create field validations for each mapping
            saved_count = 0
            for idx, mapping in enumerate(all_mappings):
                # Create validation for each property
                for field_key, field_value in mapping.items():
                    # Map field key to property
                    prop_key = field_key.lower().replace(' ', '_')
                    if prop_key in prop_map:
                        prop_info = prop_map[prop_key]
                        
                        # Insert or update field validation
                        cursor.execute("""
                            INSERT INTO field_validations 
                            (session_id, field_id, field_name, field_type, extracted_value, 
                             confidence_score, validation_status, ai_reasoning, is_identifier)
                            VALUES (%s, %s, %s, 'TEXT', %s, 95, 'validated', %s, %s)
                            ON CONFLICT (session_id, field_id) 
                            DO UPDATE SET 
                                extracted_value = EXCLUDED.extracted_value,
                                confidence_score = EXCLUDED.confidence_score,
                                validation_status = EXCLUDED.validation_status,
                                updated_at = CURRENT_TIMESTAMP
                        """, (
                            session_id,
                            f"{prop_info['id']}_{idx}",  # Unique field ID for each mapping
                            prop_info['name'],
                            str(field_value),
                            f"Extracted column mapping entry {idx + 1}",
                            prop_info['is_identifier']
                        ))
                        saved_count += 1
            
            conn.commit()
            
            # Mark identifier property as complete
            if saved_count > 0:
                print(f"Created {len(all_mappings)} column mappings with {saved_count} field validations")
                print("IDENTIFIER REFERENCES CREATED - Column Name Mapping collection is now EXTRACTION COMPLETE")
            
            return {
                "success": True,
                "mappings_created": len(all_mappings),
                "field_validations_saved": saved_count,
                "message": "Column mapping identifier references created successfully"
            }
        else:
            return {"error": "No column mappings could be created"}
        
    except Exception as e:
        return {"error": f"Column mapping extraction failed: {str(e)}"}
    finally:
        if 'conn' in locals():
            conn.close()

def main():
    """Main function for standalone execution"""
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python column_mapping_extractor.py <session_id> <document_id> <collection_id>"}))
        return
    
    session_id = sys.argv[1]
    document_id = sys.argv[2] 
    collection_id = sys.argv[3]
    
    result = extract_column_mappings(session_id, document_id, collection_id)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()