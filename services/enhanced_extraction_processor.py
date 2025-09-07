#!/usr/bin/env python3
"""
Enhanced Extraction Processor
Implements efficient extraction routing based on field configuration:
- FUNCTION extraction type: routes directly to Excel functions
- AI extraction type: generates dynamic prompts using field metadata
"""

import json
import sys
import os
import psycopg2
from typing import Dict, List, Any, Optional
from google import genai
# from all_prompts import ENHANCED_AI_EXTRACTION_PROMPT  # Will use inline prompt for now

def connect_to_database():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv('PGHOST', 'localhost'),
        port=os.getenv('PGPORT', '5432'),
        database=os.getenv('PGDATABASE', 'postgres'),
        user=os.getenv('PGUSER', 'postgres'),
        password=os.getenv('PGPASSWORD', '')
    )

def get_collection_properties_with_metadata(project_id: str) -> List[Dict[str, Any]]:
    """Get collection properties with their extraction metadata"""
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        query = """
        SELECT cp.id, cp.collection_id, cp.property_name, cp.property_type, cp.description,
               cp.extraction_type, cp.knowledge_document_ids, cp.extraction_rule_ids,
               cp.documents_required, cp.function_id, cp.required_document_type,
               cp.order_index, cp.is_identifier,
               oc.collection_name
        FROM collection_properties cp
        JOIN object_collections oc ON cp.collection_id = oc.id
        WHERE oc.project_id = %s
        ORDER BY oc.collection_name, cp.order_index
        """
        cursor.execute(query, (project_id,))
        rows = cursor.fetchall()
        
        properties = []
        for row in rows:
            properties.append({
                'id': row[0],
                'collection_id': row[1],
                'property_name': row[2],
                'property_type': row[3],
                'description': row[4],
                'extraction_type': row[5],
                'knowledge_document_ids': row[6] or [],
                'extraction_rule_ids': row[7] or [],
                'documents_required': row[8],
                'function_id': row[9],
                'required_document_type': row[10],
                'order_index': row[11],
                'is_identifier': row[12],
                'collection_name': row[13]
            })
        
        return properties
        
    finally:
        cursor.close()
        conn.close()

def get_schema_fields_with_metadata(project_id: str) -> List[Dict[str, Any]]:
    """Get schema fields with their extraction metadata"""
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        query = """
        SELECT id, field_name, field_type, description, extraction_type,
               knowledge_document_ids, extraction_rule_ids, documents_required,
               function_id, required_document_type
        FROM project_schema_fields
        WHERE project_id = %s
        ORDER BY field_name
        """
        cursor.execute(query, (project_id,))
        rows = cursor.fetchall()
        
        fields = []
        for row in rows:
            fields.append({
                'id': row[0],
                'field_name': row[1],
                'field_type': row[2],
                'description': row[3],
                'extraction_type': row[4],
                'knowledge_document_ids': row[5] or [],
                'extraction_rule_ids': row[6] or [],
                'documents_required': row[7],
                'function_id': row[8],
                'required_document_type': row[9]
            })
        
        return fields
        
    finally:
        cursor.close()
        conn.close()

def get_knowledge_documents(document_ids: List[str]) -> List[Dict[str, Any]]:
    """Get knowledge documents by IDs"""
    if not document_ids:
        return []
        
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        placeholders = ','.join(['%s'] * len(document_ids))
        query = f"""
        SELECT id, file_name, display_name, description, content
        FROM knowledge_documents
        WHERE id IN ({placeholders})
        """
        cursor.execute(query, document_ids)
        rows = cursor.fetchall()
        
        documents = []
        for row in rows:
            documents.append({
                'id': row[0],
                'file_name': row[1],
                'display_name': row[2],
                'description': row[3],
                'content': row[4]
            })
        
        return documents
        
    finally:
        cursor.close()
        conn.close()

def get_extraction_rules(rule_ids: List[str]) -> List[Dict[str, Any]]:
    """Get extraction rules by IDs"""
    if not rule_ids:
        return []
        
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        placeholders = ','.join(['%s'] * len(rule_ids))
        query = f"""
        SELECT id, rule_name, rule_content, target_field
        FROM extraction_rules
        WHERE id IN ({placeholders})
        """
        cursor.execute(query, rule_ids)
        rows = cursor.fetchall()
        
        rules = []
        for row in rows:
            rules.append({
                'id': row[0],
                'rule_name': row[1],
                'rule_content': row[2],
                'target_field': row[3]
            })
        
        return rules
        
    finally:
        cursor.close()
        conn.close()

def get_function_by_id(function_id: str) -> Optional[Dict[str, Any]]:
    """Get Excel function by ID"""
    if not function_id:
        return None
        
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        query = """
        SELECT id, function_name, description, function_code, tags
        FROM excel_wizardry_functions
        WHERE id = %s
        """
        cursor.execute(query, (function_id,))
        row = cursor.fetchone()
        
        if row:
            return {
                'id': row[0],
                'function_name': row[1],
                'description': row[2],
                'function_code': row[3],
                'tags': row[4] or []
            }
        
        return None
        
    finally:
        cursor.close()
        conn.close()

def get_previous_extractions(session_id: str) -> Dict[str, Any]:
    """Get previously extracted and verified data for context"""
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        query = """
        SELECT field_id, field_name, extracted_value, collection_name, record_index
        FROM field_validations
        WHERE session_id = %s AND validation_status = 'verified'
        """
        cursor.execute(query, (session_id,))
        rows = cursor.fetchall()
        
        previous_data = {}
        for row in rows:
            field_id, field_name, extracted_value, collection_name, record_index = row
            key = f"{field_id}_{record_index or 0}"
            previous_data[key] = {
                'field_name': field_name,
                'extracted_value': extracted_value,
                'collection_name': collection_name,
                'record_index': record_index
            }
        
        return previous_data
        
    finally:
        cursor.close()
        conn.close()

def get_step_value_input_config(value_id: str) -> Dict[str, Any]:
    """Get the inputValues configuration for a step value"""
    conn = connect_to_database()
    cursor = conn.cursor()
    
    try:
        query = """
        SELECT input_values
        FROM step_values
        WHERE id = %s
        """
        cursor.execute(query, (value_id,))
        result = cursor.fetchone()
        
        if result and result[0]:
            return result[0]  # JSONB field returns as dict
        return {}
        
    finally:
        cursor.close()
        conn.close()

def filter_previous_data_by_input_config(previous_extractions: Dict[str, Any], input_values: Dict[str, Any]) -> Dict[str, Any]:
    """Filter previous extractions to only include referenced fields from input configuration"""
    if not input_values:
        # If no input configuration, return empty (don't pass all data)
        return {}
    
    filtered_data = {}
    
    # Iterate through input values and extract referenced fields
    for param_name, param_value in input_values.items():
        if isinstance(param_value, str):
            # Check for specific tags/references (e.g., "Missing Fields • Missing Fields")
            if '•' in param_value:
                # Handle tag-style references
                tags = [tag.strip() for tag in param_value.split('•')]
                for tag in tags:
                    for key, data in previous_extractions.items():
                        field_name = data.get('field_name', '')
                        collection_name = data.get('collection_name', '')
                        
                        # Match based on tag content
                        if tag.lower() in field_name.lower() or tag.lower() in collection_name.lower():
                            filtered_data[key] = data
            
            # Check if it's a reference to previous data (contains @ symbol or specific field references)
            elif '@' in param_value:
                # Extract @-style references
                import re
                ref_pattern = r'@([^\s,;]+)'
                references = re.findall(ref_pattern, param_value)
                
                for ref in references:
                    # Find matching fields in previous extractions
                    for key, data in previous_extractions.items():
                        field_name = data.get('field_name', '')
                        collection_name = data.get('collection_name', '')
                        field_id = key.split('_')[0] if '_' in key else key
                        
                        # Check various matching patterns
                        if (ref == field_id or 
                            ref == field_name or 
                            ref == f"{collection_name}.{field_name}" or
                            ref in key):
                            filtered_data[key] = data
            
            # Check for specific patterns
            elif any(pattern in param_value for pattern in ['Column Name Mapping', 'Standard Equivalent', 'Missing Fields']):
                for key, data in previous_extractions.items():
                    field_name = data.get('field_name', '')
                    
                    # Pattern-based matching
                    if ('Column Name Mapping' in param_value and 'column' in field_name.lower()) or \
                       ('Standard Equivalent' in param_value and 'standard' in field_name.lower()) or \
                       ('Missing Fields' in param_value and 'missing' in field_name.lower()):
                        filtered_data[key] = data
                        
        elif isinstance(param_value, list):
            # If it's a list of references, check each one
            for ref in param_value:
                if isinstance(ref, str):
                    # Process each reference in the list
                    if '•' in ref:
                        # Handle tag-style references in lists
                        tags = [tag.strip() for tag in ref.split('•')]
                        for tag in tags:
                            for key, data in previous_extractions.items():
                                field_name = data.get('field_name', '')
                                collection_name = data.get('collection_name', '')
                                
                                if tag.lower() in field_name.lower() or tag.lower() in collection_name.lower():
                                    filtered_data[key] = data
                    elif '@' in ref:
                        # Extract the referenced field ID or name
                        ref_field = ref.split('@')[1].strip() if '@' in ref else ref
                        # Find matching fields in previous extractions
                        for key, data in previous_extractions.items():
                            field_name = data.get('field_name', '')
                            collection_name = data.get('collection_name', '')
                            field_id = key.split('_')[0] if '_' in key else key
                            
                            if (ref_field == field_id or 
                                ref_field == field_name or 
                                ref_field == f"{collection_name}.{field_name}" or
                                ref_field in key):
                                filtered_data[key] = data
        
        elif isinstance(param_value, dict):
            # If it's a dict, recursively check for references
            nested_filtered = filter_previous_data_by_input_config(previous_extractions, param_value)
            filtered_data.update(nested_filtered)
    
    # Log what was filtered for debugging
    if filtered_data:
        print(f"📋 Filtered {len(filtered_data)} referenced fields from {len(previous_extractions)} total fields")
    
    return filtered_data

def execute_function_extraction(function_data: Dict[str, Any], documents: List[Dict[str, Any]], 
                              previous_extractions: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Excel function extraction"""
    try:
        # Import function execution capability
        from extraction_wizardry import execute_excel_wizardry_function
        
        # Prepare document content for function
        extracted_content = {}
        for doc in documents:
            extracted_content[doc['file_name']] = doc.get('file_content', '')
        
        # Execute the function
        result = execute_excel_wizardry_function(
            function_data['function_code'],
            extracted_content,
            {'target_fields': [function_data]},
            previous_extractions
        )
        
        print(f"🔧 FUNCTION EXTRACTION: {function_data['function_name']} completed")
        return result
        
    except Exception as e:
        error_msg = f"Function execution failed: {str(e)}"
        print(f"❌ FUNCTION ERROR: {error_msg}")
        return {"error": error_msg}

def generate_dynamic_ai_prompt(tool_data: Dict[str, Any], value_data: Dict[str, Any], 
                             knowledge_docs: List[Dict[str, Any]], input_data: Dict[str, Any]) -> str:
    """Generate dynamic AI prompt using tool configuration and value inputs"""
    
    # Check if this is a create or update operation
    operation_type = tool_data.get('operationType', 'updateMultiple')  # Default to update for backward compatibility
    is_create_operation = operation_type.startswith('create')
    
    # 1. SYSTEM PROMPT - Explains the architecture
    if is_create_operation:
        # For CREATE operations - no identifierId preservation needed
        system_prompt = """SYSTEM ARCHITECTURE:
You are an AI function executor. Your inputs consist of:

1. TOOL PROMPT: Defines your function/capability (what you can do)
2. VALUE CONFIGURATION: Defines the specific task (what you should do)
3. INPUT PARAMETERS: The actual data to process
4. AI INSTRUCTIONS: Specific instructions for this execution

OPERATION TYPE: CREATE NEW RECORDS
This is a CREATE operation. Input data is for reference and context only. You will be creating NEW records based on the provided instructions and reference materials.

INPUT PARAMETER TYPES:
- User Document: Selected document content (may be optional)
- Reference Documents: Knowledge documents for validation/context
- Reference Data: Data from previous workflow steps for context

Your response should create new records according to the tool function.
---"""
    else:
        # For UPDATE operations - preserve identifierId
        system_prompt = """SYSTEM ARCHITECTURE:
You are an AI function executor. Your inputs consist of:

1. TOOL PROMPT: Defines your function/capability (what you can do)
2. VALUE CONFIGURATION: Defines the specific task (what you should do)
3. INPUT PARAMETERS: The actual data to process
4. AI INSTRUCTIONS: Specific instructions for this execution

OPERATION TYPE: UPDATE EXISTING RECORDS
CRITICAL: All input data contains 'identifierId' fields that are essential for mapping inputs to outputs. You MUST preserve and return the identifierId for each processed item to maintain data relationships.

INPUT PARAMETER TYPES:
- User Document: Selected document content (may be optional)
- Reference Documents: Knowledge documents for validation/context
- Reference Data: Data from previous workflow steps passed from session

Your response must maintain the identifierId mapping for all processed items.
---"""

    # 2. TOOL PROMPT - From tool configuration
    tool_prompt = tool_data.get('aiPrompt', '') or tool_data.get('ai_prompt', '')
    if tool_prompt:
        tool_prompt = f"\nTOOL FUNCTION:\n{tool_prompt}\n"
    
    # 3. VALUE CONFIGURATION - Task-specific details
    value_name = value_data.get('valueName', '') or value_data.get('value_name', '')
    value_description = value_data.get('description', '')
    
    value_config = f"\nVALUE TASK:\nField: {value_name}"
    if value_description:
        value_config += f"\nDescription: {value_description}"
    
    # Add explicit instruction to extract ALL occurrences
    if is_create_operation:
        value_config += "\n\nIMPORTANT: Extract ALL occurrences/instances found in the document(s), not just examples or a subset."
        value_config += "\nReturn a complete, comprehensive list of every item that matches the extraction criteria."
    
    # 4. INPUT VALUES / AI INSTRUCTIONS - Extract from value_data
    input_values = value_data.get('inputValues', {})
    if input_values:
        value_config += "\n\nAI INSTRUCTIONS:"
        has_instructions = False
        for param_key, param_value in input_values.items():
            # Log what we're processing for debugging
            print(f"  Processing inputValue [{param_key}]: {param_value[:100] if isinstance(param_value, str) else param_value}")
            
            # Extract the AI instruction from input values
            if isinstance(param_value, str):
                # Include the instruction text (skip only pure @ references to data)
                if param_value.startswith('@') and '.' in param_value and len(param_value.split()) == 1:
                    # This is a pure data reference like "@Column.Name", skip it
                    continue
                else:
                    # This is an instruction text, include it
                    # Check if the instruction contains examples and clarify they are ONLY examples
                    if 'e.g.' in param_value or 'for example' in param_value.lower():
                        # Add clarification that examples are for format only
                        value_config += f"\n- For '{param_key}', apply the AI Query: \"{param_value}\""
                        value_config += "\n  IMPORTANT: The 'e.g.' items above are ONLY FORMAT EXAMPLES to show the desired output structure."
                        value_config += "\n  You must extract ALL matching items from the document, not just these examples."
                        value_config += "\n  Search the ENTIRE document and return EVERY item that matches the criteria."
                        value_config += "\n  If Input Data is provided, use that data to extract the corresponding values."
                    else:
                        value_config += f"\n- For '{param_key}', apply the AI Query: \"{param_value}\""
                        value_config += "\n  IMPORTANT: If Input Data is provided, USE IT AS A REFERENCE to find corresponding information."
                        value_config += "\n  For each row in the Input Data, find the matching content in the document and extract the requested value."
                        value_config += "\n  Do NOT just repeat the instruction text - extract actual values from the document based on the Input Data references."
                    has_instructions = True
            elif isinstance(param_value, list):
                # Handle array-based instructions
                for item in param_value:
                    if isinstance(item, str):
                        if item.startswith('@') and '.' in item and len(item.split()) == 1:
                            # Pure data reference, skip
                            continue
                        else:
                            # Instruction text, include
                            value_config += f"\n- {item}"
                            has_instructions = True
        
        if not has_instructions:
            value_config += "\n- No specific instructions provided. Process according to the tool function."
    
    value_config += "\n"
    
    # 4. KNOWLEDGE DOCUMENTS - Reference context
    knowledge_context = ""
    if knowledge_docs:
        knowledge_context = "\nREFERENCE DOCUMENTS:\n"
        for doc in knowledge_docs:
            doc_name = doc.get('display_name') or doc.get('file_name', 'Unknown')
            doc_desc = doc.get('description', '')
            doc_content = doc.get('content', '')
            
            # Log knowledge document details for debugging
            print(f"📚 KNOWLEDGE DOC: {doc_name}")
            print(f"   Description: {doc_desc}")
            print(f"   Content Length: {len(doc_content)} chars")
            print(f"   Content Preview: {doc_content[:200]}...")
            
            knowledge_context += f"- {doc_name}: {doc_desc}\n"
            # Include full content, not just preview
            if doc_content:
                knowledge_context += f"  Content: {doc_content}\n\n"
            else:
                knowledge_context += f"  Content: [No content available]\n\n"
    
    # 5. INPUT DATA SUMMARY - What data is being processed
    input_summary = "\nINPUT DATA SUMMARY:\n"
    for param_name, param_value in input_data.items():
        if isinstance(param_value, list):
            input_summary += f"- {param_name}: Array with {len(param_value)} items\n"
            if param_value and isinstance(param_value[0], dict):
                sample_keys = list(param_value[0].keys())
                input_summary += f"  Sample structure: {sample_keys}\n"
        elif isinstance(param_value, str):
            input_summary += f"- {param_name}: Text content ({len(param_value)} chars)\n"
        else:
            input_summary += f"- {param_name}: {type(param_value).__name__}\n"
    
    # 6. ACTUAL INPUT DATA - Include the actual data to process
    actual_input_data = ""
    if input_data:
        actual_input_data = "\nACTUAL INPUT DATA TO PROCESS:\n"
        
        # Check if we have Input Data that contains column data for cross-referencing
        has_input_data_columns = False
        for param_name, param_value in input_data.items():
            if param_name == 'Input Data' and isinstance(param_value, list) and param_value:
                if isinstance(param_value[0], dict):
                    has_input_data_columns = True
                    break
        
        if has_input_data_columns:
            actual_input_data += "\nCROSS-REFERENCING INSTRUCTIONS:\n"
            actual_input_data += "The Input Data below contains reference values from previous columns.\n"
            actual_input_data += "USE THESE VALUES AS LOOKUP KEYS to find corresponding information in the document.\n"
            actual_input_data += "For each row in the Input Data:\n"
            actual_input_data += "1. Use the provided values as references/identifiers\n"
            actual_input_data += "2. Find the matching section/content in the document\n"
            actual_input_data += "3. Extract the requested information for that specific item\n"
            actual_input_data += "DO NOT just repeat the instruction examples - extract actual values from the document!\n\n"
        
        for param_name, param_value in input_data.items():
            if param_name == 'previous_data' and isinstance(param_value, dict):
                # For previous_data, include the actual JSON data
                actual_input_data += f"\n{param_name}:\n{json.dumps(param_value, indent=2)}\n"
            elif param_name == 'Input Data' and isinstance(param_value, list):
                # For Input Data array, include the full JSON data with identifierIds
                actual_input_data += f"\n{param_name} (MUST preserve identifierId for each item):\n{json.dumps(param_value, indent=2)}\n"
                actual_input_data += "\nCRITICAL: Each item above has an 'identifierId' field. You MUST include this exact identifierId in your response for each corresponding item.\n"
            elif param_name == 'document' and isinstance(param_value, str) and len(param_value) > 0:
                # For document content, include a truncated version if too long
                if len(param_value) > 5000:
                    actual_input_data += f"\n{param_name} (truncated to 5000 chars):\n{param_value[:5000]}...\n"
                else:
                    actual_input_data += f"\n{param_name}:\n{param_value}\n"
            elif isinstance(param_value, (list, dict)):
                # For other structured data, include as JSON
                actual_input_data += f"\n{param_name}:\n{json.dumps(param_value, indent=2)}\n"
    
    # 7. COMPILE FULL PROMPT
    # For CREATE operations, let the tool prompt handle output requirements
    # For UPDATE operations, add system requirements for preserving identifierIds
    if is_create_operation:
        # Add system output requirements for CREATE operations to ensure ALL items are extracted
        output_requirements = f"""
SYSTEM OUTPUT REQUIREMENTS FOR CREATE OPERATIONS:
Return a JSON array containing ALL items found that match the extraction criteria.
Each object in the array MUST include:
- extractedValue: The extracted value for "{value_name}"
- validationStatus: Either "valid", "invalid", or "pending" based on confidence
- aiReasoning: Detailed explanation of the extraction
- confidenceScore: Number between 0-100 representing confidence
- documentSource: Specific source reference (page, section, or location)

CRITICAL FOR COMPREHENSIVE EXTRACTION:
- Extract and return EVERY SINGLE matching item found in the document(s)
- Do NOT limit the results to just a few examples
- If there are 10 items, return all 10. If there are 50, return all 50
- Each unique occurrence should be a separate object in the array
- Scan the ENTIRE document thoroughly - do not stop after finding a few matches"""
    else:
        # For UPDATE operations - mapping to existing items
        output_requirements = f"""
SYSTEM OUTPUT REQUIREMENTS FOR UPDATE OPERATIONS:
Return a JSON array with one object per input item. Each object MUST include:
- identifierId: The same identifierId from the input (preserve exactly)
- extractedValue: The extracted/processed value for "{value_name}"
- validationStatus: Either "valid" or "invalid" based on confidence
- aiReasoning: Detailed explanation of the extraction logic and decision
- confidenceScore: Number between 0-100 representing confidence
- documentSource: Specific source reference (page, section, or location)

CRITICAL: 
- Maintain the EXACT SAME ORDER as the input items
- Include ALL input items in the response, even if no match is found (use null for extractedValue)
- ALWAYS preserve the identifierId for each item to maintain data relationships"""
    
    # Build the prompt with optional output requirements
    prompt_parts = [system_prompt, tool_prompt, value_config, knowledge_context, input_summary, actual_input_data]
    
    if output_requirements:
        prompt_parts.append(output_requirements)
    
    prompt_parts.append("EXECUTE THE TASK WITH THE PROVIDED INPUTS AND RETURN THE RESULT IN JSON FORMAT.")
    
    compiled_prompt = "\n\n".join(filter(None, prompt_parts))
    
    return compiled_prompt

def execute_ai_extraction(tool_data: Dict[str, Any], value_data: Dict[str, Any], 
                        knowledge_docs: List[Dict[str, Any]], input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute AI extraction using tool and value configuration"""
    try:
        # Get API key
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return {"error": "No API key found"}
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Generate dynamic prompt using tool and value configuration
        prompt = generate_dynamic_ai_prompt(tool_data, value_data, knowledge_docs, input_data)
        
        value_name = value_data.get('valueName', '') or value_data.get('value_name', '')
        print(f"🤖 AI EXTRACTION: Processing {value_name}")
        
        # Log knowledge documents summary
        if knowledge_docs:
            print(f"📚 KNOWLEDGE DOCS: {len(knowledge_docs)} documents loaded")
            for i, doc in enumerate(knowledge_docs):
                doc_name = doc.get('display_name') or doc.get('file_name', 'Unknown')
                content_len = len(doc.get('content', ''))
                print(f"   {i+1}. {doc_name} ({content_len} chars)")
        else:
            print(f"⚠️ KNOWLEDGE DOCS: No knowledge documents provided")
        
        print(f"📝 FULL AI PROMPT:\n{'-'*80}\n{prompt}\n{'-'*80}")
        
        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        response_text = response.text or ""
        
        # Parse JSON response
        try:
            # Clean response
            cleaned_response = response_text.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response.replace('```json', '').replace('```', '').strip()
            elif cleaned_response.startswith('```'):
                cleaned_response = cleaned_response.replace('```', '').strip()
            
            result = json.loads(cleaned_response)
            print(f"✅ AI EXTRACTION: Success - {result.get('extracted_value', 'N/A')}")
            return result
            
        except json.JSONDecodeError:
            # Try to extract JSON from response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx >= 0 and end_idx > start_idx:
                try:
                    json_part = response_text[start_idx:end_idx]
                    result = json.loads(json_part)
                    return result
                except:
                    pass
            
            return {
                "error": "Failed to parse AI response",
                "raw_response": response_text
            }
        
    except Exception as e:
        error_msg = f"AI extraction failed: {str(e)}"
        print(f"❌ AI ERROR: {error_msg}")
        return {"error": error_msg}

def process_enhanced_extraction(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Main enhanced extraction processor"""
    try:
        session_id = input_data.get('session_id')
        project_id = input_data.get('project_id')
        documents = input_data.get('documents', [])
        
        print(f"🚀 ENHANCED EXTRACTION: Starting for project {project_id}")
        
        # Get field configurations
        collection_properties = get_collection_properties_with_metadata(project_id)
        schema_fields = get_schema_fields_with_metadata(project_id)
        
        # Get previous extractions for context
        previous_extractions = get_previous_extractions(session_id)
        
        print(f"📋 Found {len(collection_properties)} collection properties and {len(schema_fields)} schema fields")
        
        results = []
        
        # Process collection properties
        for prop in collection_properties:
            field_id = prop['id']
            extraction_type = prop.get('extraction_type', 'AI')
            
            print(f"\n🔄 Processing {prop['property_name']} ({extraction_type})")
            
            # Get input values configuration if available
            input_values_config = {}
            if prop.get('id'):
                # Try to get input configuration from step_values
                input_values_config = get_step_value_input_config(prop['id'])
            
            # Filter previous extractions based on input configuration
            filtered_previous_data = filter_previous_data_by_input_config(previous_extractions, input_values_config)
            
            if extraction_type == 'FUNCTION' and prop.get('function_id'):
                # Route to function extraction with filtered data
                function_data = get_function_by_id(prop['function_id'])
                if function_data:
                    result = execute_function_extraction(function_data, documents, filtered_previous_data)
                    
                    if not result.get('error'):
                        results.append({
                            'field_id': field_id,
                            'field_name': f"{prop['collection_name']}.{prop['property_name']}",
                            'collection_name': prop['collection_name'],
                            'extraction_type': 'FUNCTION',
                            'extracted_value': result.get('extracted_value'),
                            'confidence_score': result.get('confidence_score', 95),
                            'reasoning': f"Function: {function_data['function_name']}"
                        })
                else:
                    print(f"⚠️ Function {prop['function_id']} not found")
            
            elif extraction_type == 'AI':
                # Route to AI extraction with tool-based architecture
                knowledge_docs = get_knowledge_documents(prop.get('knowledge_document_ids', []))
                
                # Get tool data if available
                tool_data = {}
                if prop.get('tool_id'):
                    tool_data = get_function_by_id(prop['tool_id']) or {}
                
                # Prepare value data from property
                value_data = {
                    'valueName': prop['property_name'],
                    'value_name': prop['property_name'],
                    'description': prop.get('description', ''),
                    'inputValues': input_values_config  # Include the inputValues configuration
                }
                
                # Prepare input data 
                input_data = {}
                
                # Add document content if available
                if documents:
                    input_data['document'] = documents[0].get('file_content', '')
                
                # Add filtered previous extractions as reference data
                if filtered_previous_data:
                    input_data['previous_data'] = filtered_previous_data
                
                result = execute_ai_extraction(tool_data, value_data, knowledge_docs, input_data)
                
                if not result.get('error'):
                    results.append({
                        'field_id': field_id,
                        'field_name': f"{prop['collection_name']}.{prop['property_name']}",
                        'collection_name': prop['collection_name'],
                        'extraction_type': 'AI',
                        'extracted_value': result.get('extracted_value'),
                        'confidence_score': result.get('confidence_score', 80),
                        'reasoning': result.get('reasoning', 'AI analysis')
                    })
        
        # Process schema fields
        for field in schema_fields:
            field_id = field['id']
            extraction_type = field.get('extraction_type', 'AI')
            
            print(f"\n🔄 Processing {field['field_name']} ({extraction_type})")
            
            # Get input values configuration if available
            input_values_config = {}
            if field.get('id'):
                # Try to get input configuration from step_values
                input_values_config = get_step_value_input_config(field['id'])
            
            # Filter previous extractions based on input configuration
            filtered_previous_data = filter_previous_data_by_input_config(previous_extractions, input_values_config)
            
            if extraction_type == 'FUNCTION' and field.get('function_id'):
                # Route to function extraction with filtered data
                function_data = get_function_by_id(field['function_id'])
                if function_data:
                    result = execute_function_extraction(function_data, documents, filtered_previous_data)
                    
                    if not result.get('error'):
                        results.append({
                            'field_id': field_id,
                            'field_name': field['field_name'],
                            'extraction_type': 'FUNCTION',
                            'extracted_value': result.get('extracted_value'),
                            'confidence_score': result.get('confidence_score', 95),
                            'reasoning': f"Function: {function_data['function_name']}"
                        })
            
            elif extraction_type == 'AI':
                # Route to AI extraction with tool-based architecture
                knowledge_docs = get_knowledge_documents(field.get('knowledge_document_ids', []))
                
                # Get tool data if available
                tool_data = {}
                if field.get('tool_id'):
                    tool_data = get_function_by_id(field['tool_id']) or {}
                
                # Prepare value data from field
                value_data = {
                    'valueName': field['field_name'],
                    'value_name': field['field_name'],
                    'description': field.get('description', ''),
                    'inputValues': input_values_config  # Include the inputValues configuration
                }
                
                # Prepare input data 
                input_data = {}
                
                # Add document content if available
                if documents:
                    input_data['document'] = documents[0].get('file_content', '')
                
                # Add filtered previous extractions as reference data
                if filtered_previous_data:
                    input_data['previous_data'] = filtered_previous_data
                
                result = execute_ai_extraction(tool_data, value_data, knowledge_docs, input_data)
                
                if not result.get('error'):
                    results.append({
                        'field_id': field_id,
                        'field_name': field['field_name'],
                        'extraction_type': 'AI',
                        'extracted_value': result.get('extracted_value'),
                        'confidence_score': result.get('confidence_score', 80),
                        'reasoning': result.get('reasoning', 'AI analysis')
                    })
        
        print(f"\n✅ ENHANCED EXTRACTION: Completed with {len(results)} results")
        
        return {
            'success': True,
            'field_validations': results,
            'total_processed': len(collection_properties) + len(schema_fields),
            'results_count': len(results)
        }
        
    except Exception as e:
        error_msg = f"Enhanced extraction failed: {str(e)}"
        print(f"❌ ENHANCED EXTRACTION ERROR: {error_msg}")
        return {
            'success': False,
            'error': error_msg
        }

def main():
    """Main entry point - handles both extraction and wizardry formats"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Handle legacy wizardry format
        if 'document_ids' in input_data and 'session_id' in input_data:
            print(f"DEBUG: Legacy wizardry format detected - processing with extraction_wizardry.py")
            # Route to original extraction_wizardry for compatibility
            from extraction_wizardry import run_wizardry
            
            # Call the original wizardry function
            run_wizardry(input_data, input_data.get('extraction_number', 0))
            
            # Return empty result since run_wizardry handles its own output
            return
        else:
            # Process modern extraction format
            result = process_enhanced_extraction(input_data)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f"Processing failed: {str(e)}"
        }
        print(json.dumps(error_result, indent=2))

if __name__ == '__main__':
    main()