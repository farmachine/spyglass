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

def generate_dynamic_ai_prompt(field_data: Dict[str, Any], knowledge_docs: List[Dict[str, Any]], 
                             extraction_rules: List[Dict[str, Any]], documents: List[Dict[str, Any]],
                             previous_extractions: Dict[str, Any]) -> str:
    """Generate dynamic AI prompt based on field configuration"""
    
    # Build context sections
    field_description = field_data.get('description', '')
    field_type = field_data.get('field_type') or field_data.get('property_type', 'TEXT')
    
    # Knowledge documents context
    knowledge_context = ""
    if knowledge_docs:
        knowledge_context = "\n\nKNOWLEDGE DOCUMENTS:\n"
        for doc in knowledge_docs:
            knowledge_context += f"- {doc['display_name'] or doc['file_name']}: {doc['description']}\n"
            knowledge_context += f"  Content: {doc['content'][:500]}...\n"
    
    # Extraction rules context
    rules_context = ""
    if extraction_rules:
        rules_context = "\n\nEXTRACTION RULES:\n"
        for rule in extraction_rules:
            rules_context += f"- {rule['rule_name']}: {rule['rule_content']}\n"
    
    # Previous extractions context
    previous_context = ""
    if previous_extractions:
        previous_context = "\n\nPREVIOUS EXTRACTIONS (for reference):\n"
        for key, data in previous_extractions.items():
            previous_context += f"- {data['field_name']}: {data['extracted_value']}\n"
    
    # Document summaries
    document_context = "\n\nSOURCE DOCUMENTS:\n"
    for doc in documents:
        content_preview = doc.get('file_content', '')[:300]
        document_context += f"- {doc['file_name']}: {content_preview}...\n"
    
    # Generate the prompt
    prompt = f"""
Extract the following field from the provided documents:

TARGET FIELD: {field_data.get('property_name') or field_data.get('field_name')}
FIELD TYPE: {field_type}
DESCRIPTION: {field_description}

{knowledge_context}
{rules_context}
{previous_context}
{document_context}

INSTRUCTIONS:
1. Extract the exact value for the target field based on the description and any rules provided
2. Use knowledge documents for validation and reference standards
3. Consider previous extractions for context and consistency
4. Return confidence score (0-100) based on certainty
5. Provide reasoning for your extraction

Return JSON format:
{{
    "extracted_value": "value found in documents",
    "confidence_score": 85,
    "reasoning": "explanation of how value was found and validated"
}}
"""
    
    return prompt

def execute_ai_extraction(field_data: Dict[str, Any], knowledge_docs: List[Dict[str, Any]], 
                        extraction_rules: List[Dict[str, Any]], documents: List[Dict[str, Any]],
                        previous_extractions: Dict[str, Any]) -> Dict[str, Any]:
    """Execute AI extraction with dynamic prompt"""
    try:
        # Get API key
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return {"error": "No API key found"}
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Generate dynamic prompt
        prompt = generate_dynamic_ai_prompt(field_data, knowledge_docs, extraction_rules, 
                                          documents, previous_extractions)
        
        print(f"🤖 AI EXTRACTION: Processing {field_data.get('property_name') or field_data.get('field_name')}")
        
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
            
            if extraction_type == 'FUNCTION' and prop.get('function_id'):
                # Route to function extraction
                function_data = get_function_by_id(prop['function_id'])
                if function_data:
                    result = execute_function_extraction(function_data, documents, previous_extractions)
                    
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
                # Route to AI extraction with dynamic prompt
                knowledge_docs = get_knowledge_documents(prop.get('knowledge_document_ids', []))
                extraction_rules = get_extraction_rules(prop.get('extraction_rule_ids', []))
                
                result = execute_ai_extraction(prop, knowledge_docs, extraction_rules, 
                                             documents, previous_extractions)
                
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
            
            if extraction_type == 'FUNCTION' and field.get('function_id'):
                # Route to function extraction
                function_data = get_function_by_id(field['function_id'])
                if function_data:
                    result = execute_function_extraction(function_data, documents, previous_extractions)
                    
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
                # Route to AI extraction with dynamic prompt
                knowledge_docs = get_knowledge_documents(field.get('knowledge_document_ids', []))
                extraction_rules = get_extraction_rules(field.get('extraction_rule_ids', []))
                
                result = execute_ai_extraction(field, knowledge_docs, extraction_rules, 
                                             documents, previous_extractions)
                
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
            print(f"DEBUG: Legacy wizardry format detected")
            # Convert to enhanced extraction format
            enhanced_data = {
                'session_id': input_data['session_id'],
                'project_id': None,  # Will need to be determined from session
                'documents': []  # Will need to fetch from document_ids
            }
            
            # For now, return a compatibility message
            result = {
                'success': True,
                'message': 'Enhanced processor received legacy wizardry call',
                'note': 'Use /api/sessions/:sessionId/extract for enhanced extraction',
                'legacy_data': input_data
            }
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