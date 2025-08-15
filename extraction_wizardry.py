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
    
    # Log truncated prompt for debugging
    print(f"\n📝 GEMINI PROMPT: {len(prompt)} characters")
    print(f"   Preview: {prompt[:150].replace(chr(10), ' ')}...")
    print("=" * 40)
    
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

def get_excel_wizardry_function_by_id(function_id):
    """Get a specific Excel wizardry function by ID from the database"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Query specific Excel wizardry function by ID
        query = """
        SELECT id, name, description, tags, function_code, usage_count
        FROM excel_wizardry_functions
        WHERE id = %s
        """
        
        cursor.execute(query, (function_id,))
        result = cursor.fetchone()
        
        if result:
            func_id, name, description, tags, function_code, usage_count = result
            function_data = {
                "id": str(func_id),
                "name": name,
                "description": description,
                "tags": tags or [],
                "function_code": function_code,
                "usage_count": usage_count or 0
            }
        else:
            function_data = {"error": f"No function found with ID: {function_id}"}
        
        cursor.close()
        conn.close()
        
        return function_data
        
    except Exception as e:
        return {"error": f"Failed to retrieve Excel wizardry function: {str(e)}"}

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



def generate_excel_function_with_gemini(target_fields_data, documents, identifier_references=None, extraction_number=0, max_retries=3):
    """Generate a new Excel function using Gemini AI with optional identifier references"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY not found"}
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Prepare prompt data
    target_fields_content = json.dumps(target_fields_data, indent=2)
    documents_content = json.dumps(documents, indent=2)
    identifier_references_content = json.dumps(identifier_references, indent=2) if identifier_references else "None - First extraction"
    
    prompt = EXCEL_FUNCTION_GENERATOR.format(
        target_fields=target_fields_content,
        source_documents=documents_content,
        identifier_references=identifier_references_content,
        extraction_number=extraction_number
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

def execute_excel_wizardry_function(function_code, extracted_content, target_fields_data, identifier_references=None):
    """Execute an Excel wizardry function with the provided data and optional identifier references"""
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
        
        # Execute function with appropriate parameters
        import inspect
        func_signature = inspect.signature(extract_function)
        
        if len(func_signature.parameters) >= 3 and identifier_references is not None:
            # New function signature with identifier_references
            results = extract_function(extracted_content, target_fields_data, identifier_references)
        else:
            # Legacy function signature without identifier_references
            results = extract_function(extracted_content, target_fields_data)
        
        print(f"🔧 Function executed: returned {len(results) if results else 0} results")
        
        return {"results": results}
        
    except Exception as e:
        return {"error": f"Failed to execute Excel wizardry function: {str(e)}"}

def update_document_format_analysis_with_functions(documents, target_fields_data, existing_functions, identifier_references=None, extraction_number=0):
    """Update the document format analysis to include existing functions and identifier references"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return "ERROR: GEMINI_API_KEY not found"
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Handle document content for analysis
    if documents == "NO DOCUMENTS SELECTED":
        documents_content = "NO DOCUMENTS SELECTED"
    else:
        # Prepare prompt data - only include document properties, not full content
        documents_for_analysis = []
        for doc in documents:
            doc_summary = {
                "id": doc.get("id"),
                "name": doc.get("name"), 
                "type": doc.get("type"),
                "size": len(doc.get("contentPreview", "")) if doc.get("contentPreview") else 0
            }
            documents_for_analysis.append(doc_summary)
        documents_content = json.dumps(documents_for_analysis, indent=2)
    
    # Filter existing functions to only include metadata, not full function code
    functions_for_analysis = []
    for func in existing_functions:
        func_summary = {
            "id": func.get("id"),
            "name": func.get("name"),
            "description": func.get("description"),
            "tags": func.get("tags", []),
            "usage_count": func.get("usage_count", 0)
        }
        functions_for_analysis.append(func_summary)
    
    target_fields_content = json.dumps(target_fields_data, indent=2) if target_fields_data else "No target fields provided"
    existing_functions_content = json.dumps(functions_for_analysis, indent=2) if functions_for_analysis else "No existing functions"
    
    # Format identifier references
    identifier_references_content = json.dumps(identifier_references, indent=2) if identifier_references else "None - First extraction"
    
    prompt = DOCUMENT_FORMAT_ANALYSIS.format(
        documents=documents_content,
        target_fields=target_fields_content,
        existing_functions=existing_functions_content,
        identifier_references=identifier_references_content,
        extraction_number=extraction_number
    )
    
    # Log truncated prompt for debugging
    print(f"\n📝 ENHANCED GEMINI PROMPT: {len(prompt)} characters")
    print(f"   Including {len(existing_functions)} functions and {len(identifier_references) if identifier_references else 0} references")
    print("=" * 40)
    
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
    
    # Log extraction run information
    print("\n" + "=" * 80)
    print(f"EXTRACTION RUN {extraction_number + 1}")
    print("=" * 80)
    
    if data and isinstance(data, dict):
        document_ids = data.get('document_ids', [])
        session_id = data.get('session_id')
        target_fields = data.get('target_fields', [])
        
        # Variable to store identifier references from first extraction
        first_run_identifier_references = []
        
        # Log key parameters concisely
        print(f"Session: {session_id[:8]}..." if session_id else "No session")
        print(f"Documents: {len(document_ids)} selected")
        print(f"Target fields: {len(target_fields)} total")
        
        # Log identifier references if they exist
        incoming_identifier_references = data.get('identifier_references', [])
        if incoming_identifier_references:
            print(f"Identifier references: {len(incoming_identifier_references)} records from previous extraction")
        else:
            print("Identifier references: None (first extraction)")
        
        # Log which property is being extracted
        if target_fields and extraction_number < len(target_fields):
            current_property = target_fields[extraction_number]
            property_name = current_property.get('propertyName') or current_property.get('property_name', 'Unknown Property')
            print(f"Current target: {property_name} (field {extraction_number + 1}/{len(target_fields)})")
        print("=" * 80)
        
        if not session_id:
            print(json.dumps({"error": "Missing session_id"}))
            return
        
        # Handle document retrieval - if no documents selected, use placeholder
        if not document_ids:
            print("No documents selected - working with identifier references only")
            documents = "NO DOCUMENTS SELECTED"
        else:
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
                    "type": "collection_property" if field.get('collectionId') else "schema_field",
                    "extraction_type": field.get('extractionType', ''),
                    "function_id": field.get('functionID', '') or field.get('functionId', '')
                }
                target_fields_data.append(field_data)
        
        # Filter targets based on extraction number - only process the current target property
        if extraction_number < len(target_fields_data):
            current_target = target_fields_data[extraction_number]
            identifier_targets = [current_target]
        else:
            # If extraction_number exceeds available fields, use identifier fields as fallback
            identifier_targets = [field for field in target_fields_data if field.get('is_identifier', False)]
        
        # CHECK FOR FUNCTION EXTRACTION TYPE - Bypass AI completely
        if identifier_targets and identifier_targets[0].get('extraction_type') == 'FUNCTION':
            function_id = identifier_targets[0].get('function_id')
            if function_id:
                print(f"\n🔧 FUNCTION EXTRACTION DETECTED!")
                print(f"   Extraction Type: FUNCTION")
                print(f"   Function ID: {function_id}")
                print(f"   Bypassing AI analysis and going directly to function execution")
                print("=" * 80)
                
                # Get function code from database
                function_details = get_excel_wizardry_function_by_id(function_id)
                if isinstance(function_details, dict) and "error" not in function_details:
                    function_code = function_details.get('function_code', '')
                    print(f"✅ Function retrieved: {function_details.get('name', 'Unnamed Function')}")
                    
                    # Get document content for function execution
                    if documents != "NO DOCUMENTS SELECTED" and documents:
                        for doc in documents:
                            if doc.get('type', '').lower() in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']:
                                extracted_content = doc.get('contentPreview', '')
                                
                                # Execute the function directly
                                execution_result = execute_excel_wizardry_function(
                                    function_code, 
                                    extracted_content, 
                                    identifier_targets, 
                                    incoming_identifier_references
                                )
                                
                                if isinstance(execution_result, dict) and "error" not in execution_result:
                                    print(f"✅ Function execution successful!")
                                    # Format results in the expected format
                                    processed_results = {
                                        'identifier_results': execution_result.get('results', []),
                                        'error': None
                                    }
                                    
                                    # Continue with standard result processing
                                    print(json.dumps(processed_results['identifier_results'], indent=2))
                                    
                                    # Create identifier references for next extraction
                                    identifier_references = []
                                    for result in processed_results['identifier_results']:
                                        if 'extracted_value' in result and 'field_name' in result:
                                            field_name_parts = result['field_name'].split('.')
                                            field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                            identifier_references.append({field_name_only: result['extracted_value']})
                                    
                                    print(f"\n🔗 IDENTIFIER REFERENCES ARRAY:")
                                    print("=" * 80)
                                    print(json.dumps(identifier_references, indent=2))
                                    print("=" * 80)
                                    print(f"Created {len(identifier_references)} new references for next extraction")
                                    
                                    # Handle auto-rerun logic
                                    next_extraction_number = extraction_number + 1
                                    total_target_fields = len(target_fields) if target_fields else 0
                                    
                                    if next_extraction_number < total_target_fields:
                                        print("\n" + "=" * 80)
                                        print(f"AUTO-RERUN: Starting extraction run {next_extraction_number + 1} of {total_target_fields}")
                                        print("=" * 80)
                                        print(f"Next extraction number: {next_extraction_number}")
                                        print(f"Target field: {target_fields[next_extraction_number].get('propertyName', 'Unknown') if target_fields else 'None'}")
                                        print(f"Progress: {next_extraction_number}/{total_target_fields} fields processed")
                                        
                                        rerun_data = {
                                            "document_ids": document_ids,
                                            "session_id": session_id,
                                            "target_fields": target_fields,
                                            "identifier_references": identifier_references
                                        }
                                        
                                        run_wizardry_with_gemini_analysis(rerun_data, next_extraction_number)
                                    else:
                                        print("\n" + "=" * 80)
                                        print("EXTRACTION COMPLETE")
                                        print("=" * 80)
                                        print(f"All {total_target_fields} target fields have been processed")
                                        print("Extraction sequence finished successfully")
                                        print("=" * 80)
                                    
                                    return  # Exit function after successful function execution
                                else:
                                    print(f"❌ Function execution failed: {execution_result.get('error', 'Unknown error')}")
                else:
                    print(f"❌ Could not retrieve function: {function_details.get('error', 'Unknown error') if isinstance(function_details, dict) else 'Invalid response'}")
            else:
                print(f"❌ FUNCTION extraction type detected but no function ID provided")
        
        # Continue with normal Gemini analysis if not a FUNCTION extraction type
        
        # Get all collection properties for progress tracking
        collection_ids = list(set([field.get('collection_id') for field in target_fields_data if field.get('collection_id')]))
        all_collection_properties = []
        if collection_ids:
            all_properties_result = get_all_collection_properties(collection_ids)
            if isinstance(all_properties_result, list):
                all_collection_properties = all_properties_result
        
        # Print document and target summary
        print("\n📄 DOCUMENTS:")
        if documents == "NO DOCUMENTS SELECTED":
            print("  Working with identifier references only")
        else:
            for doc in documents:
                doc_name = doc.get('name', 'Unknown')[:50]
                doc_type = doc.get('type', 'unknown')
                print(f"  - {doc_name}... ({doc_type})")
        
        print(f"\n🎯 CURRENT TARGET: {identifier_targets[0].get('name', 'Unknown') if identifier_targets else 'None'}")
        print(f"   Type: {identifier_targets[0].get('property_type', 'Unknown') if identifier_targets else 'Unknown'}")
        print(f"   Description: {identifier_targets[0].get('description', 'No description')[:100] if identifier_targets else 'None'}...")
        
        # Get existing Excel wizardry functions
        existing_functions = get_excel_wizardry_functions()
        if isinstance(existing_functions, dict) and "error" in existing_functions:
            print(f"Warning: Could not retrieve Excel functions: {existing_functions['error']}")
            existing_functions = []
        
        # Print existing Excel functions summary
        print(f"\n⚡ EXCEL FUNCTIONS: {len(existing_functions)} available")
        for func in existing_functions[:3]:  # Show top 3 functions
            print(f"   - {func.get('name', 'Unnamed')} (used {func.get('usage_count', 0)} times)")
        if len(existing_functions) > 3:
            print(f"   ... and {len(existing_functions) - 3} more functions")
        
        # Use the incoming identifier references from the previous extraction
        identifier_references = incoming_identifier_references
        
        # Analyze document formats with Gemini using enhanced analysis that includes existing functions and identifier references
        gemini_response = update_document_format_analysis_with_functions(documents, identifier_targets, existing_functions, identifier_references, extraction_number)
        
        # Print Gemini analysis summary
        print(f"\n🤖 GEMINI DECISION:")
        if "Excel Wizardry Function" in gemini_response:
            print("   Method: Excel Wizardry Function")
        elif "AI Extraction" in gemini_response:
            print("   Method: AI Extraction")
        else:
            print("   Method: No specific method recommended")
        
        # Show truncated response for debugging
        response_preview = gemini_response[:200].replace('\n', ' ')
        print(f"   Analysis: {response_preview}...")
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
            
            # Handle document processing based on whether documents are selected
            if documents == "NO DOCUMENTS SELECTED":
                print("Working with identifier references only - no documents to process")
                document_ids = []
                extracted_content = ""
            else:
                # Get document IDs for processing (no need to read full content in tool selector)
                document_ids = [doc['id'] for doc in documents]
                extracted_content = ""
                
                # Only get content when actually executing functions, not for tool selection
                # For now, just get a sample to determine document structure
                for doc in documents:
                    if doc.get('type', '').lower() in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']:
                        # Get content from database only when needed for function execution
                        doc_content = get_document_properties_from_db([doc['id']], session_id)
                        if doc_content and not isinstance(doc_content, dict):
                            for doc_data in doc_content:
                                if 'contentPreview' in doc_data:
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
                    
                    # Execute the existing function with identifier references
                    function_result = execute_excel_wizardry_function(
                        existing_function['function_code'],
                        extracted_content,
                        identifier_targets,
                        identifier_references
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
                            print(f"\n✅ EXTRACTION RESULTS: {record_count} records extracted using existing function")
                            
                            # Show complete validation results JSON
                            print(f"\n📋 COMPLETE VALIDATION RESULTS JSON:")
                            print("=" * 80)
                            print(json.dumps(processed_results['identifier_results'], indent=2))
                            print("=" * 80)
                            
                            # Create or update identifier references
                            if extraction_number == 0:
                                # First extraction - create new identifier references
                                new_identifier_references = []
                                for result in processed_results['identifier_results']:
                                    if 'extracted_value' in result and 'field_name' in result:
                                        field_name_parts = result['field_name'].split('.')
                                        field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                        new_identifier_references.append({field_name_only: result['extracted_value']})
                                
                                # Store for auto-rerun
                                first_run_identifier_references = new_identifier_references
                                identifier_references = new_identifier_references
                                print(f"\n🔗 IDENTIFIER REFERENCES ARRAY:")
                                print("=" * 80)
                                print(json.dumps(identifier_references, indent=2))
                                print("=" * 80)
                                print(f"Created {len(identifier_references)} new references for next extraction")
                            else:
                                # Subsequent extractions - append to existing identifier references
                                updated_identifier_references = []
                                existing_identifier_refs = identifier_references or []
                                
                                for i, result in enumerate(processed_results['identifier_results']):
                                    if i < len(existing_identifier_refs):
                                        # Copy existing reference and add new field
                                        updated_ref = existing_identifier_refs[i].copy()
                                        if 'extracted_value' in result and 'field_name' in result:
                                            field_name_parts = result['field_name'].split('.')
                                            field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                            updated_ref[field_name_only] = result['extracted_value']
                                        updated_identifier_references.append(updated_ref)
                                    else:
                                        # Handle case where we have more results than existing references
                                        if 'extracted_value' in result and 'field_name' in result:
                                            field_name_parts = result['field_name'].split('.')
                                            field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                            updated_identifier_references.append({field_name_only: result['extracted_value']})
                                
                                identifier_references = updated_identifier_references
                                print(f"\n🔗 IDENTIFIER REFERENCES ARRAY:")
                                print("=" * 80)
                                print(json.dumps(identifier_references, indent=2))
                                print("=" * 80)
                                print(f"Updated {len(identifier_references)} references with new field data")
                            
                            # Log extraction progress
                            if all_collection_properties:
                                extracted_field_names = set()
                                for result in processed_results.get('identifier_results', []):
                                    field_name = result.get('field_name', '')
                                    if '.' in field_name:
                                        property_name = field_name.split('.')[-1]
                                        extracted_field_names.add(property_name)
                                    else:
                                        extracted_field_names.add(field_name)
                                
                                total_fields = len(all_collection_properties)
                                extracted_count = sum(1 for prop in all_collection_properties if prop.get('property_name') in extracted_field_names)
                                remaining_count = total_fields - extracted_count
                                print(f"\n📊 PROGRESS: {extracted_count}/{total_fields} fields extracted, {remaining_count} remaining")
                        else:
                            print(f"Error processing function results: {processed_results['error']}")
                    else:
                        print(f"Error executing function: {function_result['error']}")
                else:
                    print(f"Function with ID {function_instruction} not found, creating new function instead")
                    function_instruction = "CREATE_NEW"
            
            if function_instruction == "CREATE_NEW":
                # Generate new function
                print("\n🔧 CREATING NEW FUNCTION:")
                
                # Generate function with Gemini, including identifier references and extraction number
                function_data = generate_excel_function_with_gemini(identifier_targets, documents, identifier_references, extraction_number)
                
                if 'error' not in function_data:
                    print(f"   Generated: {function_data.get('function_name', 'Unnamed Function')}")
                    
                    # Save function to database
                    create_result = create_excel_wizardry_function(
                        function_data.get('function_name', 'Auto-generated Excel Function'),
                        function_data.get('description', 'Auto-generated function for Excel data extraction'),
                        function_data.get('tags', []),
                        function_data.get('function_code', '')
                    )
                    
                    if 'error' not in create_result:
                        print(f"   Saved with ID: {create_result['id'][:8]}...")
                        
                        # Execute the new function with identifier references
                        function_result = execute_excel_wizardry_function(
                            function_data.get('function_code', ''),
                            extracted_content,
                            identifier_targets,
                            identifier_references
                        )
                        
                        if 'error' not in function_result:
                            # Process results
                            results = function_result['results']
                            processed_results = clean_json_and_extract_identifiers(results, identifier_targets)
                            
                            if 'error' not in processed_results:
                                record_count = len(processed_results['cleaned_results']) if isinstance(processed_results['cleaned_results'], list) else 0
                                print(f"\n✅ EXTRACTION RESULTS: {record_count} records extracted using new function")
                                
                                # Show complete validation results JSON
                                print(f"\n📋 COMPLETE VALIDATION RESULTS JSON:")
                                print("=" * 80)
                                print(json.dumps(processed_results['identifier_results'], indent=2))
                                print("=" * 80)
                                
                                # Create or update identifier references
                                if extraction_number == 0:
                                    # First extraction - create new identifier references
                                    new_identifier_references = []
                                    for result in processed_results['identifier_results']:
                                        if 'extracted_value' in result and 'field_name' in result:
                                            field_name_parts = result['field_name'].split('.')
                                            field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                            new_identifier_references.append({field_name_only: result['extracted_value']})
                                    
                                    # Store for auto-rerun
                                    first_run_identifier_references = new_identifier_references
                                    identifier_references = new_identifier_references
                                else:
                                    # Subsequent extractions - append to existing identifier references
                                    updated_identifier_references = []
                                    existing_identifier_refs = identifier_references or []
                                    
                                    for i, result in enumerate(processed_results['identifier_results']):
                                        if i < len(existing_identifier_refs):
                                            # Copy existing reference and add new field
                                            updated_ref = existing_identifier_refs[i].copy()
                                            if 'extracted_value' in result and 'field_name' in result:
                                                field_name_parts = result['field_name'].split('.')
                                                field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                                updated_ref[field_name_only] = result['extracted_value']
                                            updated_identifier_references.append(updated_ref)
                                        else:
                                            # Handle case where we have more results than existing references
                                            if 'extracted_value' in result and 'field_name' in result:
                                                field_name_parts = result['field_name'].split('.')
                                                field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                                                updated_identifier_references.append({field_name_only: result['extracted_value']})
                                    
                                    identifier_references = updated_identifier_references
                                
                                print("\n" + "=" * 80)
                                print("IDENTIFIER REFERENCES")
                                print("=" * 80)
                                print(json.dumps(identifier_references, indent=2))
                                
                                # Log target property with orderIndex matching extraction number
                                if all_collection_properties:
                                    target_property = None
                                    for prop in all_collection_properties:
                                        if prop.get('order_index') == extraction_number:
                                            target_property = prop
                                            break
                                    
                                    if target_property:
                                        print(f"\nTarget property with orderIndex {extraction_number}:")
                                        print("=" * 80)
                                        print(json.dumps(target_property, indent=2))
                                        print("=" * 80)
                                
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
        
        elif "AI Extraction" in gemini_response:
            print(f"\n🧠 AI EXTRACTION:")
            # Handle AI extraction based on document availability
            if documents == "NO DOCUMENTS SELECTED":
                print("   Error: Cannot use AI extraction without documents")
                ai_result = {"error": "No documents available for AI extraction"}
            else:
                # Get document IDs from the documents data
                document_ids = [doc['id'] for doc in documents]
                # Pass document IDs and identifier targets to AI extraction
                ai_result = ai_document_extraction(document_ids, session_id, identifier_targets, incoming_identifier_references)
            
            # Clean JSON and extract identifiers
            processed_results = clean_json_and_extract_identifiers(ai_result, identifier_targets)
            if 'error' not in processed_results:
                # Show record count and sample results
                record_count = len(processed_results['cleaned_results']) if isinstance(processed_results['cleaned_results'], list) else 0
                print(f"\n✅ EXTRACTION RESULTS: {record_count} records extracted using AI")
                
                # Show complete validation results JSON
                print(f"\n📋 COMPLETE VALIDATION RESULTS JSON:")
                print("=" * 80)
                print(json.dumps(processed_results['identifier_results'], indent=2))
                print("=" * 80)
                
                # Create and display IDENTIFIER REFERENCES array
                identifier_references = []
                for result in processed_results['identifier_results']:
                    if 'extracted_value' in result and 'field_name' in result:
                        # Split field_name on dot and take the part after the collection name
                        field_name_parts = result['field_name'].split('.')
                        field_name_only = field_name_parts[-1] if len(field_name_parts) > 1 else result['field_name']
                        identifier_references.append({field_name_only: result['extracted_value']})
                
                # Store for auto-rerun
                first_run_identifier_references = identifier_references
                print(f"\n🔗 IDENTIFIER REFERENCES ARRAY:")
                print("=" * 80)
                print(json.dumps(identifier_references, indent=2))
                print("=" * 80)
                print(f"Created {len(identifier_references)} new references for next extraction")
                
                # Log extraction progress
                if all_collection_properties:
                    extracted_field_names = set()
                    for result in processed_results.get('identifier_results', []):
                        field_name = result.get('field_name', '')
                        if '.' in field_name:
                            property_name = field_name.split('.')[-1]
                            extracted_field_names.add(property_name)
                        else:
                            extracted_field_names.add(field_name)
                    
                    total_fields = len(all_collection_properties)
                    extracted_count = sum(1 for prop in all_collection_properties if prop.get('property_name') in extracted_field_names)
                    remaining_count = total_fields - extracted_count
                    print(f"\n📊 PROGRESS: {extracted_count}/{total_fields} fields extracted, {remaining_count} remaining")
            else:
                print(f"   Error processing AI extraction results: {processed_results['error']}")
        else:
            print(f"\n❌ NO EXTRACTION METHOD: Gemini did not recommend a specific extraction method")
        print("=" * 80)
        
        # AUTO-RERUN LOGIC: Continue extraction until all target fields are processed
        next_extraction_number = extraction_number + 1
        total_target_fields = len(target_fields) if target_fields else 0
        
        if next_extraction_number < total_target_fields:
            print("\n" + "=" * 80)
            print(f"AUTO-RERUN: Starting extraction run {next_extraction_number + 1} of {total_target_fields}")
            print("=" * 80)
            print(f"Next extraction number: {next_extraction_number}")
            print(f"Target field: {target_fields[next_extraction_number].get('propertyName', 'Unknown') if target_fields else 'None'}")
            print(f"Progress: {next_extraction_number}/{total_target_fields} fields processed")
            
            # Create new data object with updated target fields and identifier references
            rerun_data = {
                "document_ids": document_ids,
                "session_id": session_id,
                "target_fields": target_fields,
                "identifier_references": identifier_references if 'identifier_references' in locals() else first_run_identifier_references
            }
            
            # Re-run the extraction with the new parameters
            run_wizardry_with_gemini_analysis(rerun_data, next_extraction_number)
        else:
            print("\n" + "=" * 80)
            print("EXTRACTION COMPLETE")
            print("=" * 80)
            print(f"All {total_target_fields} target fields have been processed")
            print("Extraction sequence finished successfully")
            print("=" * 80)
        
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