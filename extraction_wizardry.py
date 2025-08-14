import json
import sys
import os
import time
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS, EXCEL_FUNCTION_GENERATOR
from excel_wizard import excel_column_extraction
from ai_extraction_wizard import ai_document_extraction

def log_remaining_collection_fields(extracted_results, all_collection_properties):
    """Log which collection fields have been extracted and which remain to be processed"""
    try:
        print("\n" + "=" * 80, flush=True)
        print("EXTRACTION PROGRESS TRACKING", flush=True)
        print("=" * 80, flush=True)
        
        # Debug: Show what data we received
        print(f"DEBUG: Received {len(extracted_results)} extracted results", flush=True)
        print(f"DEBUG: Received {len(all_collection_properties)} collection properties", flush=True)
        
        if not all_collection_properties:
            print("No collection properties data provided", flush=True)
            return
            
        # Get extracted field names
        extracted_field_names = set()
        for result in extracted_results:
            field_name = result.get('field_name', '')
            if '.' in field_name:
                property_name = field_name.split('.')[-1]
                extracted_field_names.add(property_name)
            else:
                extracted_field_names.add(field_name)
        
        # Group properties by collection and show results
        current_collection = None
        field_count = 0
        extracted_count = 0
        
        for prop in all_collection_properties:
            collection_name = prop.get('collection_name', 'Unknown Collection')
            property_name = prop.get('property_name', 'Unknown Property')
            order_index = prop.get('order_index', 0)
            is_identifier = prop.get('is_identifier', False)
            description = prop.get('description', '')
            
            # Check if this field was extracted
            is_extracted = property_name in extracted_field_names
            if is_extracted:
                extracted_count += 1
            field_count += 1
            
            # Print collection header if changed
            if collection_name != current_collection:
                if current_collection is not None:
                    print("", flush=True)  # Add space between collections
                current_collection = collection_name
                print(f"🔗 COLLECTION: {collection_name}", flush=True)
            
            # Show field status
            status = "✅ EXTRACTED" if is_extracted else "⏳ NOT EXTRACTED"
            identifier_mark = " [IDENTIFIER]" if is_identifier else ""
            description_snippet = f" - {description[:40]}..." if description else ""
            
            print(f"   [{order_index:2d}] {property_name}{identifier_mark} - {status}{description_snippet}", flush=True)
        
        # Summary stats
        remaining_count = field_count - extracted_count
        
        print(f"\n📊 SUMMARY:", flush=True)
        print(f"   Total Collection Fields: {field_count}", flush=True)
        print(f"   Extracted: {extracted_count}", flush=True)
        print(f"   Remaining: {remaining_count}", flush=True)
        print("=" * 80, flush=True)
        
    except Exception as e:
        print(f"Error logging remaining fields: {e}", flush=True)

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
            
            # Store full extracted content instead of preview for Excel processing
            full_content = extracted_content or ""
            
            documents.append({
                "id": doc_id,
                "name": file_name,
                "type": mime_type or "unknown",
                "contentPreview": full_content  # Full content for Excel wizardry
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

def get_excel_wizardry_functions():
    """Get all existing Excel wizardry functions from database"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Query excel_wizardry_functions table
        query = """
        SELECT id, name, description, tags, function_code, usage_count
        FROM excel_wizardry_functions
        ORDER BY usage_count DESC, created_at DESC
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Format results
        functions = []
        for row in results:
            func_id, name, description, tags, function_code, usage_count = row
            functions.append({
                "id": str(func_id),
                "name": name,
                "description": description,
                "tags": tags or [],
                "function_code": function_code,
                "usage_count": usage_count or 0
            })
        
        cursor.close()
        conn.close()
        
        return functions
        
    except Exception as e:
        return {"error": f"Excel wizardry functions query failed: {str(e)}"}

def create_excel_wizardry_function(name, description, tags, function_code):
    """Create a new Excel wizardry function in database"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Define input and output schemas
        input_schema = {
            "type": "object",
            "properties": {
                "extracted_content": {"type": "string", "description": "Excel content with sheet names and tab-separated values"},
                "target_fields_data": {"type": "array", "description": "List of target fields to extract"}
            },
            "required": ["extracted_content", "target_fields_data"]
        }
        
        output_schema = {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "validation_type": {"type": "string"},
                    "data_type": {"type": "string"},
                    "field_name": {"type": "string"},
                    "collection_name": {"type": "string"},
                    "extracted_value": {"type": "string"},
                    "confidence_score": {"type": "number"},
                    "validation_status": {"type": "string"},
                    "ai_reasoning": {"type": "string"},
                    "record_index": {"type": "integer"}
                }
            }
        }
        
        # Insert new function with proper schemas
        query = """
        INSERT INTO excel_wizardry_functions (name, description, tags, function_code, input_schema, output_schema, usage_count)
        VALUES (%s, %s, %s, %s, %s, %s, 0)
        RETURNING id
        """
        
        cursor.execute(query, (name, description, tags, function_code, 
                             json.dumps(input_schema), json.dumps(output_schema)))
        function_id = cursor.fetchone()[0]
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"id": str(function_id), "message": "Excel wizardry function created successfully"}
        
    except Exception as e:
        return {"error": f"Failed to create Excel wizardry function: {str(e)}"}

def increment_function_usage(function_id):
    """Increment usage count for an Excel wizardry function"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Update usage count
        query = """
        UPDATE excel_wizardry_functions 
        SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
        WHERE id = %s
        """
        
        cursor.execute(query, (function_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"message": "Function usage incremented successfully"}
        
    except Exception as e:
        return {"error": f"Failed to increment function usage: {str(e)}"}

def update_excel_wizardry_function(function_id, function_code, description=None):
    """Update an existing Excel wizardry function"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Update function
        if description:
            query = """
            UPDATE excel_wizardry_functions 
            SET function_code = %s, description = %s, updated_at = NOW()
            WHERE id = %s
            """
            cursor.execute(query, (function_code, description, function_id))
        else:
            query = """
            UPDATE excel_wizardry_functions 
            SET function_code = %s, updated_at = NOW()
            WHERE id = %s
            """
            cursor.execute(query, (function_code, function_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"message": "Excel wizardry function updated successfully"}
        
    except Exception as e:
        return {"error": f"Failed to update Excel wizardry function: {str(e)}"}



def generate_excel_function_with_gemini(target_fields_data, documents, max_retries=3):
    """Generate a new Excel function using Gemini AI"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY not found"}
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Prepare prompt data
    target_fields_content = json.dumps(target_fields_data, indent=2)
    documents_content = json.dumps(documents, indent=2)
    
    prompt = EXCEL_FUNCTION_GENERATOR.format(
        target_fields=target_fields_content,
        source_documents=documents_content
    )
    
    # Log the prompt
    print("\n" + "=" * 80)
    print("EXCEL FUNCTION GENERATION PROMPT")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    # Retry logic for Gemini API calls
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            
            response_text = response.text or ""
            
            # Log the raw response for debugging
            print(f"Raw Gemini response: {response_text}")
            
            # Try to clean and parse the JSON response
            try:
                # Remove any markdown formatting if present
                cleaned_response = response_text.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response.replace('```json', '').replace('```', '').strip()
                elif cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response.replace('```', '').strip()
                
                function_data = json.loads(cleaned_response)
                return function_data
            except json.JSONDecodeError as parse_error:
                # Try to extract JSON from the response if it's embedded in text
                try:
                    # Look for JSON-like content between { and }
                    start_idx = response_text.find('{')
                    end_idx = response_text.rfind('}') + 1
                    if start_idx >= 0 and end_idx > start_idx:
                        json_part = response_text[start_idx:end_idx]
                        function_data = json.loads(json_part)
                        return function_data
                except:
                    pass
                
                return {"error": f"Failed to parse Gemini response as JSON: {str(parse_error)}", "raw_response": response_text}
            
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini function generation attempt {attempt + 1} failed: {error_msg}")
            
            if "503" in error_msg or "overloaded" in error_msg.lower():
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
            
            return {"error": f"Gemini function generation failed: {error_msg}"}
    
    return {"error": "All Gemini function generation retry attempts failed"}

def execute_excel_wizardry_function(function_code, extracted_content, target_fields_data):
    """Execute an Excel wizardry function with the provided data"""
    try:
        # Create a safe execution environment with necessary imports
        import re
        exec_globals = {
            'json': json,
            're': re,
            '__builtins__': {
                'len': len,
                'str': str,
                'int': int,
                'float': float,
                'list': list,
                'dict': dict,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'print': print,
                '__import__': __import__,  # Allow imports
                'abs': abs,
                'any': any,
                'all': all,
                'bool': bool,
                'max': max,
                'min': min,
                'sum': sum,
                'sorted': sorted,
                'reversed': reversed
            }
        }
        
        # Execute the function code
        exec(function_code, exec_globals)
        
        # Get the function from the execution environment
        if 'extract_excel_data' not in exec_globals:
            return {"error": "Function 'extract_excel_data' not found in the generated code"}
        
        extract_function = exec_globals['extract_excel_data']
        
        # Debug: Print input data
        print(f"DEBUG - Function input content preview: {extracted_content[:500]}...")
        print(f"DEBUG - Target fields count: {len(target_fields_data)}")
        print(f"DEBUG - Target fields sample: {target_fields_data[:2] if target_fields_data else 'No fields'}")
        
        # Execute the function
        results = extract_function(extracted_content, target_fields_data)
        
        print(f"DEBUG - Function returned {len(results) if results else 0} results")
        
        return {"results": results}
        
    except Exception as e:
        return {"error": f"Failed to execute Excel wizardry function: {str(e)}"}

def update_document_format_analysis_with_functions(documents, target_fields_data, existing_functions):
    """Update the document format analysis to include existing functions"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return "ERROR: GEMINI_API_KEY not found"
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Prepare prompt data
    documents_content = json.dumps(documents, indent=2)
    target_fields_content = json.dumps(target_fields_data, indent=2) if target_fields_data else "No target fields provided"
    existing_functions_content = json.dumps(existing_functions, indent=2) if existing_functions else "No existing functions"
    
    prompt = DOCUMENT_FORMAT_ANALYSIS.format(
        documents=documents_content,
        target_fields=target_fields_content,
        existing_functions=existing_functions_content
    )
    
    # Log the prompt
    print("\n" + "=" * 80)
    print("ENHANCED GEMINI PROMPT WITH EXCEL FUNCTIONS")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        return response.text or "ERROR: Empty response from Gemini"
        
    except Exception as e:
        return f"ERROR: Enhanced Gemini analysis failed: {str(e)}"

def run_wizardry_with_gemini_analysis(data=None, extraction_number=0):
    """Main function that gets documents from DB and analyzes them with Gemini"""
    
    # If this is the second run (extraction_number=1), just log parameters and stop
    if extraction_number == 1:
        print("\n" + "=" * 80)
        print("SECOND EXTRACTION RUN - PARAMETER LOGGING")
        print("=" * 80)
        print(f"EXTRACTION NUMBER: {extraction_number}")
        
        if data and isinstance(data, dict):
            target_fields = data.get('target_fields', [])
            document_ids = data.get('document_ids', [])
            session_id = data.get('session_id')
            
            print(f"DOCUMENT IDS: {document_ids}")
            print(f"SESSION ID: {session_id}")
            print(f"NUMBER OF TARGET FIELDS: {len(target_fields)}")
            print("TARGET FIELDS RECEIVED:")
            print(json.dumps(target_fields, indent=2))
        
        print("=" * 80)
        print("STOPPING PROCESS - Parameter verification complete")
        print("=" * 80)
        return  # Stop immediately after logging
    
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
        
        # Get all collection properties for progress tracking
        collection_ids = list(set([field.get('collection_id') for field in target_fields_data if field.get('collection_id')]))
        all_collection_properties = []
        if collection_ids:
            all_properties_result = get_all_collection_properties(collection_ids)
            if isinstance(all_properties_result, list):
                all_collection_properties = all_properties_result
        
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
        
        # Get existing Excel wizardry functions
        existing_functions = get_excel_wizardry_functions()
        if isinstance(existing_functions, dict) and "error" in existing_functions:
            print(f"Warning: Could not retrieve Excel functions: {existing_functions['error']}")
            existing_functions = []
        
        # Print existing Excel functions
        print("\n" + "=" * 80)
        print("EXISTING EXCEL WIZARDRY FUNCTIONS")
        print("=" * 80)
        print(json.dumps(existing_functions, indent=2))
        print("=" * 80)
        
        # Analyze document formats with Gemini using enhanced analysis that includes existing functions
        gemini_response = update_document_format_analysis_with_functions(documents, identifier_targets, existing_functions)
        
        # Print Gemini response
        print("\n" + "=" * 80)
        print("GEMINI ANALYSIS")
        print("=" * 80)
        print(gemini_response)
        print("=" * 80)
        
        # Check if Gemini recommends Excel Wizardry Function
        if "Excel Wizardry Function" in gemini_response:
            print(f"\nGemini decided to use Excel Wizardry Function")
            
            # Parse the response to get function ID or CREATE_NEW
            if "|" in gemini_response:
                function_instruction = gemini_response.split("|")[-1].strip()
            else:
                function_instruction = "CREATE_NEW"
            
            print(f"Function instruction: {function_instruction}")
            
            # Get document content for Excel processing
            document_ids = [doc['id'] for doc in documents]
            extracted_content = ""
            
            # Get the extracted content from the first Excel document
            for doc in documents:
                if doc.get('type', '').lower() in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']:
                    # Get full extracted content from database
                    doc_content = get_document_properties_from_db([doc['id']], session_id)
                    if doc_content and not isinstance(doc_content, dict):
                        for doc_data in doc_content:
                            if 'contentPreview' in doc_data:
                                # This would be the full content, not just preview in actual implementation
                                extracted_content = doc_data['contentPreview']
                                break
                    break
            
            if function_instruction != "CREATE_NEW" and function_instruction != "":
                # Use existing function
                print(f"Using existing Excel function with ID: {function_instruction}")
                
                # Find the function by ID
                existing_function = None
                for func in existing_functions:
                    if func['id'] == function_instruction:
                        existing_function = func
                        break
                
                if existing_function:
                    print(f"Found function: {existing_function['name']}")
                    
                    # Execute the existing function
                    function_result = execute_excel_wizardry_function(
                        existing_function['function_code'],
                        extracted_content,
                        identifier_targets
                    )
                    
                    if 'error' not in function_result:
                        # Increment usage count
                        increment_result = increment_function_usage(function_instruction)
                        if 'error' in increment_result:
                            print(f"Warning: Could not increment usage count: {increment_result['error']}")
                        
                        # Process results
                        results = function_result['results']
                        processed_results = clean_json_and_extract_identifiers(results, identifier_targets)
                        
                        if 'error' not in processed_results:
                            record_count = len(processed_results['cleaned_results']) if isinstance(processed_results['cleaned_results'], list) else 0
                            print(f"Found {record_count} records using existing function")
                            
                            # Show results
                            print("\n" + "=" * 80)
                            print("EXCEL WIZARDRY FUNCTION RESULTS")
                            print("=" * 80)
                            print(json.dumps(processed_results['identifier_results'], indent=2))
                            
                            # Create identifier references
                            identifier_references = []
                            for result in processed_results['identifier_results']:
                                if 'extracted_value' in result and 'field_name' in result:
                                    field_name_parts = result['field_name'].split('.')
                                    field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                    identifier_references.append({field_name_only: result['extracted_value']})
                            
                            print("\n" + "=" * 80)
                            print("IDENTIFIER REFERENCES")
                            print("=" * 80)
                            print(json.dumps(identifier_references, indent=2))
                            
                            # Log remaining fields
                            log_remaining_collection_fields(processed_results.get('identifier_results', []), all_collection_properties)
                        else:
                            print(f"Error processing function results: {processed_results['error']}")
                    else:
                        print(f"Error executing function: {function_result['error']}")
                else:
                    print(f"Function with ID {function_instruction} not found, creating new function instead")
                    function_instruction = "CREATE_NEW"
            
            if function_instruction == "CREATE_NEW":
                # Generate new function
                print("Creating new Excel wizardry function")
                
                # Generate function with Gemini
                function_data = generate_excel_function_with_gemini(identifier_targets, documents)
                
                if 'error' not in function_data:
                    print(f"Generated function: {function_data.get('function_name', 'Unnamed Function')}")
                    
                    # Save function to database
                    create_result = create_excel_wizardry_function(
                        function_data.get('function_name', 'Auto-generated Excel Function'),
                        function_data.get('description', 'Auto-generated function for Excel data extraction'),
                        function_data.get('tags', []),
                        function_data.get('function_code', '')
                    )
                    
                    if 'error' not in create_result:
                        print(f"Function saved with ID: {create_result['id']}")
                        
                        # Execute the new function
                        function_result = execute_excel_wizardry_function(
                            function_data.get('function_code', ''),
                            extracted_content,
                            identifier_targets
                        )
                        
                        if 'error' not in function_result:
                            # Process results
                            results = function_result['results']
                            processed_results = clean_json_and_extract_identifiers(results, identifier_targets)
                            
                            if 'error' not in processed_results:
                                record_count = len(processed_results['cleaned_results']) if isinstance(processed_results['cleaned_results'], list) else 0
                                print(f"Found {record_count} records using new function")
                                
                                # Show results
                                print("\n" + "=" * 80)
                                print("EXCEL WIZARDRY FUNCTION RESULTS")
                                print("=" * 80)
                                print(json.dumps(processed_results['identifier_results'], indent=2))
                                
                                # Create identifier references
                                identifier_references = []
                                for result in processed_results['identifier_results']:
                                    if 'extracted_value' in result and 'field_name' in result:
                                        field_name_parts = result['field_name'].split('.')
                                        field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                        identifier_references.append({field_name_only: result['extracted_value']})
                                
                                print("\n" + "=" * 80)
                                print("IDENTIFIER REFERENCES")
                                print("=" * 80)
                                print(json.dumps(identifier_references, indent=2))
                                
                                # Log remaining fields
                                log_remaining_collection_fields(processed_results.get('identifier_results', []), all_collection_properties)
                            else:
                                print(f"Error processing new function results: {processed_results['error']}")
                        else:
                            print(f"Error executing new function: {function_result['error']}")
                    else:
                        print(f"Error saving function: {create_result['error']}")
                else:
                    print(f"Error generating function: {function_data['error']}")
        
        # Check if Gemini recommends Excel Column Extraction
        elif "Excel Column Extraction" in gemini_response:
            print(f"\nGemini decided to use Excel Column Extraction wizard")
            print("\n" + "=" * 80)
            print("RESULTS FROM EXTRACTION")
            print("=" * 80)
            # Get document IDs from the documents data
            document_ids = [doc['id'] for doc in documents]
            # Pass only identifier targets to excel extraction
            excel_result = excel_column_extraction(document_ids, session_id, identifier_targets)
            
            # Clean JSON and extract identifiers
            processed_results = clean_json_and_extract_identifiers(excel_result, identifier_targets)
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
                
                # Log remaining unextracted collection fields
                log_remaining_collection_fields(processed_results.get('identifier_results', []), all_collection_properties)
            else:
                print(f"Error processing results: {processed_results['error']}")
        elif "Excel Sheet Extraction" in gemini_response:
            print(f"\nGemini decided to use Excel Sheet Extraction wizard")
            print("\n" + "=" * 80)
            print("RESULTS FROM EXTRACTION")
            print("=" * 80)
            print("Excel Sheet Extraction not yet implemented")
        elif "AI Extraction" in gemini_response:
            print(f"\nGemini decided to use AI Extraction wizard")
            print("\n" + "=" * 80)
            print("RESULTS FROM EXTRACTION")
            print("=" * 80)
            # Get document IDs from the documents data
            document_ids = [doc['id'] for doc in documents]
            # Pass document IDs and identifier targets to AI extraction
            ai_result = ai_document_extraction(document_ids, session_id, identifier_targets)
            
            # Clean JSON and extract identifiers
            processed_results = clean_json_and_extract_identifiers(ai_result, identifier_targets)
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
                
                # Log remaining unextracted collection fields
                log_remaining_collection_fields(processed_results.get('identifier_results', []), all_collection_properties)
            else:
                print(f"Error processing AI extraction results: {processed_results['error']}")
        else:
            print(f"\nGemini did not recommend a specific extraction method")
            print("\n" + "=" * 80)
            print("RESULTS FROM EXTRACTION")
            print("=" * 80)
            print("No extraction performed")
        print("=" * 80)
        
        # AUTO-RERUN LOGIC: Re-run the function with specific parameters after completion
        if extraction_number == 0:  # Only rerun after the first extraction
            print("\n" + "=" * 80)
            print("AUTO-RERUN: Starting second extraction run")
            print("=" * 80)
            
            # Define the parameters for the second run as specified by user
            next_extraction_number = extraction_number + 1  # 0 + 1 = 1
            num_target_collection_items = 2
            
            # Selected Target Field Objects (only fields to be extracted)
            selected_target_fields = [
                {
                    "id": "34580f0d-321f-498a-b1c0-6162ad831122",
                    "collectionId": "ee9d75f7-026e-4f59-ad7a-329295c54505",
                    "propertyName": "Column Heading",
                    "propertyType": "TEXT",
                    "description": "Please just look for the first row in each workbook. This will give you the column name. This should only look at row 1 in each sheet.",
                    "autoVerificationConfidence": 80,
                    "choiceOptions": [],
                    "isIdentifier": True,
                    "orderIndex": 0,
                    "createdAt": "2025-08-12T07:23:55.023Z"
                },
                {
                    "id": "afca5391-afb0-4639-baff-2b69487669ad",
                    "collection_id": "ee9d75f7-026e-4f59-ad7a-329295c54505",
                    "collection_name": "Column Name Mapping",
                    "property_name": "Worksheet",
                    "property_type": "TEXT",
                    "description": "The name of the worksheet containing the column. This should only look at row 1 in each sheet.",
                    "auto_verification_confidence": 80,
                    "choice_options": [],
                    "is_identifier": False,
                    "order_index": 1,
                    "createdAt": "2025-08-12T07:23:55.023Z"
                }
            ]
            
            # Collection properties NOT to be extracted (excluded from processing)
            excluded_properties = [
                {
                    "id": "7f87696b-2b4f-4e38-820f-08ebdd301bba",
                    "collection_id": "ee9d75f7-026e-4f59-ad7a-329295c54505",
                    "collection_name": "Column Name Mapping",
                    "property_name": "Standardised Column Name",
                    "property_type": "TEXT",
                    "description": "Look at the most relevant column references within the knowledge document: \"Standard_Field_Mappings_with_all_synonyms. Just give the name of the most relevant field from this document. This should only look at row 1 in each sheet.",
                    "auto_verification_confidence": 80,
                    "choice_options": [],
                    "is_identifier": False,
                    "order_index": 2
                },
                {
                    "id": "87b1fe45-0c6a-4a51-9d1c-d5a2d7ee1cde",
                    "collection_id": "ee9d75f7-026e-4f59-ad7a-329295c54505",
                    "collection_name": "Column Name Mapping",
                    "property_name": "Reasoning",
                    "property_type": "TEXT",
                    "description": "Give reasoning for the mapping of the extracted column name to the 'Standardised Column Name' from the knowledge document. This should only look at row 1 in each sheet.",
                    "auto_verification_confidence": 80,
                    "choice_options": [],
                    "is_identifier": False,
                    "order_index": 3
                }
            ]
            
            # Console log the parameters as requested
            print(f"NEXT EXTRACTION NUMBER: {next_extraction_number}")
            print(f"NUMBER OF TARGET COLLECTION ITEMS: {num_target_collection_items}")
            print("SELECTED TARGET FIELD OBJECTS:")
            print(json.dumps(selected_target_fields, indent=2))
            print("EXCLUDED PROPERTIES (NOT TO BE EXTRACTED):")
            print(json.dumps(excluded_properties, indent=2))
            
            # Create new data object with updated target fields
            rerun_data = {
                "document_ids": document_ids,
                "session_id": session_id,
                "target_fields": selected_target_fields
            }
            
            # Re-run the extraction with the new parameters
            run_wizardry_with_gemini_analysis(rerun_data, next_extraction_number)
        
    else:
        print(json.dumps({"error": "Invalid data format. Expected object with document_ids and session_id"}))

def run_wizardry(data=None, extraction_number=0):
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
    run_wizardry_with_gemini_analysis(data, extraction_number)

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